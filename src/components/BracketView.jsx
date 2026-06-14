import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ROUND_LABELS } from '../data/teams';
import { getAllScheduleRows, getMatchSchedule, formatMatchScheduleLocal } from '../lib/schedule';
import { RUNNER_OPPONENT_RULES, THIRD_TO_WINNER_RULES, WINNER_THIRD_RULES } from '../lib/tournament';
import TeamPill from './TeamPill';

const sideRoundOrder = ['r32', 'r16', 'qf', 'sf'];
const compactRoundOrder = ['r32', 'r16', 'qf', 'sf', 'final', 'third'];
const LEFT_COLUMN_BY_ROUND = {
  r32: 1,
  r16: 2,
  qf: 3,
  sf: 4,
};
const RIGHT_COLUMN_BY_ROUND = {
  sf: 6,
  qf: 7,
  r16: 8,
  r32: 9,
};
const ROW_STARTS = {
  r32: [1, 3, 5, 7, 9, 11, 13, 15],
  r16: [2, 6, 10, 14],
  qf: [4, 12],
  sf: [8],
};
const TROPHY_ROW = 10;
const FINAL_ROW = 13;
const THIRD_ROW = 15;

const winnerThirdMappings = [
  'Partido 1: Ganador A vs 3.er lugar (B/C/D/E/F)',
  'Partido 2: Ganador B vs 3.er lugar (A/C/D/E/F)',
  'Partido 3: Ganador C vs 3.er lugar (A/B/D/E/F)',
  'Partido 4: Ganador D vs 3.er lugar (A/B/C/E/F)',
  'Partido 5: Ganador E vs 3.er lugar (A/B/C/D/F)',
  'Partido 6: Ganador F vs 3.er lugar (A/B/C/D/E)',
  'Partido 7: Ganador G vs 3.er lugar (H/I/J/K/L)',
  'Partido 8: Ganador H vs 3.er lugar (G/I/J/K/L)',
  'Partido 9: Ganador I vs 3.er lugar (G/H/J/K/L)',
  'Partido 10: Ganador J vs 3.er lugar (G/H/I/K/L)',
  'Partido 11: Ganador K vs 3.er lugar (G/H/I/J/L)',
  'Partido 12: Ganador L vs 3.er lugar (G/H/I/J/K)',
  'Partidos 13-16: equipos en 2.º lugar vs otros 2.º lugar del lado opuesto del bracket',
];

const colorLegend = {
  winner: 'text-[#D97706] dark:text-[#FBBF24]',
  runner: 'text-[#2563EB] dark:text-[#3B82F6]',
  third: 'text-[#D97706] dark:text-[#F59E0B]',
};

const formatGroupList = (groups) => groups.join(', ');

const formatSeedSlot = (slotText) => {
  if (!slotText) return 'Por definir';

  const winnerMatch = slotText.match(/ganador del Grupo\s+([A-L])/i);
  if (winnerMatch) return `Ganador Grupo ${winnerMatch[1]}`;

  const bestThirdMatch = slotText.match(/mejor 3\.er lugar de los Grupos\s+([A-L/]+)/i);
  if (bestThirdMatch) return `3.er Grupo ${bestThirdMatch[1]}`;

  const runnerGroupsMatch = slotText.match(/sublíder de los Grupos\s+([A-L/]+)/i);
  if (runnerGroupsMatch) return `Sublíder Grupo ${runnerGroupsMatch[1]}`;

  const runnerGroupMatch = slotText.match(/sublíder del Grupo\s+([A-L])/i);
  if (runnerGroupMatch) return `Sublíder Grupo ${runnerGroupMatch[1]}`;

  return slotText.includes(':') ? slotText.split(':').slice(1).join(':').trim() : slotText;
};

const getSlotCandidateIds = (slotText, outcomes) => {
  if (!slotText || !outcomes) return [];

  const winnerMatch = slotText.match(/ganador del Grupo\s+([A-L])/i);
  if (winnerMatch) {
    const teamId = outcomes.winners?.[winnerMatch[1]];
    return teamId ? [teamId] : [];
  }

  const bestThirdMatch = slotText.match(/mejor 3\.er lugar de los Grupos\s+([A-L/]+)/i);
  if (bestThirdMatch) {
    const groups = bestThirdMatch[1].split('/');
    return outcomes.bestThirds
      .filter((entry) => groups.includes(entry.group))
      .map((entry) => entry.teamId);
  }

  const runnerGroupsMatch = slotText.match(/sublíder de los Grupos\s+([A-L/]+)/i);
  if (runnerGroupsMatch) {
    return runnerGroupsMatch[1]
      .split('/')
      .map((group) => outcomes.runners?.[group])
      .filter(Boolean);
  }

  const runnerGroupMatch = slotText.match(/sublíder del Grupo\s+([A-L])/i);
  if (runnerGroupMatch) {
    const teamId = outcomes.runners?.[runnerGroupMatch[1]];
    return teamId ? [teamId] : [];
  }

  return [];
};

function buildTeamGuidance(team, outcomes, mode) {
  if (!team) return null;
  const standings = outcomes.standingsByGroup[team.group] || [];
  const rank = standings.findIndex((row) => row.teamId === team.id) + 1;

  const winnerTargets = WINNER_THIRD_RULES[team.group] || [];
  const runnerTargets = RUNNER_OPPONENT_RULES[team.group] || [];
  const thirdTargets = THIRD_TO_WINNER_RULES[team.group] || [];

  if (mode === 'simple') {
    return {
      rank,
      title: `Guía de ruta para ${team.name} (${team.fifaCode})`,
      lines: [
        `Si ${team.name} termina 1.º en el Grupo ${team.group} → enfrenta a un mejor 3.er lugar de ${formatGroupList(winnerTargets)}.`,
        `Si ${team.name} termina 2.º en el Grupo ${team.group} → enfrenta a otro 2.º lugar de ${formatGroupList(runnerTargets)}.`,
        `Si ${team.name} termina 3.º y clasifica → puede enfrentar a ganadores de grupo de ${formatGroupList(thirdTargets)}.`,
      ],
    };
  }

  return {
    rank,
    title: `Vista detallada de siembra para el Grupo ${team.group}`,
    lines: [
      `Regla del espacio del ganador (Grupo ${team.group}): 1${team.group} vs candidato de 3.er lugar de los grupos ${formatGroupList(winnerTargets)}.`,
      `Regla de cruce de sublíderes (Grupo ${team.group}): 2${team.group} puede emparejarse con un sublíder de ${formatGroupList(runnerTargets)}.`,
      `Mapa inverso de mejores terceros (Grupo ${team.group}): 3${team.group} puede quedar contra ganadores ${formatGroupList(thirdTargets)}.`,
    ],
  };
}

