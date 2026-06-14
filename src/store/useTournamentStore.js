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

const teamMap = createTeamMap();

const baseState = () => {
  const groupMatches = initialGroupMatches();
  const outcomes = computeGroupResults(groupMatches, teamMap);
  const bracket = buildBracket(outcomes);

  return {
    teamMap,
    groupMatches,
    outcomes,
    bracket,
    stageLocked: false,
    theme: 'dark',
  };
};

export const useTournamentStore = create(
  persist(
    (set, get) => ({
      ...baseState(),

      setTheme: (theme) => set({ theme }),

      resetAll: () => set({ ...baseState() }),

      updateGroupMatch: (groupId, matchId, side, value) => {
        set((state) => {
          if (state.stageLocked) return state;
          const numeric = Number.isFinite(Number(value)) ? Math.max(0, Math.min(9, Number(value))) : 0;
          const updatedGroup = state.groupMatches[groupId].map((match) =>
            match.id === matchId ? { ...match, [side]: numeric } : match
          );

          const groupMatches = { ...state.groupMatches, [groupId]: updatedGroup };
          const outcomes = computeGroupResults(groupMatches, state.teamMap);
          const bracket = buildBracket(outcomes);

          return { groupMatches, outcomes, bracket };
        });
      },

      autoSimulateGroups: () => {
        set((state) => {
          if (state.stageLocked) return state;

          const groupMatches = Object.fromEntries(
            GROUPS.map((group) => {
              const matches = state.groupMatches[group.id].map((match) => {
                const home = state.teamMap[match.home];
                const away = state.teamMap[match.away];
                const [homeGoals, awayGoals] = simulateScore(home, away);
                return { ...match, homeGoals, awayGoals };
              });
              return [group.id, matches];
            })
          );

          const outcomes = computeGroupResults(groupMatches, state.teamMap);
          const bracket = buildBracket(outcomes);

          return { groupMatches, outcomes, bracket };
        });
      },

      lockGroupsAndStartKnockout: () => set({ stageLocked: true }),

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
          };

          if (updatedMatch.teamA && updatedMatch.teamA === updatedMatch.teamB) {
            return state;
          }

          round[matchIndex] = updatedMatch;

          if (roundKey === 'r32') {
            bracket.r16 = bracket.r16.map((m) => ({ ...m, teamA: null, teamB: null, winner: null, loser: null }));
            bracket.qf = bracket.qf.map((m) => ({ ...m, teamA: null, teamB: null, winner: null, loser: null }));
            bracket.sf = bracket.sf.map((m) => ({ ...m, teamA: null, teamB: null, winner: null, loser: null }));
            bracket.third = bracket.third.map((m) => ({ ...m, teamA: null, teamB: null, winner: null, loser: null }));
            bracket.final = bracket.final.map((m) => ({ ...m, teamA: null, teamB: null, winner: null, loser: null }));
            bracket.champion = null;
          }

          return { bracket };
        });
      },

      setWinner: (roundKey, matchIndex, winnerId) => {
        set((state) => {
          if (!state.stageLocked && roundKey !== 'r32') return state;
          const bracket = structuredClone(state.bracket);
          const updated = advanceWinner(bracket, roundKey, matchIndex, winnerId);
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
          };

          const clearRound = (key) => {
            if (!Array.isArray(bracket[key])) return;
            bracket[key] = bracket[key].map((m) => ({ ...m, teamA: null, teamB: null, winner: null, loser: null }));
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
          const winner = chooseWinner(state.teamMap[match.teamA], state.teamMap[match.teamB]);
          get().setWinner(roundKey, index, winner);
        });
      },
    }),
    {
      name: 'fifa-2026-simulator-v1',
      partialize: (state) => ({
        groupMatches: state.groupMatches,
        outcomes: state.outcomes,
        bracket: state.bracket,
        stageLocked: state.stageLocked,
        theme: state.theme,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...persisted,
        teamMap: current.teamMap,
      }),
    }
  )
);
