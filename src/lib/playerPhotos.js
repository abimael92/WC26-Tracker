const PHOTO_CACHE_STORAGE_KEY = 'wc26_player_photo_cache_v1';
const MANUAL_OVERRIDES_STORAGE_KEY = 'wc26_manual_player_card_overrides_v1';

const MANUAL_PLAYER_CARD_OVERRIDES = {
  // Example:
};

let runtimeManualOverridesCache = null;

const inMemoryPhotoCache = new Map();
const pendingBatchCache = new Map();
let pdfDocumentPromise = null;
let ocrWorkerPromise = null;
let pdfLibPromise = null;
let tesseractLibPromise = null;
let tesseractWorkerUrlPromise = null;

const ensurePdfLib = async () => {
  if (!pdfLibPromise) {
    pdfLibPromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]).then(([pdfjsLib, workerModule]) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;
      return pdfjsLib;
    });
  }

  return pdfLibPromise;
};

const ensureTesseractLib = async () => {
  if (!tesseractLibPromise) {
    tesseractLibPromise = import('tesseract.js');
  }
  return tesseractLibPromise;
};

const ensureTesseractWorkerUrl = async () => {
  if (!tesseractWorkerUrlPromise) {
    tesseractWorkerUrlPromise = import('tesseract.js/dist/worker.min.js?url').then((module) => module.default);
  }
  return tesseractWorkerUrlPromise;
};

const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const levenshteinDistance = (a, b) => {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i += 1) {
    for (let j = 1; j <= a.length; j += 1) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
};

const buildWordSet = (normalizedText) => new Set(String(normalizedText || '').split(' ').filter(Boolean));

const tokenMatchesFuzzy = (token, wordSet) => {
  if (!token || token.length < 3) return false;
  if (wordSet.has(token)) return true;

  for (const word of wordSet) {
    if (Math.abs(word.length - token.length) > 2) continue;
    const distance = levenshteinDistance(token, word);
    const allowedDistance = token.length >= 7 ? 2 : 1;
    if (distance <= allowedDistance) return true;
  }
  return false;
};

export const createPlayerPhotoKey = (player, team) => `${normalizeText(player)}__${normalizeText(team)}`;

const getStoredCache = () => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(PHOTO_CACHE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const getRuntimeManualOverrides = () => {
  if (runtimeManualOverridesCache) return runtimeManualOverridesCache;
  if (typeof window === 'undefined') {
    runtimeManualOverridesCache = {};
    return runtimeManualOverridesCache;
  }

  try {
    const raw = window.localStorage.getItem(MANUAL_OVERRIDES_STORAGE_KEY);
    if (!raw) {
      runtimeManualOverridesCache = {};
      return runtimeManualOverridesCache;
    }

    const parsed = JSON.parse(raw);
    runtimeManualOverridesCache = parsed && typeof parsed === 'object' ? parsed : {};
    return runtimeManualOverridesCache;
  } catch {
    runtimeManualOverridesCache = {};
    return runtimeManualOverridesCache;
  }
};

const getManualOverrideForKey = (key) => {
  const runtime = getRuntimeManualOverrides();
  return runtime[key] || MANUAL_PLAYER_CARD_OVERRIDES[key] || null;
};

export const setManualPlayerCardOverride = (player, team, override) => {
  const key = createPlayerPhotoKey(player, team);
  if (!key || !override || typeof override !== 'object') return false;

  const next = {
    ...getRuntimeManualOverrides(),
    [key]: { ...override },
  };

  runtimeManualOverridesCache = next;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(MANUAL_OVERRIDES_STORAGE_KEY, JSON.stringify(next));
    } catch {
      return false;
    }
  }

  return true;
};

export const clearManualPlayerCardOverrides = () => {
  runtimeManualOverridesCache = {};
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(MANUAL_OVERRIDES_STORAGE_KEY);
  }
};

const saveStoredCache = (cacheObject) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PHOTO_CACHE_STORAGE_KEY, JSON.stringify(cacheObject));
  } catch {
    // ignore storage failures
  }
};

export const getStoredPlayerPhotoMap = () => {
  const stored = getStoredCache();
  Object.entries(stored).forEach(([key, value]) => {
    if (typeof value === 'string' && value) {
      inMemoryPhotoCache.set(key, value);
    }
  });
  return stored;
};

const savePhotoToCaches = (key, photoDataUrl) => {
  if (!key || !photoDataUrl) return;
  inMemoryPhotoCache.set(key, photoDataUrl);
  const stored = getStoredCache();
  stored[key] = photoDataUrl;
  saveStoredCache(stored);
};

const ensurePdfDocument = async (pdfUrl) => {
  const pdfjs = await ensurePdfLib();
  const normalizedPdfUrl = String(pdfUrl || '').trim();
  if (!normalizedPdfUrl) {
    throw new Error('No se recibió la ruta del PDF.');
  }

  if (!pdfDocumentPromise) {
    pdfDocumentPromise = pdfjs.getDocument({ url: normalizedPdfUrl }).promise;
  }
  return pdfDocumentPromise;
};

const ensureOcrWorker = async () => {
  const [tesseractLib, workerPath] = await Promise.all([
    ensureTesseractLib(),
    ensureTesseractWorkerUrl(),
  ]);

  const createWorker = tesseractLib?.createWorker || tesseractLib?.default?.createWorker;
  if (typeof createWorker !== 'function') {
    throw new Error('No se pudo inicializar Tesseract (createWorker no disponible).');
  }

  if (!ocrWorkerPromise) {
    ocrWorkerPromise = createWorker('eng', 1, {
      logger: () => {},
      workerPath,
      workerBlobURL: false,
      errorHandler: () => {},
    }).then(async (worker) => {
      await worker.setParameters({
        tessedit_pageseg_mode: '6',
      });
      return worker;
    });
  }
  return ocrWorkerPromise;
};

const buildTargetDescriptor = (target) => {
  const player = String(target?.player || '').trim();
  const team = String(target?.team || '').trim();
  const key = createPlayerPhotoKey(player, team);
  const normalizedPlayer = normalizeText(player);
  const normalizedTeam = normalizeText(team);
  const playerTokens = normalizedPlayer.split(' ').filter((token) => token.length >= 2);
  const teamTokens = normalizedTeam.split(' ').filter((token) => token.length >= 2);
  const priorityPlayerToken = playerTokens[playerTokens.length - 1] || playerTokens[0] || '';

  return {
    key,
    player,
    team,
    normalizedPlayer,
    normalizedTeam,
    playerTokens,
    teamTokens,
    priorityPlayerToken,
  };
};