function BracketHelpBody({ mode }) {
  return (
    <div className="space-y-3 text-xs leading-relaxed text-[#0F172A] dark:text-[#FFFFFF] sm:text-sm">
      <p className="font-semibold text-[#2563EB] dark:text-[#3B82F6]">Cómo funciona el cuadro eliminatorio:</p>
      {mode === 'simple' ? (
        <>
          <p>
            <span className={colorLegend.winner}>Ganadores de grupo</span> juegan en su mayoría contra{' '}
            <span className={colorLegend.third}>Mejores terceros lugares</span>.
          </p>
          <p>
            Los <span className={colorLegend.runner}>sublíderes restantes</span> juegan cruces entre sublíderes.
          </p>
        </>
      ) : (
        <p>Los 2 mejores de cada grupo más los 8 mejores terceros avanzan a Dieciseisavos con reglas de siembra.</p>
      )}

      <div className="rounded-xl border border-[#E2E8F0] bg-[#F1F5F9] p-3 dark:border-[#1F2937] dark:bg-[#1A2235]">
        <p className="mb-2 text-[11px] uppercase tracking-wide text-[#475569] dark:text-[#9CA3AF]">Cruces de dieciseisavos (resumen)</p>
        <div className="grid gap-1">
          {winnerThirdMappings.map((line) => (
            <p key={line}>→ {line}</p>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-[#E2E8F0] bg-[#F1F5F9] p-3 dark:border-[#1F2937] dark:bg-[#1A2235]">
        <p className="mb-1 text-[11px] uppercase tracking-wide text-[#475569] dark:text-[#9CA3AF]">Ruta hacia octavos</p>
        <p>Ganador Partido 1 vs Ganador Partido 2</p>
        <p>Ganador Partido 3 vs Ganador Partido 4</p>
        <p>Ganador Partido 5 vs Ganador Partido 6</p>
        <p>Ganador Partido 7 vs Ganador Partido 8</p>
        <p>Ganador Partido 9 vs Ganador Partido 10</p>
        <p>Ganador Partido 11 vs Ganador Partido 12</p>
        <p>Más dos partidos de los cruces restantes entre sublíderes</p>
        <p className="mt-2 text-[#475569] dark:text-[#9CA3AF]">Después: Cuartos → Semifinales → Final + Tercer lugar.</p>
      </div>
    </div>
  );
}

function MatchCard({
  match,
  teamMap,
  outcomes,
  onPickWinner,
  onSetMatchTeam,
  roundKey,
  index,
  disabled,
  active,
  onActivate,
  scheduleText,
}) {
  const teamA = match.teamA ? teamMap[match.teamA] : null;
  const teamB = match.teamB ? teamMap[match.teamB] : null;
  const showSeedTemplate = roundKey === 'r32';
  const allTeams = Object.values(teamMap).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const candidateIdsA = showSeedTemplate ? getSlotCandidateIds(match.slotA, outcomes) : [];
  const candidateIdsB = showSeedTemplate ? getSlotCandidateIds(match.slotB, outcomes) : [];
  const optionTeamsA = (candidateIdsA.length ? candidateIdsA.map((id) => teamMap[id]).filter(Boolean) : allTeams).sort((a, b) =>
    a.name.localeCompare(b.name, 'es')
  );
  const optionTeamsB = (candidateIdsB.length ? candidateIdsB.map((id) => teamMap[id]).filter(Boolean) : allTeams).sort((a, b) =>
    a.name.localeCompare(b.name, 'es')
  );

  return (
    <>
      <motion.div
        layout
        className={`relative rounded-xl border p-3 transition-all ${
          active
            ? 'border-l-4 border-l-[#D97706] border-[#D97706] bg-[#F1F5F9] shadow-[0_4px_12px_rgba(15,23,42,0.08)] dark:border-l-[#FBBF24] dark:border-[#FBBF24] dark:bg-[#1A2235] dark:shadow-[0_4px_12px_rgba(0,0,0,0.3)]'
            : 'border-l-4 border-l-[#2563EB] border-[#E2E8F0] bg-white shadow-[0_2px_6px_rgba(15,23,42,0.08)] hover:scale-[1.02] hover:shadow-[0_4px_12px_rgba(15,23,42,0.08)] dark:border-l-[#3B82F6] dark:border-[#1F2937] dark:bg-[#141B2B] dark:shadow-[0_2px_6px_rgba(0,0,0,0.3)]'
        }`}
        transition={{ duration: 0.2 }}
        onClick={onActivate}
      >
        {showSeedTemplate ? (
          <div className="space-y-2">
            <select
              className="w-full rounded-md border border-[#E2E8F0] bg-white p-2 text-sm text-[#0F172A] dark:border-[#1F2937] dark:bg-[#141B2B] dark:text-[#FFFFFF]"
              value={match.teamA || ''}
              onChange={(e) => onSetMatchTeam?.(roundKey, index, 'teamA', e.target.value)}
            >
              <option value="">{formatSeedSlot(match.slotA)}</option>
              {optionTeamsA.map((team) => (
                <option key={team.id} value={team.id} disabled={team.id === match.teamB}>
                  {team.name}
                </option>
              ))}
            </select>
            <TeamPill team={teamA} compact />
            <select
              className="w-full rounded-md border border-[#E2E8F0] bg-white p-2 text-sm text-[#0F172A] dark:border-[#1F2937] dark:bg-[#141B2B] dark:text-[#FFFFFF]"
              value={match.teamB || ''}
              onChange={(e) => onSetMatchTeam?.(roundKey, index, 'teamB', e.target.value)}
            >
              <option value="">{formatSeedSlot(match.slotB)}</option>
              {optionTeamsB.map((team) => (
                <option key={team.id} value={team.id} disabled={team.id === match.teamA}>
                  {team.name}
                </option>
              ))}
            </select>
            <TeamPill team={teamB} compact />
          </div>
        ) : (
          <div className="space-y-2">
            <TeamPill team={teamA} compact />
            <TeamPill team={teamB} compact />
          </div>
        )}

        {!showSeedTemplate && (match.slotA || match.slotB) && (
          <div className="mt-2 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-1 text-[10px] text-[#475569] dark:border-[#1F2937] dark:bg-[#1A2235] dark:text-[#9CA3AF]">
            <p>{match.slotA || 'POR DEFINIR'} ⟷ {match.slotB || 'POR DEFINIR'}</p>
          </div>
        )}

        {teamA && teamB && (
          <select
            disabled={disabled}
            className="mt-2 w-full rounded-md border border-[#E2E8F0] bg-white p-1 text-xs text-[#0F172A] dark:border-[#1F2937] dark:bg-[#141B2B] dark:text-[#FFFFFF]"
            value={match.winner || ''}
            onChange={(e) => onPickWinner(roundKey, index, e.target.value)}
          >
            <option value="">Seleccionar ganador</option>
            <option value={teamA.id}>{teamA.name}</option>
            <option value={teamB.id}>{teamB.name}</option>
          </select>
        )}
      </motion.div>

      {scheduleText && <p className="mt-1 px-1 text-[10px] text-[#475569] dark:text-[#9CA3AF]">{scheduleText}</p>}
    </>
  );
}

export default function BracketView({
  teamMap,
  bracket,
  outcomes,
  onPickWinner,
  onSetMatchTeam,
  onResetMatch,
  stageLocked,
  selectedStandingTeamId,
  onBackToGroups,
}) {
  const isMobileViewport = () => window.matchMedia('(max-width: 767px)').matches;
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showQuickGuide, setShowQuickGuide] = useState(false);
  const [showScheduleView, setShowScheduleView] = useState(false);
  const [guideMode, setGuideMode] = useState('simple');
  const [activeBracketTab, setActiveBracketTab] = useState('partidos');
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? isMobileViewport() : false));
  const [mobileViewMode, setMobileViewMode] = useState(() => (typeof window !== 'undefined' && isMobileViewport() ? 'list' : 'bracket'));
  const [expandedRounds, setExpandedRounds] = useState(() => new Set(['r32']));
  const [showMobileMatchSheet, setShowMobileMatchSheet] = useState(false);
  const [mobileSheetRoundKey, setMobileSheetRoundKey] = useState('r32');
  const [mobileSheetMatchIndex, setMobileSheetMatchIndex] = useState(0);
  const [mobileTouchStartX, setMobileTouchStartX] = useState(0);
  const [mobilePressTimerId, setMobilePressTimerId] = useState(null);
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [selectedMatchRef, setSelectedMatchRef] = useState(null);
  const bracketScrollRef = useRef(null);
  const bracketCenterRef = useRef(null);

  const selectedStandingTeam = selectedStandingTeamId ? teamMap[selectedStandingTeamId] : null;
  const selectedTeamGuidance = useMemo(
    () => buildTeamGuidance(selectedStandingTeam, outcomes, guideMode),
    [selectedStandingTeam, outcomes, guideMode]
  );

  const selectedMatchSchedule = useMemo(() => {
    if (!selectedMatchRef) return null;
    const schedule = getMatchSchedule(selectedMatchRef.roundKey, selectedMatchRef.index);
    if (!schedule) return null;
    return {
      raw: schedule,
      local: formatMatchScheduleLocal(schedule),
    };
  }, [selectedMatchRef]);

  const mobileSheetMatch = useMemo(() => {
    const round = bracket[mobileSheetRoundKey] || [];
    return round[mobileSheetMatchIndex] || null;
  }, [bracket, mobileSheetRoundKey, mobileSheetMatchIndex]);

  const mobileSheetSchedule = useMemo(() => {
    if (!mobileSheetMatch) return null;
    const schedule = getMatchSchedule(mobileSheetRoundKey, mobileSheetMatchIndex);
    if (!schedule) return null;
    return {
      raw: schedule,
      local: formatMatchScheduleLocal(schedule),
    };
  }, [mobileSheetMatch, mobileSheetRoundKey, mobileSheetMatchIndex]);

  const allScheduleRows = useMemo(() => getAllScheduleRows(), []);

  const mobileRoundMeta = useMemo(
    () => [
      { key: 'r32', label: 'RO32', fullLabel: ROUND_LABELS.r32 },
      { key: 'r16', label: 'R16', fullLabel: ROUND_LABELS.r16 },
      { key: 'qf', label: 'QF', fullLabel: ROUND_LABELS.qf },
      { key: 'sf', label: 'SF', fullLabel: ROUND_LABELS.sf },
      { key: 'final', label: 'F', fullLabel: ROUND_LABELS.final },
      { key: 'third', label: '3°', fullLabel: ROUND_LABELS.third },
    ],
    []
  );

  const getScheduleText = (roundKey, index) => {
    const schedule = getMatchSchedule(roundKey, index);
    const local = schedule ? formatMatchScheduleLocal(schedule) : null;
    if (!schedule || !local) return null;
    return `${local.dateText} · ${local.timeText}`;
  };

  const getRoundCompletion = (roundKey) => {
    const matches = bracket[roundKey] || [];
    if (!matches.length) return 0;
    const completed = matches.filter((match) => match.winner).length;
    return Math.round((completed / matches.length) * 100);
  };

  const totalCompletion = useMemo(() => {
    const keys = ['r32', 'r16', 'qf', 'sf', 'final'];
    const all = keys.flatMap((key) => bracket[key] || []);
    if (!all.length) return 0;
    const completed = all.filter((match) => match.winner).length;
    return Math.round((completed / all.length) * 100);
  }, [bracket]);

  const handleOpenMobileSheet = (roundKey, index, match) => {
    setMobileSheetRoundKey(roundKey);
    setMobileSheetMatchIndex(index);
    setShowMobileMatchSheet(true);
    activateMatch(match, roundKey, index);
  };

  const clearMobilePressTimer = () => {
    if (!mobilePressTimerId) return;
    window.clearTimeout(mobilePressTimerId);
    setMobilePressTimerId(null);
  };

  const handleMobileTouchStart = (event, roundKey, index) => {
    setMobileTouchStartX(event.changedTouches[0].clientX);
    clearMobilePressTimer();
    const timerId = window.setTimeout(() => {
      onResetMatch?.(roundKey, index);
    }, 650);
    setMobilePressTimerId(timerId);
  };

  const handleMobileTouchEnd = (event, roundKey, index, match) => {
    const deltaX = event.changedTouches[0].clientX - mobileTouchStartX;
    const isSwipeLeft = deltaX < -60;
    clearMobilePressTimer();

    if (isSwipeLeft && match.teamA && match.teamB && !match.winner) {
      const candidates = [match.teamA, match.teamB];
      const winnerId = candidates[Math.floor(Math.random() * candidates.length)];
      onPickWinner(roundKey, index, winnerId);
    }
  };

  const toggleRoundExpanded = (roundKey) => {
    setExpandedRounds((prev) => {
      const next = new Set(prev);
      if (next.has(roundKey)) next.delete(roundKey);
      else next.add(roundKey);
      return next;
    });
  };

  const scrollToMobileRound = (roundKey) => {
    const target = document.getElementById(`mobile-round-${roundKey}`);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const getSideMatches = (roundKey, side) => {
    const matches = bracket[roundKey] || [];
    const splitIndex = Math.ceil(matches.length / 2);
    if (side === 'left') {
      return matches.slice(0, splitIndex).map((match, index) => ({ match, sourceIndex: index, sideIndex: index }));
    }

    return matches
      .slice(splitIndex)
      .map((match, index) => ({ match, sourceIndex: index + splitIndex, sideIndex: index }));
  };

  const colCenter = (col) => ((col - 0.5) / 9) * 100;
  const colLeftEdge = (col) => ((col - 1) / 9) * 100;
  const colRightEdge = (col) => (col / 9) * 100;
  const rowCenter = (row) => ((row - 0.5) / 16) * 100;

  const connectorPaths = [];

  const addRoundConnectors = (roundKey, nextRoundKey, side) => {
    const currentRows = ROW_STARTS[roundKey];
    const nextRows = ROW_STARTS[nextRoundKey];
    const currentCol = side === 'left' ? LEFT_COLUMN_BY_ROUND[roundKey] : RIGHT_COLUMN_BY_ROUND[roundKey];
    const nextCol = side === 'left' ? LEFT_COLUMN_BY_ROUND[nextRoundKey] : RIGHT_COLUMN_BY_ROUND[nextRoundKey];

    currentRows.forEach((row, idx) => {
      const targetRow = nextRows[Math.floor(idx / 2)];
      const y1 = rowCenter(row);
      const y2 = rowCenter(targetRow);

      if (side === 'left') {
        const x1 = colRightEdge(currentCol) - 0.7;
        const x2 = colLeftEdge(nextCol) + 0.7;
        const midX = (x1 + x2) / 2;
        connectorPaths.push(`M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`);
      } else {
        const x1 = colLeftEdge(currentCol) + 0.7;
        const x2 = colRightEdge(nextCol) - 0.7;
        const midX = (x1 + x2) / 2;
        connectorPaths.push(`M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`);
      }
    });
  };

  addRoundConnectors('r32', 'r16', 'left');
  addRoundConnectors('r16', 'qf', 'left');
  addRoundConnectors('qf', 'sf', 'left');
  addRoundConnectors('r32', 'r16', 'right');
  addRoundConnectors('r16', 'qf', 'right');
  addRoundConnectors('qf', 'sf', 'right');

  const leftSfY = rowCenter(ROW_STARTS.sf[0]);
  const rightSfY = rowCenter(ROW_STARTS.sf[0]);
  const trophyY = rowCenter(TROPHY_ROW);
  const finalY = rowCenter(FINAL_ROW);
  const finalLeftX = colRightEdge(LEFT_COLUMN_BY_ROUND.sf) - 0.7;
  const finalRightX = colLeftEdge(RIGHT_COLUMN_BY_ROUND.sf) + 0.7;
  const centerX = colCenter(5);
  const centerJoinY = trophyY - 4.8;
  const centerJoinLeftX = centerX - 1.2;
  const centerJoinRightX = centerX + 1.2;
  const thirdY = rowCenter(THIRD_ROW);

  const activateMatch = (match, roundKey, index) => {
    setSelectedMatchId(match.id);
    setSelectedMatchRef({ roundKey, index, matchId: match.id });
  };

  const scrollToBracketCenter = () => {
    const container = bracketScrollRef.current;
    const centerNode = bracketCenterRef.current;
    if (!container || !centerNode) return;

    const targetLeft = centerNode.offsetLeft - container.clientWidth / 2 + centerNode.clientWidth / 2;
    container.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const media = window.matchMedia('(max-width: 767px)');
    const syncViewport = (event) => {
      const nextMobile = event.matches;
      setIsMobile(nextMobile);
      if (!nextMobile) setMobileViewMode('bracket');
    };

    syncViewport(media);
    media.addEventListener('change', syncViewport);
    return () => media.removeEventListener('change', syncViewport);
  }, []);

  useEffect(() => {
    if (!isMobile || activeBracketTab !== 'partidos' || mobileViewMode !== 'bracket') return;
    const timer = window.setTimeout(scrollToBracketCenter, 70);
    return () => window.clearTimeout(timer);
  }, [isMobile, activeBracketTab, mobileViewMode]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-3xl tracking-wide text-[#2563EB] dark:text-[#F6C453]">Cuadro Eliminatorio</h2>
        <button
          onClick={() => setGuideMode((current) => (current === 'simple' ? 'detailed' : 'simple'))}
          className="rounded-full border border-[#2563EB] bg-white px-3 py-1 text-xs font-semibold text-[#1D4ED8] hover:bg-[#DBEAFE] dark:border-[#F6C453]/40 dark:bg-[#1A2740] dark:text-[#F6C453] dark:hover:bg-[#121A2B]"
        >
          {guideMode === 'simple' ? 'Modo simple' : 'Modo detallado'}
        </button>
        <button
          onClick={() => setShowHelpModal(true)}
          className="rounded-full border border-[#2563EB] bg-white px-3 py-1 text-xs font-semibold text-[#1D4ED8] hover:bg-[#DBEAFE] dark:border-[#3B82F6]/40 dark:bg-[#1A2740] dark:text-[#FFFFFF] dark:hover:bg-[#121A2B]"
        >
          Reglas
        </button>
        <button
          onClick={() => setShowQuickGuide(true)}
          className="rounded-full border border-[#D97706] bg-white px-3 py-1 text-xs font-semibold text-[#B45309] hover:bg-[#FFEDD5] dark:border-[#F59E0B]/40 dark:bg-[#1A2740] dark:text-[#F59E0B] dark:hover:bg-[#121A2B]"
        >
          Guía rápida
        </button>
        <button
          onClick={() => setShowScheduleView((value) => !value)}
          className="rounded-full border border-[#CBD5E1] bg-white px-3 py-1 text-xs text-[#334155] hover:bg-[#F1F5F9] dark:border-[#25324A] dark:bg-[#121A2B] dark:text-[#A9B4C7] dark:hover:bg-[#1A2740]"
        >
          {showScheduleView ? 'Ocultar calendario' : 'Mostrar calendario'}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setActiveBracketTab('partidos')}
          className={`rounded-full border px-4 py-2 text-sm transition-colors ${
            activeBracketTab === 'partidos'
              ? 'border-[#2563EB] bg-[#DBEAFE] text-[#1E3A8A] dark:border-[#3B82F6]/50 dark:bg-[#1A2740] dark:text-[#8FB4FF]'
              : 'border-[#CBD5E1] bg-white text-[#1F2937] hover:bg-[#F1F5F9] dark:border-[#25324A] dark:bg-[#121A2B] dark:text-[#A9B4C7] dark:hover:bg-[#1A2740]'
          }`}
        >
          Partidos
        </button>
        <button
          onClick={() => setActiveBracketTab('cruces')}
          className={`rounded-full border px-4 py-2 text-sm transition-colors ${
            activeBracketTab === 'cruces'
              ? 'border-[#2563EB] bg-[#DBEAFE] text-[#1E3A8A] dark:border-[#3B82F6]/50 dark:bg-[#1A2740] dark:text-[#8FB4FF]'
              : 'border-[#CBD5E1] bg-white text-[#1F2937] hover:bg-[#F1F5F9] dark:border-[#25324A] dark:bg-[#121A2B] dark:text-[#A9B4C7] dark:hover:bg-[#1A2740]'
          }`}
        >
          Cómo funcionan los cruces
        </button>
      </div>

      {activeBracketTab === 'partidos' && (
        <>
          {isMobile && (
            <div className="md:hidden rounded-xl border border-[#CBD5E1] bg-white p-2 shadow-[0_2px_8px_rgba(15,23,42,0.08)] dark:border-[#25324A] dark:bg-[#121A2B]">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMobileViewMode('list')}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    mobileViewMode === 'list'
                      ? 'border-[#2563EB] bg-[#DBEAFE] text-[#1E3A8A] dark:border-[#3B82F6]/50 dark:bg-[#1A2740] dark:text-[#8FB4FF]'
                      : 'border-[#CBD5E1] bg-white text-[#1F2937] hover:bg-[#F1F5F9] dark:border-[#25324A] dark:bg-[#121A2B] dark:text-[#A9B4C7] dark:hover:bg-[#1A2740]'
                  }`}
                >
                  Lista
                </button>
                <button
                  onClick={() => setMobileViewMode('bracket')}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    mobileViewMode === 'bracket'
                      ? 'border-[#2563EB] bg-[#DBEAFE] text-[#1E3A8A] dark:border-[#3B82F6]/50 dark:bg-[#1A2740] dark:text-[#8FB4FF]'
                      : 'border-[#CBD5E1] bg-white text-[#1F2937] hover:bg-[#F1F5F9] dark:border-[#25324A] dark:bg-[#121A2B] dark:text-[#A9B4C7] dark:hover:bg-[#1A2740]'
                  }`}
                >
                  Cuadro
                </button>
                {mobileViewMode === 'bracket' && (
                  <button
                    onClick={scrollToBracketCenter}
                    className="ml-auto rounded-full border border-[#2563EB] bg-white px-3 py-1 text-xs text-[#2563EB] hover:bg-[#EEF3FB] dark:border-[#3B82F6]/40 dark:bg-[#1A2740] dark:text-[#FFFFFF] dark:hover:bg-[#121A2B]"
                  >
                    Ir al centro
                  </button>
                )}
              </div>
            </div>
          )}

          {isMobile && mobileViewMode === 'bracket' && (
            <div className="mobile-landscape-hint rounded-xl border border-[#D97706] bg-[#EEF3FB] px-3 py-2 text-xs text-[#D97706] dark:border-[#F59E0B]/35 dark:bg-[#1A2740] dark:text-[#F59E0B]">
              Para ver el cuadro completo en móvil, gira tu dispositivo a modo horizontal.
            </div>
          )}

          {selectedMatchSchedule && (
            <div className="rounded-xl border border-[#D8E2F0] bg-[#EEF3FB] p-3 text-xs sm:text-sm dark:border-[#25324A] dark:bg-[#1A2740]">
              <p className="font-semibold text-[#0F172A] dark:text-[#FFFFFF]">
                {ROUND_LABELS[selectedMatchRef.roundKey]} | {selectedMatchSchedule.local.dateText} | {selectedMatchSchedule.local.timeText}
              </p>
              <p className="text-[#42526B] dark:text-[#A9B4C7]">
                Sede: {selectedMatchSchedule.raw.venue}, {selectedMatchSchedule.raw.city} ({selectedMatchSchedule.raw.country})
              </p>
            </div>
          )}

          {showScheduleView && (
            <div className="rounded-2xl border border-[#D8E2F0] bg-white p-3 dark:border-[#25324A] dark:bg-[#121A2B]">
              <p className="mb-2 font-display text-xl text-[#2563EB] dark:text-[#F6C453]">Calendario de partidos (hora local)</p>
              <div className="max-h-64 overflow-auto rounded-lg border border-[#D8E2F0] dark:border-[#25324A]">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-[#F4F7FC] text-[#0F172A] dark:bg-[#1A2740] dark:text-[#A9B4C7]">
                    <tr>
                      <th className="px-3 py-2">Ronda</th>
                      <th className="px-3 py-2">Partido</th>
                      <th className="px-3 py-2">Fecha</th>
                      <th className="px-3 py-2">Hora</th>
                      <th className="px-3 py-2">Sede</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allScheduleRows.map((row) => {
                      const local = formatMatchScheduleLocal(row);
                      return (
                        <tr key={row.id} className="border-t border-[#D8E2F0] text-[#0F172A] dark:border-[#25324A] dark:text-[#FFFFFF]">
                          <td className="px-3 py-2">{ROUND_LABELS[row.roundKey]}</td>
                          <td className="px-3 py-2">{row.matchNumber}</td>
                          <td className="px-3 py-2">{local?.dateText}</td>
                          <td className="px-3 py-2">{local?.timeText}</td>
                          <td className="px-3 py-2">
                            {row.venue} · {row.city}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {isMobile && mobileViewMode === 'list' && (
            <div className="space-y-3">
              <div className="sticky top-2 z-20 rounded-xl border border-[#E2E8F0] bg-white p-3 shadow-[0_2px_6px_rgba(15,23,42,0.08)] dark:border-[#1F2937] dark:bg-[#141B2B]">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-display text-xl text-[#2563EB] dark:text-[#FBBF24]">Knockout Stage</p>
                  <button
                    onClick={() => onBackToGroups?.()}
                    className="min-h-[44px] rounded-full border border-[#E2E8F0] bg-[#F1F5F9] px-3 py-1 text-xs text-[#475569] dark:border-[#1F2937] dark:bg-[#1A2235] dark:text-[#9CA3AF]"
                  >
                    Volver
                  </button>
                </div>

                <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
                  {mobileRoundMeta.map((round) => (
                    <button
                      key={`jump-${round.key}`}
                      onClick={() => scrollToMobileRound(round.key)}
                      className="min-h-[44px] rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-xs font-semibold text-[#2563EB] dark:border-[#1F2937] dark:bg-[#1A2235] dark:text-[#3B82F6]"
                    >
                      {round.label}
                    </button>
                  ))}
                </div>

                <div className="h-2 w-full rounded-full bg-[#F1F5F9] dark:bg-[#1A2235]">
                  <div className="h-2 rounded-full bg-[#2563EB] dark:bg-[#3B82F6]" style={{ width: `${totalCompletion}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-[#475569] dark:text-[#9CA3AF]">Progreso del knockout: {totalCompletion}%</p>
              </div>

              {compactRoundOrder.map((roundKey) => {
                const roundMatches = bracket[roundKey] || [];
                if (!roundMatches.length) return null;
                const isExpanded = expandedRounds.has(roundKey);
                const completion = getRoundCompletion(roundKey);
                const visibleMatches = isExpanded ? roundMatches : roundMatches.slice(0, 6);
                const isCollapsed = roundMatches.length > 6 && !isExpanded;

                return (
                  <div id={`mobile-round-${roundKey}`} key={`compact-${roundKey}`} className="rounded-2xl border border-[#E2E8F0] bg-white p-3 shadow-[0_2px_6px_rgba(15,23,42,0.08)] dark:border-[#1F2937] dark:bg-[#141B2B]">
                    <div className="mb-2 flex items-center justify-between border-b border-[#E2E8F0] pb-2 dark:border-[#1F2937]">
                      <p className="font-display text-lg text-[#2563EB] dark:text-[#FBBF24]">{ROUND_LABELS[roundKey]}</p>
                      <span className="text-[11px] text-[#475569] dark:text-[#9CA3AF]">{completion}%</span>
                    </div>

                    <div className="space-y-3">
                      {visibleMatches.map((match, index) => {
                        const teamA = match.teamA ? teamMap[match.teamA] : null;
                        const teamB = match.teamB ? teamMap[match.teamB] : null;
                        const winnerA = match.winner && teamA && match.winner === teamA.id;
                        const winnerB = match.winner && teamB && match.winner === teamB.id;

                        return (
                          <button
                            key={`compact-card-${match.id}`}
                            className="w-full rounded-xl border border-[#E2E8F0] bg-white p-3 text-left shadow-[0_2px_6px_rgba(15,23,42,0.08)] active:bg-[#F1F5F9] dark:border-[#1F2937] dark:bg-[#141B2B]"
                            onClick={() => handleOpenMobileSheet(roundKey, index, match)}
                            onTouchStart={(e) => handleMobileTouchStart(e, roundKey, index)}
                            onTouchEnd={(e) => handleMobileTouchEnd(e, roundKey, index, match)}
                            onTouchCancel={clearMobilePressTimer}
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex min-w-0 items-center gap-2">
                                  {teamA ? <img src={`https://flagcdn.com/w40/${teamA.code}.png`} alt={teamA.name} className="h-5 w-5 rounded-full" /> : <span className="h-5 w-5 rounded-full bg-[#F1F5F9] dark:bg-[#1A2235]" />}
                                  <p className={`truncate text-base ${winnerA ? 'font-semibold text-[#0F172A] dark:text-[#FFFFFF]' : 'text-[#0F172A] dark:text-[#FFFFFF]'}`}>{teamA?.name || 'Por definir'}</p>
                                </div>
                                <span className={`text-xl font-bold ${winnerA ? 'text-[#D97706] dark:text-[#FBBF24]' : 'text-[#94A3B8] dark:text-[#6B7280]'}`}>{winnerA ? '1' : '-'}</span>
                              </div>

                              <div className="flex items-center justify-between">
                                <div className="flex min-w-0 items-center gap-2">
                                  {teamB ? <img src={`https://flagcdn.com/w40/${teamB.code}.png`} alt={teamB.name} className="h-5 w-5 rounded-full" /> : <span className="h-5 w-5 rounded-full bg-[#F1F5F9] dark:bg-[#1A2235]" />}
                                  <p className={`truncate text-base ${winnerB ? 'font-semibold text-[#0F172A] dark:text-[#FFFFFF]' : 'text-[#0F172A] dark:text-[#FFFFFF]'}`}>{teamB?.name || 'Por definir'}</p>
                                </div>
                                <span className={`text-xl font-bold ${winnerB ? 'text-[#D97706] dark:text-[#FBBF24]' : 'text-[#94A3B8] dark:text-[#6B7280]'}`}>{winnerB ? '1' : '-'}</span>
                              </div>

                              <div className="flex items-center justify-between text-[12px] text-[#475569] dark:text-[#9CA3AF]">
                                <span>{getScheduleText(roundKey, index) || 'Sin horario'}</span>
                                <span>Winner advances →</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}

                      {isCollapsed && (
                        <button
                          onClick={() => toggleRoundExpanded(roundKey)}
                          className="w-full min-h-[44px] rounded-xl border border-[#E2E8F0] bg-[#F1F5F9] px-3 text-sm text-[#2563EB] dark:border-[#1F2937] dark:bg-[#1A2235] dark:text-[#3B82F6]"
                        >
                          Mostrar más
                        </button>
                      )}

                      {roundMatches.length > 6 && isExpanded && (
                        <button
                          onClick={() => toggleRoundExpanded(roundKey)}
                          className="w-full min-h-[44px] rounded-xl border border-[#E2E8F0] bg-[#F1F5F9] px-3 text-sm text-[#2563EB] dark:border-[#1F2937] dark:bg-[#1A2235] dark:text-[#3B82F6]"
                        >
                          Mostrar menos
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {showMobileMatchSheet && mobileSheetMatch && (
            <div className="fixed inset-0 z-40 flex items-end bg-[rgba(11,15,28,0.45)] p-3 md:hidden" onClick={() => setShowMobileMatchSheet(false)}>
              <div
                className="w-full rounded-t-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_-8px_20px_rgba(15,23,42,0.08)] dark:border-[#1F2937] dark:bg-[#141B2B]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-3 h-1.5 w-14 rounded-full bg-[#E2E8F0] dark:bg-[#1F2937]" />
                <p className="font-display text-xl text-[#2563EB] dark:text-[#FBBF24]">{ROUND_LABELS[mobileSheetRoundKey]}</p>
                {mobileSheetSchedule?.local && (
                  <p className="mt-1 text-xs text-[#475569] dark:text-[#9CA3AF]">
                    {mobileSheetSchedule.local.dateText} · {mobileSheetSchedule.local.timeText}
                  </p>
                )}
                {mobileSheetSchedule?.raw && (
                  <p className="text-xs text-[#475569] dark:text-[#9CA3AF]">
                    {mobileSheetSchedule.raw.venue}, {mobileSheetSchedule.raw.city}
                  </p>
                )}

                <div className="mt-3 space-y-2">
                  <TeamPill team={mobileSheetMatch.teamA ? teamMap[mobileSheetMatch.teamA] : null} />
                  <TeamPill team={mobileSheetMatch.teamB ? teamMap[mobileSheetMatch.teamB] : null} />
                </div>

                {mobileSheetMatch.teamA && mobileSheetMatch.teamB && (
                  <select
                    className="mt-3 min-h-[44px] w-full rounded-xl border border-[#E2E8F0] bg-white px-3 text-[#0F172A] dark:border-[#1F2937] dark:bg-[#141B2B] dark:text-[#FFFFFF]"
                    value={mobileSheetMatch.winner || ''}
                    onChange={(e) => onPickWinner(mobileSheetRoundKey, mobileSheetMatchIndex, e.target.value)}
                  >
                    <option value="">Seleccionar ganador</option>
                    <option value={mobileSheetMatch.teamA}>{teamMap[mobileSheetMatch.teamA]?.name}</option>
                    <option value={mobileSheetMatch.teamB}>{teamMap[mobileSheetMatch.teamB]?.name}</option>
                  </select>
                )}

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    className="min-h-[44px] rounded-xl border border-[#D97706] bg-[#F1F5F9] text-sm text-[#D97706] dark:border-[#F59E0B] dark:bg-[#1A2235] dark:text-[#F59E0B]"
                    onClick={() => {
                      if (!mobileSheetMatch.teamA || !mobileSheetMatch.teamB || mobileSheetMatch.winner) return;
                      const candidates = [mobileSheetMatch.teamA, mobileSheetMatch.teamB];
                      const winnerId = candidates[Math.floor(Math.random() * candidates.length)];
                      onPickWinner(mobileSheetRoundKey, mobileSheetMatchIndex, winnerId);
                    }}
                  >
                    Auto-play
                  </button>
                  <button
                    className="min-h-[44px] rounded-xl border border-[#E2E8F0] bg-[#F1F5F9] text-sm text-[#475569] dark:border-[#1F2937] dark:bg-[#1A2235] dark:text-[#9CA3AF]"
                    onClick={() => onResetMatch?.(mobileSheetRoundKey, mobileSheetMatchIndex)}
                  >
                    Resetear
                  </button>
                </div>

                <button
                  className="mt-3 min-h-[44px] w-full rounded-xl border border-[#2563EB] bg-white text-sm text-[#2563EB] dark:border-[#3B82F6] dark:bg-[#141B2B] dark:text-[#3B82F6]"
                  onClick={() => setShowMobileMatchSheet(false)}
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}

          {(!isMobile || mobileViewMode === 'bracket') && (
            <div className="rounded-2xl border border-[#E2E8F0] bg-[#F1F5F9] p-4 dark:border-[#1F2937] dark:bg-[#141B2B]">
            <div ref={bracketScrollRef} className="bracket-mobile-scroll relative overflow-x-auto pb-4">
              <div className="min-w-[980px] md:min-w-[1250px]">
                <svg
                  className="pointer-events-none absolute left-0 top-0 h-full w-full opacity-45"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="lineGrad" x1="0" x2="1">
                      <stop offset="0%" stopColor="#3B82F6" />
                      <stop offset="100%" stopColor="#FBBF24" />
                    </linearGradient>
                  </defs>

                  {connectorPaths.map((path, idx) => (
                    <motion.path
                      key={`connector-${idx}`}
                      d={path}
                      className="bracket-connector"
                      stroke="url(#lineGrad)"
                      fill="none"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.35, delay: idx * 0.02 }}
                    />
                  ))}

                  <motion.path
                    d={`M ${finalLeftX} ${leftSfY} H ${centerJoinLeftX} V ${centerJoinY} H ${centerX}`}
                    className="bracket-connector-main"
                    stroke="#FBBF24"
                    fill="none"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.35, delay: 0.25 }}
                  />
                  <motion.path
                    d={`M ${finalRightX} ${rightSfY} H ${centerJoinRightX} V ${centerJoinY} H ${centerX}`}
                    className="bracket-connector-main"
                    stroke="#FBBF24"
                    fill="none"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.35, delay: 0.3 }}
                  />
                  <motion.path
                    d={`M ${centerX} ${centerJoinY} V ${finalY - 2.8}`}
                    className="bracket-connector-main"
                    stroke="#FBBF24"
                    fill="none"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.35, delay: 0.33 }}
                  />
                  <motion.path
                    d={`M ${centerX} ${finalY + 2.8} V ${thirdY - 2.8}`}
                    className="bracket-connector-sub"
                    stroke="#FBBF24"
                    fill="none"
                    opacity="0.7"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.35, delay: 0.38 }}
                  />
                </svg>

                <div
                  className="relative z-10 grid gap-3"
                  style={{
                    gridTemplateColumns: 'repeat(9, minmax(108px, 1fr))',
                    gridTemplateRows: 'repeat(16, minmax(74px, auto))',
                  }}
                >
                  {sideRoundOrder.map((roundKey) =>
                    getSideMatches(roundKey, 'left').map(({ match, sourceIndex, sideIndex }) => (
                      <div
                        key={match.id}
                        style={{
                          gridColumn: LEFT_COLUMN_BY_ROUND[roundKey],
                          gridRow: ROW_STARTS[roundKey][sideIndex],
                        }}
                      >
                        <div className="mx-auto w-full max-w-[210px] md:max-w-[245px]">
                          <p className="mb-1 font-display text-sm font-semibold text-[#475569] md:text-base dark:text-[#9CA3AF]">{ROUND_LABELS[roundKey]}</p>
                          <MatchCard
                            match={match}
                            teamMap={teamMap}
                            outcomes={outcomes}
                            roundKey={roundKey}
                            index={sourceIndex}
                            disabled={!stageLocked && roundKey !== 'r32'}
                            onPickWinner={onPickWinner}
                            onSetMatchTeam={onSetMatchTeam}
                            active={selectedMatchId === match.id}
                            onActivate={() => activateMatch(match, roundKey, sourceIndex)}
                            scheduleText={getScheduleText(roundKey, sourceIndex)}
                          />
                        </div>
                      </div>
                    ))
                  )}

                  {sideRoundOrder.map((roundKey) =>
                    getSideMatches(roundKey, 'right').map(({ match, sourceIndex, sideIndex }) => (
                      <div
                        key={match.id}
                        style={{
                          gridColumn: RIGHT_COLUMN_BY_ROUND[roundKey],
                          gridRow: ROW_STARTS[roundKey][sideIndex],
                        }}
                      >
                        <div className="mx-auto w-full max-w-[210px] md:max-w-[245px]">
                          <p className="mb-1 text-right font-display text-sm font-semibold text-[#475569] md:text-base dark:text-[#9CA3AF]">{ROUND_LABELS[roundKey]}</p>
                          <MatchCard
                            match={match}
                            teamMap={teamMap}
                            outcomes={outcomes}
                            roundKey={roundKey}
                            index={sourceIndex}
                            disabled={!stageLocked && roundKey !== 'r32'}
                            onPickWinner={onPickWinner}
                            onSetMatchTeam={onSetMatchTeam}
                            active={selectedMatchId === match.id}
                            onActivate={() => activateMatch(match, roundKey, sourceIndex)}
                            scheduleText={getScheduleText(roundKey, sourceIndex)}
                          />
                        </div>
                      </div>
                    ))
                  )}

                  <div ref={bracketCenterRef} style={{ gridColumn: 5, gridRow: TROPHY_ROW }}>
                    <div className="mx-auto w-full max-w-[180px] md:max-w-[250px]">
                      <img src="/world-cup-trophy.png" alt="Trofeo" className="mx-auto h-[180px] w-auto object-contain md:h-[240px]" />
                    </div>
                  </div>

                  <div style={{ gridColumn: 5, gridRow: FINAL_ROW }}>
                    <div className="mx-auto w-full max-w-[220px] md:max-w-[260px]">
                      <p className="mb-2 font-display text-center text-lg text-[#2563EB] md:text-xl dark:text-[#FBBF24]">{ROUND_LABELS.final}</p>
                      {bracket.final.map((match, index) => (
                        <MatchCard
                          key={match.id}
                          match={match}
                          teamMap={teamMap}
                          outcomes={outcomes}
                          roundKey="final"
                          index={index}
                          disabled={false}
                          onPickWinner={onPickWinner}
                          onSetMatchTeam={onSetMatchTeam}
                          active={selectedMatchId === match.id}
                          onActivate={() => activateMatch(match, 'final', index)}
                          scheduleText={getScheduleText('final', index)}
                        />
                      ))}
                    </div>
                  </div>

                  <div style={{ gridColumn: 5, gridRow: THIRD_ROW }}>
                    <div className="mx-auto w-full max-w-[220px] md:max-w-[260px]">
                      <p className="mb-2 font-display text-center text-lg text-[#475569] md:text-xl dark:text-[#9CA3AF]">{ROUND_LABELS.third}</p>
                      {bracket.third.map((match, index) => (
                        <MatchCard
                          key={match.id}
                          match={match}
                          teamMap={teamMap}
                          outcomes={outcomes}
                          roundKey="third"
                          index={index}
                          disabled={false}
                          onPickWinner={onPickWinner}
                          onSetMatchTeam={onSetMatchTeam}
                          active={selectedMatchId === match.id}
                          onActivate={() => activateMatch(match, 'third', index)}
                          scheduleText={getScheduleText('third', index)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </div>
          )}
        </>
      )}

      {activeBracketTab === 'cruces' && (
        <div className="rounded-2xl border border-[#E2E8F0] bg-[#F1F5F9] p-3 dark:border-[#1F2937] dark:bg-[#141B2B]">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-[#F1F5F9] px-3 py-1 text-[#D97706] dark:bg-[#1A2235] dark:text-[#FBBF24]">Ganadores de grupo</span>
              <span className="rounded-full bg-[#F1F5F9] px-3 py-1 text-[#2563EB] dark:bg-[#1A2235] dark:text-[#3B82F6]">Sublíderes</span>
              <span className="rounded-full bg-[#F1F5F9] px-3 py-1 text-[#D97706] dark:bg-[#1A2235] dark:text-[#F59E0B]">Mejores terceros</span>
            </div>

            {stageLocked && (
              <div className="rounded-lg border border-[#E2E8F0] bg-white p-2 text-xs text-[#0F172A] dark:border-[#1F2937] dark:bg-[#1A2235] dark:text-[#FFFFFF]">
                <div className="flex items-center gap-2">
                  <span>Tabla de grupos</span>
                  <motion.span animate={{ x: [0, 8, 0] }} transition={{ duration: 1.2, repeat: Infinity }}>
                    ➜
                  </motion.span>
                  <span>Espacios de dieciseisavos</span>
                  <motion.span animate={{ x: [0, 8, 0] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}>
                    ➜
                  </motion.span>
                  <span>Camino a la final</span>
                </div>
              </div>
            )}

            {selectedTeamGuidance && (
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F1F5F9] p-3 text-xs sm:text-sm dark:border-[#1F2937] dark:bg-[#1A2235]">
                <p className="mb-1 font-semibold text-[#0F172A] dark:text-[#FFFFFF]">{selectedTeamGuidance.title}</p>
                <p className="mb-2 text-[#475569] dark:text-[#9CA3AF]">Posición actual en su grupo: #{selectedTeamGuidance.rank || '—'}</p>
                {selectedTeamGuidance.lines.map((line) => (
                  <p key={line} className="text-[#0F172A] dark:text-[#FFFFFF]">
                    {line}
                  </p>
                ))}
              </div>
            )}

            <BracketHelpBody mode={guideMode} />
          </div>
        </div>
      )}

      {showHelpModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(26,30,36,0.45)] dark:bg-black/75 p-4" onClick={() => setShowHelpModal(false)}>
          <div
            className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)] dark:border-[#1F2937] dark:bg-[#141B2B] dark:shadow-[0_10px_30px_rgba(0,0,0,0.3)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="font-display text-2xl text-[#2563EB] dark:text-[#FBBF24]">Ayuda de cruces eliminatorios</p>
              <button onClick={() => setShowHelpModal(false)} className="rounded-md border border-[#E2E8F0] px-2 py-1 text-xs text-[#475569] hover:bg-[#F1F5F9] dark:border-[#1F2937] dark:text-[#9CA3AF] dark:hover:bg-[#1A2235]">
                Cerrar
              </button>
            </div>
            <BracketHelpBody mode={guideMode} />
          </div>
        </div>
      )}

      {showQuickGuide && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(26,30,36,0.45)] dark:bg-black/75 p-4" onClick={() => setShowQuickGuide(false)}>
          <div
            className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)] dark:border-[#1F2937] dark:bg-[#141B2B] dark:shadow-[0_10px_30px_rgba(0,0,0,0.3)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="font-display text-2xl text-[#D97706] dark:text-[#F59E0B]">Flujo rápido de cruces</p>
              <button onClick={() => setShowQuickGuide(false)} className="rounded-md border border-[#E2E8F0] px-2 py-1 text-xs text-[#475569] hover:bg-[#F1F5F9] dark:border-[#1F2937] dark:text-[#9CA3AF] dark:hover:bg-[#1A2235]">
                Cerrar
              </button>
            </div>
            <div className="space-y-2 text-sm text-[#0F172A] dark:text-[#FFFFFF]">
              <p>Los ganadores de cada grupo entran en los espacios principales sembrados.</p>
              <p>Los 8 mejores terceros se asignan a cruces elegibles según reglas por grupo.</p>
              <p>Los sublíderes restantes se emparejan en cruces para completar dieciseisavos.</p>
              <p>Desde octavos, el avance es directo por ganador: R32 → R16 → QF → SF → Final.</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
