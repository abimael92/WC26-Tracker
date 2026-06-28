import { collection, doc, getDocs, orderBy, query, setDoc } from 'firebase/firestore';
import { firestoreDb, isFirebaseConfigured } from './firebase';

const LIVE_SCORES_COLLECTION = 'wc26_live_scores';

const isFirestoreNotFoundError = (error) => {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  return code.includes('not-found') || message.includes('not_found') || message.includes('not found');
};

export const PROVIDED_LIVE_SCORES = [
  // ============ GROUP A ============
  {
    matchId: 1,
    group: 'A',
    homeTeam: 'Mexico',
    awayTeam: 'South Africa',
    homeScore: 2,
    awayScore: 0,
    status: 'FT',
    goals: [
      { team: 'Mexico', player: 'Julian Quinones', minute: 23 },
      { team: 'Mexico', player: 'Raul Jimenez', minute: 67 },
    ],
  },
  {
    matchId: 2,
    group: 'A',
    homeTeam: 'South Korea',
    awayTeam: 'Czechia',
    homeScore: 2,
    awayScore: 1,
    status: 'FT',
    goals: [
      { team: 'South Korea', player: 'Son Heung-min', minute: 34 },
      { team: 'Czechia', player: 'Patrik Schick', minute: 55 },
      { team: 'South Korea', player: 'Hwang Hee-chan', minute: 78 },
    ],
  },

  // ============ GROUP B ============
  {
    matchId: 3,
    group: 'B',
    homeTeam: 'Canada',
    awayTeam: 'Bosnia and Herzegovina',
    homeScore: 1,
    awayScore: 1,
    status: 'FT',
    goals: [
      { team: 'Canada', player: 'Jonathan David', minute: 42 },
      { team: 'Bosnia and Herzegovina', player: 'Edin Dzeko', minute: 89 },
    ],
  },
  {
    matchId: 5,
    group: 'B',
    homeTeam: 'Qatar',
    awayTeam: 'Switzerland',
    homeScore: 1,
    awayScore: 1,
    status: 'FT',
    goals: [
      { team: 'Qatar', player: 'Akram Afif', minute: 28 },
      { team: 'Switzerland', player: 'Granit Xhaka', minute: 63 },
    ],
  },

  // ============ GROUP C ============
  {
    matchId: 6,
    group: 'C',
    homeTeam: 'Brazil',
    awayTeam: 'Morocco',
    homeScore: 1,
    awayScore: 1,
    status: 'FT',
    goals: [
      { team: 'Brazil', player: 'Vinicius Junior', minute: 19 },
      { team: 'Morocco', player: 'Hakim Ziyech', minute: 73 },
    ],
  },
  {
    matchId: 7,
    group: 'C',
    homeTeam: 'Haiti',
    awayTeam: 'Scotland',
    homeScore: 0,
    awayScore: 1,
    status: 'FT',
    goals: [{ team: 'Scotland', player: 'John McGinn', minute: 45 }],
  },

  // ============ GROUP D ============
  {
    matchId: 4,
    group: 'D',
    homeTeam: 'United States',
    awayTeam: 'Paraguay',
    homeScore: 4,
    awayScore: 1,
    status: 'FT',
    goals: [
      { team: 'United States', player: 'Christian Pulisic', minute: 12 },
      { team: 'United States', player: 'Weston McKennie', minute: 35 },
      { team: 'Paraguay', player: 'Miguel Almiron', minute: 51 },
      { team: 'United States', player: 'Timothy Weah', minute: 68 },
      { team: 'United States', player: 'Giovanni Reyna', minute: 84 },
    ],
  },
  {
    matchId: 8,
    group: 'D',
    homeTeam: 'Australia',
    awayTeam: 'Turkey',
    homeScore: 2,
    awayScore: 0,
    status: 'FT',
    goals: [
      { team: 'Australia', player: 'Mathew Leckie', minute: 31 },
      { team: 'Australia', player: 'Craig Goodwin', minute: 76 },
    ],
  },

  // ============ GROUP E ============
  {
    matchId: 9,
    group: 'E',
    homeTeam: 'Germany',
    awayTeam: 'Curacao',
    homeScore: 7,
    awayScore: 1,
    status: 'FT',
    goals: [
      { team: 'Germany', player: 'Jamal Musiala', minute: 4 },
      { team: 'Germany', player: 'Kai Havertz', minute: 15 },
      { team: 'Curacao', player: 'Livano Comenencia', minute: 22 },
      { team: 'Germany', player: 'Florian Wirtz', minute: 38 },
      { team: 'Germany', player: 'Niclas Fullkrug', minute: 52 },
      { team: 'Germany', player: 'Leroy Sane', minute: 66 },
      { team: 'Germany', player: 'Jonathan Tah', minute: 79 },
      { team: 'Germany', player: 'Deniz Undav', minute: 88 },
    ],
  },
  {
    matchId: 10,
    group: 'E',
    homeTeam: 'Ivory Coast',
    awayTeam: 'Ecuador',
    homeScore: 1,
    awayScore: 0,
    status: 'FT',
    goals: [{ team: 'Ivory Coast', player: 'Amad Diallo', minute: 58 }],
  },

  // ============ GROUP F ============
  {
    matchId: 11,
    group: 'F',
    homeTeam: 'Netherlands',
    awayTeam: 'Japan',
    homeScore: 2,
    awayScore: 2,
    status: 'FT',
    goals: [
      { team: 'Netherlands', player: 'Virgil van Dijk', minute: 14 },
      { team: 'Japan', player: 'Daichi Kamada', minute: 33 },
      { team: 'Netherlands', player: 'Crysencio Summerville', minute: 51 },
      { team: 'Japan', player: 'Ritsu Doan', minute: 79 },
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
      { team: 'Sweden', player: 'Alexander Isak', minute: 9 },
      { team: 'Tunisia', player: 'Wahbi Khazri', minute: 27 },
      { team: 'Sweden', player: 'Viktor Gyokeres', minute: 44 },
      { team: 'Sweden', player: 'Yasin Ayari', minute: 62 },
      { team: 'Sweden', player: 'Emil Forsberg', minute: 73 },
      { team: 'Sweden', player: 'Hugo Larsson', minute: 85 },
    ],
  },

  // ============ GROUP G ============
  {
    matchId: 13,
    group: 'G',
    homeTeam: 'Belgium',
    awayTeam: 'Egypt',
    homeScore: 1,
    awayScore: 1,
    status: 'FT',
    goals: [
      { team: 'Belgium', player: 'Kevin De Bruyne', minute: 41 },
      { team: 'Egypt', player: 'Mohamed Salah', minute: 70 },
    ],
  },
  {
    matchId: 15,
    group: 'H',
    homeTeam: 'Saudi Arabia',
    awayTeam: 'Uruguay',
    homeScore: 1,
    awayScore: 1,
    status: 'FT',
    goals: [
      { team: 'Saudi Arabia', player: 'Abdulelah Al-Amri' },
      { team: 'Uruguay', player: 'Maxi Araujo' },
    ],
  },

  // ============ GROUP H ============
  {
    matchId: 14,
    group: 'H',
    homeTeam: 'Spain',
    awayTeam: 'Cape Verde',
    homeScore: 0,
    awayScore: 0,
    status: 'FT',
    goals: [],
  },
  {
    matchId: 16,
    group: 'G',
    homeTeam: 'Iran',
    awayTeam: 'New Zealand',
    homeScore: 2,
    awayScore: 2,
    status: 'FT',
    goals: [
      { team: 'New Zealand', player: 'Eli Just', minute: 7 },
      { team: 'Iran', player: 'Ramin Rezaeian', minute: 32 },
      { team: 'New Zealand', player: 'Eli Just', minute: 55 },
      { team: 'Iran', player: 'Mohammad Mohebi', minute: 64 },
    ],
  },
  {
    matchId: 17,
    group: 'I',
    homeTeam: 'France',
    awayTeam: 'Senegal',
    homeScore: 3,
    awayScore: 1,
    status: 'FT',
    goals: [
      { team: 'France', player: 'Kylian Mbappé', minute: 66 },
      { team: 'France', player: 'Bradley Barcola', minute: 82 },
      { team: 'Senegal', player: 'Mbaye', minute: 90 },
      { team: 'France', player: 'Kylian Mbappé', minute: 96 },
    ],
  },
];