const lineHasPlayer = (normalizedLine, descriptor) => {
  if (!descriptor.normalizedPlayer) return false;
  if (normalizedLine.includes(descriptor.normalizedPlayer)) return true;
  if (descriptor.priorityPlayerToken && normalizedLine.includes(descriptor.priorityPlayerToken)) return true;

  const tokenHits = descriptor.playerTokens.filter((token) => normalizedLine.includes(token)).length;
  return tokenHits >= Math.min(2, descriptor.playerTokens.length);
};

const lineHasTeam = (normalizedLine, descriptor) => {
  if (!descriptor.normalizedTeam) return true;
  if (normalizedLine.includes(descriptor.normalizedTeam)) return true;
  return descriptor.teamTokens.some((token) => normalizedLine.includes(token));
};

const scoreTextMatch = (normalizedText, descriptor) => {
  if (!normalizedText) return 0;
  const wordSet = buildWordSet(normalizedText);

  let score = 0;
  if (descriptor.normalizedPlayer && normalizedText.includes(descriptor.normalizedPlayer)) {
    score += 8;
  }
  if (descriptor.priorityPlayerToken && normalizedText.includes(descriptor.priorityPlayerToken)) {
    score += 5;
  } else if (tokenMatchesFuzzy(descriptor.priorityPlayerToken, wordSet)) {
    score += 3;
  }

  descriptor.playerTokens.forEach((token) => {
    if (normalizedText.includes(token)) {
      score += 2;
      return;
    }
    if (tokenMatchesFuzzy(token, wordSet)) score += 1.25;
  });

  descriptor.teamTokens.forEach((token) => {
    if (normalizedText.includes(token) || tokenMatchesFuzzy(token, wordSet)) score += 0.5;
  });

  return score;
};

const findBestLine = (ocrLines, descriptor) => {
  const normalizedLines = (ocrLines || []).map((line) => ({
    line,
    normalized: normalizeText(line?.text || ''),
  }));

  const direct = normalizedLines.find(({ normalized }) => lineHasPlayer(normalized, descriptor) && lineHasTeam(normalized, descriptor));
  if (direct) return direct.line;

  const playerOnly = normalizedLines.find(({ normalized }) => lineHasPlayer(normalized, descriptor));
  return playerOnly?.line || null;
};

const findBestBbox = (ocrData, descriptor) => {
  const lines = Array.isArray(ocrData?.lines) ? ocrData.lines : [];
  const words = Array.isArray(ocrData?.words) ? ocrData.words : [];

  const lineCandidates = lines
    .map((line) => ({
      bbox: line?.bbox || null,
      score: scoreTextMatch(normalizeText(line?.text || ''), descriptor),
    }))
    .filter((item) => item.bbox && item.score > 0);

  const wordCandidates = words
    .map((word) => ({
      bbox: word?.bbox || null,
      score: scoreTextMatch(normalizeText(word?.text || ''), descriptor),
    }))
    .filter((item) => item.bbox && item.score > 0);

  const best = [...lineCandidates, ...wordCandidates].sort((a, b) => b.score - a.score)[0] || null;
  return best?.bbox || null;
};

const findBestTextCandidateFromOcrData = (ocrData, descriptor) => {
  const lines = Array.isArray(ocrData?.lines) ? ocrData.lines : [];
  const words = Array.isArray(ocrData?.words) ? ocrData.words : [];

  const candidates = [
    ...lines.map((line) => ({
      text: normalizeText(line?.text || ''),
      bbox: line?.bbox || null,
    })),
    ...words.map((word) => ({
      text: normalizeText(word?.text || ''),
      bbox: word?.bbox || null,
    })),
  ]
    .filter((item) => item.text && item.bbox)
    .map((item) => ({
      ...item,
      score: scoreTextMatch(item.text, descriptor),
    }))
    .sort((a, b) => b.score - a.score);

  return candidates[0] || null;
};

const findBestTextLayerLine = (lines, descriptor) => {
  const candidates = (Array.isArray(lines) ? lines : [])
    .map((line) => {
      const text = String(line?.text || '');
      const baseScore = scoreTextMatch(text, descriptor);
      const words = buildWordSet(text);
      const tokenScore = descriptor.playerTokens.reduce((acc, token) => (
        acc + (tokenMatchesFuzzy(token, words) ? 1.1 : 0)
      ), 0);

      return {
        text,
        bbox: line?.bbox || null,
        score: baseScore + tokenScore,
      };
    })
    .sort((a, b) => b.score - a.score);

  return candidates[0] || null;
};

const findDirectTextLayerTokenMatch = (items, descriptor) => {
  const list = Array.isArray(items) ? items : [];
  let best = null;

  list.forEach((item) => {
    const text = String(item?.text || '');
    if (!text) return;

    const words = buildWordSet(text);
    let score = 0;

    if (descriptor.priorityPlayerToken && (text.includes(descriptor.priorityPlayerToken) || tokenMatchesFuzzy(descriptor.priorityPlayerToken, words))) {
      score += 3;
    }

    descriptor.playerTokens.forEach((token) => {
      if (text.includes(token) || tokenMatchesFuzzy(token, words)) score += 1.2;
    });

    descriptor.teamTokens.forEach((token) => {
      if (text.includes(token) || tokenMatchesFuzzy(token, words)) score += 0.9;
    });

    if (score <= 0) return;
    if (!best || score > best.score) {
      best = {
        text,
        bbox: item?.bbox || null,
        score,
      };
    }
  });

  return best;
};

const findDirectTextLayerTokenMatchFromLines = (lines, descriptor) => {
  const list = Array.isArray(lines) ? lines : [];
  let best = null;

  list.forEach((line) => {
    const text = String(line?.text || '');
    if (!text) return;

    const words = buildWordSet(text);
    let score = 0;

    if (descriptor.priorityPlayerToken && (text.includes(descriptor.priorityPlayerToken) || tokenMatchesFuzzy(descriptor.priorityPlayerToken, words))) {
      score += 3.2;
    }

    descriptor.playerTokens.forEach((token) => {
      if (text.includes(token) || tokenMatchesFuzzy(token, words)) score += 1.4;
    });

    descriptor.teamTokens.forEach((token) => {
      if (text.includes(token) || tokenMatchesFuzzy(token, words)) score += 1;
    });

    if (score <= 0) return;
    if (!best || score > best.score) {
      best = {
        text,
        bbox: line?.bbox || null,
        score,
      };
    }
  });

  return best;
};

