import { GROUPS } from '../data/teams';
import { ANNEX_C_ROWS, ANNEX_C_WINNERS } from '../data/annexCThirdPlaceTable';

export const createTeamMap = () => {
  const map = {};
  GROUPS.forEach((group) => {
    group.teams.forEach((team) => {
      map[team.id] = {
        ...team,
        group: group.id,
        code: team.flagCode ?? team.code,
        fifaCode: team.fifaCode ?? team.id.toUpperCase(),
      };
    });
  });
  return map;
};

export const initialGroupMatches = () => {
  const byGroup = {};
  GROUPS.forEach((group) => {
    const ids = group.teams.map((team) => team.id);
    const fixtures = [
      [ids[0], ids[1]],
      [ids[2], ids[3]],
      [ids[0], ids[2]],
      [ids[1], ids[3]],
      [ids[0], ids[3]],
      [ids[1], ids[2]],
    ];
    byGroup[group.id] = fixtures.map((fixture, index) => ({
      id: `${group.id}-${index + 1}`,
      home: fixture[0],
      away: fixture[1],
      homeGoals: '',
      awayGoals: '',
    }));
  });
  return byGroup;
};

const emptyRow = (team) => ({
  teamId: team.id,
  group: team.group,
  points: 0,
  played: 0,
  won: 0,
  draw: 0,
  lost: 0,
  gf: 0,
  ga: 0,
  gd: 0,
  strength: team.strength,
});

const baseStandingComparator = (a, b) => {
  if (b.points !== a.points) return b.points - a.points;
  if (b.gd !== a.gd) return b.gd - a.gd;
  if (b.gf !== a.gf) return b.gf - a.gf;
  return 0;
};

const stableTeamComparator = (a, b) => a.teamId.localeCompare(b.teamId);

const buildHeadToHeadTable = (teamIds, groupMatches, toGoalValue) => {
  const teamSet = new Set(teamIds);
  const table = Object.fromEntries(
    teamIds.map((teamId) => [teamId, { points: 0, gf: 0, ga: 0, gd: 0 }])
  );

  groupMatches.forEach((match) => {
    if (!teamSet.has(match.home) || !teamSet.has(match.away)) return;

    const hg = toGoalValue(match.homeGoals);
    const ag = toGoalValue(match.awayGoals);
    if (hg === null || ag === null) return;

    const home = table[match.home];
    const away = table[match.away];

    home.gf += hg;
    home.ga += ag;
    away.gf += ag;
    away.ga += hg;
    home.gd = home.gf - home.ga;
    away.gd = away.gf - away.ga;

    if (hg > ag) {
      home.points += 3;
    } else if (ag > hg) {
      away.points += 3;
    } else {
      home.points += 1;
      away.points += 1;
    }
  });

  return table;
};

export const calculateGroupStandings = (groupId, groupMatches, teamMap) => {
  const rows = {};
  GROUPS.find((group) => group.id === groupId)?.teams.forEach((team) => {
    rows[team.id] = emptyRow(teamMap[team.id]);
  });

  const toGoalValue = (value) => {
    if (value === '' || value === null || value === undefined) return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  };

  groupMatches.forEach((match) => {
    const home = rows[match.home];
    const away = rows[match.away];
    const hg = toGoalValue(match.homeGoals);
    const ag = toGoalValue(match.awayGoals);

    if (hg === null || ag === null) return;

    home.played += 1;
    away.played += 1;

    home.gf += hg;
    home.ga += ag;
    away.gf += ag;
    away.ga += hg;

    home.gd = home.gf - home.ga;
    away.gd = away.gf - away.ga;

    if (hg > ag) {
      home.won += 1;
      away.lost += 1;
      home.points += 3;
    } else if (ag > hg) {
      away.won += 1;
      home.lost += 1;
      away.points += 3;
    } else {
      home.draw += 1;
      away.draw += 1;
      home.points += 1;
      away.points += 1;
    }
  });

  const prelim = Object.values(rows).sort((a, b) => baseStandingComparator(a, b) || stableTeamComparator(a, b));
  const resolved = [];

  for (let i = 0; i < prelim.length; ) {
    let j = i + 1;
    while (j < prelim.length && baseStandingComparator(prelim[i], prelim[j]) === 0) {
      j += 1;
    }

    const tieCluster = prelim.slice(i, j);
    if (tieCluster.length === 1) {
      resolved.push(tieCluster[0]);
    } else {
      const h2h = buildHeadToHeadTable(
        tieCluster.map((row) => row.teamId),
        groupMatches,
        toGoalValue
      );

      resolved.push(
        ...tieCluster.sort((a, b) => {
          const headA = h2h[a.teamId];
          const headB = h2h[b.teamId];
          if (headB.points !== headA.points) return headB.points - headA.points;
          if (headB.gd !== headA.gd) return headB.gd - headA.gd;
          if (headB.gf !== headA.gf) return headB.gf - headA.gf;
          return stableTeamComparator(a, b);
        })
      );
    }

    i = j;
  }

  return resolved;
};