const TEAM_NAME_ALIASES = {
  // Group A
  mexico: 'mex',
  'méxico': 'mex',
  'south africa': 'rsa',
  'sudafrica': 'rsa',
  'sudáfrica': 'rsa',
  'south korea': 'kor',
  'corea del sur': 'kor',
  'republic of korea': 'kor',
  czechia: 'cze',
  chequia: 'cze',
  'czech republic': 'cze',
  
  // Group B
  canada: 'can',
  canadá: 'can',
  'bosnia and herzegovina': 'bih',
  'bosnia y herzegovina': 'bih',
  bosnia: 'bih',
  qatar: 'qat',
  catar: 'qat',
  switzerland: 'sui',
  suiza: 'sui',
  'schweiz': 'sui',
  
  // Group C
  brazil: 'bra',
  brasil: 'bra',
  morocco: 'mar',
  marruecos: 'mar',
  haiti: 'hai',
  scotland: 'sco',
  escocia: 'sco',
  
  // Group D
  'united states': 'usa',
  'estados unidos': 'usa',
  'ee. uu.': 'usa',
  paraguay: 'par',
  australia: 'aus',
  turkey: 'tur',
  'turquia': 'tur',
  'turquía': 'tur',
  'türkiye': 'tur',
  
  // Group E
  germany: 'ger',
  alemania: 'ger',
  'deutschland': 'ger',
  curacao: 'cuw',
  curazao: 'cuw',
  'curaçao': 'cuw',
  'ivory coast': 'civ',
  'costa de marfil': 'civ',
  "côte d'ivoire": 'civ',
  ecuador: 'ecu',
  
  // Group F
  netherlands: 'ned',
  'paises bajos': 'ned',
  'países bajos': 'ned',
  'holland': 'ned',
  japan: 'jpn',
  japón: 'jpn',
  'nippon': 'jpn',
  sweden: 'swe',
  suecia: 'swe',
  tunisia: 'tun',
  tunnez: 'tun',
  túnez: 'tun',
  
  // Group G
  belgium: 'bel',
  bélgica: 'bel',
  egypt: 'egy',
  egipto: 'egy',
  iran: 'irn',
  'irán': 'irn',
  'new zealand': 'nzl',
  'nueva zelanda': 'nzl',
  'saudi arabia': 'ksa',
  'arabia saudita': 'ksa',
  'ksa': 'ksa',
  uruguay: 'uru',
  
  // Group H
  spain: 'esp',
  españa: 'esp',
  france: 'fra',
  francia: 'fra',
  'cape verde': 'cpv',
  'cabo verde': 'cpv',
  colombia: 'col',
  senegal: 'sen',

  // Group I
  norway: 'nor',
  noruega: 'nor',
  iraq: 'irq',
  irak: 'irq',
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
    const explicitGroupId = String(entryGroup).toUpperCase();
    const explicitMatches = groupMatches[explicitGroupId] || [];
    const hasPairInExplicitGroup = explicitMatches.some(
      (match) =>
        (match.home === homeTeamId && match.away === awayTeamId) ||
        (match.home === awayTeamId && match.away === homeTeamId)
    );

    if (hasPairInExplicitGroup) {
      return explicitGroupId;
    }
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

  try {
    await Promise.all(
      PROVIDED_LIVE_SCORES.map((entry) =>
        setDoc(doc(firestoreDb, LIVE_SCORES_COLLECTION, String(entry.matchId)), {
          ...entry,
          updatedAt: new Date().toISOString(),
        }, { merge: true })
      )
    );
  } catch (error) {
    if (!isFirestoreNotFoundError(error)) {
      throw error;
    }
  }
};

