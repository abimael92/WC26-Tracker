import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import bracketThemeSong from './assets/WorldCup26 Bracket Theme.mp3';
import BracketView from './components/BracketView';
import ChampionOverlay from './components/ChampionOverlay';
import GroupStage from './components/GroupStage';
import { fetchLiveScores, saveLiveScoreEntryToFirebase, seedProvidedScoresIfNeeded } from './lib/liveScores';
import { getGroupMatchScheduleById, getMatchSchedule } from './lib/schedule';
import { useTournamentStore } from './store/useTournamentStore';

const ACTIVE_SECTION_STORAGE_KEY = 'fifa-active-section';
const KNOCKOUT_ROUND_ORDER = ['r32', 'r16', 'qf', 'sf', 'third', 'final'];
const KNOCKOUT_ROUND_LABELS = {
  r32: 'Dieciseisavos',
  r16: 'Octavos',
  qf: 'Cuartos',
  sf: 'Semifinal',
  third: 'Tercer puesto',
  final: 'Final',
};
const KNOCKOUT_MATCH_ID_OFFSETS = {
  r32: 72,
  r16: 88,
  qf: 96,
  sf: 100,
  third: 102,
  final: 103,
};

const isScoreFilled = (value) => value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value));

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
    updateGroupMatch,
    toggleGroupPlacement,
    clearGroupPlacement,
    clearAllGroupPlacements,
    autoSimulateGroups,
    lockGroupsAndStartKnockout,
    autoSimulateRound,
    setMatchTeam,
    setWinner,
    setMatchScore,
    resetMatch,
    resetAll,
    applyLiveScores,
  } = useTournamentStore();

  const [showChampion, setShowChampion] = useState(false);
  const [selectedStandingTeamId, setSelectedStandingTeamId] = useState(null);
  const [teamSearchQuery, setTeamSearchQuery] = useState('');
  const bgmAudioRef = useRef(null);
  const isSyncingRef = useRef(false);
  const [bgmEnabled, setBgmEnabled] = useState(false);
  const [isSavingScores, setIsSavingScores] = useState(false);
  const [isSyncingScores, setIsSyncingScores] = useState(false);
  const [liveSyncMessage, setLiveSyncMessage] = useState('');
  const [liveScoresFeed, setLiveScoresFeed] = useState([]);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isPlayerModalOpen, setIsPlayerModalOpen] = useState(false);
  const [selectedScorer, setSelectedScorer] = useState(null);
  const [selectedFixtureKey, setSelectedFixtureKey] = useState('');
  const [saveForm, setSaveForm] = useState({
    group: '',
    homeTeam: '',
    awayTeam: '',
    homeScore: '',
    awayScore: '',
    status: 'FT',
  });
  const [goalRows, setGoalRows] = useState([{ team: '', player: '', minute: '', ownGoal: false, isPenalty: false }]);
  const [saveModalError, setSaveModalError] = useState('');
  const [activeSection, setActiveSection] = useState(() => {
    if (typeof window === 'undefined') return 'groups';
    const saved = window.localStorage.getItem(ACTIVE_SECTION_STORAGE_KEY);
    return saved === 'bracket' ? 'bracket' : 'groups';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(ACTIVE_SECTION_STORAGE_KEY, activeSection);
  }, [activeSection]);

  const areAllGroupMatchesComplete = useMemo(
    () =>
      Object.values(groupMatches).every(
        (matches) =>
          Array.isArray(matches) && matches.every((match) => isScoreFilled(match?.homeGoals) && isScoreFilled(match?.awayGoals))
      ),
    [groupMatches]
  );

  useEffect(() => {
    if (activeSection !== 'bracket') return;
    if (stageLocked) return;
    if (!areAllGroupMatchesComplete) return;
    lockGroupsAndStartKnockout();
  }, [activeSection, stageLocked, areAllGroupMatchesComplete, lockGroupsAndStartKnockout]);

  const withTimeout = async (promise, ms = 8000) => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = window.setTimeout(() => reject(new Error('SYNC_TIMEOUT')), ms);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const normalizeName = (value) =>
    String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  const toFlagEmoji = (countryCode) => {
    const code = String(countryCode || '').trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) return '🏳️';
    return String.fromCodePoint(...[...code].map((char) => 127397 + char.charCodeAt(0)));
  };

  const numericInput = (value) => String(value || '').replace(/[^0-9]/g, '');
  const emptyGoalRow = () => ({ team: '', player: '', minute: '', ownGoal: false, isPenalty: false });
  const parseGoalsCount = (value) => {
    const text = String(value ?? '').trim();
    if (text === '') return 0;
    const numeric = Number(text);
    if (!Number.isFinite(numeric) || numeric < 0) return 0;
    return Math.floor(numeric);
  };
  const minuteInput = (value) => {
    let cleaned = String(value || '').replace(/[^0-9+]/g, '');
    cleaned = cleaned.replace(/\++/g, '+');
    if (cleaned.startsWith('+')) cleaned = cleaned.slice(1);
    const firstPlus = cleaned.indexOf('+');
    if (firstPlus !== -1) {
      const base = cleaned.slice(0, firstPlus).replace(/\+/g, '');
      const extra = cleaned.slice(firstPlus + 1).replace(/\+/g, '');
      cleaned = `${base}+${extra}`;
    }
    return cleaned;
  };
  const isValidMinuteValue = (value) => value === '' || /^\d+(?:\+\d+)?$/.test(String(value || '').trim());
  const parseMinuteForSort = (value) => {
    const text = String(value ?? '').trim();
    if (!text) return Number.POSITIVE_INFINITY;
    const match = text.match(/^(\d+)(?:\+(\d+))?$/);
    if (!match) return Number.POSITIVE_INFINITY;
    const base = Number(match[1]);
    const extra = match[2] ? Number(match[2]) : 0;
    return base + (extra / 100);
  };
  const formatMinuteLabel = (value) => {
    const text = String(value ?? '').trim();
    return text ? `${text}'` : 'Min N/D';
  };

  const detectMatchId = ({ group, homeTeam, awayTeam, selectedFixture }) => {
    const normalizedGroup = String(group || '').trim().toUpperCase();
    const normalizedHome = normalizeName(homeTeam);
    const normalizedAway = normalizeName(awayTeam);

    const fromLiveFeed = liveScoresFeed.find((entry) => {
      const entryGroup = String(entry?.group || '').trim().toUpperCase();
      const entryHome = normalizeName(entry?.homeTeam);
      const entryAway = normalizeName(entry?.awayTeam);
      return (
        entryGroup === normalizedGroup &&
        ((entryHome === normalizedHome && entryAway === normalizedAway) ||
          (entryHome === normalizedAway && entryAway === normalizedHome))
      );
    });

    if (Number.isFinite(Number(fromLiveFeed?.matchId))) {
      return Number(fromLiveFeed.matchId);
    }

    const fromFixture = fixtureOptions.find((fixture) => {
      if (fixture.groupId !== normalizedGroup) return false;
      const fixtureHome = normalizeName(fixture.homeName);
      const fixtureAway = normalizeName(fixture.awayName);
      return (
        (fixtureHome === normalizedHome && fixtureAway === normalizedAway) ||
        (fixtureHome === normalizedAway && fixtureAway === normalizedHome)
      );
    });

    if (selectedFixture && Number.isFinite(Number(selectedFixture.scheduleMatchNumber))) {
      return Number(selectedFixture.scheduleMatchNumber);
    }

    if (fromFixture && Number.isFinite(Number(fromFixture.scheduleMatchNumber))) {
      return Number(fromFixture.scheduleMatchNumber);
    }

    return null;
  };

  const applyFixtureToSaveForm = (fixture) => {
    if (!fixture) return;
    setSaveForm((prev) => {
      const next = {
        ...prev,
        group: fixture.groupId || prev.group,
        homeTeam: fixture.homeName || prev.homeTeam,
        awayTeam: fixture.awayName || prev.awayTeam,
        homeScore: fixture.homeGoals === '' ? prev.homeScore : String(fixture.homeGoals),
        awayScore: fixture.awayGoals === '' ? prev.awayScore : String(fixture.awayGoals),
      };

      const homeGoals = parseGoalsCount(next.homeScore);
      const awayGoals = parseGoalsCount(next.awayScore);
      const slots = [
        ...Array.from({ length: homeGoals }, () => next.homeTeam || ''),
        ...Array.from({ length: awayGoals }, () => next.awayTeam || ''),
      ];

      setGoalRows((prevRows) => {
        if (!slots.length) return [];

        return slots.map((team, index) => {
          const prevRow = prevRows[index] || emptyGoalRow();
          return { ...prevRow, team };
        });
      });

      return next;
    });
  };

  const updateSaveFormField = (field, value) => {
    setSaveForm((prev) => {
      const next = {
        ...prev,
        [field]: value,
      };

      if (field === 'homeScore' || field === 'awayScore' || field === 'homeTeam' || field === 'awayTeam') {
        const homeGoals = parseGoalsCount(next.homeScore);
        const awayGoals = parseGoalsCount(next.awayScore);
        const slots = [
          ...Array.from({ length: homeGoals }, () => next.homeTeam || ''),
          ...Array.from({ length: awayGoals }, () => next.awayTeam || ''),
        ];

        setGoalRows((prevRows) => {
          if (!slots.length) return [];

          return slots.map((team, index) => {
            const prevRow = prevRows[index] || emptyGoalRow();
            return { ...prevRow, team };
          });
        });
      }

      return next;
    });
  };

  const logLiveScoresSnapshot = (liveScores, appliedCount) => {
    const normalized = (liveScores || [])
      .map((match) => ({
        matchId: Number(match?.matchId ?? 0),
        group: String(match?.group || '-'),
        homeTeam: String(match?.homeTeam || '-'),
        awayTeam: String(match?.awayTeam || '-'),
        score: `${match?.homeScore ?? '-'}-${match?.awayScore ?? '-'}`,
        status: String(match?.status || '-'),
      }))
      .sort((a, b) => a.matchId - b.matchId);

    console.group('[WC26] Live scores sync');
    console.info(`Total recibidos: ${normalized.length}`);
    console.info(`Aplicados en UI: ${appliedCount}`);
    console.table(normalized);
    console.groupEnd();
  };

  const syncLiveScores = async ({ seedIfEmpty = false } = {}) => {
    if (isSyncingRef.current) return 0;
    isSyncingRef.current = true;
    setIsSyncingScores(true);
    setLiveSyncMessage('Actualizando...');

    try {
      if (seedIfEmpty) {
        await withTimeout(seedProvidedScoresIfNeeded());
      }

      const liveScores = await withTimeout(fetchLiveScores());
      setLiveScoresFeed(liveScores);
      if (!liveScores.length) {
        setLiveSyncMessage('No hay datos en Firebase.');
        return 0;
      }

      const appliedCount = applyLiveScores(liveScores);
      logLiveScoresSnapshot(liveScores, appliedCount);
      setLiveSyncMessage(appliedCount ? `Actualizados (${appliedCount}).` : 'Actualizados.');
      return appliedCount;
    } catch (error) {
      console.warn('No se pudieron sincronizar marcadores desde Firebase.', error);
      setLiveSyncMessage('Error al Actualizar.');
      return 0;
    } finally {
      setIsSyncingScores(false);
      isSyncingRef.current = false;
    }
  };

  const isLiveDataUpdated = liveSyncMessage.startsWith('Actualizados');

  useEffect(() => {
    let cancelled = false;

    syncLiveScores({ seedIfEmpty: true });

    const unsubscribeHydration = useTournamentStore.persist?.onFinishHydration?.(() => {
      if (!cancelled) {
        syncLiveScores();
      }
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
    () => Object.entries(groupMatches).flatMap(([groupId, matches]) => matches.map((match, groupMatchIndex) => ({ ...match, groupId, groupMatchIndex }))),
    [groupMatches]
  );

  const getKnockoutMatchId = (roundKey, matchIndex) => {
    const offset = KNOCKOUT_MATCH_ID_OFFSETS[roundKey];
    if (!Number.isFinite(offset)) return null;
    return offset + matchIndex + 1;
  };

  const groupFixtureOptions = useMemo(
    () =>
      flattenedMatches.map((match) => ({
        scheduleEntry: getGroupMatchScheduleById(match.id),
        ...match,
        fixtureKey: `${match.groupId}-${match.groupMatchIndex}`,
        stageLabel: `Grupo ${match.groupId}`,
        homeName: teamMap[match.home]?.name || match.home,
        awayName: teamMap[match.away]?.name || match.away,
        homeFlag: toFlagEmoji(teamMap[match.home]?.code),
        awayFlag: toFlagEmoji(teamMap[match.away]?.code),
        scheduleMatchNumber: Number.isFinite(Number(getGroupMatchScheduleById(match.id)?.matchNumber))
          ? Number(getGroupMatchScheduleById(match.id).matchNumber)
          : null,
        isPlayed: match.homeGoals !== '' && match.awayGoals !== '',
      })),
    [flattenedMatches, teamMap]
  );

  const knockoutFixtureOptions = useMemo(
    () =>
      KNOCKOUT_ROUND_ORDER.flatMap((roundKey) =>
        (Array.isArray(bracket?.[roundKey]) ? bracket[roundKey] : []).map((match, matchIndex) => {
          const homeTeamId = match?.teamA || null;
          const awayTeamId = match?.teamB || null;
          const homeResolvedName = homeTeamId ? (teamMap[homeTeamId]?.name || homeTeamId) : '';
          const awayResolvedName = awayTeamId ? (teamMap[awayTeamId]?.name || awayTeamId) : '';

          return {
            id: match?.id || `${roundKey}-${matchIndex + 1}`,
            groupId: String(roundKey || '').toUpperCase(),
            roundKey,
            scheduleEntry: getMatchSchedule(roundKey, matchIndex),
            scheduleMatchNumber: getKnockoutMatchId(roundKey, matchIndex),
            fixtureKey: `KO-${roundKey}-${matchIndex}`,
            stageLabel: KNOCKOUT_ROUND_LABELS[roundKey] || String(roundKey || '').toUpperCase(),
            homeName: homeResolvedName,
            awayName: awayResolvedName,
            homeDisplayName: homeResolvedName || String(match?.slotA || 'Por definir'),
            awayDisplayName: awayResolvedName || String(match?.slotB || 'Por definir'),
            homeFlag: toFlagEmoji(teamMap[homeTeamId]?.code),
            awayFlag: toFlagEmoji(teamMap[awayTeamId]?.code),
            homeGoals: '',
            awayGoals: '',
            isPlayed: false,
          };
        })
      ),
    [bracket, teamMap]
  );

  const fixtureOptions = useMemo(() => [...groupFixtureOptions, ...knockoutFixtureOptions], [groupFixtureOptions, knockoutFixtureOptions]);

  const selectableFixtureOptions = useMemo(() => {
    const isSavedInDb = (fixture) =>
      liveScoresFeed.some((entry) => {
        const fixtureMatchId = Number(fixture.scheduleMatchNumber);
        const entryMatchId = Number(entry?.matchId);
        if (Number.isFinite(fixtureMatchId) && Number.isFinite(entryMatchId) && fixtureMatchId === entryMatchId) {
          return Number.isFinite(Number(entry?.homeScore)) && Number.isFinite(Number(entry?.awayScore));
        }

        const entryGroup = String(entry?.group || '').trim().toUpperCase();
        if (entryGroup !== fixture.groupId) return false;

        const entryHome = normalizeName(entry?.homeTeam);
        const entryAway = normalizeName(entry?.awayTeam);
        const fixtureHome = normalizeName(fixture.homeName);
        const fixtureAway = normalizeName(fixture.awayName);

        const samePair =
          (entryHome === fixtureHome && entryAway === fixtureAway) ||
          (entryHome === fixtureAway && entryAway === fixtureHome);

        if (!samePair) return false;

        return Number.isFinite(Number(entry?.homeScore)) && Number.isFinite(Number(entry?.awayScore));
      });

    return fixtureOptions
      .filter((fixture) => !fixture.isPlayed && !isSavedInDb(fixture))
      .sort((a, b) => {
        const aId = Number(a.scheduleMatchNumber);
        const bId = Number(b.scheduleMatchNumber);
        const aHasId = Number.isFinite(aId);
        const bHasId = Number.isFinite(bId);
        if (aHasId && bHasId) return aId - bId;
        if (aHasId) return -1;
        if (bHasId) return 1;
        return String(a.fixtureKey).localeCompare(String(b.fixtureKey));
      });
  }, [fixtureOptions, liveScoresFeed]);

  const savePhaseOptions = useMemo(() => {
    const orderedCodes = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'R32', 'R16', 'QF', 'SF', 'THIRD', 'FINAL'];
    const labelsByCode = {
      R32: 'Dieciseisavos',
      R16: 'Octavos',
      QF: 'Cuartos',
      SF: 'Semifinal',
      THIRD: 'Tercer puesto',
      FINAL: 'Final',
    };

    const availableCodes = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']);
    fixtureOptions.forEach((fixture) => {
      if (fixture?.groupId) availableCodes.add(String(fixture.groupId).toUpperCase());
    });

    return orderedCodes
      .filter((code) => availableCodes.has(code))
      .map((code) => ({
        code,
        label: labelsByCode[code] || `Grupo ${code}`,
      }));
  }, [fixtureOptions]);

  const hasPendingFixtures = selectableFixtureOptions.length > 0;
  const selectedFixtureForSave = selectableFixtureOptions.find((fixture) => fixture.fixtureKey === selectedFixtureKey) || null;
  const autoDetectedMatchId = detectMatchId({
    group: saveForm.group,
    homeTeam: saveForm.homeTeam,
    awayTeam: saveForm.awayTeam,
    selectedFixture: selectedFixtureForSave,
  });

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

  const topScorers = useMemo(() => {
    const scorerMap = new Map();

    liveScoresFeed.forEach((match) => {
      const goals = Array.isArray(match?.goals) ? match.goals : [];
      goals.forEach((goal) => {
        if (Boolean(goal?.ownGoal)) return;

        const player = String(goal?.player || '').trim();
        const normalizedPlayer = normalizeName(player);
        if (!normalizedPlayer) return;

        const team = String(goal?.team || '').trim() || 'N/D';
        const key = normalizedPlayer;
        const prev = scorerMap.get(key);
        const minuteRaw = String(goal?.minute ?? '').trim();
        const minute = minuteRaw || null;
        const matchHome = String(match?.homeTeam || '').trim();
        const matchAway = String(match?.awayTeam || '').trim();
        const normalizedGoalTeam = normalizeName(team);
        const opponent =
          normalizedGoalTeam === normalizeName(matchHome)
            ? matchAway
            : normalizedGoalTeam === normalizeName(matchAway)
              ? matchHome
              : '';

        const goalEvent = {
          matchId: Number.isFinite(Number(match?.matchId)) ? Number(match.matchId) : null,
          group: String(match?.group || '').trim().toUpperCase(),
          minute,
          homeTeam: matchHome || 'N/D',
          awayTeam: matchAway || 'N/D',
          team,
          opponent: opponent || 'N/D',
          score: `${match?.homeScore ?? '-'}-${match?.awayScore ?? '-'}`,
          isPenalty: Boolean(goal?.isPenalty),
          ownGoal: Boolean(goal?.ownGoal),
        };

        scorerMap.set(key, {
          player: prev?.player || player,
          team: prev?.team && prev.team !== 'N/D' ? prev.team : team,
          goals: (prev?.goals || 0) + 1,
          firstMinute: Math.min(prev?.firstMinute ?? Number.POSITIVE_INFINITY, parseMinuteForSort(minute)),
          goalEvents: [...(prev?.goalEvents || []), goalEvent],
        });
      });
    });

    return [...scorerMap.values()]
      .map((scorer) => ({
        ...scorer,
        goalEvents: [...(scorer.goalEvents || [])].sort((a, b) => {
          const idA = Number.isFinite(a?.matchId) ? a.matchId : Number.POSITIVE_INFINITY;
          const idB = Number.isFinite(b?.matchId) ? b.matchId : Number.POSITIVE_INFINITY;
          const minuteA = parseMinuteForSort(a?.minute);
          const minuteB = parseMinuteForSort(b?.minute);
          return idA - idB || minuteA - minuteB;
        }),
      }))
      .sort((a, b) => b.goals - a.goals || a.firstMinute - b.firstMinute || a.player.localeCompare(b.player, 'es'));
  }, [liveScoresFeed]);

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

  const handleAutoSimulateRound = (roundKey) => {
    if (!roundKey) return;
    autoSimulateRound(roundKey);
  };

  const handleSaveLiveData = async (entry) => {
    setIsSavingScores(true);
    setSaveModalError('');
    try {
      const saved = await saveLiveScoreEntryToFirebase(entry);
      if (!saved) {
        setSaveModalError('No se pudo guardar el partido. Revisa los datos.');
        return;
      }
      const liveScores = await fetchLiveScores();
      setLiveScoresFeed(liveScores);
      applyLiveScores(liveScores);
      setLiveSyncMessage(`Partido ${entry.matchId} guardado en Firebase.`);
      setIsSaveModalOpen(false);
      setSaveForm({ group: '', homeTeam: '', awayTeam: '', homeScore: '', awayScore: '', status: 'FT' });
      setSelectedFixtureKey('');
      setGoalRows([]);
    } catch (error) {
      console.warn('No se pudieron guardar los marcadores en Firebase.', error);
      setSaveModalError('No se pudo subir la información a Firebase.');
    } finally {
      setIsSavingScores(false);
    }
  };

  const handleSaveModalSubmit = (event) => {
    event.preventDefault();

    const homeScore = Number(saveForm.homeScore);
    const awayScore = Number(saveForm.awayScore);
    const group = saveForm.group.trim().toUpperCase();
    const homeTeam = saveForm.homeTeam.trim();
    const awayTeam = saveForm.awayTeam.trim();
    const matchId = autoDetectedMatchId;

    if (!Number.isFinite(matchId) || matchId <= 0) {
      setSaveModalError('No se pudo detectar el partido. Elige un partido de la lista.');
      return;
    }

    if (!group || !homeTeam || !awayTeam) {
      setSaveModalError('Completa fase y equipos.');
      return;
    }

    if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore) || homeScore < 0 || awayScore < 0) {
      setSaveModalError('El marcador debe tener goles válidos (0 o más).');
      return;
    }

    const expectedGoalsFromScore = homeScore + awayScore;

    if (goalRows.length !== expectedGoalsFromScore) {
      setSaveModalError(`Inconsistencia: marcador total ${expectedGoalsFromScore} pero hay ${goalRows.length} filas de gol.`);
      return;
    }

    const missingGoalData = goalRows.some((row) => {
      const team = String(row.team || '').trim();
      const player = String(row.player || '').trim();
      return !team || !player;
    });

    if (missingGoalData) {
      setSaveModalError('Completa equipo y jugador en cada gol.');
      return;
    }

    const homeGoalRows = goalRows.filter((row) => String(row.team || '').trim() === homeTeam).length;
    const awayGoalRows = goalRows.filter((row) => String(row.team || '').trim() === awayTeam).length;

    if (homeGoalRows !== homeScore || awayGoalRows !== awayScore) {
      setSaveModalError(
        `Los goles por equipo no cuadran. ${homeTeam}: ${homeGoalRows}/${homeScore}, ${awayTeam}: ${awayGoalRows}/${awayScore}.`
      );
      return;
    }

    const rawGoals = goalRows
      .map((row) => ({
        team: String(row.team || '').trim(),
        player: String(row.player || '').trim(),
        minute: String(row.minute || '').trim(),
        ownGoal: Boolean(row.ownGoal),
        isPenalty: Boolean(row.isPenalty),
      }));

    const hasInvalidMinute = rawGoals.some((row) => !isValidMinuteValue(row.minute));
    if (hasInvalidMinute) {
      setSaveModalError('Minuto inválido. Usa formato como 45, 90 o 45+2.');
      return;
    }

    const goals = rawGoals
      .map((row) => ({
        ...row,
        ...(row.minute ? { minute: row.minute } : {}),
        ...(row.ownGoal ? { ownGoal: true } : {}),
        ...(row.isPenalty ? { isPenalty: true } : {}),
      }));

    handleSaveLiveData({
      matchId,
      group,
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      status: saveForm.status || 'FT',
      goals,
    });
  };

  const updateGoalRow = (index, field, value) => {
    setGoalRows((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)));
  };

  const openSaveModal = ({ prefillGoal } = {}) => {
    const prefilledPlayer = String(prefillGoal?.player || '').trim();
    const prefilledTeamRaw = String(prefillGoal?.team || '').trim();
    setIsSaveModalOpen(true);
    setSaveModalError('');

    const firstFixture = selectableFixtureOptions[0];
    if (!firstFixture) {
      setSelectedFixtureKey('');
      setGoalRows([]);
      setSaveModalError('No hay partidos pendientes por guardar.');
      return;
    }

    setSelectedFixtureKey(firstFixture.fixtureKey);
    applyFixtureToSaveForm(firstFixture);

    const fixtureHome = String(firstFixture.homeName || '').trim();
    const fixtureAway = String(firstFixture.awayName || '').trim();
    let prefilledTeam = '';
    if (prefilledTeamRaw) {
      if (normalizeName(prefilledTeamRaw) === normalizeName(fixtureHome)) {
        prefilledTeam = fixtureHome;
      } else if (normalizeName(prefilledTeamRaw) === normalizeName(fixtureAway)) {
        prefilledTeam = fixtureAway;
      }
    }

    setGoalRows((prev) => {
      if (!prev.length) return prev;
      const [first, ...rest] = prev;
      return [
        {
          ...first,
          team: first.team || prefilledTeam,
          player: first.player || prefilledPlayer,
        },
        ...rest,
      ];
    });
  };

  const handleScorerClick = (scorer) => {
    setSelectedScorer(scorer || null);
    setIsPlayerModalOpen(true);
  };

  const rootTheme = 'theme-dark dark';

  return (
    <div className={`${rootTheme} a11y-mode min-h-screen overflow-x-hidden bg-app text-[#0F172A] dark:text-[#FFFFFF]`}>
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
                className="rounded-full border border-[#2563EB] bg-white px-3 py-2 font-semibold text-[#1E3A8A] hover:bg-[#DBEAFE] dark:border-[#3B82F6] dark:bg-[#121A2B] dark:text-[#8FB4FF] dark:hover:bg-[#1A2740]"
              >
                Simular grupos
              </button>
              <button
                onClick={resetAll}
                className="rounded-full border border-[#CBD5E1] bg-white px-3 py-2 text-[#1F2937] hover:bg-[#F8FAFC] dark:border-[#25324A] dark:bg-[#121A2B] dark:text-[#FFFFFF] dark:hover:bg-[#1A2740]"
              >
                Reiniciar
              </button>
              <button
                onClick={() => syncLiveScores()}
                disabled={isSyncingScores}
                className="rounded-full border border-[#2563EB] bg-white px-3 py-2 font-semibold text-[#1E3A8A] hover:bg-[#DBEAFE] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#3B82F6] dark:bg-[#121A2B] dark:text-[#8FB4FF] dark:hover:bg-[#1A2740]"
              >
                {isSyncingScores ? 'Actualizando...' : isLiveDataUpdated ? 'Actualizados' : 'Actualizar'}
              </button>
              <button
                onClick={() => openSaveModal()}
                disabled={isSavingScores}
                className="rounded-full border border-[#2563EB] bg-white px-3 py-2 font-semibold text-[#1E3A8A] hover:bg-[#DBEAFE] dark:border-[#3B82F6] dark:bg-[#121A2B] dark:text-[#8FB4FF] dark:hover:bg-[#1A2740]"
              >
                {isSavingScores ? 'Guardando...' : 'Guardar datos'}
              </button>
            </div>
          </div>
          {liveSyncMessage && (
            <p className="mt-2 text-xs text-[#475569] dark:text-[#9CA3AF]">{liveSyncMessage}</p>
          )}
        </motion.header>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-3xl border border-[#CBD5E1] bg-white/95 p-4 shadow-[0_8px_22px_var(--shadow)] sm:p-5 dark:border-[#2C2C34] dark:bg-[linear-gradient(180deg,#141B2A_0%,#101520_100%)]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#64748B] dark:text-[#A1A1AA]">Próximos partidos</p>
              <span className="rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#1D4ED8] dark:border-[#1E3A8A] dark:bg-[#10203A] dark:text-[#8FB4FF]">
                Agenda
              </span>
            </div>
            <div className="mt-3 space-y-3">
              {upcomingMatches.map((match) => (
                <div key={`upcoming-${match.id}`} className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-2.5 transition-colors hover:bg-[#F1F5F9] sm:p-3 dark:border-[#2C2C34] dark:bg-[#0F1626] dark:hover:bg-[#131D31]">
                  <div className="flex items-center justify-between gap-2 text-[11px] sm:text-xs">
                    <span className="rounded-full bg-[#E2E8F0] px-2 py-0.5 font-semibold text-[#334155] dark:bg-[#1A2740] dark:text-[#D4D4D8]">Grupo {match.groupId}</span>
                    <span className="font-semibold text-[#2563EB] dark:text-[#8FB4FF]">{formatUpcomingKickoff(match.kickoffAt)}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-[minmax(0,1fr)_58px_minmax(0,1fr)] sm:items-center">
                    <span className="flex min-w-0 items-center gap-2 font-semibold text-[#0F172A] dark:text-[#FAFAFA]">
                      <img className="h-5 w-5 rounded-full object-cover" src={`https://flagcdn.com/w40/${teamMap[match.home]?.code}.png`} alt={teamMap[match.home]?.name} loading="lazy" />
                      <span className="truncate">{teamMap[match.home]?.name}</span>
                    </span>
                    <span className="inline-flex w-fit items-center justify-center justify-self-center rounded-full border border-[#CBD5E1] px-2 py-0.5 text-center font-black text-[#334155] sm:mx-auto sm:w-[50px] dark:border-[#2E3B52] dark:text-[#D4D4D8]">vs.</span>
                    <span className="flex min-w-0 items-center justify-start gap-2 text-left font-semibold text-[#0F172A] sm:justify-end sm:text-right dark:text-[#FAFAFA]">
                      <img className="h-5 w-5 rounded-full object-cover sm:order-2" src={`https://flagcdn.com/w40/${teamMap[match.away]?.code}.png`} alt={teamMap[match.away]?.name} loading="lazy" />
                      <span className="truncate sm:order-1">{teamMap[match.away]?.name}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-3xl border border-[#CBD5E1] bg-white/95 p-5 shadow-[0_8px_22px_var(--shadow)] dark:border-[#2C2C34] dark:bg-[linear-gradient(180deg,#141B2A_0%,#101520_100%)]">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#64748B] dark:text-[#A1A1AA]">Goleadores</p>
              <span className="rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#1D4ED8] dark:border-[#1E3A8A] dark:bg-[#10203A] dark:text-[#8FB4FF]">
                Ranking
              </span>
            </div>
            <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto pb-2 pr-2 [scrollbar-width:thin] [scrollbar-color:#3B82F6_#E2E8F0] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-[#E2E8F0] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#3B82F6] dark:[scrollbar-color:#3B82F6_#0F1626] dark:[&::-webkit-scrollbar-track]:bg-[#0F1626]">
              {topScorers.length ? (
                topScorers.map((scorer, index) => (
                  <button
                    key={`${scorer.player}-${scorer.team}`}
                    type="button"
                    onClick={() => handleScorerClick(scorer)}
                    className="flex w-full items-center justify-between gap-2 rounded-2xl border border-[#D5E3FF] bg-[#F8FAFC] px-2.5 py-2 text-left transition-colors hover:bg-[#EEF5FF] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/35 sm:gap-3 sm:px-3 sm:py-2.5 dark:border-[#2C2C34] dark:bg-[#0F1626] dark:hover:bg-[#131D31]"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#DBEAFE] text-[11px] font-black text-[#1E3A8A] sm:h-7 sm:w-7 sm:text-xs dark:bg-[#1A2740] dark:text-[#8FB4FF]">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold leading-tight text-[#0F172A] sm:text-[15px] dark:text-[#FAFAFA]">
                          {scorer.player}
                        </p>
                        <p className="truncate text-xs text-[#475569] sm:text-sm dark:text-[#A1A1AA]">{scorer.team}</p>
                      </div>
                    </div>
                    <span className="inline-flex min-w-[72px] items-center justify-center rounded-full border border-[#93C5FD] bg-[#DBEAFE] px-2.5 py-1 text-xs font-extrabold text-[#1E3A8A] sm:min-w-[88px] sm:px-3 sm:py-1.5 sm:text-sm dark:border-[#1E3A8A] dark:bg-[#10203A] dark:text-[#8FB4FF]">
                      {scorer.goals} gol{scorer.goals === 1 ? '' : 'es'}
                    </span>
                  </button>
                ))
              ) : (
                <p className="text-sm text-[#64748B] dark:text-[#A1A1AA]">Sin datos de goleadores todavía.</p>
              )}
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
            <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:min-w-[280px]">
              <input
                list="team-search-options"
                value={teamSearchQuery}
                onChange={(e) => setTeamSearchQuery(e.target.value)}
                placeholder="Buscar equipo"
                className="w-full min-w-0 flex-1 rounded-full border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/25 sm:min-w-[220px] dark:border-[#25324A] dark:bg-[#121A2B] dark:text-[#FFFFFF] dark:placeholder:text-[#7A879D]"
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
                    stageLocked={stageLocked}
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
                    onAutoSimulateRound={handleAutoSimulateRound}
                    onSetMatchScore={setMatchScore}
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

      {isPlayerModalOpen && selectedScorer && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#020617]/70 px-4">
          <div className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-3xl border border-[#25324A] bg-[#0F172A] p-5 shadow-[0_20px_50px_rgba(2,6,23,0.6)] md:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold uppercase tracking-[0.18em] text-[#8FB4FF]">Detalle del jugador</p>
                <p className="mt-1 text-xl font-bold text-white">{selectedScorer.player}</p>
                <p className="text-sm text-[#A9B4C7]">{selectedScorer.team}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsPlayerModalOpen(false);
                  setSelectedScorer(null);
                }}
                className="rounded-full border border-[#2E3B52] px-2.5 py-1.5 text-sm font-semibold text-[#D4D4D8] hover:bg-[#1A2740]"
              >
                Cerrar
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#2E3B52] bg-[#111C31] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8FA3C7]">Total goles</p>
                <p className="mt-1 text-3xl font-black leading-none text-[#8FB4FF]">{selectedScorer.goals}</p>
                <p className="mt-1 text-xs text-[#7F8BA1]">Anotaciones registradas</p>
              </div>
              <div className="rounded-2xl border border-[#2E3B52] bg-[#111C31] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8FA3C7]">Partidos con gol</p>
                <p className="mt-1 text-3xl font-black leading-none text-[#8FB4FF]">
                  {
                    new Set(
                      (selectedScorer.goalEvents || [])
                        .map((event) => (Number.isFinite(event?.matchId) ? event.matchId : null))
                        .filter((matchId) => matchId !== null)
                    ).size
                  }
                </p>
                <p className="mt-1 text-xs text-[#7F8BA1]">Encuentros diferentes</p>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#A9B4C7]">Goles registrados</p>
              <div className="mt-2 max-h-[320px] space-y-2 overflow-y-auto pr-2 [scrollbar-width:thin] [scrollbar-color:#3B82F6_#1A2740] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-[#1A2740] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#3B82F6]">
                {selectedScorer.goalEvents?.length ? (
                  selectedScorer.goalEvents.map((event, index) => (
                    <div key={`goal-event-${event.matchId ?? 'x'}-${event.minute ?? 'nd'}-${index}`} className="rounded-xl border border-[#35507B] bg-[#111C31] px-3 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white">
                            Partido #{Number.isFinite(event.matchId) ? event.matchId : 'N/D'} · Grupo {event.group || 'N/D'}
                          </p>
                          <p className="mt-0.5 text-sm text-[#B5C2D8]">
                            {event.homeTeam || 'N/D'} vs. {event.awayTeam || 'N/D'}
                          </p>
                          <p className="mt-0.5 text-sm text-[#A9B4C7]">
                            Marcador final: {event.score}
                          </p>
                        </div>
                        <span className="rounded-full border border-[#3B82F6]/50 bg-[#0F2345] px-2.5 py-1 text-xs font-bold text-[#8FB4FF]">
                          {formatMinuteLabel(event.minute)}
                        </span>
                      </div>
                      <div className="mt-2">
                        <span className="rounded-full border border-[#2E3B52] bg-[#0B1425] px-2 py-0.5 text-xs font-semibold text-[#A9B4C7]">
                          Gol #{index + 1} · {event.team || selectedScorer.team}
                        </span>
                        {event.ownGoal ? (
                          <span className="ml-2 rounded-full border border-[#2E3B52] bg-[#0B1425] px-2 py-0.5 text-xs font-semibold text-[#A9B4C7]">
                            OG
                          </span>
                        ) : null}
                        {event.isPenalty ? (
                          <span className="ml-2 rounded-full border border-[#2E3B52] bg-[#0B1425] px-2 py-0.5 text-xs font-semibold text-[#A9B4C7]">
                            PEN
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[#A9B4C7]">Sin detalle de goles disponible.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isSaveModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#020617]/70 px-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-[#25324A] bg-[#0F172A] p-5 shadow-[0_20px_50px_rgba(2,6,23,0.6)] md:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold uppercase tracking-[0.18em] text-[#8FB4FF]">Subir resultado</p>
                <p className="mt-1 text-sm text-[#A9B4C7]">Ingresa marcador y goles del partido para guardar en Firebase.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (isSavingScores) return;
                  setIsSaveModalOpen(false);
                  setSaveModalError('');
                }}
                className="rounded-full border border-[#2E3B52] px-2.5 py-1.5 text-sm font-semibold text-[#D4D4D8] hover:bg-[#1A2740]"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={handleSaveModalSubmit} className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block md:col-span-2">
                  <span className="mb-1 block text-sm font-semibold text-[#A9B4C7]">Partido jugado</span>
                  <select
                    value={selectedFixtureKey}
                    onChange={(e) => {
                      const key = e.target.value;
                      setSelectedFixtureKey(key);
                      const fixture = selectableFixtureOptions.find((item) => item.fixtureKey === key);
                      applyFixtureToSaveForm(fixture);
                    }}
                    className="w-full rounded-xl border border-[#2E3B52] bg-[#111C31] px-3 py-2.5 text-base text-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/35"
                  >
                    {selectableFixtureOptions.length ? (
                      selectableFixtureOptions.map((fixture) => (
                        <option key={fixture.fixtureKey} value={fixture.fixtureKey}>
                          {`${fixture.stageLabel || fixture.groupId} · ${fixture.homeFlag} ${fixture.homeDisplayName || fixture.homeName || 'Por definir'} vs. ${fixture.awayFlag} ${fixture.awayDisplayName || fixture.awayName || 'Por definir'}`}
                        </option>
                      ))
                    ) : (
                      <option value="">Sin partidos pendientes</option>
                    )}
                  </select>
                </label>

                <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-sm font-semibold text-[#A9B4C7]">Match ID</span>
                    <input
                      value={Number.isFinite(autoDetectedMatchId) ? String(autoDetectedMatchId) : 'Sin detectar'}
                      readOnly
                      className="w-full rounded-xl border border-[#2E3B52] bg-[#0B1425] px-3 py-2.5 text-base font-semibold text-[#D4D4D8]"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-sm font-semibold text-[#A9B4C7]">Fase *</span>
                    <select
                      value={saveForm.group}
                      onChange={(e) => updateSaveFormField('group', e.target.value)}
                      className="w-full rounded-xl border border-[#2E3B52] bg-[#111C31] px-3 py-2.5 text-base text-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/35"
                    >
                      <option value="">Selecciona fase</option>
                      {savePhaseOptions.map((phase) => (
                        <option key={`phase-${phase.code}`} value={phase.code}>
                          {phase.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="block md:col-span-2 space-y-3">
                  <div className="grid gap-3 md:grid-cols-12">
                    <label className="block md:col-span-10">
                      <span className="mb-1 block text-sm font-semibold text-[#A9B4C7]">Equipo local *</span>
                      <select
                        value={saveForm.homeTeam}
                        onChange={(e) => updateSaveFormField('homeTeam', e.target.value)}
                        className="w-full rounded-xl border border-[#2E3B52] bg-[#111C31] px-3 py-2.5 text-base text-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/35"
                      >
                        <option value="">Selecciona equipo local</option>
                        {searchableTeams.map((team) => (
                          <option key={`home-${team.id}`} value={team.name}>
                            {`${toFlagEmoji(team.code)} ${team.name}`}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block md:col-span-2">
                      <span className="mb-1 block text-sm font-semibold text-[#A9B4C7]">Goles local *</span>
                      <input
                        value={saveForm.homeScore}
                        onChange={(e) => updateSaveFormField('homeScore', numericInput(e.target.value))}
                        className="w-full rounded-xl border border-[#2E3B52] bg-[#111C31] px-3 py-2.5 text-base text-white placeholder:text-[#7A879D] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/35"
                        placeholder="3"
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                      />
                    </label>
                  </div>

                  <div className="grid gap-3 md:grid-cols-12">
                    <label className="block md:col-span-10">
                      <span className="mb-1 block text-sm font-semibold text-[#A9B4C7]">Equipo visitante *</span>
                      <select
                        value={saveForm.awayTeam}
                        onChange={(e) => updateSaveFormField('awayTeam', e.target.value)}
                        className="w-full rounded-xl border border-[#2E3B52] bg-[#111C31] px-3 py-2.5 text-base text-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/35"
                      >
                        <option value="">Selecciona equipo visitante</option>
                        {searchableTeams.map((team) => (
                          <option key={`away-${team.id}`} value={team.name}>
                            {`${toFlagEmoji(team.code)} ${team.name}`}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block md:col-span-2">
                      <span className="mb-1 block text-sm font-semibold text-[#A9B4C7]">Goles visitante *</span>
                      <input
                        value={saveForm.awayScore}
                        onChange={(e) => updateSaveFormField('awayScore', numericInput(e.target.value))}
                        className="w-full rounded-xl border border-[#2E3B52] bg-[#111C31] px-3 py-2.5 text-base text-white placeholder:text-[#7A879D] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/35"
                        placeholder="1"
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#2E3B52] bg-[#111C31] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#A9B4C7]">Goles (equipo, jugador, minuto, OG, PEN)</p>
                  <span className="rounded-full border border-[#35507B] px-3 py-1 text-xs font-semibold text-[#8FB4FF]">
                    Total filas: {goalRows.length}
                  </span>
                </div>

                <div className="space-y-2">
                  {!goalRows.length ? (
                    <p className="rounded-lg border border-dashed border-[#2E3B52] bg-[#0D1628] px-3 py-2 text-sm text-[#A9B4C7]">
                      Sin goles. Si hay anotaciones, ingresa los goles de cada equipo para generar las filas automáticamente.
                    </p>
                  ) : null}
                  {goalRows.map((row, index) => (
                    <div key={`goal-row-${index}`} className="grid grid-cols-12 gap-2">
                      <select
                        value={row.team}
                        onChange={(e) => updateGoalRow(index, 'team', e.target.value)}
                        disabled
                        className="col-span-3 rounded-lg border border-[#2E3B52] bg-[#0D1628] px-2.5 py-2 text-sm text-white placeholder:text-[#7A879D] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/35"
                      >
                        <option value="">Equipo</option>
                        {saveForm.homeTeam ? <option value={saveForm.homeTeam}>{saveForm.homeTeam}</option> : null}
                        {saveForm.awayTeam ? <option value={saveForm.awayTeam}>{saveForm.awayTeam}</option> : null}
                      </select>
                      <input
                        value={row.player}
                        onChange={(e) => updateGoalRow(index, 'player', e.target.value)}
                        className="col-span-4 rounded-lg border border-[#2E3B52] bg-[#0D1628] px-2.5 py-2 text-sm text-white placeholder:text-[#7A879D] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/35"
                        placeholder="Jugador"
                      />
                      <input
                        value={row.minute}
                        onChange={(e) => updateGoalRow(index, 'minute', minuteInput(e.target.value))}
                        className="col-span-2 rounded-lg border border-[#2E3B52] bg-[#0D1628] px-2.5 py-2 text-sm text-white placeholder:text-[#7A879D] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/35"
                        placeholder="45 o 45+2"
                        type="text"
                        inputMode="numeric"
                      />
                      <label className="col-span-1 flex items-center justify-center rounded-lg border border-[#2E3B52] bg-[#0D1628] px-1 text-[11px] font-semibold text-[#A9B4C7]">
                        <input
                          type="checkbox"
                          checked={Boolean(row.ownGoal)}
                          onChange={(e) => updateGoalRow(index, 'ownGoal', e.target.checked)}
                          className="mr-1 h-3.5 w-3.5 accent-[#3B82F6]"
                        />
                        OG
                      </label>
                      <label className="col-span-1 flex items-center justify-center rounded-lg border border-[#2E3B52] bg-[#0D1628] px-1 text-[11px] font-semibold text-[#A9B4C7]">
                        <input
                          type="checkbox"
                          checked={Boolean(row.isPenalty)}
                          onChange={(e) => updateGoalRow(index, 'isPenalty', e.target.checked)}
                          className="mr-1 h-3.5 w-3.5 accent-[#3B82F6]"
                        />
                        PEN
                      </label>
                      <span className="col-span-1 flex items-center justify-center rounded-lg border border-[#2E3B52] bg-[#0B1425] text-[11px] font-semibold text-[#7A879D]">
                        {index + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {saveModalError && <p className="text-sm font-semibold text-[#FCA5A5]">{saveModalError}</p>}

              <button
                type="submit"
                disabled={isSavingScores || !hasPendingFixtures}
                className="w-full rounded-xl border border-[#3B82F6] bg-[#0B4BB3] px-4 py-2.5 text-base font-semibold text-white hover:bg-[#1D5FD0] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingScores ? 'Subiendo...' : 'Guardar'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