export const computeGroupResults = (groupMatches, teamMap) => {
  const standingsByGroup = {};
  const winners = {};
  const runners = {};
  const thirds = [];

  GROUPS.forEach((group) => {
    const standings = calculateGroupStandings(group.id, groupMatches[group.id], teamMap);
    standingsByGroup[group.id] = standings;
    winners[group.id] = standings[0].teamId;
    runners[group.id] = standings[1].teamId;
    thirds.push({ ...standings[2], group: group.id });
  });

  const rankedThirds = [...thirds].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.teamId.localeCompare(b.teamId);
  });

  return {
    standingsByGroup,
    winners,
    runners,
    rankedThirds,
    bestThirds: rankedThirds.slice(0, 8),
  };
};

const GROUP_ORDER = GROUPS.map((group) => group.id);
export const RUNNER_OPPONENT_RULES = {
  A: ['B'],
  B: ['A'],
  C: ['F'],
  D: ['G'],
  E: ['I'],
  F: ['C'],
  G: ['D'],
  H: ['J'],
  I: ['E'],
  J: ['H'],
  K: ['L'],
  L: ['K'],
};

export const WINNER_THIRD_RULES = {
  A: ['C', 'E', 'F', 'H', 'I'],
  B: ['E', 'F', 'G', 'I', 'J'],
  C: [],
  D: ['B', 'E', 'F', 'I', 'J'],
  E: ['A', 'B', 'C', 'D', 'F'],
  F: [],
  G: ['A', 'E', 'H', 'I', 'J'],
  H: [],
  I: ['C', 'D', 'F', 'G', 'H'],
  J: [],
  K: ['D', 'E', 'I', 'J', 'L'],
  L: ['E', 'H', 'I', 'J', 'K'],
};

export const THIRD_TO_WINNER_RULES = Object.fromEntries(
  GROUP_ORDER.map((groupId) => [
    groupId,
    GROUP_ORDER.filter((winnerGroup) => WINNER_THIRD_RULES[winnerGroup].includes(groupId)),
  ])
);

const ANNEX_C_LOOKUP = new Map(
  ANNEX_C_ROWS.map((row) => {
    const byWinner = {};
    ANNEX_C_WINNERS.forEach((winnerGroup, index) => {
      byWinner[winnerGroup] = row[index];
    });
    const comboKey = row.split('').sort().join('');
    return [comboKey, byWinner];
  })
);

