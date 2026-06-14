import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import html2canvas from 'html2canvas';
import BracketView from './components/BracketView';
import ChampionOverlay from './components/ChampionOverlay';
import GroupStage from './components/GroupStage';
import { useTournamentStore } from './store/useTournamentStore';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const createTone = () => {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(640, ctx.currentTime);
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
  oscillator.start();
  oscillator.stop(ctx.currentTime + 0.24);
};

export default function App() {
  const {
    teamMap,
    groupMatches,
    outcomes,
    bracket,
    stageLocked,
    theme,
    setTheme,
    updateGroupMatch,
    autoSimulateGroups,
    lockGroupsAndStartKnockout,
    setMatchTeam,
    setWinner,
    resetMatch,
    autoSimulateRound,
    resetAll,
  } = useTournamentStore();

  const [showChampion, setShowChampion] = useState(false);
  const [selectedStandingTeamId, setSelectedStandingTeamId] = useState(null);
  const [activeSection, setActiveSection] = useState('groups');

  const flattenedMatches = useMemo(
    () => Object.entries(groupMatches).flatMap(([groupId, matches]) => matches.map((match) => ({ ...match, groupId }))),
    [groupMatches]
  );

  const liveMatch = useMemo(() => {
    if (!flattenedMatches.length) return null;
    return [...flattenedMatches].sort((a, b) => b.homeGoals + b.awayGoals - (a.homeGoals + a.awayGoals))[0];
  }, [flattenedMatches]);

  const upcomingMatches = useMemo(() => flattenedMatches.slice(0, 4), [flattenedMatches]);

  const standingsLeaders = useMemo(
    () =>
      Object.values(outcomes.standingsByGroup)
        .flat()
        .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf)
        .slice(0, 5),
    [outcomes]
  );

  const champion = useMemo(() => (bracket.champion ? teamMap[bracket.champion] : null), [bracket.champion, teamMap]);

  const handleWinnerPick = (roundKey, matchIndex, winnerId) => {
    if (!winnerId) return;
    setWinner(roundKey, matchIndex, winnerId);
    createTone();
    if (roundKey === 'final') {
      setShowChampion(true);
      setTimeout(() => setShowChampion(false), 3500);
    }
  };

  const simulateEntire = async () => {
    autoSimulateGroups();
    lockGroupsAndStartKnockout();
    await delay(340);
    const rounds = ['r32', 'r16', 'qf', 'sf', 'third', 'final'];
    for (const round of rounds) {
      autoSimulateRound(round);
      await delay(360);
    }
    setShowChampion(true);
    setTimeout(() => setShowChampion(false), 3600);
  };

  const exportBracketImage = async () => {
    const node = document.getElementById('capture-root');
    if (!node) return;
    const canvas = await html2canvas(node, { backgroundColor: null });
    const link = document.createElement('a');
    link.download = 'fifa-2026-bracket.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const rootTheme = theme === 'dark' ? 'theme-dark dark' : 'theme-light light-mode';

  return (
    <div className={`${rootTheme} min-h-screen bg-app text-[#0F172A] dark:text-[#FFFFFF]`}>
      <div className="animated-bg" />
      <ChampionOverlay open={showChampion} champion={champion} />

      <main id="capture-root" className="relative z-10 mx-auto max-w-[1500px] space-y-6 px-4 py-6 md:px-8">
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="rounded-3xl border border-[#CBD5E1] bg-white p-5 shadow-[0_8px_22px_var(--shadow)] dark:border-[#25324A] dark:bg-[var(--gradient-header)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-display text-5xl leading-none tracking-wide text-[#0F172A] dark:text-white">Simulador FIFA 2026</p>
              <p className="font-body text-sm text-[#334155] dark:text-[#A9B4C7]">48 equipos · 12 grupos · camino completo hasta coronar al campeón</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button
                onClick={autoSimulateGroups}
                className="rounded-full border border-[#2563EB] bg-white px-3 py-2 font-semibold text-[#1E3A8A] hover:bg-[#DBEAFE] dark:border-[#3B82F6] dark:bg-[#121A2B] dark:text-[#8FB4FF] dark:hover:bg-[#1A2740]"
              >
                Simular grupos automáticamente
              </button>
              <button
                onClick={lockGroupsAndStartKnockout}
                className="rounded-full border border-[#059669] bg-white px-3 py-2 font-semibold text-[#065F46] hover:bg-[#ECFDF5] dark:border-[#10B981] dark:bg-[#121A2B] dark:text-[#10B981] dark:hover:bg-[#1A2740]"
              >
                Bloquear grupos
              </button>
              <button
                onClick={simulateEntire}
                className="rounded-full border border-[#FBBF24] bg-[var(--gradient-gold)] px-3 py-2 font-semibold text-[#FFFFFF] hover:brightness-105 dark:border-[#FBBF24]"
              >
                Simular torneo completo
              </button>
              <button onClick={resetAll} className="rounded-full border border-[#CBD5E1] bg-white px-3 py-2 text-[#1F2937] hover:bg-[#F8FAFC] dark:border-[#25324A] dark:bg-[#121A2B] dark:text-[#FFFFFF] dark:hover:bg-[#1A2740]">
                Reiniciar
              </button>
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                aria-label="Cambiar tema"
                className={`relative h-[24px] w-[44px] rounded-full border transition-all duration-200 ease-in-out ${
                  theme === 'dark' ? 'border-[#2C2C34] bg-[#18181B]' : 'border-[#CBD5E1] bg-[#E2E8F0]'
                }`}
              >
                <span
                  className={`absolute top-[1px] h-[20px] w-[20px] rounded-full bg-[#FFFFFF] text-[11px] leading-[20px] text-center transition-all duration-200 ease-in-out ${
                    theme === 'dark' ? 'left-[1px] text-[#0B0F1C]' : 'left-[21px] text-[#EA580C]'
                  }`}
                >
                  {theme === 'dark' ? '🌙' : '☀️'}
                </span>
              </button>
              <span className="rounded-full border border-[#CBD5E1] bg-white/80 px-3 py-1 text-[11px] font-semibold text-[#334155] dark:border-[#2C2C34] dark:bg-[#18181B] dark:text-[#D4D4D8]">
                {theme === 'dark' ? 'Night Fixture' : 'Day Match'}
              </span>
              <button
                onClick={exportBracketImage}
                className="rounded-full border border-[#2563EB] bg-white px-3 py-2 font-semibold text-[#1E3A8A] hover:bg-[#DBEAFE] dark:border-[#3B82F6] dark:bg-[#121A2B] dark:text-[#8FB4FF] dark:hover:bg-[#1A2740]"
              >
                Compartir como imagen
              </button>
            </div>
          </div>
        </motion.header>

        <section className="grid gap-4 lg:grid-cols-3">
          <article className="rounded-3xl border border-[#CBD5E1] bg-white p-5 shadow-[0_8px_22px_var(--shadow)] dark:border-[#2C2C34] dark:bg-[#18181B]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#64748B] dark:text-[#A1A1AA]">Live Score</p>
            {liveMatch ? (
              <>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-team-pop text-lg">{teamMap[liveMatch.home]?.name}</p>
                  <p className="text-live-score text-4xl leading-none">
                    {liveMatch.homeGoals} - {liveMatch.awayGoals}
                  </p>
                  <p className="text-team-pop text-lg text-right">{teamMap[liveMatch.away]?.name}</p>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="rounded-full bg-[#EF4444]/10 px-2 py-1 font-semibold text-[#EF4444]">🟥 0</span>
                  <span className="text-match-timer">{stageLocked ? "90'+" : "72'"} · Grupo {liveMatch.groupId}</span>
                  <span className="rounded-full bg-[#EAB308]/10 px-2 py-1 font-semibold text-[#EAB308]">🟨 2</span>
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm text-[#64748B] dark:text-[#A1A1AA]">No hay partidos disponibles.</p>
            )}
          </article>

          <article className="rounded-3xl border border-[#CBD5E1] bg-white p-5 shadow-[0_8px_22px_var(--shadow)] dark:border-[#2C2C34] dark:bg-[#18181B]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#64748B] dark:text-[#A1A1AA]">Upcoming Matches</p>
            <div className="mt-3 space-y-3">
              {upcomingMatches.map((match) => (
                <div key={`upcoming-${match.id}`} className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 dark:border-[#2C2C34] dark:bg-[#111117]">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#334155] dark:text-[#D4D4D8]">Grupo {match.groupId}</span>
                    <span className="text-match-timer">Kickoff +{match.id.split('-')[1]}0m</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-3 text-sm">
                    <span className="text-team-pop">{teamMap[match.home]?.name}</span>
                    <span className="font-black text-[#0F172A] dark:text-[#FAFAFA]">vs</span>
                    <span className="text-team-pop text-right">{teamMap[match.away]?.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-3xl border border-[#CBD5E1] bg-white p-5 shadow-[0_8px_22px_var(--shadow)] dark:border-[#2C2C34] dark:bg-[#18181B]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#64748B] dark:text-[#A1A1AA]">Team Standings</p>
            <div className="mt-3 space-y-2">
              {standingsLeaders.map((row, idx) => {
                const team = teamMap[row.teamId];
                return (
                  <div key={`leader-${row.teamId}`} className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 dark:border-[#2C2C34] dark:bg-[#111117]">
                    <div className="flex items-center gap-2">
                      <span className="w-5 text-xs font-bold text-[#64748B] dark:text-[#A1A1AA]">#{idx + 1}</span>
                      <span className="text-team-pop text-sm">{team?.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-live-score">{row.points} pts</span>
                      <span className="font-bold text-[#EA580C] dark:text-[#06B6D4]">GD {row.gd}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveSection('groups')}
              className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                activeSection === 'groups'
                  ? 'border-[#2563EB] bg-[#DBEAFE] text-[#1E3A8A] dark:border-[#3B82F6] dark:bg-[#1A2740] dark:text-[#8FB4FF]'
                  : 'border-[#CBD5E1] bg-[#FFFFFF] text-[#1F2937] hover:bg-[#F1F5F9] dark:border-[#25324A] dark:bg-[#121A2B] dark:text-[#A9B4C7] dark:hover:bg-[#1A2740]'
              }`}
            >
              Fase de grupos
            </button>
            <button
              onClick={() => setActiveSection('bracket')}
              className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                activeSection === 'bracket'
                  ? 'border-[#2563EB] bg-[#DBEAFE] text-[#1E3A8A] dark:border-[#3B82F6] dark:bg-[#1A2740] dark:text-[#8FB4FF]'
                  : 'border-[#CBD5E1] bg-[#FFFFFF] text-[#1F2937] hover:bg-[#F1F5F9] dark:border-[#25324A] dark:bg-[#121A2B] dark:text-[#A9B4C7] dark:hover:bg-[#1A2740]'
              }`}
            >
              Cuadro eliminatorio
            </button>
          </div>

          <div className="rounded-3xl border border-[#CBD5E1] bg-white p-3 md:p-4 dark:border-[#25324A] dark:bg-[#121A2B]">
            {activeSection === 'groups' ? (
              <GroupStage
                teamMap={teamMap}
                groupMatches={groupMatches}
                outcomes={outcomes}
                stageLocked={stageLocked}
                onScoreChange={updateGroupMatch}
                selectedTeamId={selectedStandingTeamId}
                onSelectTeam={setSelectedStandingTeamId}
              />
            ) : (
              <BracketView
                teamMap={teamMap}
                bracket={bracket}
                outcomes={outcomes}
                onPickWinner={handleWinnerPick}
                onSetMatchTeam={setMatchTeam}
                onResetMatch={resetMatch}
                stageLocked={stageLocked}
                selectedStandingTeamId={selectedStandingTeamId}
                onBackToGroups={() => setActiveSection('groups')}
              />
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