const createDebugPreviewFromBbox = (sourceCanvas, bbox) => {
  if (!bbox) return null;

  const padX = Math.max(8, Math.round(((bbox.x1 || 0) - (bbox.x0 || 0)) * 0.2));
  const padY = Math.max(8, Math.round(((bbox.y1 || 0) - (bbox.y0 || 0)) * 0.35));

  const crop = cropCanvasRegion(sourceCanvas, {
    x: (bbox.x0 || 0) - padX,
    y: (bbox.y0 || 0) - padY,
    width: ((bbox.x1 || 0) - (bbox.x0 || 0)) + (padX * 2),
    height: ((bbox.y1 || 0) - (bbox.y0 || 0)) + (padY * 2),
  });

  return crop ? crop.toDataURL('image/webp', 0.78) : null;
};

const isDescriptorLikelyInPage = (pageText, descriptor) => {
  const normalized = normalizeText(pageText || '');
  if (!normalized) return false;

  if (descriptor.normalizedPlayer && normalized.includes(descriptor.normalizedPlayer)) return true;
  if (descriptor.priorityPlayerToken && normalized.includes(descriptor.priorityPlayerToken)) return true;

  const wordSet = buildWordSet(normalized);
  if (tokenMatchesFuzzy(descriptor.priorityPlayerToken, wordSet)) return true;

  const playerHits = descriptor.playerTokens.filter((token) => tokenMatchesFuzzy(token, wordSet)).length;
  return playerHits >= Math.min(2, descriptor.playerTokens.length);
};

const buildTextLayerLines = (items) => {
  const sorted = [...(Array.isArray(items) ? items : [])].sort((a, b) => {
    const yDiff = (a?.bbox?.y0 || 0) - (b?.bbox?.y0 || 0);
    if (Math.abs(yDiff) > 10) return yDiff;
    return (a?.bbox?.x0 || 0) - (b?.bbox?.x0 || 0);
  });

  const lines = [];
  sorted.forEach((item) => {
    const y = item?.bbox?.y0 || 0;
    const line = lines.find((entry) => Math.abs((entry.y || 0) - y) <= 10);
    if (!line) {
      lines.push({
        y,
        parts: [item],
      });
      return;
    }
    line.parts.push(item);
  });

  return lines
    .map((line) => {
      const parts = [...line.parts].sort((a, b) => (a?.bbox?.x0 || 0) - (b?.bbox?.x0 || 0));
      const text = normalizeText(parts.map((part) => part.text).join(' '));
      if (!text) return null;

      const x0 = Math.min(...parts.map((part) => part?.bbox?.x0 || 0));
      const y0 = Math.min(...parts.map((part) => part?.bbox?.y0 || 0));
      const x1 = Math.max(...parts.map((part) => part?.bbox?.x1 || 0));
      const y1 = Math.max(...parts.map((part) => part?.bbox?.y1 || 0));

      return {
        text,
        bbox: { x0, y0, x1, y1 },
      };
    })
    .filter(Boolean);
};

const getTextLayerInfo = async (page) => {
  try {
    const viewport = page.getViewport({ scale: 2.6 });
    const textContent = await page.getTextContent();
    const items = Array.isArray(textContent?.items)
      ? textContent.items
          .map((item) => {
            const text = normalizeText(item?.str || '');
            if (!text) return null;

            const tx = Array.isArray(item?.transform) ? item.transform : [1, 0, 0, 1, 0, 0];
            const x = Number(tx[4] || 0) * 2.6;
            const yBase = Number(tx[5] || 0) * 2.6;
            const width = Math.max(16, Number(item?.width || 0) * 2.6);
            const height = Math.max(12, Number(item?.height || 0) * 2.6);

            const y = (viewport.height - yBase) - height;

            return {
              text,
              bbox: {
                x0: Math.max(0, x),
                y0: Math.max(0, y),
                x1: Math.max(0, x + width),
                y1: Math.max(0, y + height),
              },
            };
          })
          .filter(Boolean)
      : [];

    const lines = buildTextLayerLines(items);

    return {
      items,
      lines,
      joined: lines.map((line) => line.text).join(' '),
    };
  } catch {
    return {
      items: [],
      lines: [],
      joined: '',
    };
  }
};

const findBestTextLayerItem = (items, descriptor) => {
  const candidates = (Array.isArray(items) ? items : [])
    .map((item) => {
      const text = String(item?.text || '');
      const baseScore = scoreTextMatch(text, descriptor);
      const words = buildWordSet(text);
      const tokenScore = descriptor.playerTokens.reduce((acc, token) => (
        acc + (tokenMatchesFuzzy(token, words) ? 0.9 : 0)
      ), 0);

      return {
        text,
        bbox: item?.bbox || null,
        score: baseScore + tokenScore,
      };
    })
    .sort((a, b) => b.score - a.score);

  return candidates[0] || null;
};

const isDescriptorLikelyInTextLayer = (textLayerJoined, descriptor) => {
  if (!textLayerJoined) return false;
  if (descriptor.normalizedPlayer && textLayerJoined.includes(descriptor.normalizedPlayer)) return true;
  if (descriptor.priorityPlayerToken && textLayerJoined.includes(descriptor.priorityPlayerToken)) return true;

  const wordSet = buildWordSet(textLayerJoined);
  const playerHits = descriptor.playerTokens.filter((token) => tokenMatchesFuzzy(token, wordSet)).length;
  return playerHits >= Math.min(2, descriptor.playerTokens.length);
};

const preprocessCanvasForOcr = (sourceCanvas) => {
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = sourceCanvas.width;
  outputCanvas.height = sourceCanvas.height;

  const outputCtx = outputCanvas.getContext('2d', { willReadFrequently: true });
  if (!outputCtx) return sourceCanvas;

  outputCtx.drawImage(sourceCanvas, 0, 0);
  const imageData = outputCtx.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const gray = Math.round((r * 0.3) + (g * 0.59) + (b * 0.11));
    const boosted = gray < 140 ? 0 : 255;
    data[i] = boosted;
    data[i + 1] = boosted;
    data[i + 2] = boosted;
  }

  outputCtx.putImageData(imageData, 0, 0);
  return outputCanvas;
};

