import { AnimatePresence, motion } from 'framer-motion';

const confetti = Array.from({ length: 56 }).map((_, i) => ({
  id: i,
  left: `${Math.random() * 100}%`,
  delay: Math.random() * 0.4,
  duration: 1.2 + Math.random() * 1.2,
  color: ['#FBBF24', '#3B82F6', '#FFFFFF'][i % 3],
}));

export default function ChampionOverlay({ open, champion }) {
  return (
    <AnimatePresence>
      {open && champion && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none fixed inset-0 z-50 overflow-hidden bg-[rgba(11,15,28,0.78)] dark:bg-[rgba(11,15,28,0.78)]"
        >
          {confetti.map((piece) => (
            <motion.span
              key={piece.id}
              className="absolute h-3 w-2 rounded-sm"
              style={{ left: piece.left, backgroundColor: piece.color, top: '-4%' }}
              animate={{ y: '110vh', rotate: 360 }}
              transition={{ duration: piece.duration, delay: piece.delay, repeat: 2, ease: 'easeOut' }}
            />
          ))}

          <div className="flex h-full items-center justify-center">
            <motion.div
              initial={{ scale: 0.85, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ duration: 0.35 }}
              className="rounded-3xl border border-[#FBBF24] bg-[var(--gradient-gold)] p-8 text-center shadow-[0_10px_30px_var(--shadow)]"
            >
              <p className="font-display text-4xl tracking-wide text-[#FFFFFF]">CAMPEÓN</p>
              <p className="mt-2 font-body text-2xl font-semibold text-[#FFFFFF]">{champion.name}</p>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
