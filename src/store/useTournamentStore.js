import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GROUPS } from '../data/teams';
import {
  advanceWinner,
  buildBracket,
  chooseWinner,
  computeGroupResults,
  createTeamMap,
  initialGroupMatches,
  simulateScore,
} from '../lib/tournament';
import { mapLiveScoresIntoMatches } from '../lib/liveScores';

const teamMap = createTeamMap();

const GROUP_WINNER_PROBABILITIES = {
  A: [
    { teamId: 'mex', weight: 48 },
    { teamId: 'kor', weight: 30 },
    { teamId: 'cze', weight: 17 },
    { teamId: 'rsa', weight: 5 },
  ],
  B: [
    { teamId: 'sui', weight: 50 },
    { teamId: 'can', weight: 28 },
    { teamId: 'bih', weight: 18 },
    { teamId: 'qat', weight: 4 },
  ],
  C: [
    { teamId: 'bra', weight: 65 },
    { teamId: 'mar', weight: 22 },
    { teamId: 'sco', weight: 10 },
    { teamId: 'hai', weight: 3 },
  ],
  D: [
    { teamId: 'usa', weight: 45 },
    { teamId: 'aus', weight: 25 },
    { teamId: 'tur', weight: 20 },
    { teamId: 'par', weight: 10 },
  ],
  E: [
    { teamId: 'ger', weight: 75 },
    { teamId: 'ecu', weight: 15 },
    { teamId: 'civ', weight: 8 },
    { teamId: 'cuw', weight: 2 },
  ],
  F: [
    { teamId: 'ned', weight: 40 },
    { teamId: 'jpn', weight: 25 },
    { teamId: 'swe', weight: 25 },
    { teamId: 'tun', weight: 10 },
  ],
  G: [
    { teamId: 'bel', weight: 55 },
    { teamId: 'egy', weight: 20 },
    { teamId: 'irn', weight: 18 },
    { teamId: 'nzl', weight: 7 },
  ],
  H: [
    { teamId: 'esp', weight: 80 },
    { teamId: 'uru', weight: 15 },
    { teamId: 'ksa', weight: 3 },
    { teamId: 'cpv', weight: 2 },
  ],
  I: [
    { teamId: 'fra', weight: 72 },
    { teamId: 'nor', weight: 15 },
    { teamId: 'sen', weight: 10 },
    { teamId: 'irq', weight: 3 },
  ],
  J: [
    { teamId: 'arg', weight: 70 },
    { teamId: 'aut', weight: 15 },
    { teamId: 'alg', weight: 12 },
    { teamId: 'jor', weight: 3 },
  ],
  K: [
    { teamId: 'por', weight: 55 },
    { teamId: 'col', weight: 30 },
    { teamId: 'uzb', weight: 10 },
    { teamId: 'cod', weight: 5 },
  ],
  L: [
    { teamId: 'eng', weight: 65 },
    { teamId: 'cro', weight: 20 },
    { teamId: 'gha', weight: 10 },
    { teamId: 'pan', weight: 5 },
  ],
};

const pickWeightedTeamId = (choices = [], fallbackTeamIds = []) => {
  const normalizedChoices = choices
    .filter((choice) => fallbackTeamIds.includes(choice.teamId))
    .map((choice) => ({ ...choice, weight: Math.max(0, Number(choice.weight) || 0) }));

  const totalWeight = normalizedChoices.reduce((sum, choice) => sum + choice.weight, 0);
  if (totalWeight <= 0) {
    return fallbackTeamIds[0] || null;
  }

  let roll = Math.random() * totalWeight;
  for (const choice of normalizedChoices) {
    roll -= choice.weight;
    if (roll <= 0) return choice.teamId;
  }

  return normalizedChoices[normalizedChoices.length - 1]?.teamId ?? fallbackTeamIds[0] ?? null;
};