const R32_TEMPLATE = [
  {
    id: 'r32-1',
    teamA: { type: 'runner', group: 'A' },
    teamB: { type: 'runner', group: 'B' },
    slotA: 'Espacio RUA: Reservado para el sublíder del Grupo A',
    slotB: 'Espacio RUB: Reservado para el sublíder del Grupo B',
    helpText: '2.º A vs 2.º B',
  },
  {
    id: 'r32-2',
    teamA: { type: 'winner', group: 'E' },
    teamB: { type: 'third', winnerGroup: 'E', allowedGroups: ['A', 'B', 'C', 'D', 'F'] },
    slotA: 'Espacio 1E: Reservado para el ganador del Grupo E',
    slotB: 'Espacio 3ro-E: Mejor 3.er lugar de A/B/C/D/F (Anexo C)',
    helpText: '1.º E vs mejor 3.º (A/B/C/D/F)',
  },
  {
    id: 'r32-3',
    teamA: { type: 'winner', group: 'F' },
    teamB: { type: 'runner', group: 'C' },
    slotA: 'Espacio 1F: Reservado para el ganador del Grupo F',
    slotB: 'Espacio RUC: Reservado para el sublíder del Grupo C',
    helpText: '1.º F vs 2.º C',
  },
  {
    id: 'r32-4',
    teamA: { type: 'winner', group: 'C' },
    teamB: { type: 'runner', group: 'F' },
    slotA: 'Espacio 1C: Reservado para el ganador del Grupo C',
    slotB: 'Espacio RUF: Reservado para el sublíder del Grupo F',
    helpText: '1.º C vs 2.º F',
  },
  {
    id: 'r32-5',
    teamA: { type: 'winner', group: 'I' },
    teamB: { type: 'third', winnerGroup: 'I', allowedGroups: ['C', 'D', 'F', 'G', 'H'] },
    slotA: 'Espacio 1I: Reservado para el ganador del Grupo I',
    slotB: 'Espacio 3ro-I: Mejor 3.er lugar de C/D/F/G/H (Anexo C)',
    helpText: '1.º I vs mejor 3.º (C/D/F/G/H)',
  },
  {
    id: 'r32-6',
    teamA: { type: 'runner', group: 'E' },
    teamB: { type: 'runner', group: 'I' },
    slotA: 'Espacio RUE: Reservado para el sublíder del Grupo E',
    slotB: 'Espacio RUI: Reservado para el sublíder del Grupo I',
    helpText: '2.º E vs 2.º I',
  },
  {
    id: 'r32-7',
    teamA: { type: 'winner', group: 'A' },
    teamB: { type: 'third', winnerGroup: 'A', allowedGroups: ['C', 'E', 'F', 'H', 'I'] },
    slotA: 'Espacio 1A: Reservado para el ganador del Grupo A',
    slotB: 'Espacio 3ro-A: Mejor 3.er lugar de C/E/F/H/I (Anexo C)',
    helpText: '1.º A vs mejor 3.º (C/E/F/H/I)',
  },
  {
    id: 'r32-8',
    teamA: { type: 'winner', group: 'L' },
    teamB: { type: 'third', winnerGroup: 'L', allowedGroups: ['E', 'H', 'I', 'J', 'K'] },
    slotA: 'Espacio 1L: Reservado para el ganador del Grupo L',
    slotB: 'Espacio 3ro-L: Mejor 3.er lugar de E/H/I/J/K (Anexo C)',
    helpText: '1.º L vs mejor 3.º (E/H/I/J/K)',
  },
  {
    id: 'r32-9',
    teamA: { type: 'winner', group: 'D' },
    teamB: { type: 'third', winnerGroup: 'D', allowedGroups: ['B', 'E', 'F', 'I', 'J'] },
    slotA: 'Espacio 1D: Reservado para el ganador del Grupo D',
    slotB: 'Espacio 3ro-D: Mejor 3.er lugar de B/E/F/I/J (Anexo C)',
    helpText: '1.º D vs mejor 3.º (B/E/F/I/J)',
  },
  {
    id: 'r32-10',
    teamA: { type: 'winner', group: 'G' },
    teamB: { type: 'third', winnerGroup: 'G', allowedGroups: ['A', 'E', 'H', 'I', 'J'] },
    slotA: 'Espacio 1G: Reservado para el ganador del Grupo G',
    slotB: 'Espacio 3ro-G: Mejor 3.er lugar de A/E/H/I/J (Anexo C)',
    helpText: '1.º G vs mejor 3.º (A/E/H/I/J)',
  },
  {
    id: 'r32-11',
    teamA: { type: 'runner', group: 'K' },
    teamB: { type: 'runner', group: 'L' },
    slotA: 'Espacio RUK: Reservado para el sublíder del Grupo K',
    slotB: 'Espacio RUL: Reservado para el sublíder del Grupo L',
    helpText: '2.º K vs 2.º L',
  },
  {
    id: 'r32-12',
    teamA: { type: 'winner', group: 'H' },
    teamB: { type: 'runner', group: 'J' },
    slotA: 'Espacio 1H: Reservado para el ganador del Grupo H',
    slotB: 'Espacio RUJ: Reservado para el sublíder del Grupo J',
    helpText: '1.º H vs 2.º J',
  },
  {
    id: 'r32-13',
    teamA: { type: 'winner', group: 'B' },
    teamB: { type: 'third', winnerGroup: 'B', allowedGroups: ['E', 'F', 'G', 'I', 'J'] },
    slotA: 'Espacio 1B: Reservado para el ganador del Grupo B',
    slotB: 'Espacio 3ro-B: Mejor 3.er lugar de E/F/G/I/J (Anexo C)',
    helpText: '1.º B vs mejor 3.º (E/F/G/I/J)',
  },
  {
    id: 'r32-14',
    teamA: { type: 'winner', group: 'J' },
    teamB: { type: 'runner', group: 'H' },
    slotA: 'Espacio 1J: Reservado para el ganador del Grupo J',
    slotB: 'Espacio RUH: Reservado para el sublíder del Grupo H',
    helpText: '1.º J vs 2.º H',
  },
  {
    id: 'r32-15',
    teamA: { type: 'winner', group: 'K' },
    teamB: { type: 'third', winnerGroup: 'K', allowedGroups: ['D', 'E', 'I', 'J', 'L'] },
    slotA: 'Espacio 1K: Reservado para el ganador del Grupo K',
    slotB: 'Espacio 3ro-K: Mejor 3.er lugar de D/E/I/J/L (Anexo C)',
    helpText: '1.º K vs mejor 3.º (D/E/I/J/L)',
  },
  {
    id: 'r32-16',
    teamA: { type: 'runner', group: 'D' },
    teamB: { type: 'runner', group: 'G' },
    slotA: 'Espacio RUD: Reservado para el sublíder del Grupo D',
    slotB: 'Espacio RUG: Reservado para el sublíder del Grupo G',
    helpText: '2.º D vs 2.º G',
  },
];

