import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ROUND_LABELS } from '../data/teams';
import { getAllScheduleRows, getMatchSchedule, formatMatchScheduleLocal } from '../lib/schedule';
import { RUNNER_OPPONENT_RULES, THIRD_TO_WINNER_RULES, WINNER_THIRD_RULES } from '../lib/tournament';
import TeamPill from './TeamPill';

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

const MOBILE_BRACKET_VIEW_STORAGE_KEY = 'fifa-mobile-bracket-view';
const MOBILE_ROUND_TAB_STORAGE_KEY = 'fifa-mobile-round-tab';
const ANNOUNCE_VERBOSITY_STORAGE_KEY = 'fifa-bracket-announce-verbosity';
const ROUND_PROGRESS_ORDER = ['r32', 'r16', 'qf', 'sf', 'final'];
const ROUND_AUTOSIM_ORDER = ['r32', 'r16', 'qf', 'sf', 'third', 'final'];
const ROUND_BADGE_CLASSES = {
  r32: 'border-[#0EA5E9]/35 bg-[#E0F2FE] text-[#0369A1] dark:border-[#38BDF8]/40 dark:bg-[#08273A] dark:text-[#7DD3FC]',
  r16: 'border-[#2563EB]/35 bg-[#DBEAFE] text-[#1D4ED8] dark:border-[#3B82F6]/40 dark:bg-[#1A2740] dark:text-[#8FB4FF]',
  qf: 'border-[#9333EA]/35 bg-[#F3E8FF] text-[#7E22CE] dark:border-[#A855F7]/40 dark:bg-[#27153A] dark:text-[#D8B4FE]',
  sf: 'border-[#D97706]/35 bg-[#FFEDD5] text-[#B45309] dark:border-[#F59E0B]/45 dark:bg-[#3A2614] dark:text-[#FCD34D]',
  final: 'border-[#CA8A04]/35 bg-[#FEF9C3] text-[#854D0E] dark:border-[#EAB308]/45 dark:bg-[#3A3215] dark:text-[#FDE047]',
  third: 'border-[#475569]/35 bg-[#E2E8F0] text-[#334155] dark:border-[#64748B]/45 dark:bg-[#1E293B] dark:text-[#CBD5E1]',
};
const ROUND_ANNOUNCE_LABELS = {
  r32: '16avos',
  r16: 'octavos',
  qf: 'cuartos',
  sf: 'semis',
  final: 'la final',
  third: 'tercer lugar',
};