const buildGuaranteedLeaderGroupMatches = (matches, leaderTeamId, teamsMap) =>
  matches.map((match) => {
    if (match.home === leaderTeamId) {
      const awayGoals = Math.floor(Math.random() * 2);
      const homeGoals = awayGoals + 1 + Math.floor(Math.random() * 3);
      return { ...match, homeGoals, awayGoals };
    }

    if (match.away === leaderTeamId) {
      const homeGoals = Math.floor(Math.random() * 2);
      const awayGoals = homeGoals + 1 + Math.floor(Math.random() * 3);
      return { ...match, homeGoals, awayGoals };
    }

    const home = teamsMap[match.home];
    const away = teamsMap[match.away];
    const [homeGoals, awayGoals] = simulateScore(home, away);
    return { ...match, homeGoals, awayGoals };
  });

const applyManualPlacements = (outcomes, manualGroupPlacements = {}) => {
  if (!manualGroupPlacements || Object.keys(manualGroupPlacements).length === 0) {
    return outcomes;
  }

  const standingsByGroup = {};
  const winners = {};
  const runners = {};
  const thirds = [];

  GROUPS.forEach((group) => {
    const currentStandings = outcomes.standingsByGroup[group.id] || [];
    const currentByTeamId = Object.fromEntries(currentStandings.map((row) => [row.teamId, row]));
    const placement = manualGroupPlacements[group.id] || {};

    const forcedTeamIds = [1, 2, 3, 4]
      .map((place) => placement[place])
      .filter((teamId, index, arr) => Boolean(teamId) && arr.indexOf(teamId) === index && currentByTeamId[teamId]);

    const remaining = currentStandings.filter((row) => !forcedTeamIds.includes(row.teamId)).map((row) => row.teamId);
    const orderedTeamIds = [...forcedTeamIds, ...remaining];
    const nextStandings = orderedTeamIds.map((teamId) => currentByTeamId[teamId]).filter(Boolean);

    standingsByGroup[group.id] = nextStandings;
    winners[group.id] = nextStandings[0]?.teamId ?? null;
    runners[group.id] = nextStandings[1]?.teamId ?? null;

    if (nextStandings[2]) {
      thirds.push({ ...nextStandings[2], group: group.id });
    }
  });

  const rankedThirds = [...thirds].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return b.strength - a.strength;
  });

  return {
    ...outcomes,
    standingsByGroup,
    winners,
    runners,
    rankedThirds,
    bestThirds: rankedThirds.slice(0, 8),
  };
};

const recomputeTournament = (groupMatches, teamsMap, manualGroupPlacements, stageLocked = false) => {
  const baseOutcomes = computeGroupResults(groupMatches, teamsMap);
  const outcomes = applyManualPlacements(baseOutcomes, manualGroupPlacements);
  const bracket = stageLocked ? buildBracket(outcomes) : buildBlankBracket(outcomes);
  return { outcomes, bracket };
};

const buildBlankBracket = (outcomes) => {
  const seededBracket = buildBracket(outcomes);
  const clearRound = (matches = []) => matches.map((match) => ({
    ...match,
    teamA: null,
    teamB: null,
    winner: null,
    loser: null,
    scoreA: null,
    scoreB: null,
  }));

  return {
    ...seededBracket,
    r32: clearRound(seededBracket.r32),
    r16: clearRound(seededBracket.r16),
    qf: clearRound(seededBracket.qf),
    sf: clearRound(seededBracket.sf),
    third: clearRound(seededBracket.third),
    final: clearRound(seededBracket.final),
    champion: null,
  };
};

const buildSequentialPlacement = (groupId, placement = {}) => {
  const group = GROUPS.find((entry) => entry.id === groupId);
  if (!group) return placement;

  const current = { ...placement };
  delete current[4];

  const orderedManualTeamIds = [1, 2, 3]
    .map((place) => current[place])
    .filter((teamId, index, arr) => Boolean(teamId) && arr.indexOf(teamId) === index);

  const normalized = {};
  orderedManualTeamIds.forEach((teamId, index) => {
    normalized[index + 1] = teamId;
  });

  if (orderedManualTeamIds.length === 3) {
    const remainingTeamId = group.teams.map((team) => team.id).find((teamId) => !orderedManualTeamIds.includes(teamId));
    if (remainingTeamId) {
      normalized[4] = remainingTeamId;
    }
  }

  return normalized;
};

