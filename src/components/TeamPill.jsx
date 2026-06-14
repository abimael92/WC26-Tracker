import { motion } from 'framer-motion';

export default function TeamPill({ team, compact = false }) {
  if (!team) {
    return (
      <div className="rounded-xl border border-[#D8E2F0] bg-white px-3 py-2 text-xs text-[#7D8EA8] dark:border-[#25324A] dark:bg-[#121A2B] dark:text-[#7A879D]">
        Por definir
      </div>
    );
  }

  return (
    <motion.div
      layout
      whileHover={{ scale: 1.02, boxShadow: '0 4px 12px rgba(15,23,42,0.12)' }}
      transition={{ duration: 0.25 }}
      className="team-pill rounded-xl border border-[#D8E2F0] bg-[linear-gradient(145deg,#FFFFFF_0%,#EEF3FB_100%)] px-3 py-2 dark:border-[#25324A] dark:bg-[linear-gradient(145deg,#1A2740_0%,#121A2B_100%)]"
    >
      <div className="flex items-center gap-2">
        <img
          className={`rounded-full object-cover shadow-md ${compact ? 'h-5 w-5' : 'h-6 w-6'}`}
          src={`https://flagcdn.com/w40/${team.code}.png`}
          alt={team.name}
          loading="lazy"
        />
        <div className="min-w-0">
          <p className={`${compact ? 'text-xs' : 'text-sm'} truncate font-semibold text-[#0F172A] dark:text-[#FFFFFF]`}>{team.name}</p>
          <p className="text-[10px] tracking-wide text-[#42526B] dark:text-[#A9B4C7]">{team.fifaCode}</p>
        </div>
      </div>
    </motion.div>
  );
}