const detectStickerCards = (sourceCanvas) => {
  const maxSide = 1100;
  const scale = Math.min(1, maxSide / Math.max(sourceCanvas.width, sourceCanvas.height));
  const downW = Math.max(1, Math.round(sourceCanvas.width * scale));
  const downH = Math.max(1, Math.round(sourceCanvas.height * scale));

  const downCanvas = document.createElement('canvas');
  downCanvas.width = downW;
  downCanvas.height = downH;
  const downCtx = downCanvas.getContext('2d', { willReadFrequently: true });
  if (!downCtx) return [];

  downCtx.drawImage(sourceCanvas, 0, 0, downW, downH);
  const { data } = downCtx.getImageData(0, 0, downW, downH);

  let sampleCount = 0;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  const borderStep = 4;

  for (let x = 0; x < downW; x += borderStep) {
    const topIdx = (x * 4);
    const bottomIdx = (((downH - 1) * downW + x) * 4);
    sumR += data[topIdx] + data[bottomIdx];
    sumG += data[topIdx + 1] + data[bottomIdx + 1];
    sumB += data[topIdx + 2] + data[bottomIdx + 2];
    sampleCount += 2;
  }
  for (let y = 0; y < downH; y += borderStep) {
    const leftIdx = ((y * downW) * 4);
    const rightIdx = (((y * downW) + (downW - 1)) * 4);
    sumR += data[leftIdx] + data[rightIdx];
    sumG += data[leftIdx + 1] + data[rightIdx + 1];
    sumB += data[leftIdx + 2] + data[rightIdx + 2];
    sampleCount += 2;
  }

  const bgR = sampleCount ? (sumR / sampleCount) : 220;
  const bgG = sampleCount ? (sumG / sampleCount) : 220;
  const bgB = sampleCount ? (sumB / sampleCount) : 220;

  const mask = new Uint8Array(downW * downH);
  for (let y = 0; y < downH; y += 1) {
    for (let x = 0; x < downW; x += 1) {
      const idx = ((y * downW) + x) * 4;
      const dr = data[idx] - bgR;
      const dg = data[idx + 1] - bgG;
      const db = data[idx + 2] - bgB;
      const distance = Math.sqrt((dr * dr) + (dg * dg) + (db * db));
      if (distance > 46) {
        mask[(y * downW) + x] = 1;
      }
    }
  }

  const visited = new Uint8Array(downW * downH);
  const boxes = [];
  const queueX = [];
  const queueY = [];

  for (let y = 0; y < downH; y += 1) {
    for (let x = 0; x < downW; x += 1) {
      const start = (y * downW) + x;
      if (!mask[start] || visited[start]) continue;

      let head = 0;
      queueX.length = 0;
      queueY.length = 0;
      queueX.push(x);
      queueY.push(y);
      visited[start] = 1;

      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let area = 0;

      while (head < queueX.length) {
        const cx = queueX[head];
        const cy = queueY[head];
        head += 1;
        area += 1;

        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);

        const neighbors = [
          [cx + 1, cy],
          [cx - 1, cy],
          [cx, cy + 1],
          [cx, cy - 1],
        ];

        for (const [nx, ny] of neighbors) {
          if (nx < 0 || ny < 0 || nx >= downW || ny >= downH) continue;
          const nIndex = (ny * downW) + nx;
          if (!mask[nIndex] || visited[nIndex]) continue;
          visited[nIndex] = 1;
          queueX.push(nx);
          queueY.push(ny);
        }
      }

      const boxW = (maxX - minX) + 1;
      const boxH = (maxY - minY) + 1;
      const aspect = boxH / Math.max(1, boxW);
      const fillRatio = area / Math.max(1, boxW * boxH);
      const minArea = downW * downH * 0.008;

      if (area < minArea) continue;
      if (aspect < 1.15 || aspect > 2.4) continue;
      if (fillRatio < 0.35) continue;

      boxes.push({ x: minX, y: minY, width: boxW, height: boxH, area });
    }
  }

  const merged = [];
  const sorted = boxes.sort((a, b) => b.area - a.area);
  sorted.forEach((box) => {
    const overlap = merged.find((existing) => {
      const x0 = Math.max(existing.x, box.x);
      const y0 = Math.max(existing.y, box.y);
      const x1 = Math.min(existing.x + existing.width, box.x + box.width);
      const y1 = Math.min(existing.y + existing.height, box.y + box.height);
      if (x1 <= x0 || y1 <= y0) return false;
      const inter = (x1 - x0) * (y1 - y0);
      const union = (existing.width * existing.height) + (box.width * box.height) - inter;
      return (inter / Math.max(1, union)) > 0.36;
    });

    if (!overlap) {
      merged.push(box);
    }
  });

  return merged
    .slice(0, 24)
    .map((box) => ({
      x: Math.round(box.x / scale),
      y: Math.round(box.y / scale),
      width: Math.round(box.width / scale),
      height: Math.round(box.height / scale),
    }));
};

const buildGridCardBoxes = (sourceCanvas) => {
  const templates = [
    { cols: 3, rows: 4, marginX: 0.04, marginY: 0.04, gapX: 0.02, gapY: 0.02 },
    { cols: 4, rows: 4, marginX: 0.03, marginY: 0.04, gapX: 0.015, gapY: 0.02 },
    { cols: 3, rows: 3, marginX: 0.05, marginY: 0.05, gapX: 0.02, gapY: 0.025 },
    { cols: 2, rows: 3, marginX: 0.08, marginY: 0.06, gapX: 0.03, gapY: 0.03 },
  ];

  const all = [];
  templates.forEach((template) => {
    const availW = sourceCanvas.width * (1 - (template.marginX * 2));
    const availH = sourceCanvas.height * (1 - (template.marginY * 2));
    const cardW = (availW - ((template.cols - 1) * availW * template.gapX)) / template.cols;
    const cardH = (availH - ((template.rows - 1) * availH * template.gapY)) / template.rows;

    if (cardW < 80 || cardH < 120) return;
    const aspect = cardH / cardW;
    if (aspect < 1.2 || aspect > 2.2) return;

    const gapXpx = (availW * template.gapX);
    const gapYpx = (availH * template.gapY);
    const startX = sourceCanvas.width * template.marginX;
    const startY = sourceCanvas.height * template.marginY;

    for (let row = 0; row < template.rows; row += 1) {
      for (let col = 0; col < template.cols; col += 1) {
        const x = startX + (col * (cardW + gapXpx));
        const y = startY + (row * (cardH + gapYpx));
        all.push({ x, y, width: cardW, height: cardH });
      }
    }
  });

  return all;
};

