import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { motion, AnimatePresence } from 'framer-motion';

export default function Celebrate() {
  const animationEvent = useGameStore(state => state.animationEvent);
  const clearAnimationEvent = useGameStore(state => state.clearAnimationEvent);

  useEffect(() => {
    if (animationEvent) {
      const timer = setTimeout(() => {
        clearAnimationEvent();
      }, 3500); // Animation duration
      return () => clearTimeout(timer);
    }
  }, [animationEvent, clearAnimationEvent]);

  if (!animationEvent) return null;

  const { type, player, winner, margin } = animationEvent;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto select-none">
        
        {/* Dark blurred overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.95 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-zinc-950/90 backdrop-blur-sm"
        />

        {/* 1. FOUR CELEBRATION */}
        {type === 'four' && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="text-center z-10"
          >
            <motion.h1
              animate={{ rotate: [-5, 5, -5, 5, 0], scale: [1, 1.2, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="text-8xl font-black italic bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_10px_20px_rgba(245,158,11,0.4)]"
            >
              FOUR!
            </motion.h1>
            <p className="text-zinc-400 font-extrabold uppercase tracking-widest text-sm mt-4 animate-pulse">
              ⚡ Boundary Scored ⚡
            </p>
          </motion.div>
        )}

        {/* 2. SIX CELEBRATION */}
        {type === 'six' && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 100 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 1.8, opacity: 0, y: -100 }}
            transition={{ type: "spring", stiffness: 180, damping: 12 }}
            className="text-center z-10"
          >
            <motion.h1
              animate={{ scale: [1, 1.3, 1], y: [0, -20, 0] }}
              transition={{ duration: 0.6, repeat: Infinity }}
              className="text-9xl font-black italic bg-gradient-to-r from-cyan-400 via-pink-400 to-indigo-500 bg-clip-text text-transparent drop-shadow-[0_15px_30px_rgba(236,72,153,0.5)]"
            >
              SIX!
            </motion.h1>
            <p className="text-pink-400 font-black uppercase tracking-widest text-sm mt-4 animate-pulse">
              🚀 Absolute Monster Hit 🚀
            </p>
          </motion.div>
        )}

        {/* 3. WICKET CELEBRATION */}
        {type === 'wicket' && (
          <motion.div
            initial={{ rotate: -45, scale: 0.2, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className="text-center z-10"
          >
            <motion.div
              animate={{ x: [-10, 10, -10, 10, 0] }}
              transition={{ duration: 0.5 }}
              className="text-9xl font-black bg-gradient-to-r from-red-600 via-orange-500 to-red-600 bg-clip-text text-transparent drop-shadow-[0_10px_20px_rgba(220,38,38,0.5)] italic"
            >
              OUT!
            </motion.div>
            <h2 className="text-xl font-bold text-zinc-300 mt-4 uppercase tracking-wider">
              {player} Dismissed
            </h2>
            <p className="text-red-500 font-extrabold uppercase tracking-widest text-xs mt-2 animate-pulse">
              🔴 Wicket Fallen 🔴
            </p>
          </motion.div>
        )}

        {/* 4. FIFTY CELEBRATION */}
        {type === 'fifty' && (
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.3, opacity: 0 }}
            className="text-center z-10"
          >
            <span className="text-6xl">🙌🏏</span>
            <h1 className="text-7xl font-black mt-4 bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent italic">
              FIFTY!
            </h1>
            <h2 className="text-2xl font-bold text-zinc-200 mt-2 uppercase tracking-wide">
              {player}
            </h2>
            <p className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mt-1">
              Sensational Milestone Fifty runs scored
            </p>
          </motion.div>
        )}

        {/* 5. HUNDRED CELEBRATION */}
        {type === 'hundred' && (
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.3, opacity: 0 }}
            className="text-center z-10"
          >
            <span className="text-7xl">👑🏏🔥</span>
            <h1 className="text-8xl font-black mt-4 bg-gradient-to-r from-amber-500 via-amber-200 to-yellow-400 bg-clip-text text-transparent italic drop-shadow-md">
              CENTURY!
            </h1>
            <h2 className="text-3xl font-black text-zinc-100 mt-2 uppercase tracking-wide">
              {player}
            </h2>
            <p className="text-amber-400 text-xs font-black uppercase tracking-widest mt-2 animate-pulse">
              🏏 Magnificent Century 100 Runs 🏏
            </p>
          </motion.div>
        )}

        {/* 6. WINNING SHOT / CHAMPIONS */}
        {type === 'winning_shot' && (
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.2, opacity: 0 }}
            className="text-center z-10 px-6 max-w-lg"
          >
            <motion.span
              animate={{ rotateY: [0, 360], scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-8xl block mb-6"
            >
              🏆
            </motion.span>
            <h1 className="text-6xl font-black bg-gradient-to-r from-amber-400 via-amber-200 to-blue-400 bg-clip-text text-transparent italic drop-shadow-md uppercase tracking-wider">
              Champions!
            </h1>
            <h2 className="text-3xl font-black text-zinc-100 mt-3 uppercase tracking-wide">
              {winner === 'Australia' ? '🇦🇺 Australia wins' : '🇮🇳 India wins'}
            </h2>
            <p className="text-emerald-400 font-extrabold mt-2 text-sm uppercase tracking-widest animate-pulse">
              🎉 {margin} 🎉
            </p>
          </motion.div>
        )}

      </div>
    </AnimatePresence>
  );
}
