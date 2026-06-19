import { GROUPS } from '../data/teams';

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

  return Object.values(rows).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return b.strength - a.strength;
  });
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
    return b.strength - a.strength;
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
const FIRST_HALF = GROUP_ORDER.slice(0, 6);
const SECOND_HALF = GROUP_ORDER.slice(6);

export const RUNNER_OPPONENT_RULES = Object.fromEntries(
  GROUP_ORDER.map((groupId) => [groupId, FIRST_HALF.includes(groupId) ? SECOND_HALF : FIRST_HALF])
);

export const WINNER_THIRD_RULES = {
  A: ['B', 'C', 'D', 'E', 'F'],
  B: ['A', 'C', 'D', 'E', 'F'],
  C: ['A', 'B', 'D', 'E', 'F'],
  D: ['A', 'B', 'C', 'E', 'F'],
  E: ['A', 'B', 'C', 'D', 'F'],
  F: ['A', 'B', 'C', 'D', 'E'],
  G: ['H', 'I', 'J', 'K', 'L'],
  H: ['G', 'I', 'J', 'K', 'L'],
  I: ['G', 'H', 'J', 'K', 'L'],
  J: ['G', 'H', 'I', 'K', 'L'],
  K: ['G', 'H', 'I', 'J', 'L'],
  L: ['G', 'H', 'I', 'J', 'K'],
};

export const THIRD_TO_WINNER_RULES = Object.fromEntries(
  GROUP_ORDER.map((groupId) => [
    groupId,
    GROUP_ORDER.filter((winnerGroup) => WINNER_THIRD_RULES[winnerGroup].includes(groupId)),
  ])
);

const shuffle = (items) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const inSameHalf = (groupA, groupB) =>
  (FIRST_HALF.includes(groupA) && FIRST_HALF.includes(groupB)) ||
  (SECOND_HALF.includes(groupA) && SECOND_HALF.includes(groupB));

const assignThirdTeamsToWinners = (bestThirds) => {
  const targetCount = Math.min(8, bestThirds.length);
  let bestAssignment = {};

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const availableThirds = shuffle(bestThirds);
    const winners = shuffle(GROUP_ORDER);
    const assignment = {};

    winners.forEach((winnerGroup) => {
      if (Object.keys(assignment).length >= targetCount) return;

      const eligibleIndex = availableThirds.findIndex(
        (third) => WINNER_THIRD_RULES[winnerGroup].includes(third.group) && third.group !== winnerGroup
      );

      if (eligibleIndex >= 0) {
        const [picked] = availableThirds.splice(eligibleIndex, 1);
        assignment[winnerGroup] = picked;
      }
    });

    if (Object.keys(assignment).length > Object.keys(bestAssignment).length) {
      bestAssignment = assignment;
    }

    if (Object.keys(assignment).length === targetCount) {
      return assignment;
    }
  }

  return bestAssignment;
};

const pullRunner = (pool, winnerGroup) => {
  const candidateIndex = pool.findIndex(
    (runner) => runner.group !== winnerGroup && !inSameHalf(runner.group, winnerGroup)
  );
  const fallbackIndex = pool.findIndex((runner) => runner.group !== winnerGroup);
  const index = candidateIndex >= 0 ? candidateIndex : fallbackIndex;
  if (index < 0) return null;
  const [picked] = pool.splice(index, 1);
  return picked;
};

const pairRemainingRunners = (runnerPool) => {
  const pool = [...runnerPool];
  const pairs = [];

  while (pool.length >= 2) {
    const left = pool.shift();
    const oppositeIndex = pool.findIndex(
      (runner) => runner.group !== left.group && !inSameHalf(runner.group, left.group)
    );
    const fallbackIndex = pool.findIndex((runner) => runner.group !== left.group);
    const pickIndex = oppositeIndex >= 0 ? oppositeIndex : Math.max(0, fallbackIndex);
    const right = pool.splice(pickIndex, 1)[0];
    pairs.push([left, right]);
  }

  return pairs;
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
  }));

export const buildBracket = (outcomes) => {
  const thirdAssignments = assignThirdTeamsToWinners(outcomes.bestThirds);
  const runnerPool = shuffle(
    Object.entries(outcomes.runners).map(([group, teamId]) => ({
      group,
      teamId,
    }))
  );

  const r32 = [];

  GROUP_ORDER.forEach((groupId, index) => {
    const thirdPick = thirdAssignments[groupId];
    const runnerPick = thirdPick ? null : pullRunner(runnerPool, groupId);
    const opponentId = thirdPick?.teamId ?? runnerPick?.teamId ?? null;
    const opponentLabel = thirdPick
      ? `3.er lugar (${WINNER_THIRD_RULES[groupId].join('/')})`
      : '2.º lugar (cruce)';

    r32.push({
      id: `r32-${index + 1}`,
      teamA: outcomes.winners[groupId],
      teamB: opponentId,
      winner: null,
      loser: null,
      scoreA: null,
      scoreB: null,
      slotA: `Espacio ${groupId}1: Reservado para el ganador del Grupo ${groupId}`,
      slotB: thirdPick
        ? `Espacio 3ro-${groupId}: Reservado para el mejor 3.er lugar de los Grupos ${WINNER_THIRD_RULES[groupId].join('/')}`
        : `Espacio R2-${groupId}: Reservado para el sublíder de los Grupos ${RUNNER_OPPONENT_RULES[groupId].join('/')}`,
      helpText: `Ganador de ${groupId} vs ${opponentLabel}`,
    });
  });

  const runnerPairs = pairRemainingRunners(runnerPool);
  runnerPairs.slice(0, 4).forEach(([left, right], idx) => {
    r32.push({
      id: `r32-${13 + idx}`,
      teamA: left?.teamId ?? null,
      teamB: right?.teamId ?? null,
      winner: null,
      loser: null,
      scoreA: null,
      scoreB: null,
      slotA: `Espacio R2-${left?.group ?? '?'}: Reservado para el sublíder del Grupo ${left?.group ?? '?'}`,
      slotB: `Espacio R2-${right?.group ?? '?'}: Reservado para el sublíder del Grupo ${right?.group ?? '?'}`,
      helpText: 'Cruce entre equipos de 2.º lugar',
    });
  });

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
  const loserId = match.teamA === winnerId ? match.teamB : match.teamA;
  const normalizedScoreA = Number.isFinite(Number(scoreData?.scoreA)) ? Number(scoreData.scoreA) : null;
  const normalizedScoreB = Number.isFinite(Number(scoreData?.scoreB)) ? Number(scoreData.scoreB) : null;

  bracket[roundKey][matchIndex] = {
    ...match,
    winner: winnerId,
    loser: loserId,
    scoreA: normalizedScoreA,
    scoreB: normalizedScoreB,
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