const resolveThirdAssignmentsFromAnnexC = (bestThirds = []) => {
  const byGroup = Object.fromEntries(bestThirds.map((third) => [third.group, third]));
  const comboKey = bestThirds
    .map((third) => third.group)
    .filter(Boolean)
    .sort()
    .join('');

  const winnerToThirdGroup = ANNEX_C_LOOKUP.get(comboKey);
  if (!winnerToThirdGroup) return {};

  return Object.fromEntries(
    Object.entries(winnerToThirdGroup).map(([winnerGroup, thirdGroup]) => [winnerGroup, byGroup[thirdGroup] ?? null])
  );
};

const resolveBracketTeam = (slot, outcomes, thirdAssignments) => {
  if (slot.type === 'winner') return outcomes.winners[slot.group] ?? null;
  if (slot.type === 'runner') return outcomes.runners[slot.group] ?? null;
  if (slot.type === 'third') return thirdAssignments[slot.winnerGroup]?.teamId ?? null;
  return null;
};

const createRound = (size, key) =>
  Array.from({ length: size }, (_, index) => ({
    id: `${key}-${index + 1}`,
    teamA: null,
    teamB: null,
    winner: null,
    loser: null,
    scoreA: null,
    scoreB: null,
    extraTimeScoreA: null,
    extraTimeScoreB: null,
    penaltiesA: null,
    penaltiesB: null,
    winnerMethod: null,
  }));

export const buildBracket = (outcomes) => {
  const thirdAssignments = resolveThirdAssignmentsFromAnnexC(outcomes.bestThirds);

  const r32 = R32_TEMPLATE.map((matchTemplate) => ({
    id: matchTemplate.id,
    teamA: resolveBracketTeam(matchTemplate.teamA, outcomes, thirdAssignments),
    teamB: resolveBracketTeam(matchTemplate.teamB, outcomes, thirdAssignments),
    winner: null,
    loser: null,
    scoreA: null,
    scoreB: null,
    extraTimeScoreA: null,
    extraTimeScoreB: null,
    penaltiesA: null,
    penaltiesB: null,
    winnerMethod: null,
    slotA: matchTemplate.slotA,
    slotB: matchTemplate.slotB,
    helpText: matchTemplate.helpText,
  }));

  return {
    r32,
    r16: createRound(8, 'r16'),
    qf: createRound(4, 'qf'),
    sf: createRound(2, 'sf'),
    third: createRound(1, 'third'),
    final: createRound(1, 'final'),
    champion: null,
  };
};

