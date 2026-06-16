import { collection, doc, getDocs, orderBy, query, setDoc } from 'firebase/firestore';
import { firestoreDb, isFirebaseConfigured } from './firebase';

const LIVE_SCORES_COLLECTION = 'wc26_live_scores';

export const PROVIDED_LIVE_SCORES = [
  {
    matchId: 1,
    group: 'A',
    homeTeam: 'Mexico',
    awayTeam: 'South Africa',
    homeScore: 2,
    awayScore: 0,
    status: 'FT',
    goals: [
      { team: 'Mexico', player: 'Julian Quinones' },
      { team: 'Mexico', player: 'Raul Jimenez' },
    ],
  },
  { matchId: 2, group: 'A', homeTeam: 'South Korea', awayTeam: 'Czechia', homeScore: 2, awayScore: 1, status: 'FT', goals: [] },
  {
    matchId: 3,
    group: 'B',
    homeTeam: 'Canada',
    awayTeam: 'Bosnia and Herzegovina',
    homeScore: 1,
    awayScore: 1,
    status: 'FT',
    goals: [],
  },
  { matchId: 4, group: 'D', homeTeam: 'United States', awayTeam: 'Paraguay', homeScore: 4, awayScore: 1, status: 'FT', goals: [] },
  { matchId: 5, group: 'B', homeTeam: 'Qatar', awayTeam: 'Switzerland', homeScore: 1, awayScore: 1, status: 'FT', goals: [] },
  { matchId: 6, group: 'C', homeTeam: 'Brazil', awayTeam: 'Morocco', homeScore: 1, awayScore: 1, status: 'FT', goals: [] },
  { matchId: 7, group: 'C', homeTeam: 'Haiti', awayTeam: 'Scotland', homeScore: 0, awayScore: 1, status: 'FT', goals: [] },
  { matchId: 8, group: 'D', homeTeam: 'Australia', awayTeam: 'Turkey', homeScore: 2, awayScore: 0, status: 'FT', goals: [] },
  {
    matchId: 9,
    group: 'E',
    homeTeam: 'Germany',
    awayTeam: 'Curacao',
    homeScore: 7,
    awayScore: 1,
    status: 'FT',
    goals: [{ team: 'Curacao', player: 'Livano Comenencia' }],
  },
  {
    matchId: 10,
    group: 'E',
    homeTeam: 'Ivory Coast',
    awayTeam: 'Ecuador',
    homeScore: 1,
    awayScore: 0,
    status: 'FT',
    goals: [{ team: 'Ivory Coast', player: 'Amad Diallo' }],
  },
  {
    matchId: 11,
    group: 'F',
    homeTeam: 'Netherlands',
    awayTeam: 'Japan',
    homeScore: 2,
    awayScore: 2,
    status: 'FT',
    goals: [
      { team: 'Netherlands', player: 'Virgil van Dijk' },
      { team: 'Netherlands', player: 'Crysencio Summerville' },
      { team: 'Japan', player: 'Daichi Kamada' },
    ],
  },
  {
    matchId: 12,
    group: 'F',
    homeTeam: 'Sweden',
    awayTeam: 'Tunisia',
    homeScore: 5,
    awayScore: 1,
    status: 'FT',
    goals: [
      { team: 'Sweden', player: 'Alexander Isak' },
      { team: 'Sweden', player: 'Viktor Gyokeres' },
      { team: 'Sweden', player: 'Yasin Ayari' },
    ],
  },
  { matchId: 13, group: 'G', homeTeam: 'Belgium', awayTeam: 'Egypt', homeScore: 1, awayScore: 1, status: 'FT', goals: [] },
  { matchId: 14, group: 'H', homeTeam: 'Spain', awayTeam: 'Cape Verde', homeScore: 0, awayScore: 0, status: 'FT', goals: [] },
  {
    matchId: 15,
    group: 'Saudi Arabia',
    awayTeam: 'Uruguay',
    homeScore: 1,
    awayScore: 1,
    status: 'FT',
    goals: [],
  },
];

const TEAM_NAME_ALIASES = {
  mexico: 'mex',
  'south africa': 'rsa',
  'sudafrica': 'rsa',
  'sudáfrica': 'rsa',
  'south korea': 'kor',
  'corea del sur': 'kor',
  czechia: 'cze',
  chequia: 'cze',
  canada: 'can',
  canadá: 'can',
  'bosnia and herzegovina': 'bih',
  'bosnia y herzegovina': 'bih',
  qatar: 'qat',
  catar: 'qat',
  switzerland: 'sui',
  suiza: 'sui',
  brazil: 'bra',
  brasil: 'bra',
  morocco: 'mar',
  marruecos: 'mar',
  haiti: 'hai',
  haiti: 'hai',
  scotland: 'sco',
  escocia: 'sco',
  'united states': 'usa',
  'estados unidos': 'usa',
  paraguay: 'par',
  australia: 'aus',
  turkey: 'tur',
  'turquia': 'tur',
  'turquía': 'tur',
  germany: 'ger',
  alemania: 'ger',
  curacao: 'cuw',
  curazao: 'cuw',
  'ivory coast': 'civ',
  'costa de marfil': 'civ',
  ecuador: 'ecu',
  netherlands: 'ned',
  'paises bajos': 'ned',
  'países bajos': 'ned',
  japan: 'jpn',
  japón: 'jpn',
  sweden: 'swe',
  suecia: 'swe',
  tunisia: 'tun',
  tunnez: 'tun',
  túnez: 'tun',
  belgium: 'bel',
  bélgica: 'bel',
  egypt: 'egy',
  egipto: 'egy',
  spain: 'esp',
  españa: 'esp',
  'cape verde': 'cpv',
  'cabo verde': 'cpv',
  'saudi arabia': 'ksa',
  'arabia saudita': 'ksa',
  uruguay: 'uru',
};