const combineCardBoxes = (detectedBoxes, gridBoxes) => {
  const merged = [...(detectedBoxes || [])];

  (gridBoxes || []).forEach((candidate) => {
    const overlapsExisting = merged.some((box) => {
      const x0 = Math.max(box.x, candidate.x);
      const y0 = Math.max(box.y, candidate.y);
      const x1 = Math.min(box.x + box.width, candidate.x + candidate.width);
      const y1 = Math.min(box.y + box.height, candidate.y + candidate.height);
      if (x1 <= x0 || y1 <= y0) return false;
      const inter = (x1 - x0) * (y1 - y0);
      const union = (box.width * box.height) + (candidate.width * candidate.height) - inter;
      return (inter / Math.max(1, union)) > 0.45;
    });

    if (!overlapsExisting) merged.push(candidate);
  });

  return merged.slice(0, 40);
};

const buildForcedProbeBoxes = (sourceCanvas) => {
  const cols = 3;
  const rows = 8;
  const marginX = sourceCanvas.width * 0.04;
  const marginY = sourceCanvas.height * 0.03;
  const availW = sourceCanvas.width - (marginX * 2);
  const availH = sourceCanvas.height - (marginY * 2);
  const cellW = availW / cols;
  const cellH = availH / rows;

  const boxes = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      boxes.push({
        x: marginX + (c * cellW),
        y: marginY + (r * cellH),
        width: cellW,
        height: cellH,
      });
    }
  }

  return boxes;
};

const cropCanvasRegion = (sourceCanvas, box) => {
  const x = clamp(Math.round(box.x), 0, sourceCanvas.width - 1);
  const y = clamp(Math.round(box.y), 0, sourceCanvas.height - 1);
  const maxWidth = Math.max(1, sourceCanvas.width - x);
  const maxHeight = Math.max(1, sourceCanvas.height - y);
  const width = clamp(Math.round(box.width), 1, maxWidth);
  const height = clamp(Math.round(box.height), 1, maxHeight);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(sourceCanvas, x, y, width, height, 0, 0, width, height);
  return canvas;
};

const getCardNameStripBox = (cardBox) => ({
  x: cardBox.x + (cardBox.width * 0.08),
  y: cardBox.y + (cardBox.height * 0.80),
  width: cardBox.width * 0.84,
  height: cardBox.height * 0.14,
});

const getCardNameStripBoxVariants = (cardBox) => [
  getCardNameStripBox(cardBox),
  {
    x: cardBox.x + (cardBox.width * 0.08),
    y: cardBox.y + (cardBox.height * 0.75),
    width: cardBox.width * 0.84,
    height: cardBox.height * 0.17,
  },
  {
    x: cardBox.x + (cardBox.width * 0.06),
    y: cardBox.y + (cardBox.height * 0.70),
    width: cardBox.width * 0.88,
    height: cardBox.height * 0.22,
  },
];

const extractCardTexts = async (worker, sourceCanvas, cardBox) => {
  const variants = getCardNameStripBoxVariants(cardBox);
  const texts = [];

  for (const variant of variants) {
    const strip = cropCanvasRegion(sourceCanvas, variant);
    if (!strip) continue;

    const preprocessed = preprocessCanvasForOcr(strip);
    const { data } = await worker.recognize(preprocessed);
    const text = normalizeText(data?.text || '');
    texts.push({
      text: text || '[sin texto ocr]',
      previewImage: strip.toDataURL('image/webp', 0.78),
    });
  }

  const fullCard = cropCanvasRegion(sourceCanvas, cardBox);
  if (fullCard) {
    const preprocessedCard = preprocessCanvasForOcr(fullCard);
    const { data: cardData } = await worker.recognize(preprocessedCard);
    const cardText = normalizeText(cardData?.text || '');
    texts.push({
      text: cardText || '[sin texto ocr]',
      previewImage: fullCard.toDataURL('image/webp', 0.72),
    });
  }

  return texts;
};

const createFaceCropFromCardBox = (sourceCanvas, cardBox) => {
  const cropX = cardBox.x + (cardBox.width * 0.15);
  const cropY = cardBox.y + (cardBox.height * 0.10);
  const cropWidth = cardBox.width * 0.68;
  const cropHeight = cardBox.height * 0.66;

  const faceCanvas = cropCanvasRegion(sourceCanvas, {
    x: cropX,
    y: cropY,
    width: cropWidth,
    height: cropHeight,
  });
  if (!faceCanvas) return null;

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = 72;
  outputCanvas.height = 72;
  const outCtx = outputCanvas.getContext('2d');
  if (!outCtx) return null;

  outCtx.save();
  outCtx.beginPath();
  outCtx.arc(36, 36, 36, 0, Math.PI * 2);
  outCtx.closePath();
  outCtx.clip();
  outCtx.drawImage(faceCanvas, 0, 0, faceCanvas.width, faceCanvas.height, 0, 0, 72, 72);
  outCtx.restore();

  return outputCanvas.toDataURL('image/webp', 0.85);
};

const findBestDescriptorForCardText = (cardText, descriptorList) => {
  let best = null;

  descriptorList.forEach((descriptor) => {
    const score = scoreTextMatch(cardText, descriptor);
    if (!best || score > best.score) {
      best = { descriptor, score };
    }
  });

  return best && best.score >= 2.2 ? best : null;
};

const findBestDescriptorForCardTexts = (cardTexts, descriptorList) => {
  let best = null;

  (cardTexts || []).forEach((entry) => {
    if (!entry?.text) return;
    const candidate = findBestDescriptorForCardText(entry.text, descriptorList);
    if (!candidate) return;
    if (!best || candidate.score > best.score) {
      best = { ...candidate, text: entry.text, previewImage: entry.previewImage || null };
    }
  });

  return best;
};