const isLegacyZeroInitializedGroupMatches = (groupMatches = {}) => {
  const groups = Object.values(groupMatches);
  if (!groups.length) return false;

  return groups.every(
    (matches) =>
      Array.isArray(matches) &&
      matches.every((match) => Number(match?.homeGoals) === 0 && Number(match?.awayGoals) === 0)
  );
};

const normalizeGroupMatchesForHydration = (groupMatches = {}) => {
  if (!isLegacyZeroInitializedGroupMatches(groupMatches)) {
    return groupMatches;
  }

  return Object.fromEntries(
    Object.entries(groupMatches).map(([groupId, matches]) => [
      groupId,
      matches.map((match) => ({
        ...match,
        homeGoals: '',
        awayGoals: '',
      })),
    ])
  );
};

const baseState = () => {
  const groupMatches = initialGroupMatches();
  const manualGroupPlacements = {};
  const { outcomes, bracket } = recomputeTournament(groupMatches, teamMap, manualGroupPlacements, false);

  return {
    teamMap,
    groupMatches,
    manualGroupPlacements,
    outcomes,
    bracket,
    stageLocked: false,
    liveDataLocked: false,
    theme: 'dark',
  };
};

export const useTournamentStore = create(
  persist(
    (set, get) => ({
      ...baseState(),

      setTheme: (theme) => set({ theme }),

      resetAll: () => {
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('fifa-2026-simulator-v1');
        }

        set(() => {
          const groupMatches = initialGroupMatches();
          const manualGroupPlacements = {};
          const baseOutcomes = computeGroupResults(groupMatches, teamMap);
          const outcomes = applyManualPlacements(baseOutcomes, manualGroupPlacements);
          const bracket = buildBlankBracket(outcomes);

          return {
            teamMap,
            groupMatches,
            manualGroupPlacements,
            outcomes,
            bracket,
            stageLocked: false,
            liveDataLocked: false,
            theme: 'dark',
          };
        });
      },

      setGroupPlacement: (groupId, teamId, place) => {
        set((state) => {
          if (state.stageLocked) return state;
          if (!groupId || !teamId) return state;

          const normalizedPlace = Math.min(4, Math.max(1, Number(place) || 1));
          const currentPlacement = { ...(state.manualGroupPlacements[groupId] || {}) };

          Object.keys(currentPlacement).forEach((key) => {
            if (currentPlacement[key] === teamId || Number(key) === normalizedPlace) {
              delete currentPlacement[key];
            }
          });

          currentPlacement[normalizedPlace] = teamId;

          const manualGroupPlacements = {
            ...state.manualGroupPlacements,
            [groupId]: currentPlacement,
          };

          const { outcomes, bracket } = recomputeTournament(state.groupMatches, state.teamMap, manualGroupPlacements, state.stageLocked);
          return { manualGroupPlacements, outcomes, bracket };
        });
      },

      toggleGroupPlacement: (groupId, teamId) => {
        set((state) => {
          if (state.stageLocked) return state;
          if (!groupId || !teamId) return state;

          const currentPlacement = { ...(state.manualGroupPlacements[groupId] || {}) };
          const assignedPlace = Number(
            Object.entries(currentPlacement).find(([, placedTeamId]) => placedTeamId === teamId)?.[0] || 0
          );

          delete currentPlacement[4];

          if (assignedPlace > 0) {
            delete currentPlacement[assignedPlace];
          } else {
            const usedPlaces = new Set(
              Object.entries(currentPlacement)
                .filter(([, placedTeamId]) => Boolean(placedTeamId))
                .map(([key]) => Number(key))
            );
            const nextPlace = [1, 2, 3].find((place) => !usedPlaces.has(place));
            if (!nextPlace) return state;
            currentPlacement[nextPlace] = teamId;
          }

          const normalizedPlacement = buildSequentialPlacement(groupId, currentPlacement);
          const manualGroupPlacements = {
            ...state.manualGroupPlacements,
            [groupId]: normalizedPlacement,
          };

          if (!Object.keys(normalizedPlacement).length) {
            delete manualGroupPlacements[groupId];
          }

          const { outcomes, bracket } = recomputeTournament(state.groupMatches, state.teamMap, manualGroupPlacements, state.stageLocked);
          return { manualGroupPlacements, outcomes, bracket };
        });
      },

      clearGroupPlacement: (groupId) => {
        set((state) => {
          if (state.stageLocked) return state;
          if (!groupId || !state.manualGroupPlacements[groupId]) return state;

          const manualGroupPlacements = { ...state.manualGroupPlacements };
          delete manualGroupPlacements[groupId];

          const { outcomes, bracket } = recomputeTournament(state.groupMatches, state.teamMap, manualGroupPlacements, state.stageLocked);
          return { manualGroupPlacements, outcomes, bracket };
        });
      },

      clearAllGroupPlacements: () => {
        set((state) => {
          if (state.stageLocked) return state;
          if (!Object.keys(state.manualGroupPlacements || {}).length) return state;

          const manualGroupPlacements = {};
          const { outcomes, bracket } = recomputeTournament(state.groupMatches, state.teamMap, manualGroupPlacements, state.stageLocked);
          return { manualGroupPlacements, outcomes, bracket };
        });
      },

      updateGroupMatch: (groupId, matchId, side, value) => {
        set((state) => {
          if (state.stageLocked) return state;
          const nextValue = value === '' ? '' : Number.isFinite(Number(value)) ? Math.max(0, Math.min(9, Number(value))) : '';
          const updatedGroup = state.groupMatches[groupId].map((match) =>
            match.id === matchId ? { ...match, [side]: nextValue } : match
          );

          const groupMatches = { ...state.groupMatches, [groupId]: updatedGroup };
          const { outcomes, bracket } = recomputeTournament(groupMatches, state.teamMap, state.manualGroupPlacements, state.stageLocked);

          return { groupMatches, outcomes, bracket };
        });
      },

      autoSimulateGroups: () => {
        set((state) => {
          if (state.stageLocked) return state;

          const groupMatches = Object.fromEntries(
            GROUPS.map((group) => {
              const groupTeamIds = group.teams.map((team) => team.id);
              const leaderTeamId =
                pickWeightedTeamId(GROUP_WINNER_PROBABILITIES[group.id], groupTeamIds) || groupTeamIds[0];
              const matches = buildGuaranteedLeaderGroupMatches(state.groupMatches[group.id], leaderTeamId, state.teamMap);
              return [group.id, matches];
            })
          );

          const { outcomes, bracket } = recomputeTournament(groupMatches, state.teamMap, state.manualGroupPlacements, state.stageLocked);

          return { groupMatches, outcomes, bracket };
        });
      },

      lockGroupsAndStartKnockout: () =>
        set((state) => {
          const { outcomes, bracket } = recomputeTournament(state.groupMatches, state.teamMap, state.manualGroupPlacements, true);
          return { stageLocked: true, outcomes, bracket };
        }),

      setMatchTeam: (roundKey, matchIndex, slotKey, teamId) => {
        set((state) => {
          const bracket = structuredClone(state.bracket);
          const round = bracket[roundKey];
          if (!round?.[matchIndex]) return state;
          if (slotKey !== 'teamA' && slotKey !== 'teamB') return state;

          const match = round[matchIndex];
          const nextValue = teamId || null;
          const updatedMatch = {
            ...match,
            [slotKey]: nextValue,
            winner: null,
            loser: null,
            scoreA: null,
            scoreB: null,
          };

          if (updatedMatch.teamA && updatedMatch.teamA === updatedMatch.teamB) {
            return state;
          }

          round[matchIndex] = updatedMatch;

          if (roundKey === 'r32') {
            bracket.r16 = bracket.r16.map((m) => ({ ...m, teamA: null, teamB: null, winner: null, loser: null, scoreA: null, scoreB: null }));
            bracket.qf = bracket.qf.map((m) => ({ ...m, teamA: null, teamB: null, winner: null, loser: null, scoreA: null, scoreB: null }));
            bracket.sf = bracket.sf.map((m) => ({ ...m, teamA: null, teamB: null, winner: null, loser: null, scoreA: null, scoreB: null }));
            bracket.third = bracket.third.map((m) => ({ ...m, teamA: null, teamB: null, winner: null, loser: null, scoreA: null, scoreB: null }));
            bracket.final = bracket.final.map((m) => ({ ...m, teamA: null, teamB: null, winner: null, loser: null, scoreA: null, scoreB: null }));
            bracket.champion = null;
          }

          return { bracket };
        });
      },

      setWinner: (roundKey, matchIndex, winnerId, scoreData = null) => {
        set((state) => {
          const bracket = structuredClone(state.bracket);
          const match = bracket[roundKey]?.[matchIndex];
          if (!match?.teamA || !match?.teamB) return state;
          const updated = advanceWinner(bracket, roundKey, matchIndex, winnerId, scoreData);
          return {
            bracket: updated,
          };
        });
      },

      resetMatch: (roundKey, matchIndex) => {
        set((state) => {
          const bracket = structuredClone(state.bracket);
          const round = bracket[roundKey];
          if (!round?.[matchIndex]) return state;

          round[matchIndex] = {
            ...round[matchIndex],
            winner: null,
            loser: null,
            scoreA: null,
            scoreB: null,
          };

          const clearRound = (key) => {
            if (!Array.isArray(bracket[key])) return;
            bracket[key] = bracket[key].map((m) => ({ ...m, teamA: null, teamB: null, winner: null, loser: null, scoreA: null, scoreB: null }));
          };

          const order = ['r32', 'r16', 'qf', 'sf', 'third', 'final'];
          const start = order.indexOf(roundKey);
          if (start !== -1) {
            order.slice(start + 1).forEach(clearRound);
          }

          if (roundKey === 'r32') {
            clearRound('r16');
            clearRound('qf');
            clearRound('sf');
            clearRound('third');
            clearRound('final');
          }

          bracket.champion = null;
          return { bracket };
        });
      },

      autoSimulateRound: (roundKey) => {
        const state = get();
        const roundMatches = state.bracket[roundKey];
        roundMatches.forEach((match, index) => {
          if (!match.teamA || !match.teamB || match.winner) return;
          const teamA = state.teamMap[match.teamA];
          const teamB = state.teamMap[match.teamB];
          if (!teamA || !teamB) return;

          const winner = chooseWinner(teamA, teamB);
          let [scoreA, scoreB] = simulateScore(teamA, teamB);
          if (scoreA === scoreB) {
            if (winner === match.teamA) {
              scoreA += 1;
            } else {
              scoreB += 1;
            }
          }

          get().setWinner(roundKey, index, winner, {
            scoreA,
            scoreB,
          });
        });
      },

      applyLiveScores: (liveScores = []) => {
        let appliedCount = 0;

        set((state) => {
          if (!Array.isArray(liveScores) || !liveScores.length) return state;

          const mapped = mapLiveScoresIntoMatches(state.groupMatches, state.teamMap, liveScores);
          appliedCount = mapped.appliedCount;
          if (!appliedCount) return state;

          const { outcomes, bracket } = recomputeTournament(
            mapped.nextGroupMatches,
            state.teamMap,
            state.manualGroupPlacements,
            state.stageLocked
          );

          return {
            groupMatches: mapped.nextGroupMatches,
            outcomes,
            bracket,
            liveDataLocked: false,
          };
        });

        return appliedCount;
      },
    }),
    {
      name: 'fifa-2026-simulator-v1',
      partialize: (state) => ({
        groupMatches: state.groupMatches,
        manualGroupPlacements: state.manualGroupPlacements,
        outcomes: state.outcomes,
        bracket: state.bracket,
        stageLocked: state.stageLocked,
        liveDataLocked: state.liveDataLocked,
        theme: state.theme,
      }),
      merge: (persisted, current) => ({
        ...(() => {
          const merged = {
            ...current,
            ...persisted,
            teamMap: current.teamMap,
          };

          const normalizedGroupMatches = normalizeGroupMatchesForHydration(merged.groupMatches);

          if (!merged.stageLocked) {
            const { outcomes, bracket } = recomputeTournament(normalizedGroupMatches, current.teamMap, merged.manualGroupPlacements || {}, false);

            return {
              ...merged,
              groupMatches: normalizedGroupMatches,
              liveDataLocked: false,
              outcomes,
              bracket,
            };
          }

          return {
            ...merged,
            groupMatches: normalizedGroupMatches,
            liveDataLocked: false,
          };
        })(),
      }),
    }
  )
);
