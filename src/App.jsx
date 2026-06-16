import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import bracketThemeSong from './assets/WorldCup26 Bracket Theme.mp3';
import BracketView from './components/BracketView';
import ChampionOverlay from './components/ChampionOverlay';
import GroupStage from './components/GroupStage';
import { fetchLiveScores, saveGroupMatchesToFirebase, seedProvidedScoresIfNeeded } from './lib/liveScores';
import { getGroupMatchScheduleById } from './lib/schedule';
import { useTournamentStore } from './store/useTournamentStore';

const ACTIVE_SECTION_STORAGE_KEY = 'fifa-active-section';

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
    manualGroupPlacements,
    outcomes,
    bracket,
    stageLocked,
    liveDataLocked,
    updateGroupMatch,
    toggleGroupPlacement,
    clearGroupPlacement,
    clearAllGroupPlacements,
    autoSimulateGroups,
    setMatchTeam,
    setWinner,
    resetMatch,
    resetAll,
    applyLiveScores,
  } = useTournamentStore();

  const [showChampion, setShowChampion] = useState(false);
  const [selectedStandingTeamId, setSelectedStandingTeamId] = useState(null);
  const [teamSearchQuery, setTeamSearchQuery] = useState('');
  const bgmAudioRef = useRef(null);
  const [bgmEnabled, setBgmEnabled] = useState(false);
  const [isSavingScores, setIsSavingScores] = useState(false);
  const [activeSection, setActiveSection] = useState(() => {
    if (typeof window === 'undefined') return 'groups';
    const saved = window.localStorage.getItem(ACTIVE_SECTION_STORAGE_KEY);
    return saved === 'bracket' ? 'bracket' : 'groups';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(ACTIVE_SECTION_STORAGE_KEY, activeSection);
  }, [activeSection]);

  useEffect(() => {
    let cancelled = false;

    const syncLiveScores = async () => {
      try {
        await seedProvidedScoresIfNeeded();
        const liveScores = await fetchLiveScores();
        if (cancelled || !liveScores.length) return;
        applyLiveScores(liveScores);
      } catch (error) {
        console.warn('No se pudieron sincronizar marcadores desde Firebase.', error);
      }
    };

    syncLiveScores();

    const unsubscribeHydration = useTournamentStore.persist?.onFinishHydration?.(() => {
      syncLiveScores();
    });

    return () => {
      cancelled = true;
      if (typeof unsubscribeHydration === 'function') {
        unsubscribeHydration();
      }
    };
  }, [applyLiveScores]);

  useEffect(() => {
    const audio = bgmAudioRef.current;
    if (!audio) return;

    audio.loop = true;
    audio.volume = 0.3;

    if (!bgmEnabled) {
      audio.pause();
      return;
    }

    let cleaned = false;
    const playAttempt = () => {
      if (cleaned) return;
      audio.play().catch(() => {});
    };

    playAttempt();

    const resumeOnInteraction = () => {
      playAttempt();
      window.removeEventListener('pointerdown', resumeOnInteraction);
      window.removeEventListener('keydown', resumeOnInteraction);
    };

    window.addEventListener('pointerdown', resumeOnInteraction, { once: true });
    window.addEventListener('keydown', resumeOnInteraction, { once: true });

    return () => {
      cleaned = true;
      window.removeEventListener('pointerdown', resumeOnInteraction);
      window.removeEventListener('keydown', resumeOnInteraction);
    };
  }, [bgmEnabled]);

  const flattenedMatches = useMemo(
    () => Object.entries(groupMatches).flatMap(([groupId, matches]) => matches.map((match) => ({ ...match, groupId }))),
    [groupMatches]
  );

  const upcomingMatches = useMemo(() => {
    const now = new Date();
    const scheduledMatches = flattenedMatches.map((match) => {
      const scheduleEntry = getGroupMatchScheduleById(match.id);
      return {
        ...match,
        scheduleEntry,
        kickoffAt: scheduleEntry ? new Date(scheduleEntry.kickoffUtc) : null,
      };
    });

    const datedMatches = scheduledMatches
      .filter((match) => match.kickoffAt instanceof Date && !Number.isNaN(match.kickoffAt.getTime()))
      .sort((a, b) => a.kickoffAt.getTime() - b.kickoffAt.getTime());

    const futureMatches = datedMatches.filter((match) => match.kickoffAt >= now);
    if (futureMatches.length) return futureMatches.slice(0, 4);

    const latestPastMatches = [...datedMatches]
      .filter((match) => match.kickoffAt < now)
      .sort((a, b) => b.kickoffAt.getTime() - a.kickoffAt.getTime())
      .slice(0, 4)
      .reverse();

    if (latestPastMatches.length) return latestPastMatches;

    return flattenedMatches.slice(0, 4).map((match) => ({
      ...match,
      scheduleEntry: null,
      kickoffAt: null,
    }));
  }, [flattenedMatches]);

  const formatUpcomingKickoff = (kickoffAt) => {
    if (!kickoffAt) return 'Por definir';

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDay = new Date(kickoffAt.getFullYear(), kickoffAt.getMonth(), kickoffAt.getDate());
    const diffDays = Math.round((targetDay - today) / (24 * 60 * 60 * 1000));

    const timeText = new Intl.DateTimeFormat('es-MX', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(kickoffAt);

    if (diffDays === 0) return `Hoy · ${timeText}`;
    if (diffDays === 1) return `Mañana · ${timeText}`;

    const dateText = new Intl.DateTimeFormat('es-MX', {
      day: 'numeric',
      month: 'short',
    }).format(kickoffAt);

    return `${dateText} · ${timeText}`;
  };

  const standingsLeaders = useMemo(
    () =>
      Object.values(outcomes.standingsByGroup)
        .flat()
        .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf)
        .slice(0, 5),
    [outcomes]
  );

  const champion = useMemo(() => (bracket.champion ? teamMap[bracket.champion] : null), [bracket.champion, teamMap]);

  const searchableTeams = useMemo(
    () => Object.values(teamMap).sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [teamMap]
  );

  const selectedSearchTeam = useMemo(() => {
    const normalized = teamSearchQuery.trim().toLowerCase();
    if (!normalized) return null;
    return searchableTeams.find((team) => {
      const name = team.name.toLowerCase();
      const code = team.fifaCode.toLowerCase();
      return name === normalized || code === normalized || `${team.name} (${team.fifaCode})`.toLowerCase() === normalized;
    });
  }, [searchableTeams, teamSearchQuery]);

  const handleTeamSearchJump = (section) => {
    if (!selectedSearchTeam) return;
    setSelectedStandingTeamId(selectedSearchTeam.id);
    setActiveSection(section);
  };

  const handleWinnerPick = (roundKey, matchIndex, winnerId) => {
    if (!winnerId) return;
    setWinner(roundKey, matchIndex, winnerId);
    createTone();
    if (roundKey === 'final') {
      setShowChampion(true);
      setTimeout(() => setShowChampion(false), 3500);
    }
  };

  const handleSaveLiveData = async () => {
    setIsSavingScores(true);
    try {
      const savedCount = await saveGroupMatchesToFirebase(groupMatches, teamMap);
      if (!savedCount) return;
      const liveScores = await fetchLiveScores();
      applyLiveScores(liveScores);
    } catch (error) {
      console.warn('No se pudieron guardar los marcadores en Firebase.', error);
    } finally {
      setIsSavingScores(false);
    }
  };

  const rootTheme = 'theme-dark dark';

  return (
    <div className={`${rootTheme} a11y-mode min-h-screen bg-app text-[#0F172A] dark:text-[#FFFFFF]`}>
      <audio ref={bgmAudioRef} src={bracketThemeSong} preload="auto" />
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
              <p className="font-display text-5xl leading-none tracking-wide text-[#0F172A] dark:text-white">FIFA 2026</p>
              <p className="font-body text-sm text-[#334155] dark:text-[#A9B4C7]">48 equipos · 12 grupos · camino completo hasta coronar al campeón</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button
                onClick={autoSimulateGroups}
                disabled={liveDataLocked}
                className="rounded-full border border-[#2563EB] bg-white px-3 py-2 font-semibold text-[#1E3A8A] hover:bg-[#DBEAFE] dark:border-[#3B82F6] dark:bg-[#121A2B] dark:text-[#8FB4FF] dark:hover:bg-[#1A2740]"
              >
                Simular grupos automáticamente
              </button>
              <button
                onClick={resetAll}
                disabled={liveDataLocked}
                className="rounded-full border border-[#CBD5E1] bg-white px-3 py-2 text-[#1F2937] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#25324A] dark:bg-[#121A2B] dark:text-[#FFFFFF] dark:hover:bg-[#1A2740]"
              >
                Reiniciar
              </button>
              <button
                onClick={handleSaveLiveData}
                disabled={isSavingScores || liveDataLocked}
                className="rounded-full border border-[#2563EB] bg-white px-3 py-2 font-semibold text-[#1E3A8A] hover:bg-[#DBEAFE] dark:border-[#3B82F6] dark:bg-[#121A2B] dark:text-[#8FB4FF] dark:hover:bg-[#1A2740]"
              >
                {isSavingScores ? 'Guardando...' : 'Guardar datos'}
              </button>
            </div>
          </div>
        </motion.header>

        <section className="grid gap-4 lg:grid-cols-1">
          <article className="rounded-3xl border border-[#CBD5E1] bg-white p-5 shadow-[0_8px_22px_var(--shadow)] dark:border-[#2C2C34] dark:bg-[#18181B]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#64748B] dark:text-[#A1A1AA]">Próximos partidos</p>
            <div className="mt-3 space-y-3">
              {upcomingMatches.map((match) => (
                <div key={`upcoming-${match.id}`} className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 dark:border-[#2C2C34] dark:bg-[#111117]">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#334155] dark:text-[#D4D4D8]">Grupo {match.groupId}</span>
                    <span className="font-semibold text-[#2563EB] dark:text-[#8FB4FF]">{formatUpcomingKickoff(match.kickoffAt)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 font-semibold text-[#0F172A] dark:text-[#FAFAFA]">
                      <img className="h-5 w-5 rounded-full object-cover" src={`https://flagcdn.com/w40/${teamMap[match.home]?.code}.png`} alt={teamMap[match.home]?.name} loading="lazy" />
                      {teamMap[match.home]?.name}
                    </span>
                    <span className="font-black text-[#334155] dark:text-[#D4D4D8]">vs.</span>
                    <span className="flex items-center justify-end gap-2 text-right font-semibold text-[#0F172A] dark:text-[#FAFAFA]">
                      {teamMap[match.away]?.name}
                      <img className="h-5 w-5 rounded-full object-cover" src={`https://flagcdn.com/w40/${teamMap[match.away]?.code}.png`} alt={teamMap[match.away]?.name} loading="lazy" />
                    </span>
                  </div>
                </div>
              ))}
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
              Fase eliminatoria
            </button>
            <div className="ml-auto flex min-w-[280px] flex-wrap items-center gap-2">
              <input
                list="team-search-options"
                value={teamSearchQuery}
                onChange={(e) => setTeamSearchQuery(e.target.value)}
                placeholder="Buscar equipo o código FIFA"
                className="min-w-[220px] flex-1 rounded-full border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/25 dark:border-[#25324A] dark:bg-[#121A2B] dark:text-[#FFFFFF] dark:placeholder:text-[#7A879D]"
              />
              <datalist id="team-search-options">
                {searchableTeams.map((team) => (
                  <option key={team.id} value={`${team.name} (${team.fifaCode})`} />
                ))}
              </datalist>
              <button
                type="button"
                onClick={() => handleTeamSearchJump('groups')}
                disabled={!selectedSearchTeam}
                className="rounded-full border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-semibold text-[#1F2937] hover:bg-[#F1F5F9] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#25324A] dark:bg-[#121A2B] dark:text-[#A9B4C7] dark:hover:bg-[#1A2740]"
              >
                Ir a grupos
              </button>
              <button
                type="button"
                onClick={() => handleTeamSearchJump('bracket')}
                disabled={!selectedSearchTeam}
                className="rounded-full border border-[#2563EB] bg-white px-3 py-2 text-xs font-semibold text-[#1E3A8A] hover:bg-[#DBEAFE] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#3B82F6] dark:bg-[#121A2B] dark:text-[#8FB4FF] dark:hover:bg-[#1A2740]"
              >
                Ver en cruces
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-[#CBD5E1] bg-white p-3 md:p-4 dark:border-[#25324A] dark:bg-[#121A2B]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                {activeSection === 'groups' ? (
                  <GroupStage
                    teamMap={teamMap}
                    groupMatches={groupMatches}
                    outcomes={outcomes}
                    stageLocked={stageLocked || liveDataLocked}
                    onScoreChange={updateGroupMatch}
                    manualGroupPlacements={manualGroupPlacements}
                    onToggleGroupPlacement={toggleGroupPlacement}
                    onClearGroupPlacement={clearGroupPlacement}
                    onClearAllGroupPlacements={clearAllGroupPlacements}
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
              </motion.div>
            </AnimatePresence>
          </div>
        </section>
      </main>

      <button
        type="button"
        onClick={() => setBgmEnabled((value) => !value)}
        aria-label={bgmEnabled ? 'Pausar música' : 'Reproducir música'}
        className={`fixed bottom-4 right-4 z-30 rounded-full border px-4 py-2 text-xs font-semibold shadow-[0_6px_16px_rgba(15,23,42,0.22)] transition-colors ${
          bgmEnabled
            ? 'border-[#2563EB] bg-[#DBEAFE] text-[#1E3A8A] hover:bg-[#BFDBFE] dark:border-[#3B82F6]/60 dark:bg-[#1A2740] dark:text-[#8FB4FF] dark:hover:bg-[#203255]'
            : 'border-[#CBD5E1] bg-white text-[#1F2937] hover:bg-[#F8FAFC] dark:border-[#25324A] dark:bg-[#121A2B] dark:text-[#FFFFFF] dark:hover:bg-[#1A2740]'
        }`}
      >
        {bgmEnabled ? '⏸ Pausar música' : '▶'}
      </button>

    </div>
  );
}