const getManualOverrideBox = (canvas, override) => {
  if (!override) return null;

  const cols = Math.max(1, Number(override.cols) || 3);
  const rows = Math.max(1, Number(override.rows) || 4);
  const row = Math.max(0, Number(override.row) || 0);
  const col = Math.max(0, Number(override.col) || 0);

  const marginX = Number.isFinite(Number(override.marginX)) ? Number(override.marginX) : 0.04;
  const marginY = Number.isFinite(Number(override.marginY)) ? Number(override.marginY) : 0.04;
  const gapX = Number.isFinite(Number(override.gapX)) ? Number(override.gapX) : 0.02;
  const gapY = Number.isFinite(Number(override.gapY)) ? Number(override.gapY) : 0.02;

  const availW = canvas.width * (1 - (marginX * 2));
  const availH = canvas.height * (1 - (marginY * 2));
  const gapXpx = availW * gapX;
  const gapYpx = availH * gapY;

  const cardW = (availW - ((cols - 1) * gapXpx)) / cols;
  const cardH = (availH - ((rows - 1) * gapYpx)) / rows;
  if (cardW <= 0 || cardH <= 0) return null;

  const safeCol = Math.min(cols - 1, col);
  const safeRow = Math.min(rows - 1, row);

  return {
    x: (canvas.width * marginX) + (safeCol * (cardW + gapXpx)),
    y: (canvas.height * marginY) + (safeRow * (cardH + gapYpx)),
    width: cardW,
    height: cardH,
  };
};

const getManualOverrideCandidateBoxes = (canvas, override) => {
  if (!override) return [];

  const cols = Math.max(1, Number(override.cols) || 3);
  const rows = Math.max(1, Number(override.rows) || 4);
  const targetRow = Math.max(0, Number(override.row) || 0);
  const targetCol = Math.max(0, Number(override.col) || 0);

  const marginX = Number.isFinite(Number(override.marginX)) ? Number(override.marginX) : 0.04;
  const marginY = Number.isFinite(Number(override.marginY)) ? Number(override.marginY) : 0.04;
  const gapX = Number.isFinite(Number(override.gapX)) ? Number(override.gapX) : 0.02;
  const gapY = Number.isFinite(Number(override.gapY)) ? Number(override.gapY) : 0.02;

  const availW = canvas.width * (1 - (marginX * 2));
  const availH = canvas.height * (1 - (marginY * 2));
  const gapXpx = availW * gapX;
  const gapYpx = availH * gapY;

  const cardW = (availW - ((cols - 1) * gapXpx)) / cols;
  const cardH = (availH - ((rows - 1) * gapYpx)) / rows;
  if (cardW <= 0 || cardH <= 0) return [];

  const boxes = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      boxes.push({
        x: (canvas.width * marginX) + (col * (cardW + gapXpx)),
        y: (canvas.height * marginY) + (row * (cardH + gapYpx)),
        width: cardW,
        height: cardH,
        distance: Math.abs(row - targetRow) + Math.abs(col - targetCol),
      });
    }
  }

  return boxes.sort((a, b) => a.distance - b.distance);
};

const createFaceCrop = (sourceCanvas, lineBbox) => {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  const lineWidth = Math.max(20, (lineBbox?.x1 || 0) - (lineBbox?.x0 || 0));

  const cropWidth = clamp(Math.round(lineWidth * 1.9), 130, Math.round(width * 0.55));
  const cropHeight = clamp(Math.round(cropWidth * 1.28), 150, Math.round(height * 0.7));

  const centerX = Math.round(((lineBbox?.x0 || 0) + (lineBbox?.x1 || 0)) / 2);
  let cropX = clamp(centerX - Math.round(cropWidth / 2), 0, Math.max(0, width - cropWidth));

  const lineYTop = Math.max(0, Math.round(lineBbox?.y0 || 0));
  let cropY = lineYTop - cropHeight - 14;
  if (cropY < 0) {
    cropY = clamp(lineYTop - Math.round(cropHeight * 0.75), 0, Math.max(0, height - cropHeight));
  }

  if (cropX + cropWidth > width) cropX = Math.max(0, width - cropWidth);
  if (cropY + cropHeight > height) cropY = Math.max(0, height - cropHeight);

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = 72;
  outputCanvas.height = 72;

  const ctx = outputCanvas.getContext('2d');
  if (!ctx) return null;

  ctx.save();
  ctx.beginPath();
  ctx.arc(36, 36, 36, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(sourceCanvas, cropX, cropY, cropWidth, cropHeight, 0, 0, 72, 72);
  ctx.restore();

  return outputCanvas.toDataURL('image/webp', 0.8);
};

const renderPageToCanvas = async (page, scale = 2.6) => {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);

  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
};