export const fetchLiveScores = async () => {
  if (!isFirebaseConfigured || !firestoreDb) return [];

  try {
    const scoresQuery = query(collection(firestoreDb, LIVE_SCORES_COLLECTION), orderBy('matchId'));
    const snapshot = await getDocs(scoresQuery);
    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (error) {
    if (isFirestoreNotFoundError(error)) {
      return PROVIDED_LIVE_SCORES;
    }
    throw error;
  }
};

export const saveGroupMatchesToFirebase = async (groupMatches, teamMap) => {
  if (!isFirebaseConfigured || !firestoreDb) return 0;
  if (!groupMatches || !teamMap) return 0;

  const payload = Object.entries(groupMatches).flatMap(([groupId, matches]) =>
    matches.map((match, index) => ({
      matchId: ((groupId.charCodeAt(0) - 65) * 6) + (index + 1),
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

export const saveLiveScoreEntryToFirebase = async (entry) => {
  if (!isFirebaseConfigured || !firestoreDb) return false;
  if (!entry || !Number.isFinite(Number(entry.matchId))) return false;

  const normalizeGoalMinute = (value) => {
    const text = String(value ?? '').trim();
    if (!text) return null;
    const exactNumber = text.match(/^\d+$/);
    if (exactNumber) return Number(text);
    const extraTime = text.match(/^\d+\+\d+$/);
    if (extraTime) return text;
    return null;
  };

  const matchId = Number(entry.matchId);
  const payload = {
    matchId,
    group: String(entry.group || '').trim().toUpperCase(),
    homeTeam: String(entry.homeTeam || '').trim(),
    awayTeam: String(entry.awayTeam || '').trim(),
    homeScore: Number(entry.homeScore),
    awayScore: Number(entry.awayScore),
    status: String(entry.status || 'FT').trim().toUpperCase() || 'FT',
    goals: Array.isArray(entry.goals)
      ? entry.goals
          .map((goal) => {
            const minute = normalizeGoalMinute(goal?.minute);
            return {
              team: String(goal?.team || '').trim(),
              player: String(goal?.player || '').trim(),
              ...(minute !== null ? { minute } : {}),
              ...(Boolean(goal?.ownGoal) ? { ownGoal: true } : {}),
              ...(Boolean(goal?.isPenalty) ? { isPenalty: true } : {}),
            };
          })
          .filter((goal) => goal.team && goal.player)
      : [],
    updatedAt: new Date().toISOString(),
  };

  await setDoc(doc(firestoreDb, LIVE_SCORES_COLLECTION, String(matchId)), payload, { merge: true });
  return true;
};
