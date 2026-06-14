import { motion } from 'framer-motion';
import { GROUPS } from '../data/teams';

const isEmptyScore = (value) => value === '' || value === null || value === undefined;

export default function GroupStage({
  teamMap,
  groupMatches,
  outcomes,
  stageLocked,
  onScoreChange,
  manualGroupPlacements,
  onToggleGroupPlacement,
  onClearGroupPlacement,
  onClearAllGroupPlacements,
  selectedTeamId,
  onSelectTeam,
}) {
  const bestThirdIds = new Set(outcomes.bestThirds.map((entry) => entry.teamId));
  const hasAnyManualPlacement = Boolean(
    manualGroupPlacements && Object.values(manualGroupPlacements).some((groupPlacement) => Object.keys(groupPlacement || {}).length)
  );

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-3xl tracking-wide text-[#2563EB] dark:text-[#F6C453]">Fase de Grupos</h2>
        <div className="flex items-center gap-2">
          {hasAnyManualPlacement && (
            <button
              type="button"
              disabled={stageLocked}
              onClick={() => onClearAllGroupPlacements?.()}
              className="rounded-full border border-[#CBD5E1] bg-white px-3 py-1 text-xs font-semibold text-[#475569] hover:bg-[#EEF3FB] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#25324A] dark:bg-[#121A2B] dark:text-[#A9B4C7] dark:hover:bg-[#1A2740]"
            >
              Limpiar todos los órdenes
            </button>
          )}
          <span className="rounded-full border border-[#D8E2F0] bg-white px-3 py-1 text-xs text-[#42526B] dark:border-[#25324A] dark:bg-[#121A2B] dark:text-[#A9B4C7]">
            12 grupos · 48 equipos
          </span>
        </div>
      </div>

      <div className="group-scroll flex snap-x gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-2 xl:grid-cols-3 md:overflow-visible">
        {GROUPS.map((group, index) => {
          const standings = outcomes.standingsByGroup[group.id] || [];
          const hasManualPlacement = Boolean(manualGroupPlacements?.[group.id] && Object.keys(manualGroupPlacements[group.id]).length);
          return (
            <motion.article
              key={group.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03, duration: 0.25 }}
              className="min-w-[310px] snap-center rounded-2xl border border-[#D8E2F0] bg-white p-4 shadow-[0_4px_12px_rgba(15,23,42,0.08),0_1px_2px_rgba(15,23,42,0.08)] dark:border-[#25324A] dark:bg-[#121A2B] dark:shadow-[0_4px_12px_rgba(2,6,23,0.45)]"
            >
              <header className="mb-3 flex items-center justify-between gap-2">
                <h3 className="rounded-lg bg-[#2563EB] px-3 py-1 font-display text-xl text-white dark:bg-[#3B82F6]">Grupo {group.id}</h3>
                <div className="flex items-center gap-2">
                  {hasManualPlacement && (
                    <button
                      type="button"
                      disabled={stageLocked}
                      onClick={() => onClearGroupPlacement?.(group.id)}
                      className="rounded-md border border-[#CBD5E1] bg-white px-2 py-1 text-[10px] font-semibold text-[#475569] hover:bg-[#EEF3FB] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#25324A] dark:bg-[#121A2B] dark:text-[#A9B4C7] dark:hover:bg-[#1A2740]"
                    >
                      Limpiar orden
                    </button>
                  )}
                  <span className="text-xs text-[var(--muted-text-aa)] dark:text-[#7A879D]">Tabla en vivo</span>
                </div>
              </header>

              <div className="mb-2 rounded-md border border-[#D8E2F0] bg-[#F8FAFC] px-2 py-1 text-[10px] text-[#475569] dark:border-[#25324A] dark:bg-[#1A2235] dark:text-[#9CA3AF]">
                <p className="hidden sm:block">PJ: Partidos jugados · PTS: Puntos · DG: Diferencia de gol · GF: Goles a favor · GC: Goles en contra</p>
                <details className="sm:hidden">
                  <summary className="cursor-pointer">Ver siglas de tabla</summary>
                  <p className="mt-1">PJ: Jugados · PTS: Puntos · DG: Dif. gol · GF: A favor · GC: En contra</p>
                </details>
              </div>

              <table className="mb-3 w-full text-xs">
                <thead>
                  <tr className="border-b border-[#D8E2F0] bg-[#F4F7FC] text-[#0F172A] dark:border-[#25324A] dark:bg-[#1A2740] dark:text-[#FFFFFF]">
                    <th className="pb-1 text-left">Equipo</th>
                    <th>PJ</th>
                    <th>PTS</th>
                    <th>DG</th>
                    <th>GF</th>
                    <th>GC</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((row, idx) => {
                    const team = teamMap[row.teamId];
                    const adv = idx < 2 || bestThirdIds.has(row.teamId);
                    const placementForGroup = manualGroupPlacements?.[group.id] || {};
                    const assignedPlace = Number(
                      Object.entries(placementForGroup).find(([, teamId]) => teamId === row.teamId)?.[0] || 0
                    );
                    return (
                      <tr
                        key={row.teamId}
                        className={`${adv ? 'text-[#059669] dark:text-[#10B981]' : 'text-[#0F172A] dark:text-[#FFFFFF]'} cursor-pointer border-b border-[#D8E2F0] dark:border-[#25324A] ${
                          selectedTeamId === row.teamId ? 'bg-[#EEF3FB] dark:bg-[#1A2740]' : 'odd:bg-[#F4F7FC] even:bg-white hover:bg-[#EEF3FB] dark:odd:bg-[#121A2B] dark:even:bg-[#121A2B] dark:hover:bg-[#1A2740]'
                        }`}
                        onClick={() => onSelectTeam?.(row.teamId)}
                      >
                        <td className="py-1">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={stageLocked}
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleGroupPlacement?.(group.id, row.teamId);
                              }}
                              className={`min-w-[24px] rounded-full border px-1.5 py-0.5 text-[10px] font-bold leading-none transition-colors ${
                                assignedPlace > 0
                                  ? assignedPlace === 4
                                    ? 'border-[#DC2626] bg-[#FEE2E2] text-[#991B1B] dark:border-[#EF4444] dark:bg-[#3A1217] dark:text-[#FCA5A5]'
                                    : 'border-[#2563EB] bg-[#DBEAFE] text-[#1E3A8A] dark:border-[#3B82F6] dark:bg-[#1A2740] dark:text-[#8FB4FF]'
                                  : 'border-[#CBD5E1] bg-white text-[#475569] hover:bg-[#EEF3FB] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#25324A] dark:bg-[#121A2B] dark:text-[#A9B4C7] dark:hover:bg-[#1A2740]'
                              }`}
                            >
                              {assignedPlace > 0 ? `${assignedPlace}°` : '—'}
                            </button>
                            <img
                              src={`https://flagcdn.com/w40/${team.code}.png`}
                              alt={team.name}
                              className="h-4 w-4 rounded-full"
                            />
                            <span className="truncate">{team.name}</span>
                            <span className="text-[10px] tracking-wide text-[var(--muted-text-aa)] dark:text-[#7A879D]">{team.fifaCode}</span>
                          </div>
                        </td>
                        <td className="text-center">{row.played}</td>
                        <td className="text-center">{row.points}</td>
                        <td className="text-center">{row.gd}</td>
                        <td className="text-center">{row.gf}</td>
                        <td className="text-center">{row.ga}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="space-y-2">
                {groupMatches[group.id].map((match) => {
                  const hasIncompleteScore = isEmptyScore(match.homeGoals) !== isEmptyScore(match.awayGoals);

                  return (
                    <div key={match.id}>
                      <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2 text-xs">
                        <span className="truncate text-[#0F172A] dark:text-[#FFFFFF]">{teamMap[match.home].name}</span>
                        <input
                          type="number"
                          min="0"
                          max="9"
                          placeholder="-"
                          disabled={stageLocked}
                          value={match.homeGoals}
                          onChange={(e) => onScoreChange(group.id, match.id, 'homeGoals', e.target.value)}
                          className="w-10 rounded-md border border-[#D8E2F0] bg-white p-1 text-center text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 dark:border-[#25324A] dark:bg-[#121A2B] dark:text-[#FFFFFF] dark:focus:ring-[#3B82F6]/20"
                        />
                        <span className="truncate text-[#0F172A] dark:text-[#FFFFFF]">{teamMap[match.away].name}</span>
                        <input
                          type="number"
                          min="0"
                          max="9"
                          placeholder="-"
                          disabled={stageLocked}
                          value={match.awayGoals}
                          onChange={(e) => onScoreChange(group.id, match.id, 'awayGoals', e.target.value)}
                          className="w-10 rounded-md border border-[#D8E2F0] bg-white p-1 text-center text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 dark:border-[#25324A] dark:bg-[#121A2B] dark:text-[#FFFFFF] dark:focus:ring-[#3B82F6]/20"
                        />
                      </div>
                      {hasIncompleteScore && <p className="mt-1 text-[10px] text-[#B45309] dark:text-[#F59E0B]">Falta marcador</p>}
                    </div>
                  );
                })}
              </div>
            </motion.article>
          );
        })}
      </div>

      <div className="rounded-2xl border border-[#D8E2F0] bg-[#EEF3FB] p-4 dark:border-[#25324A] dark:bg-[#121A2B]">
        <p className="mb-2 font-display text-xl text-[#0F172A] dark:text-[#FFFFFF]">Ranking de 3.os lugares (avanzan los mejores 8)</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {outcomes.rankedThirds.map((entry, idx) => {
            const team = teamMap[entry.teamId];
            const qualified = idx < 8;
            return (
              <div
                key={entry.teamId}
                className={`rounded-lg border px-3 py-2 text-xs ${
                  qualified
                    ? 'border-[#059669] bg-[#F1F5F9] text-[#059669] dark:border-[#10B981] dark:bg-[#1A2235] dark:text-[#10B981]'
                    : 'border-[#D8E2F0] bg-white text-[#42526B] dark:border-[#25324A] dark:bg-[#121A2B] dark:text-[#A9B4C7]'
                }`}
              >
                {idx + 1}. {team.name} ({entry.group}) · {entry.points} pts · DG {entry.gd}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