const ACTIVE_MATCH_CLASSES = {
  r32: 'border-l-4 border-l-[#0EA5E9] border-[#0EA5E9] bg-[#ECFEFF] shadow-[0_8px_18px_rgba(14,165,233,0.2)] ring-2 ring-[#38BDF8]/30 dark:border-l-[#38BDF8] dark:border-[#38BDF8] dark:bg-[#0C2336] dark:shadow-[0_8px_20px_rgba(2,6,23,0.5)] dark:ring-[#38BDF8]/35',
  r16: 'border-l-4 border-l-[#2563EB] border-[#2563EB] bg-[#EEF2FF] shadow-[0_8px_18px_rgba(37,99,235,0.2)] ring-2 ring-[#3B82F6]/30 dark:border-l-[#3B82F6] dark:border-[#3B82F6] dark:bg-[#13243A] dark:shadow-[0_8px_20px_rgba(2,6,23,0.5)] dark:ring-[#60A5FA]/30',
  qf: 'border-l-4 border-l-[#9333EA] border-[#9333EA] bg-[#FAF5FF] shadow-[0_8px_18px_rgba(147,51,234,0.2)] ring-2 ring-[#A855F7]/30 dark:border-l-[#A855F7] dark:border-[#A855F7] dark:bg-[#221335] dark:shadow-[0_8px_20px_rgba(2,6,23,0.5)] dark:ring-[#C084FC]/30',
  sf: 'border-l-4 border-l-[#D97706] border-[#D97706] bg-[#FFF7ED] shadow-[0_8px_18px_rgba(217,119,6,0.2)] ring-2 ring-[#F59E0B]/35 dark:border-l-[#F6C453] dark:border-[#F6C453] dark:bg-[#2C1F14] dark:shadow-[0_8px_20px_rgba(2,6,23,0.5)] dark:ring-[#FBBF24]/30',
  final: 'border-l-4 border-l-[#CA8A04] border-[#CA8A04] bg-[#FEFCE8] shadow-[0_8px_18px_rgba(202,138,4,0.2)] ring-2 ring-[#EAB308]/35 dark:border-l-[#EAB308] dark:border-[#EAB308] dark:bg-[#2E2A14] dark:shadow-[0_8px_20px_rgba(2,6,23,0.5)] dark:ring-[#FDE047]/30',
  third: 'border-l-4 border-l-[#475569] border-[#475569] bg-[#F8FAFC] shadow-[0_8px_18px_rgba(71,85,105,0.18)] ring-2 ring-[#94A3B8]/35 dark:border-l-[#94A3B8] dark:border-[#64748B] dark:bg-[#1B2738] dark:shadow-[0_8px_20px_rgba(2,6,23,0.5)] dark:ring-[#94A3B8]/35',
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

const formatSlotRuleHint = (slotText) => {
  if (!slotText) return 'Cupo por definir.';

  const winnerMatch = slotText.match(/ganador del Grupo\s+([A-L])/i);
  if (winnerMatch) return `Debe ser un equipo del Grupo ${winnerMatch[1]} (normalmente el líder).`;

  const bestThirdMatch = slotText.match(/mejor 3\.er lugar de los Grupos\s+([A-L/]+)/i);
  if (bestThirdMatch) return `Debe ser un mejor 3.er lugar entre los grupos ${bestThirdMatch[1]}.`;

  const runnerGroupsMatch = slotText.match(/sublíder de los Grupos\s+([A-L/]+)/i);
  if (runnerGroupsMatch) return `Debe ser un sublíder de los grupos ${runnerGroupsMatch[1]}.`;

  const runnerGroupMatch = slotText.match(/sublíder del Grupo\s+([A-L])/i);
  if (runnerGroupMatch) return `Debe ser el sublíder del Grupo ${runnerGroupMatch[1]}.`;

  return 'Cupo definido por reglas de siembra del torneo.';
};

const toMatchScore = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const getSlotCandidateIds = (slotText, outcomes) => {
  if (!slotText || !outcomes) return [];

  const unique = (teamIds) => [...new Set(teamIds.filter(Boolean))];
  const winnerByGroup = outcomes.winners || {};
  const runnerByGroup = outcomes.runners || {};
  const qualifyingThirdsByGroup = Object.fromEntries(
    (outcomes.bestThirds || []).map((entry) => [entry.group, entry.teamId])
  );

  const winnerMatch = slotText.match(/ganador del Grupo\s+([A-L])/i);
  if (winnerMatch) {
    return unique([winnerByGroup[winnerMatch[1]]]);
  }

  const bestThirdMatch = slotText.match(/mejor 3\.er lugar de los Grupos\s+([A-L/]+)/i);
  if (bestThirdMatch) {
    const groups = bestThirdMatch[1].split('/');
    return unique(groups.map((group) => qualifyingThirdsByGroup[group]));
  }

  const runnerGroupsMatch = slotText.match(/sublíder de los Grupos\s+([A-L/]+)/i);
  if (runnerGroupsMatch) {
    return unique(runnerGroupsMatch[1].split('/').map((group) => runnerByGroup[group]));
  }

  const runnerGroupMatch = slotText.match(/sublíder del Grupo\s+([A-L])/i);
  if (runnerGroupMatch) {
    return unique([runnerByGroup[runnerGroupMatch[1]]]);
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
      <p className="font-semibold text-[#2563EB] dark:text-[#3B82F6]">Cómo funciona la fase eliminatoria:</p>
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
  onSetMatchScore,
  onSetMatchTeam,
  roundKey,
  index,
  disabled,
  active,
  onActivate,
  scheduleText,
  roundMatches,
  cardRef,
}) {
  const teamA = match.teamA ? teamMap[match.teamA] : null;
  const teamB = match.teamB ? teamMap[match.teamB] : null;
  const scoreA = toMatchScore(match.scoreA);
  const scoreB = toMatchScore(match.scoreB);
  const isComplete = Boolean(match.winner);
  const prevCompleteRef = useRef(isComplete);
  const [completionFlash, setCompletionFlash] = useState(false);
  const showSeedTemplate = roundKey === 'r32';
  const allTeams = Object.values(teamMap).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const candidateIdsA = showSeedTemplate ? getSlotCandidateIds(match.slotA, outcomes) : [];
  const candidateIdsB = showSeedTemplate ? getSlotCandidateIds(match.slotB, outcomes) : [];
  const selectedIdsInRound = showSeedTemplate
    ? new Set((roundMatches || []).flatMap((item) => [item.teamA, item.teamB]).filter(Boolean))
    : new Set();
  const blockedForA = new Set(selectedIdsInRound);
  blockedForA.delete(match.teamA);
  const blockedForB = new Set(selectedIdsInRound);
  blockedForB.delete(match.teamB);

  const optionTeamsA = (showSeedTemplate ? candidateIdsA.map((id) => teamMap[id]).filter(Boolean) : allTeams)
    .filter((team) => !blockedForA.has(team.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const optionTeamsB = (showSeedTemplate ? candidateIdsB.map((id) => teamMap[id]).filter(Boolean) : allTeams)
    .filter((team) => !blockedForB.has(team.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

  const handleScoreInputChange = (slot, value) => {
    if (!teamA || !teamB || typeof onSetMatchScore !== 'function') return;
    const nextValue = value === '' ? '' : value.replace(/[^0-9]/g, '').slice(0, 1);
    if (slot === 'A') {
      onSetMatchScore(roundKey, index, nextValue, undefined);
      return;
    }
    onSetMatchScore(roundKey, index, undefined, nextValue);
  };

  useEffect(() => {
    if (!prevCompleteRef.current && isComplete) {
      setCompletionFlash(true);
      const timer = window.setTimeout(() => setCompletionFlash(false), 650);
      prevCompleteRef.current = isComplete;
      return () => window.clearTimeout(timer);
    }

    prevCompleteRef.current = isComplete;
  }, [isComplete]);

  return (
    <>
      <motion.div
        ref={cardRef}
        layout
        animate={
          completionFlash
            ? {
                scale: [1, 1.018, 1],
              }
            : undefined
        }
        className={`relative rounded-xl border p-3 transition-all ${
          active
            ? ACTIVE_MATCH_CLASSES[roundKey] || ACTIVE_MATCH_CLASSES.r16
            : 'border-l-4 border-l-[#2563EB] border-[#E2E8F0] bg-white shadow-[0_2px_6px_rgba(15,23,42,0.08)] hover:scale-[1.02] hover:shadow-[0_4px_12px_rgba(15,23,42,0.08)] dark:border-l-[#38BDF8] dark:border-[#22324D] dark:bg-[#0F1A2E] dark:shadow-[0_2px_6px_rgba(2,6,23,0.4)]'
        } ${completionFlash ? 'ring-2 ring-[#10B981]/40 dark:ring-[#34D399]/40' : ''}`}
        transition={{ duration: 0.2 }}
        onClick={onActivate}
      >
        <div className="mb-2 flex justify-end">
          <span
            className={`rounded-full border px-3.5 py-1.5 text-xs font-bold leading-none ${
              isComplete
                ? 'border-[#059669]/35 bg-[#ECFDF5] text-[#047857] dark:border-[#10B981]/45 dark:bg-[#103225] dark:text-[#34D399]'
                : 'border-[#CBD5E1] bg-[#F8FAFC] text-[#475569] dark:border-[#25324A] dark:bg-[#1A2235] dark:text-[#A9B4C7]'
            }`}
          >
            {isComplete ? 'Completo' : 'Pendiente'}
          </span>
        </div>
        {showSeedTemplate ? (
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <select
                className="min-h-11 w-full rounded-md border border-[#E2E8F0] bg-white px-2 py-2 text-xs text-[#0F172A] dark:border-[#1F2937] dark:bg-[#141B2B] dark:text-[#FFFFFF]"
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
              <details className="relative mt-1">
                <summary className="flex h-6 w-6 cursor-pointer list-none items-center justify-center rounded-full border border-[#CBD5E1] bg-white text-[10px] font-bold text-[#475569] dark:border-[#25324A] dark:bg-[#121A2B] dark:text-[#A9B4C7]">
                  ?
                </summary>
                <p className="absolute right-0 z-20 mt-1 w-52 rounded-md border border-[#E2E8F0] bg-white p-2 text-[10px] leading-snug text-[#334155] shadow-md dark:border-[#1F2937] dark:bg-[#121A2B] dark:text-[#D4D4D8]">
                  {formatSlotRuleHint(match.slotA)}
                </p>
              </details>
            </div>
            <TeamPill team={teamA} compact />
            <div className="flex items-start gap-2">
              <select
                className="min-h-11 w-full rounded-md border border-[#E2E8F0] bg-white px-2 py-2 text-xs text-[#0F172A] dark:border-[#1F2937] dark:bg-[#141B2B] dark:text-[#FFFFFF]"
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
              <details className="relative mt-1">
                <summary className="flex h-6 w-6 cursor-pointer list-none items-center justify-center rounded-full border border-[#CBD5E1] bg-white text-[10px] font-bold text-[#475569] dark:border-[#25324A] dark:bg-[#121A2B] dark:text-[#A9B4C7]">
                  ?
                </summary>
                <p className="absolute right-0 z-20 mt-1 w-52 rounded-md border border-[#E2E8F0] bg-white p-2 text-[10px] leading-snug text-[#334155] shadow-md dark:border-[#1F2937] dark:bg-[#121A2B] dark:text-[#D4D4D8]">
                  {formatSlotRuleHint(match.slotB)}
                </p>
              </details>
            </div>
            <TeamPill team={teamB} compact />
          </div>
        ) : (
          <div className="space-y-2">
            <TeamPill team={teamA} compact />
            <TeamPill team={teamB} compact />
          </div>
        )}

        {teamA && teamB && (
          <div className="mt-2 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-1.5 dark:border-[#1F2937] dark:bg-[#1A2235]">
            <div className="grid grid-cols-2 gap-2">
              <input
                disabled={disabled}
                inputMode="numeric"
                pattern="[0-9]*"
                value={scoreA ?? ''}
                onChange={(e) => handleScoreInputChange('A', e.target.value)}
                className="min-h-10 w-full rounded-md border border-[#CBD5E1] bg-white px-2 text-center text-sm font-black text-[#0F172A] dark:border-[#25324A] dark:bg-[#141B2B] dark:text-[#FFFFFF]"
                placeholder="-"
                aria-label={`Marcador ${teamA.name}`}
              />
              <input
                disabled={disabled}
                inputMode="numeric"
                pattern="[0-9]*"
                value={scoreB ?? ''}
                onChange={(e) => handleScoreInputChange('B', e.target.value)}
                className="min-h-10 w-full rounded-md border border-[#CBD5E1] bg-white px-2 text-center text-sm font-black text-[#0F172A] dark:border-[#25324A] dark:bg-[#141B2B] dark:text-[#FFFFFF]"
                placeholder="-"
                aria-label={`Marcador ${teamB.name}`}
              />
            </div>
            {scoreA !== null && scoreB !== null && scoreA === scoreB && (
              <p className="mt-1 text-center text-[10px] text-[#B45309] dark:text-[#FBBF24]">En eliminación no hay empate, ajusta el marcador.</p>
            )}
          </div>
        )}

        {!showSeedTemplate && (match.slotA || match.slotB) && (
          <div className="mt-2 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-1 text-[10px] text-[#475569] dark:border-[#1F2937] dark:bg-[#1A2235] dark:text-[#9CA3AF]">
            <p>{match.slotA || 'POR DEFINIR'} ⟷ {match.slotB || 'POR DEFINIR'}</p>
          </div>
        )}

        {teamA && teamB && (
          <>
            <select
              disabled={disabled}
              className="mt-2 min-h-11 w-full rounded-md border border-[#E2E8F0] bg-white px-2 py-2 text-xs text-[#0F172A] dark:border-[#1F2937] dark:bg-[#141B2B] dark:text-[#FFFFFF]"
              value={match.winner || ''}
              onChange={(e) => onPickWinner(roundKey, index, e.target.value)}
            >
              <option value="">Seleccionar ganador (manual)</option>
              <option value={teamA.id}>{teamA.name}</option>
              <option value={teamB.id}>{teamB.name}</option>
            </select>
            <p className="mt-1 text-center text-[10px] text-[#64748B] dark:text-[#9CA3AF]">También puedes definir ganador por marcador.</p>
          </>
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
  onAutoSimulateRound,
  onSetMatchScore,
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
  const [guideMode] = useState('simple');
  const [activeBracketTab] = useState('partidos');
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? isMobileViewport() : false));
  const [mobileViewMode, setMobileViewMode] = useState(() => {
    if (typeof window === 'undefined') return 'list';
    const saved = window.localStorage.getItem(MOBILE_BRACKET_VIEW_STORAGE_KEY);
    if (saved === 'list' || saved === 'bracket') return saved;
    return isMobileViewport() ? 'list' : 'bracket';
  });
  const [expandedRounds, setExpandedRounds] = useState(() => new Set(['r32']));
  const [showMobileMatchSheet, setShowMobileMatchSheet] = useState(false);
  const [mobileSheetRoundKey, setMobileSheetRoundKey] = useState('r32');
  const [mobileSheetMatchIndex, setMobileSheetMatchIndex] = useState(0);
  const [mobileTouchStartX, setMobileTouchStartX] = useState(0);
  const [mobilePressTimerId, setMobilePressTimerId] = useState(null);
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [selectedMatchRef, setSelectedMatchRef] = useState(null);
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(true);
  const [pendingAutoAdvance, setPendingAutoAdvance] = useState(null);
  const [bracketZoom, setBracketZoom] = useState(1);
  const [mobileRoundTab, setMobileRoundTab] = useState(() => {
    if (typeof window === 'undefined') return 'r32';
    const saved = window.localStorage.getItem(MOBILE_ROUND_TAB_STORAGE_KEY);
    return ['r32', 'r16', 'qf', 'sf', 'final', 'third'].includes(saved) ? saved : 'r32';
  });
  const [scheduleRoundFilter, setScheduleRoundFilter] = useState('all');
  const bracketScrollRef = useRef(null);
  const bracketCanvasRef = useRef(null);
  const bracketCenterRef = useRef(null);
  const cardRefs = useRef(new Map());
  const mobileScoreInputARef = useRef(null);
  const mobileScoreInputBRef = useRef(null);
  const [connectorOverlay, setConnectorOverlay] = useState({ width: 0, height: 0, paths: [] });
  const [centerDecorPaths, setCenterDecorPaths] = useState({ gold: '', bronze: '' });
  const [advancePathPulse, setAdvancePathPulse] = useState({ ids: [], token: 0 });
  const [mobileAdvancePulse, setMobileAdvancePulse] = useState({ ids: [], token: 0 });
  const [liveAnnouncement, setLiveAnnouncement] = useState({ text: '', token: 0 });
  const [announceVerbosity, setAnnounceVerbosity] = useState(() => {
    if (typeof window === 'undefined') return 'compact';
    const saved = window.localStorage.getItem(ANNOUNCE_VERBOSITY_STORAGE_KEY);
    return saved === 'detailed' ? 'detailed' : 'compact';
  });
  const prevWinnerByMatchRef = useRef(new Map());

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

  const mobileSheetScoreA = toMatchScore(mobileSheetMatch?.scoreA);
  const mobileSheetScoreB = toMatchScore(mobileSheetMatch?.scoreB);

  useEffect(() => {
    if (!showMobileMatchSheet || !mobileSheetMatch?.teamA || !mobileSheetMatch?.teamB) return;

    const targetInput =
      mobileSheetScoreA === null
        ? mobileScoreInputARef.current
        : mobileSheetScoreB === null
          ? mobileScoreInputBRef.current
          : mobileScoreInputARef.current;

    if (!targetInput) return;

    const frameId = window.requestAnimationFrame(() => {
      targetInput.focus();
      targetInput.select?.();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [showMobileMatchSheet, mobileSheetMatch?.id, mobileSheetMatch?.teamA, mobileSheetMatch?.teamB, mobileSheetScoreA, mobileSheetScoreB]);

  const mobileSheetOptions = useMemo(() => {
    const showSeedTemplate = mobileSheetRoundKey === 'r32';
    if (!mobileSheetMatch || !showSeedTemplate) {
      return { showSeedTemplate, optionTeamsA: [], optionTeamsB: [] };
    }

    const candidateIdsA = getSlotCandidateIds(mobileSheetMatch.slotA, outcomes);
    const candidateIdsB = getSlotCandidateIds(mobileSheetMatch.slotB, outcomes);
    const roundMatches = bracket[mobileSheetRoundKey] || [];
    const selectedIdsInRound = new Set(roundMatches.flatMap((item) => [item.teamA, item.teamB]).filter(Boolean));
    const blockedForA = new Set(selectedIdsInRound);
    blockedForA.delete(mobileSheetMatch.teamA);
    const blockedForB = new Set(selectedIdsInRound);
    blockedForB.delete(mobileSheetMatch.teamB);

    const optionTeamsA = candidateIdsA.map((id) => teamMap[id]).filter(Boolean)
      .filter((team) => !blockedForA.has(team.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));

    const optionTeamsB = candidateIdsB.map((id) => teamMap[id]).filter(Boolean)
      .filter((team) => !blockedForB.has(team.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));

    return { showSeedTemplate, optionTeamsA, optionTeamsB };
  }, [bracket, mobileSheetMatch, mobileSheetRoundKey, outcomes, teamMap]);

  const allScheduleRows = useMemo(() => getAllScheduleRows(), []);

  const mobileRoundMeta = useMemo(
    () => [
      { key: 'r32', label: '16avos', fullLabel: ROUND_LABELS.r32 },
      { key: 'r16', label: 'Octavos', fullLabel: ROUND_LABELS.r16 },
      { key: 'qf', label: 'Cuartos', fullLabel: ROUND_LABELS.qf },
      { key: 'sf', label: 'Semis', fullLabel: ROUND_LABELS.sf },
      { key: 'final', label: 'Final', fullLabel: ROUND_LABELS.final },
      { key: 'third', label: '3°', fullLabel: ROUND_LABELS.third },
    ],
    []
  );

  const activeMobileRoundKey = useMemo(
    () => (mobileRoundMeta.some((round) => round.key === mobileRoundTab) ? mobileRoundTab : 'r32'),
    [mobileRoundMeta, mobileRoundTab]
  );

  const getScheduleText = (roundKey, index) => {
    const schedule = getMatchSchedule(roundKey, index);
    const local = schedule ? formatMatchScheduleLocal(schedule) : null;
    if (!schedule || !local) return null;
    return `${local.dateText} · ${local.timeText}`;
  };

  const getRoundCompletion = (roundKey) => {
    const matches = (bracket[roundKey] || []).filter(Boolean);
    if (!matches.length) return 0;
    const completed = matches.filter((match) => match?.winner).length;
    return Math.round((completed / matches.length) * 100);
  };

  const getRoundProgressCounts = (roundKey) => {
    const matches = (bracket[roundKey] || []).filter(Boolean);
    const completed = matches.filter((match) => match?.winner).length;
    return { completed, total: matches.length };
  };

  const totalCompletion = useMemo(() => {
    const keys = ['r32', 'r16', 'qf', 'sf', 'final'];
    const all = keys.flatMap((key) => bracket[key] || []).filter(Boolean);
    if (!all.length) return 0;
    const completed = all.filter((match) => match?.winner).length;
    return Math.round((completed / all.length) * 100);
  }, [bracket]);

  const totalProgressCounts = useMemo(() => {
    const keys = ROUND_PROGRESS_ORDER;
    const all = keys.flatMap((key) => bracket[key] || []).filter(Boolean);
    const completed = all.filter((match) => match?.winner).length;
    return { completed, total: all.length };
  }, [bracket]);

  const roundProgressSummary = useMemo(
    () => ROUND_PROGRESS_ORDER.map((roundKey) => ({ roundKey, ...getRoundProgressCounts(roundKey) })),
    [bracket]
  );

  const nextAutoSimRound = useMemo(() => {
    for (const roundKey of ROUND_AUTOSIM_ORDER) {
      const matches = (bracket[roundKey] || []).filter(Boolean);
      const hasPendingPlayableMatch = matches.some((match) => match?.teamA && match?.teamB && !match?.winner);
      if (hasPendingPlayableMatch) return roundKey;
    }
    return null;
  }, [bracket]);

  const handleAutoSimulatePendingRound = () => {
    if (!nextAutoSimRound || typeof onAutoSimulateRound !== 'function') return;
    onAutoSimulateRound(nextAutoSimRound);
  };

  const quickSummary = useMemo(() => {
    const allMatches = Object.values(bracket).flat().filter(Boolean);
    const completed = allMatches.filter((match) => match?.winner).length;
    const pending = allMatches.length - completed;
    const mostAdvanced =
      [...ROUND_PROGRESS_ORDER].reverse().find((roundKey) => (bracket[roundKey] || []).some((match) => match?.winner)) || 'r32';
    return { completed, pending, mostAdvanced };
  }, [bracket]);

  const filteredScheduleRows = useMemo(
    () => (scheduleRoundFilter === 'all' ? allScheduleRows : allScheduleRows.filter((row) => row.roundKey === scheduleRoundFilter)),
    [allScheduleRows, scheduleRoundFilter]
  );

  const scheduleFilterLabel = scheduleRoundFilter === 'all' ? 'Todas las rondas' : ROUND_LABELS[scheduleRoundFilter] || scheduleRoundFilter;

  const getRoundBadgeClass = (roundKey) => ROUND_BADGE_CLASSES[roundKey] || ROUND_BADGE_CLASSES.r16;

  const getRoundCardMaxWidth = (roundKey) => {
    if (roundKey === 'sf') return 'clamp(178px, 14vw, 210px)';
    if (roundKey === 'final' || roundKey === 'third') return 'clamp(190px, 15vw, 230px)';
    if (roundKey === 'qf') return 'clamp(160px, 13vw, 192px)';
    return 'clamp(150px, 12vw, 182px)';
  };

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
      handleWinnerSelection(roundKey, index, winnerId);
    }
  };

  const handleResetMobileMatch = () => {
    if (!mobileSheetMatch) return;

    if (mobileSheetRoundKey === 'r32') {
      onSetMatchTeam?.(mobileSheetRoundKey, mobileSheetMatchIndex, 'teamA', '');
      onSetMatchTeam?.(mobileSheetRoundKey, mobileSheetMatchIndex, 'teamB', '');
    }

    onResetMatch?.(mobileSheetRoundKey, mobileSheetMatchIndex);
  };

  const toggleRoundExpanded = (roundKey) => {
    setExpandedRounds((prev) => {
      const next = new Set(prev);
      if (next.has(roundKey)) next.delete(roundKey);
      else next.add(roundKey);
      return next;
    });
  };

  const getSideMatches = (roundKey, side) => {
    const matches = (bracket[roundKey] || []).filter(Boolean);
    const splitIndex = Math.ceil(matches.length / 2);
    if (side === 'left') {
      return matches.slice(0, splitIndex).map((match, index) => ({ match, sourceIndex: index, sideIndex: index }));
    }

    return matches
      .slice(splitIndex)
      .map((match, index) => ({ match, sourceIndex: index + splitIndex, sideIndex: index }));
  };

  const setMatchCardRef = useCallback(
    (matchId) => (node) => {
      if (!matchId) return;
      if (node) cardRefs.current.set(matchId, node);
      else cardRefs.current.delete(matchId);
    },
    []
  );

  const connectorLinks = useMemo(() => {
    const links = [];

    const pushLink = (fromMatch, toMatch, kind = 'main', side = 'left') => {
      if (!fromMatch?.id || !toMatch?.id) return;
      links.push({ id: `${kind}-${side}-${fromMatch.id}-${toMatch.id}`, from: fromMatch.id, to: toMatch.id, kind, side });
    };

    const connectRounds = (fromRound, toRound) => {
      const fromLeft = getSideMatches(fromRound, 'left');
      const toLeft = getSideMatches(toRound, 'left');
      toLeft.forEach((target, idx) => {
        pushLink(fromLeft[idx * 2]?.match, target.match, 'main', 'left');
        pushLink(fromLeft[idx * 2 + 1]?.match, target.match, 'main', 'left');
      });

      const fromRight = getSideMatches(fromRound, 'right');
      const toRight = getSideMatches(toRound, 'right');
      toRight.forEach((target, idx) => {
        pushLink(fromRight[idx * 2]?.match, target.match, 'main', 'right');
        pushLink(fromRight[idx * 2 + 1]?.match, target.match, 'main', 'right');
      });
    };

    connectRounds('r32', 'r16');
    connectRounds('r16', 'qf');
    connectRounds('qf', 'sf');

    return links;
  }, [bracket]);

  const activeAdvancePathIds = useMemo(() => new Set(advancePathPulse.ids), [advancePathPulse.ids]);
  const activeMobileAdvanceIds = useMemo(() => new Set(mobileAdvancePulse.ids), [mobileAdvancePulse.ids]);

  useEffect(() => {
    const matchById = new Map();
    const roundByMatchId = new Map();
    Object.entries(bracket).forEach(([roundKey, matches]) => {
      (matches || [])
        .filter(Boolean)
        .forEach((match) => {
          matchById.set(match.id, match);
          roundByMatchId.set(match.id, roundKey);
        });
    });

    const nextWinnerByMatch = new Map();
    Object.values(bracket)
      .flat()
      .filter(Boolean)
      .forEach((match) => {
        nextWinnerByMatch.set(match.id, match.winner || '');
      });

    const newlyCompleted = new Set();
    nextWinnerByMatch.forEach((winnerId, matchId) => {
      const previousWinnerId = prevWinnerByMatchRef.current.get(matchId) || '';
      if (!previousWinnerId && winnerId) newlyCompleted.add(matchId);
    });

    prevWinnerByMatchRef.current = nextWinnerByMatch;
    if (!newlyCompleted.size) return;

    const highlightedLinks = connectorLinks.filter((link) => newlyCompleted.has(link.from));
    const highlightedLinkIds = highlightedLinks.map((link) => link.id);
    const highlightedMatchIds = [...new Set(highlightedLinks.map((link) => link.from))];

    const announcementParts = [...newlyCompleted]
      .map((matchId) => {
        const match = matchById.get(matchId);
        const winnerName = teamMap[match?.winner]?.name;
        if (!winnerName) return null;

        const sourceRound = roundByMatchId.get(matchId);
        const nextLink = connectorLinks.find((link) => link.from === matchId);
        if (nextLink) {
          const destinationRound = roundByMatchId.get(nextLink.to);
          const destinationLabel = ROUND_ANNOUNCE_LABELS[destinationRound] || 'la siguiente ronda';
          return `${winnerName} avanza a ${destinationLabel}.`;
        }

        if (sourceRound === 'final') return `${winnerName} es campeón del torneo.`;
        if (sourceRound === 'third') return `${winnerName} gana el tercer lugar.`;
        return `${winnerName} avanza.`;
      })
      .filter(Boolean);

    if (announcementParts.length) {
      const champs = announcementParts.filter((line) => line.includes('campeón del torneo'));
      const thirds = announcementParts.filter((line) => line.includes('tercer lugar'));
      const advances = announcementParts.length - champs.length - thirds.length;

      const summary = [];
      if (advances > 0) summary.push(`${advances} equipos avanzan de ronda.`);
      if (thirds.length) summary.push('Se definió el tercer lugar.');
      if (champs.length) summary.push('Hay campeón del torneo.');
      const compactText = summary.join(' ');

      const text =
        announceVerbosity === 'detailed'
          ? announcementParts.join(' ')
          : announcementParts.length > 1
            ? compactText || announcementParts[0]
            : announcementParts[0];

      setLiveAnnouncement((prev) => ({ text, token: prev.token + 1 }));
    }

    if (highlightedLinkIds.length) {
      setAdvancePathPulse((prev) => ({ ids: highlightedLinkIds, token: prev.token + 1 }));
      setMobileAdvancePulse((prev) => ({ ids: highlightedMatchIds, token: prev.token + 1 }));
    }

    const visualTimer =
      highlightedLinkIds.length > 0
        ? window.setTimeout(() => {
            setAdvancePathPulse((prev) => (prev.ids.length ? { ids: [], token: prev.token } : prev));
            setMobileAdvancePulse((prev) => (prev.ids.length ? { ids: [], token: prev.token } : prev));
          }, 900)
        : null;

    const announcementTimer =
      announcementParts.length > 0
        ? window.setTimeout(() => {
            setLiveAnnouncement((prev) => (prev.text ? { text: '', token: prev.token } : prev));
          }, 1500)
        : null;

    return () => {
      if (visualTimer) window.clearTimeout(visualTimer);
      if (announcementTimer) window.clearTimeout(announcementTimer);
    };
  }, [announceVerbosity, bracket, connectorLinks, teamMap]);

  const recalculateConnectorOverlay = useCallback(() => {
    const canvas = bracketCanvasRef.current;
    if (!canvas) return;

    const canvasRect = canvas.getBoundingClientRect();

    const paths = connectorLinks
      .map((link) => {
        const fromEl = cardRefs.current.get(link.from);
        const toEl = cardRefs.current.get(link.to);
        if (!fromEl || !toEl) return null;

        const fromRect = fromEl.getBoundingClientRect();
        const toRect = toEl.getBoundingClientRect();

        const sx = (link.side === 'right' ? fromRect.left : fromRect.right) - canvasRect.left;
        const sy = fromRect.top + fromRect.height / 2 - canvasRect.top;
        const tx = (link.side === 'right' ? toRect.right : toRect.left) - canvasRect.left;
        const ty = toRect.top + toRect.height / 2 - canvasRect.top;

        const distance = Math.max(36, Math.abs(tx - sx) * 0.35);
        const c1x = link.side === 'right' ? sx - distance : sx + distance;
        const c2x = link.side === 'right' ? tx + distance : tx - distance;
        const d = `M ${sx} ${sy} C ${c1x} ${sy}, ${c2x} ${ty}, ${tx} ${ty}`;

        return { id: link.id, d, kind: link.kind };
      })
      .filter(Boolean);

    setConnectorOverlay({ width: canvas.scrollWidth, height: canvas.scrollHeight, paths });

    const trophyEl = bracketCenterRef.current;
    const finalEl = cardRefs.current.get((bracket.final || []).filter(Boolean)[0]?.id);
    const thirdEl = cardRefs.current.get((bracket.third || []).filter(Boolean)[0]?.id);
    const sfMatches = (bracket.sf || []).filter(Boolean);
    const sfSplit = Math.ceil(sfMatches.length / 2);
    const leftSfEl = cardRefs.current.get(sfMatches[0]?.id);
    const rightSfEl = cardRefs.current.get(sfMatches[sfSplit]?.id);

    let gold = '';
    let bronze = '';

    if (trophyEl && finalEl && leftSfEl && rightSfEl) {
      const trophyRect = trophyEl.getBoundingClientRect();
      const finalRect = finalEl.getBoundingClientRect();
      const leftSfRect = leftSfEl.getBoundingClientRect();
      const rightSfRect = rightSfEl.getBoundingClientRect();

      const cx = trophyRect.left + trophyRect.width / 2 - canvasRect.left;
      const leftX = leftSfRect.right - canvasRect.left + 8;
      const rightX = rightSfRect.left - canvasRect.left - 8;
      const leftY = leftSfRect.top + leftSfRect.height / 2 - canvasRect.top;
      const rightY = rightSfRect.top + rightSfRect.height / 2 - canvasRect.top;
      const barY = Math.min(leftY, rightY) - 18;
      const trophyY = trophyRect.bottom - canvasRect.top + 4;
      const finalY = finalRect.top - canvasRect.top - 10;

      gold = `M ${leftX} ${leftY} C ${leftX + 44} ${leftY}, ${cx - 72} ${barY}, ${cx} ${barY} C ${cx + 72} ${barY}, ${rightX - 44} ${rightY}, ${rightX} ${rightY} M ${cx} ${trophyY} C ${cx} ${trophyY + 18}, ${cx} ${finalY - 20}, ${cx} ${finalY}`;
    }

    if (finalEl && thirdEl && leftSfEl && rightSfEl) {
      const finalRect = finalEl.getBoundingClientRect();
      const thirdRect = thirdEl.getBoundingClientRect();
      const leftSfRect = leftSfEl.getBoundingClientRect();
      const rightSfRect = rightSfEl.getBoundingClientRect();

      const cx = finalRect.left + finalRect.width / 2 - canvasRect.left;
      const leftX = leftSfRect.right - canvasRect.left + 8;
      const rightX = rightSfRect.left - canvasRect.left - 8;
      const leftY = leftSfRect.top + leftSfRect.height / 2 - canvasRect.top + 24;
      const rightY = rightSfRect.top + rightSfRect.height / 2 - canvasRect.top + 24;
      const barY = Math.max(leftY, rightY) + 18;
      const finalY = finalRect.bottom - canvasRect.top + 8;
      const thirdY = thirdRect.top - canvasRect.top - 10;

      bronze = `M ${leftX} ${leftY} C ${leftX + 44} ${leftY}, ${cx - 72} ${barY}, ${cx} ${barY} C ${cx + 72} ${barY}, ${rightX - 44} ${rightY}, ${rightX} ${rightY} M ${cx} ${finalY} C ${cx} ${finalY + 16}, ${cx} ${thirdY - 20}, ${cx} ${thirdY}`;
    }

    setCenterDecorPaths({ gold, bronze });
  }, [connectorLinks]);

  const getNextMatchRef = (roundKey, index) => {
    const order = ['r32', 'r16', 'qf', 'sf', 'third', 'final'];
    const currentRound = bracket[roundKey] || [];
    if (index + 1 < currentRound.length) {
      return { roundKey, index: index + 1 };
    }

    const currentIndex = order.indexOf(roundKey);
    if (currentIndex === -1) return null;

    for (let i = currentIndex + 1; i < order.length; i += 1) {
      const nextRoundKey = order[i];
      const nextRound = bracket[nextRoundKey] || [];
      if (nextRound.length) {
        return { roundKey: nextRoundKey, index: 0 };
      }
    }

    return null;
  };

  const jumpToNextPendingMatch = () => {
    const order = ['r32', 'r16', 'qf', 'sf', 'third', 'final'];
    for (const roundKey of order) {
      const matches = bracket[roundKey] || [];
      const index = matches.findIndex((match) => match.teamA && match.teamB && !match.winner);
      if (index !== -1) {
        const match = matches[index];
        activateMatch(match, roundKey, index);
        if (isMobile && mobileViewMode === 'list') setMobileRoundTab(roundKey);
        return;
      }
    }
  };

  const handleWinnerSelection = (roundKey, index, winnerId) => {
    if (!winnerId) return;
    onPickWinner(roundKey, index, winnerId);

    if (!autoAdvanceEnabled) return;
    const nextRef = getNextMatchRef(roundKey, index);
    if (nextRef) setPendingAutoAdvance(nextRef);
  };

  const handleMobileSheetScoreChange = (slot, value) => {
    if (!mobileSheetMatch?.teamA || !mobileSheetMatch?.teamB || typeof onSetMatchScore !== 'function') return;
    const nextValue = value === '' ? '' : value.replace(/[^0-9]/g, '').slice(0, 1);
    if (slot === 'A') {
      onSetMatchScore(mobileSheetRoundKey, mobileSheetMatchIndex, nextValue, undefined);
      return;
    }
    onSetMatchScore(mobileSheetRoundKey, mobileSheetMatchIndex, undefined, nextValue);
  };

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(MOBILE_BRACKET_VIEW_STORAGE_KEY, mobileViewMode);
  }, [mobileViewMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(MOBILE_ROUND_TAB_STORAGE_KEY, mobileRoundTab);
  }, [mobileRoundTab]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(ANNOUNCE_VERBOSITY_STORAGE_KEY, announceVerbosity);
  }, [announceVerbosity]);

  useEffect(() => {
    if (!pendingAutoAdvance) return;

    const nextMatch = bracket[pendingAutoAdvance.roundKey]?.[pendingAutoAdvance.index];
    if (!nextMatch) {
      setPendingAutoAdvance(null);
      return;
    }

    activateMatch(nextMatch, pendingAutoAdvance.roundKey, pendingAutoAdvance.index);
    if (isMobile && mobileViewMode === 'list') setMobileRoundTab(pendingAutoAdvance.roundKey);

    setPendingAutoAdvance(null);
  }, [pendingAutoAdvance, bracket, isMobile, mobileViewMode]);

  useEffect(() => {
    if (isMobile && mobileViewMode !== 'bracket') return;

    const canvas = bracketCanvasRef.current;
    if (!canvas) return;

    let frameId = null;
    const scheduleMeasure = () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        recalculateConnectorOverlay();
      });
    };

    scheduleMeasure();

    const resizeObserver = new ResizeObserver(() => scheduleMeasure());
    resizeObserver.observe(canvas);
    cardRefs.current.forEach((node) => resizeObserver.observe(node));
    window.addEventListener('resize', scheduleMeasure);

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', scheduleMeasure);
    };
  }, [recalculateConnectorOverlay, bracket, isMobile, mobileViewMode]);

  return (
    <section className="space-y-4">
      <p key={`live-announce-${liveAnnouncement.token}`} className="sr-only" aria-live="polite" aria-atomic="true">
        {liveAnnouncement.text}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-3xl tracking-wide text-[#2563EB] dark:text-[#F6C453]">Fase Eliminatoria</h2>
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
          onClick={() => setAnnounceVerbosity((value) => (value === 'compact' ? 'detailed' : 'compact'))}
          className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
            announceVerbosity === 'detailed'
              ? 'border-[#0EA5E9] bg-[#E0F2FE] text-[#0C4A6E] dark:border-[#38BDF8]/45 dark:bg-[#08273A] dark:text-[#7DD3FC]'
              : 'border-[#CBD5E1] bg-white text-[#475569] hover:bg-[#F1F5F9] dark:border-[#25324A] dark:bg-[#121A2B] dark:text-[#A9B4C7] dark:hover:bg-[#1A2740]'
          }`}
        >
          A11y: {announceVerbosity === 'detailed' ? 'Anuncios detallados' : 'Anuncios compactos'}
        </button>
        <button
          onClick={() => setShowScheduleView((value) => !value)}
          className="rounded-full border border-[#CBD5E1] bg-white px-3 py-1 text-xs text-[#334155] hover:bg-[#F1F5F9] dark:border-[#25324A] dark:bg-[#121A2B] dark:text-[#A9B4C7] dark:hover:bg-[#1A2740]"
        >
          {showScheduleView ? 'Ocultar calendario' : 'Mostrar calendario'}
        </button>
        <button
          onClick={() => setAutoAdvanceEnabled((value) => !value)}
          className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
            autoAdvanceEnabled
              ? 'border-[#2563EB] bg-[#DBEAFE] text-[#1E3A8A] dark:border-[#3B82F6]/40 dark:bg-[#1A2740] dark:text-[#8FB4FF]'
              : 'border-[#CBD5E1] bg-white text-[#475569] hover:bg-[#F1F5F9] dark:border-[#25324A] dark:bg-[#121A2B] dark:text-[#A9B4C7] dark:hover:bg-[#1A2740]'
          }`}
        >
          Autoavance: {autoAdvanceEnabled ? 'Activado' : 'Desactivado'}
        </button>
        <button
          onClick={jumpToNextPendingMatch}
          className="rounded-full border border-[#CBD5E1] bg-white px-3 py-1 text-xs font-semibold text-[#475569] hover:bg-[#F1F5F9] dark:border-[#25324A] dark:bg-[#121A2B] dark:text-[#A9B4C7] dark:hover:bg-[#1A2740]"
        >
          Siguiente pendiente
        </button>
        <button
          onClick={handleAutoSimulatePendingRound}
          disabled={!nextAutoSimRound}
          className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
            nextAutoSimRound
              ? 'border-[#16A34A] bg-[#DCFCE7] text-[#166534] hover:bg-[#BBF7D0] dark:border-[#22C55E]/40 dark:bg-[#102A1E] dark:text-[#86EFAC] dark:hover:bg-[#143524]'
              : 'cursor-not-allowed border-[#CBD5E1] bg-[#F8FAFC] text-[#94A3B8] dark:border-[#25324A] dark:bg-[#121A2B] dark:text-[#64748B]'
          }`}
        >
          {nextAutoSimRound ? `Simular ${ROUND_LABELS[nextAutoSimRound] || nextAutoSimRound}` : 'Todo simulado'}
        </button>
        {(!isMobile || mobileViewMode === 'bracket') && (
          <div className="ml-auto flex items-center gap-1 rounded-full border border-[#CBD5E1] bg-white px-2 py-1 dark:border-[#25324A] dark:bg-[#121A2B]">
            <button
              type="button"
              onClick={() => setBracketZoom((z) => Math.max(0.8, Number((z - 0.1).toFixed(2))))}
              className="rounded-md px-2 py-0.5 text-xs font-semibold text-[#334155] hover:bg-[#F1F5F9] dark:text-[#A9B4C7] dark:hover:bg-[#1A2740]"
            >
              −
            </button>
            <button
              type="button"
              onClick={() => setBracketZoom(1)}
              className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-[#334155] hover:bg-[#F1F5F9] dark:text-[#A9B4C7] dark:hover:bg-[#1A2740]"
            >
              {Math.round(bracketZoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setBracketZoom((z) => Math.min(1.35, Number((z + 0.1).toFixed(2))))}
              className="rounded-md px-2 py-0.5 text-xs font-semibold text-[#334155] hover:bg-[#F1F5F9] dark:text-[#A9B4C7] dark:hover:bg-[#1A2740]"
            >
              +
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-[#2563EB] bg-[#DBEAFE] px-4 py-2 text-sm font-semibold text-[#1E3A8A] dark:border-[#3B82F6]/50 dark:bg-[#1A2740] dark:text-[#8FB4FF]">
          Partidos
        </span>
      </div>

      {activeBracketTab === 'partidos' && (
        <>
          {isMobile && (
            <div className="md:hidden rounded-xl border border-[#CBD5E1] bg-white p-2 shadow-[0_2px_8px_rgba(15,23,42,0.08)] dark:border-[#25324A] dark:bg-[#121A2B]">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMobileViewMode('list')}
                  className={`min-h-10 rounded-full border px-4 py-2 text-sm transition-colors ${
                    mobileViewMode === 'list'
                      ? 'border-[#2563EB] bg-[#DBEAFE] text-[#1E3A8A] dark:border-[#3B82F6]/50 dark:bg-[#1A2740] dark:text-[#8FB4FF]'
                      : 'border-[#CBD5E1] bg-white text-[#1F2937] hover:bg-[#F1F5F9] dark:border-[#25324A] dark:bg-[#121A2B] dark:text-[#A9B4C7] dark:hover:bg-[#1A2740]'
                  }`}
                >
                  Lista
                </button>
                <button
                  onClick={() => setMobileViewMode('bracket')}
                  className={`min-h-10 rounded-full border px-4 py-2 text-sm transition-colors ${
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
                    className="ml-auto min-h-10 rounded-full border border-[#2563EB] bg-white px-4 py-2 text-sm text-[#2563EB] hover:bg-[#EEF3FB] dark:border-[#3B82F6]/40 dark:bg-[#1A2740] dark:text-[#FFFFFF] dark:hover:bg-[#121A2B]"
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

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-[#D8E2F0] bg-white p-3 dark:border-[#25324A] dark:bg-[#121A2B]">
              <p className="text-[11px] uppercase tracking-wide text-[#64748B] dark:text-[#9CA3AF]">Pendientes</p>
              <p className="font-display text-2xl text-[#B45309] dark:text-[#F59E0B]">{quickSummary.pending}</p>
            </div>
            <div className="rounded-xl border border-[#D8E2F0] bg-white p-3 dark:border-[#25324A] dark:bg-[#121A2B]">
              <p className="text-[11px] uppercase tracking-wide text-[#64748B] dark:text-[#9CA3AF]">Completos</p>
              <p className="font-display text-2xl text-[#059669] dark:text-[#34D399]">{quickSummary.completed}</p>
            </div>
            <div className="rounded-xl border border-[#D8E2F0] bg-white p-3 dark:border-[#25324A] dark:bg-[#121A2B]">
              <p className="text-[11px] uppercase tracking-wide text-[#64748B] dark:text-[#9CA3AF]">Ronda más avanzada</p>
              <span className={`mt-1 inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${getRoundBadgeClass(quickSummary.mostAdvanced)}`}>
                {ROUND_LABELS[quickSummary.mostAdvanced]}
              </span>
            </div>
            <div className="rounded-xl border border-[#D8E2F0] bg-white p-3 dark:border-[#25324A] dark:bg-[#121A2B]">
              <p className="text-[11px] uppercase tracking-wide text-[#64748B] dark:text-[#9CA3AF]">Equipo seleccionado</p>
              <p className="truncate text-sm font-semibold text-[#0F172A] dark:text-[#FFFFFF]">{selectedStandingTeam?.name || 'Sin selección'}</p>
            </div>
          </div>

          <div className="rounded-xl border border-[#D8E2F0] bg-white p-3 dark:border-[#25324A] dark:bg-[#121A2B]">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#64748B] dark:text-[#9CA3AF]">Progreso por ronda</p>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
              {roundProgressSummary.map((round) => (
                <div key={`summary-round-${round.roundKey}`} className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-2 dark:border-[#1F2937] dark:bg-[#1A2235]">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getRoundBadgeClass(round.roundKey)}`}>
                      {ROUND_LABELS[round.roundKey]}
                    </span>
                    <span className="text-xs font-semibold text-[#64748B] dark:text-[#9CA3AF]">
                      {round.completed}/{round.total}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {Array.from({ length: round.total || 1 }).map((_, idx) => (
                      <span
                        key={`segment-${round.roundKey}-${idx}`}
                        className={`h-1.5 flex-1 rounded-full ${idx < round.completed ? 'bg-[#10B981] dark:bg-[#34D399]' : 'bg-[#D8E2F0] dark:bg-[#25324A]'}`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {showScheduleView && (
            <div className="rounded-2xl border border-[#D8E2F0] bg-white p-3 dark:border-[#25324A] dark:bg-[#121A2B]">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="font-display text-xl text-[#2563EB] dark:text-[#F6C453]">Calendario de partidos (hora local)</p>
                <select
                  value={scheduleRoundFilter}
                  onChange={(e) => setScheduleRoundFilter(e.target.value)}
                  className="rounded-md border border-[#D8E2F0] bg-white px-2 py-1 text-xs text-[#334155] dark:border-[#25324A] dark:bg-[#121A2B] dark:text-[#A9B4C7]"
                >
                  <option value="all">Todas las rondas</option>
                  <option value="r32">Dieciseisavos</option>
                  <option value="r16">Octavos</option>
                  <option value="qf">Cuartos</option>
                  <option value="sf">Semifinales</option>
                  <option value="third">Tercer lugar</option>
                  <option value="final">Final</option>
                </select>
              </div>
              {scheduleRoundFilter !== 'all' && (
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded-full border border-[#2563EB] bg-[#DBEAFE] px-2.5 py-1 text-[11px] font-semibold text-[#1E3A8A] dark:border-[#3B82F6]/50 dark:bg-[#1A2740] dark:text-[#8FB4FF]">
                    Filtro: {scheduleFilterLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => setScheduleRoundFilter('all')}
                    className="rounded-full border border-[#CBD5E1] bg-white px-2 py-1 text-[10px] font-semibold text-[#475569] hover:bg-[#F1F5F9] dark:border-[#25324A] dark:bg-[#121A2B] dark:text-[#A9B4C7] dark:hover:bg-[#1A2740]"
                  >
                    Mostrar todas
                  </button>
                </div>
              )}
              {filteredScheduleRows.length ? (
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
                      {filteredScheduleRows.map((row) => {
                        const local = formatMatchScheduleLocal(row);
                        return (
                          <tr key={row.id} className="border-t border-[#D8E2F0] text-[#0F172A] dark:border-[#25324A] dark:text-[#FFFFFF]">
                            <td className="px-3 py-2">
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getRoundBadgeClass(row.roundKey)}`}>
                                {ROUND_LABELS[row.roundKey]}
                              </span>
                            </td>
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
              ) : (
                <div className="rounded-lg border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-5 text-center dark:border-[#25324A] dark:bg-[#1A2235]">
                  <p className="text-sm font-semibold text-[#334155] dark:text-[#D4D4D8]">No hay partidos para este filtro</p>
                  <p className="mt-1 text-xs text-[#64748B] dark:text-[#9CA3AF]">Cambia de ronda o muestra todas para ver el calendario completo.</p>
                  <button
                    type="button"
                    onClick={() => setScheduleRoundFilter('all')}
                    className="mt-3 rounded-full border border-[#2563EB] bg-white px-3 py-1.5 text-xs font-semibold text-[#1E3A8A] hover:bg-[#DBEAFE] dark:border-[#3B82F6]/50 dark:bg-[#121A2B] dark:text-[#8FB4FF] dark:hover:bg-[#1A2740]"
                  >
                    Mostrar todas las rondas
                  </button>
                </div>
              )}
            </div>
          )}

          {isMobile && mobileViewMode === 'list' && (
            <div className="space-y-3">
              <div className="sticky top-2 z-20 rounded-xl border border-[#E2E8F0] bg-white p-3 shadow-[0_2px_6px_rgba(15,23,42,0.08)] dark:border-[#1F2937] dark:bg-[#141B2B]">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-display text-xl text-[#2563EB] dark:text-[#FBBF24]">Fase eliminatoria</p>
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
                      key={`round-tab-${round.key}`}
                      onClick={() => setMobileRoundTab(round.key)}
                      className={`min-h-[44px] rounded-full border px-3 text-xs font-semibold transition-colors ${
                        activeMobileRoundKey === round.key
                          ? 'border-[#2563EB] bg-[#DBEAFE] text-[#1E3A8A] dark:border-[#3B82F6]/50 dark:bg-[#1A2740] dark:text-[#8FB4FF]'
                          : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#2563EB] dark:border-[#1F2937] dark:bg-[#1A2235] dark:text-[#3B82F6]'
                      }`}
                    >
                      {round.label}
                    </button>
                  ))}
                </div>

                <div className="h-2 w-full rounded-full bg-[#F1F5F9] dark:bg-[#1A2235]">
                  <div className="h-2 rounded-full bg-[#2563EB] dark:bg-[#3B82F6]" style={{ width: `${totalCompletion}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-[#475569] dark:text-[#9CA3AF]">
                  Progreso del knockout: {totalCompletion}% ({totalProgressCounts.completed}/{totalProgressCounts.total})
                </p>
              </div>

              {(() => {
                const roundKey = activeMobileRoundKey;
                const roundEntries = (bracket[roundKey] || []).map((match, sourceIndex) => ({ match, sourceIndex }));
                if (!roundEntries.length) return null;
                const isExpanded = expandedRounds.has(roundKey);
                const completion = getRoundCompletion(roundKey);
                const progress = getRoundProgressCounts(roundKey);
                const visibleEntries = isExpanded ? roundEntries : roundEntries.slice(0, 6);
                const isCollapsed = roundEntries.length > 6 && !isExpanded;

                return (
                  <div key={`compact-${roundKey}`} className="rounded-2xl border border-[#E2E8F0] bg-white p-3 shadow-[0_2px_6px_rgba(15,23,42,0.08)] dark:border-[#1F2937] dark:bg-[#141B2B]">
                    <div className="mb-2 flex items-center justify-between border-b border-[#E2E8F0] pb-2 dark:border-[#1F2937]">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-sm font-semibold ${getRoundBadgeClass(roundKey)}`}>{ROUND_LABELS[roundKey]}</span>
                      <span className="text-sm font-semibold text-[#475569] dark:text-[#9CA3AF]">{completion}% ({progress.completed}/{progress.total})</span>
                    </div>
                    <div className="mb-2 flex gap-1">
                      {Array.from({ length: progress.total || 1 }).map((_, idx) => (
                        <span
                          key={`mobile-segment-${roundKey}-${idx}`}
                          className={`h-1.5 flex-1 rounded-full ${idx < progress.completed ? 'bg-[#10B981] dark:bg-[#34D399]' : 'bg-[#D8E2F0] dark:bg-[#25324A]'}`}
                        />
                      ))}
                    </div>

                    <div className="space-y-3">
                      {visibleEntries.map(({ match, sourceIndex }) => {
                        const teamA = match.teamA ? teamMap[match.teamA] : null;
                        const teamB = match.teamB ? teamMap[match.teamB] : null;
                        const scoreA = toMatchScore(match.scoreA);
                        const scoreB = toMatchScore(match.scoreB);
                        const winnerA = match.winner && teamA && match.winner === teamA.id;
                        const winnerB = match.winner && teamB && match.winner === teamB.id;
                        const isComplete = Boolean(match.winner);
                        const showAdvancePulse = activeMobileAdvanceIds.has(match.id);

                        return (
                          <button
                            key={`compact-card-${match.id}`}
                            className={`w-full rounded-xl border bg-white p-3 text-left shadow-[0_2px_6px_rgba(15,23,42,0.08)] transition-all active:bg-[#F1F5F9] dark:bg-[#141B2B] ${
                              showAdvancePulse
                                ? 'border-l-4 border-l-[#0EA5E9] border-[#38BDF8] ring-2 ring-[#67E8F9]/35 dark:border-l-[#67E8F9] dark:border-[#38BDF8]/70 dark:ring-[#22D3EE]/35'
                                : 'border-[#E2E8F0] dark:border-[#1F2937]'
                            }`}
                            onClick={() => handleOpenMobileSheet(roundKey, sourceIndex, match)}
                            onTouchStart={(e) => handleMobileTouchStart(e, roundKey, sourceIndex)}
                            onTouchEnd={(e) => handleMobileTouchEnd(e, roundKey, sourceIndex, match)}
                            onTouchCancel={clearMobilePressTimer}
                          >
                            <div className="mb-2 flex justify-end">
                              <span
                                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                                  isComplete
                                    ? 'border-[#059669]/30 bg-[#ECFDF5] text-[#059669] dark:border-[#10B981]/40 dark:bg-[#103225] dark:text-[#34D399]'
                                    : 'border-[#CBD5E1] bg-[#F8FAFC] text-[#64748B] dark:border-[#25324A] dark:bg-[#1A2235] dark:text-[#94A3B8]'
                                }`}
                              >
                                {isComplete ? 'Completo' : 'Pendiente'}
                              </span>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex min-w-0 items-center gap-2">
                                  {teamA ? <img src={`https://flagcdn.com/w40/${teamA.code}.png`} alt={teamA.name} className="h-5 w-5 rounded-full" /> : <span className="h-5 w-5 rounded-full bg-[#F1F5F9] dark:bg-[#1A2235]" />}
                                  <p className={`truncate text-base ${winnerA ? 'font-semibold text-[#0F172A] dark:text-[#FFFFFF]' : 'text-[#0F172A] dark:text-[#FFFFFF]'}`}>{teamA?.name || 'Por definir'}</p>
                                </div>
                                <span className={`text-xl font-bold ${winnerA ? 'text-[#D97706] dark:text-[#FBBF24]' : 'text-[var(--muted-text-aa)] dark:text-[#6B7280]'}`}>{scoreA ?? '-'}</span>
                              </div>

                              <div className="flex items-center justify-between">
                                <div className="flex min-w-0 items-center gap-2">
                                  {teamB ? <img src={`https://flagcdn.com/w40/${teamB.code}.png`} alt={teamB.name} className="h-5 w-5 rounded-full" /> : <span className="h-5 w-5 rounded-full bg-[#F1F5F9] dark:bg-[#1A2235]" />}
                                  <p className={`truncate text-base ${winnerB ? 'font-semibold text-[#0F172A] dark:text-[#FFFFFF]' : 'text-[#0F172A] dark:text-[#FFFFFF]'}`}>{teamB?.name || 'Por definir'}</p>
                                </div>
                                <span className={`text-xl font-bold ${winnerB ? 'text-[#D97706] dark:text-[#FBBF24]' : 'text-[var(--muted-text-aa)] dark:text-[#6B7280]'}`}>{scoreB ?? '-'}</span>
                              </div>

                              <div className="flex items-center justify-between text-[12px] text-[#475569] dark:text-[#9CA3AF]">
                                <span>{getScheduleText(roundKey, sourceIndex) || 'Sin horario'}</span>
                                {showAdvancePulse ? (
                                  <motion.span
                                    key={`mobile-advance-${mobileAdvancePulse.token}-${match.id}`}
                                    initial={{ x: -4, opacity: 0.55 }}
                                    animate={{ x: [0, 8, 0], opacity: [0.55, 1, 0.55] }}
                                    transition={{ duration: 0.9, ease: 'easeOut' }}
                                    className="font-semibold text-[#0EA5E9] dark:text-[#67E8F9]"
                                  >
                                    Avanza el ganador →
                                  </motion.span>
                                ) : (
                                  <span>Avanza el ganador →</span>
                                )}
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

                      {roundEntries.length > 6 && isExpanded && (
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
              })()}
            </div>
          )}

          {showMobileMatchSheet && mobileSheetMatch && (
            <div className="fixed inset-0 z-40 flex items-end bg-[rgba(11,15,28,0.45)] p-3 md:hidden" onClick={() => setShowMobileMatchSheet(false)}>
              <div
                className="max-h-[88vh] w-full overflow-y-auto rounded-t-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_-8px_20px_rgba(15,23,42,0.08)] dark:border-[#1F2937] dark:bg-[#141B2B]"
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

                {mobileSheetOptions.showSeedTemplate ? (
                  <div className="mt-3 space-y-2">
                    <select
                      className="min-h-[44px] w-full rounded-xl border border-[#E2E8F0] bg-white px-3 text-sm text-[#0F172A] dark:border-[#1F2937] dark:bg-[#141B2B] dark:text-[#FFFFFF]"
                      value={mobileSheetMatch.teamA || ''}
                      onChange={(e) => onSetMatchTeam?.(mobileSheetRoundKey, mobileSheetMatchIndex, 'teamA', e.target.value)}
                    >
                      <option value="">{formatSeedSlot(mobileSheetMatch.slotA)}</option>
                      {mobileSheetOptions.optionTeamsA.map((team) => (
                        <option key={team.id} value={team.id} disabled={team.id === mobileSheetMatch.teamB}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-[#64748B] dark:text-[#9CA3AF]">{formatSlotRuleHint(mobileSheetMatch.slotA)}</p>
                    <TeamPill team={mobileSheetMatch.teamA ? teamMap[mobileSheetMatch.teamA] : null} />

                    <select
                      className="min-h-[44px] w-full rounded-xl border border-[#E2E8F0] bg-white px-3 text-sm text-[#0F172A] dark:border-[#1F2937] dark:bg-[#141B2B] dark:text-[#FFFFFF]"
                      value={mobileSheetMatch.teamB || ''}
                      onChange={(e) => onSetMatchTeam?.(mobileSheetRoundKey, mobileSheetMatchIndex, 'teamB', e.target.value)}
                    >
                      <option value="">{formatSeedSlot(mobileSheetMatch.slotB)}</option>
                      {mobileSheetOptions.optionTeamsB.map((team) => (
                        <option key={team.id} value={team.id} disabled={team.id === mobileSheetMatch.teamA}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-[#64748B] dark:text-[#9CA3AF]">{formatSlotRuleHint(mobileSheetMatch.slotB)}</p>
                    <TeamPill team={mobileSheetMatch.teamB ? teamMap[mobileSheetMatch.teamB] : null} />
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    <TeamPill team={mobileSheetMatch.teamA ? teamMap[mobileSheetMatch.teamA] : null} />
                    <TeamPill team={mobileSheetMatch.teamB ? teamMap[mobileSheetMatch.teamB] : null} />
                  </div>
                )}

                {mobileSheetMatch.teamA && mobileSheetMatch.teamB && (
                  <div className="mt-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-2 dark:border-[#1F2937] dark:bg-[#1A2235]">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        ref={mobileScoreInputARef}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={mobileSheetScoreA ?? ''}
                        onChange={(e) => handleMobileSheetScoreChange('A', e.target.value)}
                        className="min-h-[44px] w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-center text-lg font-black text-[#0F172A] dark:border-[#25324A] dark:bg-[#141B2B] dark:text-[#FFFFFF]"
                        placeholder="-"
                        aria-label={`Marcador ${teamMap[mobileSheetMatch.teamA]?.name || 'Local'}`}
                      />
                      <input
                        ref={mobileScoreInputBRef}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={mobileSheetScoreB ?? ''}
                        onChange={(e) => handleMobileSheetScoreChange('B', e.target.value)}
                        className="min-h-[44px] w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-center text-lg font-black text-[#0F172A] dark:border-[#25324A] dark:bg-[#141B2B] dark:text-[#FFFFFF]"
                        placeholder="-"
                        aria-label={`Marcador ${teamMap[mobileSheetMatch.teamB]?.name || 'Visitante'}`}
                      />
                    </div>
                    {mobileSheetScoreA !== null && mobileSheetScoreB !== null && mobileSheetScoreA === mobileSheetScoreB && (
                      <p className="mt-1 text-center text-[11px] text-[#B45309] dark:text-[#FBBF24]">No se permite empate en eliminación.</p>
                    )}
                  </div>
                )}

                {mobileSheetMatch.teamA && mobileSheetMatch.teamB && (
                  <select
                    className="mt-3 min-h-[44px] w-full rounded-xl border border-[#E2E8F0] bg-white px-3 text-[#0F172A] dark:border-[#1F2937] dark:bg-[#141B2B] dark:text-[#FFFFFF]"
                    value={mobileSheetMatch.winner || ''}
                    onChange={(e) => handleWinnerSelection(mobileSheetRoundKey, mobileSheetMatchIndex, e.target.value)}
                  >
                    <option value="">Seleccionar ganador (manual)</option>
                    <option value={mobileSheetMatch.teamA}>{teamMap[mobileSheetMatch.teamA]?.name}</option>
                    <option value={mobileSheetMatch.teamB}>{teamMap[mobileSheetMatch.teamB]?.name}</option>
                  </select>
                )}

                <button
                  className="mt-3 min-h-[44px] w-full rounded-xl border border-[#E2E8F0] bg-[#F1F5F9] text-sm text-[#475569] dark:border-[#1F2937] dark:bg-[#1A2235] dark:text-[#9CA3AF]"
                  onClick={handleResetMobileMatch}
                >
                  Reiniciar
                </button>

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
            <div className="rounded-2xl border border-[#E2E8F0] bg-[#F1F5F9] p-4 dark:border-[#22324D] dark:bg-[#0B1730]">
            <div ref={bracketScrollRef} className="bracket-mobile-scroll relative overflow-x-auto pb-4">
              <div
                ref={bracketCanvasRef}
                className="relative w-max min-w-full"
                style={{ transform: `scale(${bracketZoom})`, transformOrigin: 'top center' }}
              >
                <svg
                  className="pointer-events-none absolute left-0 top-0 z-0"
                  width={Math.max(connectorOverlay.width, 1)}
                  height={Math.max(connectorOverlay.height, 1)}
                  viewBox={`0 0 ${Math.max(connectorOverlay.width, 1)} ${Math.max(connectorOverlay.height, 1)}`}
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="lineGrad" x1="0" x2="1">
                      <stop offset="0%" stopColor="#38BDF8" />
                      <stop offset="100%" stopColor="#F6C453" />
                    </linearGradient>
                    <linearGradient id="advancePathGlow" x1="0" x2="1">
                      <stop offset="0%" stopColor="#22D3EE" />
                      <stop offset="100%" stopColor="#10B981" />
                    </linearGradient>
                    <linearGradient id="centerGold" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FDE68A" />
                      <stop offset="100%" stopColor="#CA8A04" />
                    </linearGradient>
                    <linearGradient id="centerBronze" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F6C7A5" />
                      <stop offset="100%" stopColor="#B45309" />
                    </linearGradient>
                  </defs>

                  {centerDecorPaths.gold && (
                    <motion.path
                      d={centerDecorPaths.gold}
                      stroke="url(#centerGold)"
                      fill="none"
                      strokeWidth="4"
                      strokeLinecap="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.45 }}
                    />
                  )}

                  {centerDecorPaths.bronze && (
                    <motion.path
                      d={centerDecorPaths.bronze}
                      stroke="url(#centerBronze)"
                      fill="none"
                      strokeWidth="3"
                      strokeLinecap="round"
                      opacity="0.9"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.42, delay: 0.04 }}
                    />
                  )}

                  {connectorOverlay.paths.map((path, idx) => (
                    <motion.path
                      key={path.id}
                      d={path.d}
                      className={path.kind === 'third' ? 'bracket-connector-sub' : 'bracket-connector'}
                      stroke={path.kind === 'third' ? '#CDA24A' : 'url(#lineGrad)'}
                      fill="none"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.35, delay: idx * 0.02 }}
                      strokeLinecap="round"
                    />
                  ))}

                  {connectorOverlay.paths
                    .filter((path) => activeAdvancePathIds.has(path.id))
                    .map((path) => (
                      <motion.path
                        key={`advance-${advancePathPulse.token}-${path.id}`}
                        d={path.d}
                        stroke="url(#advancePathGlow)"
                        fill="none"
                        strokeWidth="6"
                        strokeLinecap="round"
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: [0, 1, 0] }}
                        transition={{ duration: 0.9, ease: 'easeOut' }}
                      />
                    ))}
                </svg>

                <div
                  className="relative z-10 grid gap-3"
                  style={{
                    gridTemplateColumns: 'repeat(9, clamp(136px, 13vw, 168px))',
                  }}
                >
                  {[
                    { roundKey: 'r32', side: 'left' },
                    { roundKey: 'r16', side: 'left' },
                    { roundKey: 'qf', side: 'left' },
                    { roundKey: 'sf', side: 'left' },
                  ].map(({ roundKey, side }) => (
                    <div key={`col-${side}-${roundKey}`} className="flex h-full flex-col justify-evenly gap-3">
                      {getSideMatches(roundKey, side).map(({ match, sourceIndex }) => (
                        <div key={match.id} className="mx-auto w-full" style={{ maxWidth: getRoundCardMaxWidth(roundKey) }}>
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getRoundBadgeClass(roundKey)}`}>
                              {ROUND_LABELS[roundKey]}
                            </span>
                            <span className="text-xs font-semibold text-[#64748B] dark:text-[#9CA3AF]">
                              {getRoundProgressCounts(roundKey).completed}/{getRoundProgressCounts(roundKey).total}
                            </span>
                          </div>
                          <MatchCard
                            cardRef={setMatchCardRef(match.id)}
                            match={match}
                            teamMap={teamMap}
                            outcomes={outcomes}
                            roundMatches={bracket[roundKey]}
                            roundKey={roundKey}
                            index={sourceIndex}
                            disabled={false}
                            onPickWinner={handleWinnerSelection}
                            onSetMatchScore={onSetMatchScore}
                            onSetMatchTeam={onSetMatchTeam}
                            active={selectedMatchId === match.id}
                            onActivate={() => activateMatch(match, roundKey, sourceIndex)}
                            scheduleText={getScheduleText(roundKey, sourceIndex)}
                          />
                        </div>
                      ))}
                    </div>
                  ))}

                  <div className="flex h-full flex-col items-center">
                    <div ref={bracketCenterRef} className="mx-auto w-full max-w-[180px] md:max-w-[250px]">
                      <img src="/world-cup-trophy.png" alt="Trofeo" className="mx-auto h-[180px] w-auto object-contain md:h-[240px]" />
                    </div>

                    <div className="mx-auto mt-2 w-full" style={{ maxWidth: getRoundCardMaxWidth('final') }}>
                      <div className="mb-2 flex items-center justify-center gap-2">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${getRoundBadgeClass('final')}`}>{ROUND_LABELS.final}</span>
                        <span className="text-[11px] text-[#64748B] dark:text-[#9CA3AF]">
                          {getRoundProgressCounts('final').completed}/{getRoundProgressCounts('final').total}
                        </span>
                      </div>
                      {(bracket.final || []).filter(Boolean).map((match, index) => (
                        <MatchCard
                          key={match.id}
                          cardRef={setMatchCardRef(match.id)}
                          match={match}
                          teamMap={teamMap}
                          outcomes={outcomes}
                          roundMatches={bracket.final}
                          roundKey="final"
                          index={index}
                          disabled={false}
                          onPickWinner={handleWinnerSelection}
                          onSetMatchScore={onSetMatchScore}
                          onSetMatchTeam={onSetMatchTeam}
                          active={selectedMatchId === match.id}
                          onActivate={() => activateMatch(match, 'final', index)}
                          scheduleText={getScheduleText('final', index)}
                        />
                      ))}
                    </div>

                    <div className="mx-auto mt-auto w-full" style={{ maxWidth: getRoundCardMaxWidth('third') }}>
                      <div className="mb-2 flex items-center justify-center gap-2">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${getRoundBadgeClass('third')}`}>{ROUND_LABELS.third}</span>
                        <span className="text-[11px] text-[#64748B] dark:text-[#9CA3AF]">
                          {getRoundProgressCounts('third').completed}/{getRoundProgressCounts('third').total}
                        </span>
                      </div>
                      {(bracket.third || []).filter(Boolean).map((match, index) => (
                        <MatchCard
                          key={match.id}
                          cardRef={setMatchCardRef(match.id)}
                          match={match}
                          teamMap={teamMap}
                          outcomes={outcomes}
                          roundMatches={bracket.third}
                          roundKey="third"
                          index={index}
                          disabled={false}
                          onPickWinner={handleWinnerSelection}
                          onSetMatchScore={onSetMatchScore}
                          onSetMatchTeam={onSetMatchTeam}
                          active={selectedMatchId === match.id}
                          onActivate={() => activateMatch(match, 'third', index)}
                          scheduleText={getScheduleText('third', index)}
                        />
                      ))}
                    </div>
                  </div>

                  {[
                    { roundKey: 'sf', side: 'right' },
                    { roundKey: 'qf', side: 'right' },
                    { roundKey: 'r16', side: 'right' },
                    { roundKey: 'r32', side: 'right' },
                  ].map(({ roundKey, side }) => (
                    <div key={`col-${side}-${roundKey}`} className="flex h-full flex-col justify-evenly gap-3">
                      {getSideMatches(roundKey, side).map(({ match, sourceIndex }) => (
                        <div key={match.id} className="mx-auto w-full" style={{ maxWidth: getRoundCardMaxWidth(roundKey) }}>
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getRoundBadgeClass(roundKey)}`}>
                              {ROUND_LABELS[roundKey]}
                            </span>
                            <span className="text-xs font-semibold text-[#64748B] dark:text-[#9CA3AF]">
                              {getRoundProgressCounts(roundKey).completed}/{getRoundProgressCounts(roundKey).total}
                            </span>
                          </div>
                          <MatchCard
                            cardRef={setMatchCardRef(match.id)}
                            match={match}
                            teamMap={teamMap}
                            outcomes={outcomes}
                            roundMatches={bracket[roundKey]}
                            roundKey={roundKey}
                            index={sourceIndex}
                            disabled={false}
                            onPickWinner={handleWinnerSelection}
                            onSetMatchScore={onSetMatchScore}
                            onSetMatchTeam={onSetMatchTeam}
                            active={selectedMatchId === match.id}
                            onActivate={() => activateMatch(match, roundKey, sourceIndex)}
                            scheduleText={getScheduleText(roundKey, sourceIndex)}
                          />
                        </div>
                      ))}
                    </div>
                  ))}
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