export const advanceWinner = (bracket, roundKey, matchIndex, winnerId, scoreData = null) => {
  const rounds = {
    r32: 'r16',
    r16: 'qf',
    qf: 'sf',
    sf: 'final',
  };

  const nextRoundKey = rounds[roundKey];
  const match = bracket[roundKey][matchIndex];
  if (winnerId !== match.teamA && winnerId !== match.teamB) {
    return bracket;
  }
  const loserId = match.teamA === winnerId ? match.teamB : match.teamA;
  const normalizedScoreA = Number.isFinite(Number(scoreData?.scoreA)) ? Number(scoreData.scoreA) : null;
  const normalizedScoreB = Number.isFinite(Number(scoreData?.scoreB)) ? Number(scoreData.scoreB) : null;
  const normalizedEtScoreA =
    Number.isFinite(Number(scoreData?.extraTimeScoreA)) ? Number(scoreData.extraTimeScoreA) : null;
  const normalizedEtScoreB =
    Number.isFinite(Number(scoreData?.extraTimeScoreB)) ? Number(scoreData.extraTimeScoreB) : null;
  const normalizedPensA = Number.isFinite(Number(scoreData?.penaltiesA)) ? Number(scoreData.penaltiesA) : null;
  const normalizedPensB = Number.isFinite(Number(scoreData?.penaltiesB)) ? Number(scoreData.penaltiesB) : null;
  const winnerMethod =
    typeof scoreData?.winnerMethod === 'string' && scoreData.winnerMethod.trim()
      ? scoreData.winnerMethod.trim()
      : normalizedScoreA !== null && normalizedScoreB !== null && normalizedScoreA !== normalizedScoreB
        ? 'regulation'
        : normalizedPensA !== null && normalizedPensB !== null
          ? 'penalties'
          : normalizedEtScoreA !== null && normalizedEtScoreB !== null
            ? 'extra_time'
            : null;

  bracket[roundKey][matchIndex] = {
    ...match,
    winner: winnerId,
    loser: loserId,
    scoreA: normalizedScoreA,
    scoreB: normalizedScoreB,
    extraTimeScoreA: normalizedEtScoreA,
    extraTimeScoreB: normalizedEtScoreB,
    penaltiesA: normalizedPensA,
    penaltiesB: normalizedPensB,
    winnerMethod,
  };

  if (roundKey === 'final') {
    bracket.final[0].winner = winnerId;
    bracket.champion = winnerId;
    return bracket;
  }

  if (roundKey === 'third') {
    bracket.third[0].winner = winnerId;
    return bracket;
  }

  if (nextRoundKey) {
    const target = Math.floor(matchIndex / 2);
    const slot = matchIndex % 2 === 0 ? 'teamA' : 'teamB';
    bracket[nextRoundKey][target] = {
      ...bracket[nextRoundKey][target],
      [slot]: winnerId,
    };
  }

  if (roundKey === 'sf') {
    const thirdSlot = matchIndex === 0 ? 'teamA' : 'teamB';
    bracket.third[0] = {
      ...bracket.third[0],
      [thirdSlot]: loserId,
    };
  }

  return bracket;
};

const sampleGoals = (expected) => {
  const noise = Math.random() * 1.4;
  const goals = Math.max(0, Math.round(expected + noise - 0.4));
  return Math.min(goals, 6);
};

export const simulateScore = (teamA, teamB) => {
  const diff = (teamA.strength - teamB.strength) / 14;
  const expectedA = 1.4 + Math.max(-0.7, diff * 0.6);
  const expectedB = 1.2 + Math.max(-0.7, -diff * 0.6);
  return [sampleGoals(expectedA), sampleGoals(expectedB)];
};

export const chooseWinner = (teamA, teamB) => {
  const total = teamA.strength + teamB.strength;
  const roll = Math.random() * total;
  return roll < teamA.strength ? teamA.id : teamB.id;
};