const normalizeKey = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const isGroupCode = (value) => /^[A-L]$/i.test(String(value || '').trim());

const toTeamId = (teamName, teamMap) => {
  const normalized = normalizeKey(teamName);
  if (!normalized) return null;

  const aliasId = TEAM_NAME_ALIASES[normalized];
  if (aliasId && teamMap[aliasId]) return aliasId;

  const fromName = Object.values(teamMap).find((team) => normalizeKey(team.name) === normalized);
  if (fromName) return fromName.id;

  const fromFifaCode = Object.values(teamMap).find((team) => normalizeKey(team.fifaCode) === normalized);
  return fromFifaCode?.id || null;
};

const resolveGroupId = (entryGroup, homeTeamId, awayTeamId, groupMatches) => {
  if (isGroupCode(entryGroup)) {
    return String(entryGroup).toUpperCase();
  }

  return (
    Object.entries(groupMatches).find(([, matches]) =>
      matches.some(
        (match) =>
          (match.home === homeTeamId && match.away === awayTeamId) ||
          (match.home === awayTeamId && match.away === homeTeamId)
      )
    )?.[0] || null
  );
};

const toNumberScore = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(20, Math.trunc(n)));
};

export const mapLiveScoresIntoMatches = (groupMatches, teamMap, liveScores) => {
  const nextGroupMatches = Object.fromEntries(
    Object.entries(groupMatches).map(([groupId, matches]) => [groupId, matches.map((match) => ({ ...match }))])
  );

  let appliedCount = 0;

  liveScores.forEach((entry) => {
    const inferredHomeName = entry.homeTeam || (!isGroupCode(entry.group) ? entry.group : null);
    const homeTeamId = toTeamId(inferredHomeName, teamMap);
    const awayTeamId = toTeamId(entry.awayTeam, teamMap);
    const homeScore = toNumberScore(entry.homeScore);
    const awayScore = toNumberScore(entry.awayScore);

    if (!homeTeamId || !awayTeamId || homeScore == null || awayScore == null) return;

    const groupId = resolveGroupId(entry.group, homeTeamId, awayTeamId, nextGroupMatches);
    if (!groupId || !nextGroupMatches[groupId]) return;

    const matches = nextGroupMatches[groupId];
    const directIndex = matches.findIndex((match) => match.home === homeTeamId && match.away === awayTeamId);

    if (directIndex !== -1) {
      matches[directIndex] = {
        ...matches[directIndex],
        homeGoals: homeScore,
        awayGoals: awayScore,
      };
      appliedCount += 1;
      return;
    }

    const reversedIndex = matches.findIndex((match) => match.home === awayTeamId && match.away === homeTeamId);
    if (reversedIndex !== -1) {
      matches[reversedIndex] = {
        ...matches[reversedIndex],
        homeGoals: awayScore,
        awayGoals: homeScore,
      };
      appliedCount += 1;
    }
  });

  return { nextGroupMatches, appliedCount };
};

export const seedProvidedScoresIfNeeded = async () => {
  if (!isFirebaseConfigured || !firestoreDb) return;

  const scoresCollection = collection(firestoreDb, LIVE_SCORES_COLLECTION);
  const existing = await getDocs(scoresCollection);
  if (!existing.empty) return;

  await Promise.all(
    PROVIDED_LIVE_SCORES.map((entry) =>
      setDoc(doc(firestoreDb, LIVE_SCORES_COLLECTION, String(entry.matchId)), {
        ...entry,
        updatedAt: new Date().toISOString(),
      })
    )
  );
};

export const fetchLiveScores = async () => {
  if (!isFirebaseConfigured || !firestoreDb) return [];

  const scoresQuery = query(collection(firestoreDb, LIVE_SCORES_COLLECTION), orderBy('matchId'));
  const snapshot = await getDocs(scoresQuery);
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
};

export const saveGroupMatchesToFirebase = async (groupMatches, teamMap) => {
  if (!isFirebaseConfigured || !firestoreDb) return 0;
  if (!groupMatches || !teamMap) return 0;

  const payload = Object.entries(groupMatches).flatMap(([groupId, matches]) =>
    matches.map((match, index) => ({
      matchId: Number(`${groupId.charCodeAt(0)}${index + 1}`),
      group: groupId,
      homeTeam: teamMap[match.home]?.name || match.home,
      awayTeam: teamMap[match.away]?.name || match.away,
      homeScore: match.homeGoals === '' ? null : Number(match.homeGoals),
      awayScore: match.awayGoals === '' ? null : Number(match.awayGoals),
      status: match.homeGoals === '' || match.awayGoals === '' ? 'PENDIENTE' : 'FT',
      goals: [],
      updatedAt: new Date().toISOString(),
    }))
  );

  const validPayload = payload.filter((entry) => Number.isFinite(entry.homeScore) && Number.isFinite(entry.awayScore));

  await Promise.all(
    validPayload.map((entry) =>
      setDoc(doc(firestoreDb, LIVE_SCORES_COLLECTION, String(entry.matchId)), entry, { merge: true })
    )
  );

  return validPayload.length;
};