export const extractPlayerPhotosFromPdf = async ({
  pdfUrl,
  targets,
  maxPages = null,
  onProgress,
}) => {
  const descriptors = (Array.isArray(targets) ? targets : [])
    .map(buildTargetDescriptor)
    .filter((descriptor) => descriptor.key && descriptor.player);

  if (!descriptors.length) {
    return { found: {}, missingKeys: [], debugByKey: {} };
  }

  const batchKey = `${pdfUrl}::${descriptors.map((item) => item.key).sort().join('|')}`;
  if (pendingBatchCache.has(batchKey)) {
    return pendingBatchCache.get(batchKey);
  }

  const taskPromise = (async () => {
    const found = {};
    const debugByKey = {};
    const unresolved = new Map(descriptors.map((descriptor) => [descriptor.key, descriptor]));

    const pushDebugCandidate = (key, candidate) => {
      if (!key || !candidate?.text) return;
      if (!debugByKey[key]) debugByKey[key] = [];
      if (debugByKey[key].some((item) => item.page === candidate.page && item.text === candidate.text && item.matchType === candidate.matchType)) return;

      if ((candidate.matchType === 'pdf-text' || candidate.matchType === 'ocr') && debugByKey[key].length) {
        debugByKey[key] = debugByKey[key].filter((item) => item.matchType !== 'base');
      }

      if (debugByKey[key].length >= 6) return;
      debugByKey[key].push(candidate);
    };

    const pdf = await ensurePdfDocument(pdfUrl);
    const worker = await ensureOcrWorker();

    const pagesByOverride = new Map();
    for (const descriptor of unresolved.values()) {
      const override = getManualOverrideForKey(descriptor.key);
      const page = Number(override?.page);
      if (!Number.isFinite(page) || page < 1 || page > pdf.numPages) continue;
      if (!pagesByOverride.has(page)) pagesByOverride.set(page, []);
      pagesByOverride.get(page).push({ descriptor, override });
    }

    for (const [pageNumber, items] of pagesByOverride.entries()) {
      if (!unresolved.size) break;

      const page = await pdf.getPage(pageNumber);
      const canvas = await renderPageToCanvas(page);
      if (!canvas) continue;

      for (const item of items) {
        if (!unresolved.has(item.descriptor.key)) continue;

        const candidateBoxes = getManualOverrideCandidateBoxes(canvas, item.override);
        let bestCandidate = null;

        for (const cardBox of candidateBoxes) {
          const cardTexts = await extractCardTexts(worker, canvas, cardBox);
          if (!cardTexts.length) continue;

          const bestMatch = findBestDescriptorForCardTexts(cardTexts, [item.descriptor]);
          if (!bestMatch) continue;

          if (!bestCandidate || bestMatch.score > bestCandidate.score) {
            bestCandidate = {
              cardBox,
              text: bestMatch.text || cardTexts[0]?.text || '[manual]',
              score: bestMatch.score,
            };
          }

          if (bestMatch.score >= 2.2) break;
        }

        const cardBox = bestCandidate?.cardBox || getManualOverrideBox(canvas, item.override);
        if (!cardBox) continue;

        const previewBox = getCardNameStripBox(cardBox);
        pushDebugCandidate(item.descriptor.key, {
          page: pageNumber,
          text: bestCandidate ? `[manual] ${bestCandidate.text}` : '[manual] override configurado para este jugador',
          score: Number.isFinite(Number(bestCandidate?.score)) ? Number(bestCandidate.score.toFixed(2)) : 999,
          previewImage: createDebugPreviewFromBbox(canvas, cardBox) || createDebugPreviewFromBbox(canvas, previewBox),
          bbox: previewBox,
          matchType: 'manual',
        });

        const photoData = createFaceCropFromCardBox(canvas, cardBox);
        if (!photoData) continue;

        found[item.descriptor.key] = photoData;
        savePhotoToCaches(item.descriptor.key, photoData);
        unresolved.delete(item.descriptor.key);
      }
    }

    if (!unresolved.size) {
      return {
        found,
        missingKeys: [],
        debugByKey,
      };
    }

    const pagesToScan = Math.min(Number.isFinite(Number(maxPages)) ? Number(maxPages) : pdf.numPages, pdf.numPages);

    for (let pageIndex = 1; pageIndex <= pagesToScan; pageIndex += 1) {
      if (!unresolved.size) break;

      const page = await pdf.getPage(pageIndex);
      const textLayerInfo = await getTextLayerInfo(page);
      const canvas = await renderPageToCanvas(page);
      if (!canvas) continue;

      const ocrCanvas = preprocessCanvasForOcr(canvas);
      const { data } = await worker.recognize(ocrCanvas);
      const pageText = normalizeText(data?.text || '');
      const lines = Array.isArray(data?.lines) ? data.lines : [];
      let rawOcrData = null;

      for (const descriptor of unresolved.values()) {
        if (debugByKey[descriptor.key]?.length >= 6) continue;

        const bestOcrCandidate = findBestTextCandidateFromOcrData(data, descriptor);
        const bestOcrLine = findBestLine(lines, descriptor);
        const targetBbox = bestOcrLine?.bbox || bestOcrCandidate?.bbox || findBestBbox(data, descriptor);
        const ocrScore = Math.max(
          Number(bestOcrCandidate?.score || 0),
          bestOcrLine ? scoreTextMatch(normalizeText(bestOcrLine.text || ''), descriptor) : 0
        );

        if (ocrScore <= 0.2 || !targetBbox) continue;

        pushDebugCandidate(descriptor.key, {
          page: pageIndex,
          text: `[ocr-page] ${(bestOcrLine?.text || bestOcrCandidate?.text || '')}`.trim(),
          score: Number(ocrScore.toFixed(2)),
          previewImage: createDebugPreviewFromBbox(canvas, targetBbox),
          bbox: targetBbox,
          matchType: 'ocr',
        });

        const photoData = createFaceCrop(canvas, targetBbox);
        if (!photoData) continue;

        found[descriptor.key] = photoData;
        savePhotoToCaches(descriptor.key, photoData);
        unresolved.delete(descriptor.key);
      }

      if (!unresolved.size) {
        if (typeof onProgress === 'function') {
          onProgress({
            pageIndex,
            pagesToScan,
            resolved: descriptors.length,
            total: descriptors.length,
          });
        }
        break;
      }

      const cardBoxes = combineCardBoxes(detectStickerCards(canvas), buildGridCardBoxes(canvas));
      const probeBoxes = cardBoxes.length ? cardBoxes : buildForcedProbeBoxes(canvas);
      if (probeBoxes.length) {
        for (const cardBox of probeBoxes) {
          if (!unresolved.size) break;

          const cardTexts = await extractCardTexts(worker, canvas, cardBox);
          if (!cardTexts.length) continue;

          for (const descriptor of unresolved.values()) {
            let bestForDescriptor = null;
            cardTexts.forEach((entry) => {
              const score = scoreTextMatch(entry.text, descriptor);
              if (!bestForDescriptor || score > bestForDescriptor.score) {
                bestForDescriptor = { entry, score };
              }
            });

            if (bestForDescriptor) {
              pushDebugCandidate(descriptor.key, {
                page: pageIndex,
                text: bestForDescriptor.entry.text,
                score: Number(bestForDescriptor.score.toFixed(2)),
                previewImage: bestForDescriptor.entry.previewImage || null,
                bbox: cardBox,
                matchType: 'probe',
              });
            }
          }

              found[item.descriptor.key] = photoData;
              savePhotoToCaches(item.descriptor.key, photoData);
              unresolved.delete(item.descriptor.key);
          const photoData = createFaceCropFromCardBox(canvas, cardBox);
          if (!photoData) continue;

          found[bestMatch.descriptor.key] = photoData;
          savePhotoToCaches(bestMatch.descriptor.key, photoData);
          unresolved.delete(bestMatch.descriptor.key);
        }
      }

      if (!unresolved.size) {
        if (typeof onProgress === 'function') {
          onProgress({
            pageIndex,
            pagesToScan,
            resolved: descriptors.length,
            total: descriptors.length,
          });
        }
        break;
      }

      for (const descriptor of unresolved.values()) {
        if (debugByKey[descriptor.key]?.length >= 6) continue;

        const directLineMatch = findDirectTextLayerTokenMatchFromLines(textLayerInfo.lines, descriptor);
        if (directLineMatch) {
          pushDebugCandidate(descriptor.key, {
            page: pageIndex,
            text: `[pdf-line] ${directLineMatch.text}`,
            score: Number(directLineMatch.score.toFixed(2)),
            previewImage: directLineMatch.bbox ? createDebugPreviewFromBbox(canvas, directLineMatch.bbox) : null,
            bbox: directLineMatch.bbox || null,
            matchType: 'pdf-text',
          });
          continue;
        }

        const directTextLayerMatch = findDirectTextLayerTokenMatch(textLayerInfo.items, descriptor);
        if (directTextLayerMatch) {
          pushDebugCandidate(descriptor.key, {
            page: pageIndex,
            text: `[pdf-token] ${directTextLayerMatch.text}`,
            score: Number(directTextLayerMatch.score.toFixed(2)),
            previewImage: directTextLayerMatch.bbox ? createDebugPreviewFromBbox(canvas, directTextLayerMatch.bbox) : null,
            bbox: directTextLayerMatch.bbox || null,
            matchType: 'pdf-text',
          });
          continue;
        }

        const bestTextLayerLine = findBestTextLayerLine(textLayerInfo.lines, descriptor);
        if (bestTextLayerLine && bestTextLayerLine.score > 0) {
          pushDebugCandidate(descriptor.key, {
            page: pageIndex,
            text: `[pdf-line-best] ${bestTextLayerLine.text}`,
            score: Number(bestTextLayerLine.score.toFixed(2)),
            previewImage: bestTextLayerLine.bbox ? createDebugPreviewFromBbox(canvas, bestTextLayerLine.bbox) : null,
            bbox: bestTextLayerLine.bbox || null,
            matchType: 'pdf-text',
          });
          continue;
        }

        const bestTextLayerItem = findBestTextLayerItem(textLayerInfo.items, descriptor);
        if (!bestTextLayerItem || bestTextLayerItem.score <= 0) continue;

        pushDebugCandidate(descriptor.key, {
          page: pageIndex,
          text: `[pdf-text] ${bestTextLayerItem.text}`,
          score: Number(bestTextLayerItem.score.toFixed(2)),
          previewImage: bestTextLayerItem.bbox ? createDebugPreviewFromBbox(canvas, bestTextLayerItem.bbox) : null,
          bbox: bestTextLayerItem.bbox || null,
          matchType: 'pdf-text',
        });
      }

      for (const descriptor of unresolved.values()) {
        if (debugByKey[descriptor.key]?.length >= 6) continue;

        const bestTextCandidate = findBestTextCandidateFromOcrData(data, descriptor);
        if (bestTextCandidate && bestTextCandidate.score > 0.2) {
          pushDebugCandidate(descriptor.key, {
            page: pageIndex,
            text: `[ocr] ${bestTextCandidate.text}`,
            score: Number(bestTextCandidate.score.toFixed(2)),
            previewImage: bestTextCandidate.bbox ? createDebugPreviewFromBbox(canvas, bestTextCandidate.bbox) : null,
            bbox: bestTextCandidate.bbox || null,
            matchType: 'ocr',
          });
          continue;
        }

        if (!rawOcrData) {
          try {
            const rawResult = await worker.recognize(canvas);
            rawOcrData = rawResult?.data || null;
          } catch {
            rawOcrData = null;
          }
        }

        const bestRawCandidate = findBestTextCandidateFromOcrData(rawOcrData, descriptor);
        if (bestRawCandidate && bestRawCandidate.score > 0.2) {
          pushDebugCandidate(descriptor.key, {
            page: pageIndex,
            text: `[ocr-raw] ${bestRawCandidate.text}`,
            score: Number(bestRawCandidate.score.toFixed(2)),
            previewImage: bestRawCandidate.bbox ? createDebugPreviewFromBbox(canvas, bestRawCandidate.bbox) : null,
            bbox: bestRawCandidate.bbox || null,
            matchType: 'ocr',
          });
          continue;
        }

        pushDebugCandidate(descriptor.key, {
          page: pageIndex,
          text: '[sin coincidencias reales de texto en esta página]',
          score: 0,
          previewImage: null,
          bbox: null,
          matchType: 'none',
        });
      }

      for (const [key, descriptor] of unresolved.entries()) {
        const playerTextDetected =
          isDescriptorLikelyInTextLayer(textLayerInfo.joined, descriptor) ||
          isDescriptorLikelyInPage(pageText, descriptor);
        if (!playerTextDetected) continue;

        const line = findBestLine(lines, descriptor);
        const targetBbox = line?.bbox || findBestBbox(data, descriptor);
        if (!targetBbox) continue;

        const photoData = createFaceCrop(canvas, targetBbox);
        if (!photoData) continue;

        found[key] = photoData;
        savePhotoToCaches(key, photoData);
        unresolved.delete(key);
      }

      if (typeof onProgress === 'function') {
        onProgress({
          pageIndex,
          pagesToScan,
          resolved: descriptors.length - unresolved.size,
          total: descriptors.length,
        });
      }
    }

    return {
      found,
      missingKeys: [...unresolved.keys()],
      debugByKey,
    };
  })();

  pendingBatchCache.set(batchKey, taskPromise);

  try {
    return await taskPromise;
  } finally {
    pendingBatchCache.delete(batchKey);
  }
};

export const getPlayerPhotoFromCache = (player, team) => {
  const key = createPlayerPhotoKey(player, team);
  if (!key) return null;

  if (inMemoryPhotoCache.has(key)) {
    return inMemoryPhotoCache.get(key);
  }

  const stored = getStoredCache();
  const photo = stored[key] || null;
  if (photo) {
    inMemoryPhotoCache.set(key, photo);
  }
  return photo;
};

export const clearPlayerPhotoCache = async () => {
  inMemoryPhotoCache.clear();
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(PHOTO_CACHE_STORAGE_KEY);
  }

  if (ocrWorkerPromise) {
    try {
      const worker = await ocrWorkerPromise;
      await worker.terminate();
    } catch {
      // ignore
    } finally {
      ocrWorkerPromise = null;
    }
  }
};
