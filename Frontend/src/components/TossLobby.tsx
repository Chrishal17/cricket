import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { motion } from 'framer-motion';

export default function TossLobby() {
  const activeMatch = useGameStore(state => state.activeMatch);
  const user = useGameStore(state => state.user);
  const presence = useGameStore(state => state.presence);
  const tossSpinning = useGameStore(state => state.tossSpinning);
  const tossResultData = useGameStore(state => state.tossResultData);
  const startToss = useGameStore(state => state.startToss);
  const submitTossDecision = useGameStore(state => state.submitTossDecision);

  const [tossCalling, setTossCalling] = useState(false);

  const team = user?.team || 'AUS';
  const matchId = activeMatch?._id || activeMatch?.id || '';

  if (!activeMatch) return null;

  const bothConnected = presence.AUS === 'Online' && presence.IND === 'Online';

  if (!bothConnected) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl max-w-2xl mx-auto text-center relative overflow-hidden">
        <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-radial from-amber-500/5 via-transparent to-transparent pointer-events-none" />
        
        <h2 className="text-zinc-400 text-xs font-extrabold uppercase tracking-widest mb-2">
          Match Toss Arena
        </h2>
        <h3 className="text-xl font-extrabold text-zinc-100 mb-8 uppercase tracking-wide">
          Waiting for Opponent Connection
        </h3>
        
        <div className="py-12 flex flex-col items-center justify-center space-y-4">
          <div className="h-10 w-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
          <p className="text-sm font-bold text-zinc-300">Awaiting Both Managers to be Online</p>
          <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
            The Toss coin flip will become available once both the Australia and India managers are connected to the live match lobby.
          </p>
          
          <div className="flex justify-center space-x-6 pt-6 text-xs font-mono">
            <div className="flex items-center space-x-2">
              <span>🇦🇺 AUS:</span>
              <span className={presence.AUS === 'Online' ? 'text-green-400 font-bold' : 'text-red-500 font-semibold'}>
                {presence.AUS === 'Online' ? '🟢 Online' : '🔴 Offline'}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span>🇮🇳 IND:</span>
              <span className={presence.IND === 'Online' ? 'text-green-400 font-bold' : 'text-red-500 font-semibold'}>
                {presence.IND === 'Online' ? '🟢 Online' : '🔴 Offline'}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Determine roles in toss
  const isCaller = activeMatch.tossCaller === team;
  const callerName = activeMatch.tossCaller === 'AUS' ? 'Australia' : 'India';

  const isTossWinner = activeMatch.tossWinner === team;
  const tossWinnerName = activeMatch.tossWinner === 'AUS' ? 'Australia' : 'India';

  const handleTossCall = (choice: 'Heads' | 'Tails') => {
    setTossCalling(true);
    startToss(matchId, choice);
  };

  const handleDecision = (decision: 'Bat' | 'Bowl') => {
    submitTossDecision(matchId, decision);
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl max-w-2xl mx-auto text-center relative overflow-hidden">
      {/* Dynamic background glow */}
      <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-radial from-amber-500/5 via-transparent to-transparent pointer-events-none" />

      <h2 className="text-zinc-400 text-xs font-extrabold uppercase tracking-widest mb-2">
        Match Toss Arena
      </h2>
      <h3 className="text-xl font-extrabold text-zinc-100 mb-8 uppercase tracking-wide">
        Coin Flip Lobbby
      </h3>

      {/* 1. COIN SPINNING ANIMATION PHASE */}
      {tossSpinning ? (
        <div className="py-12 flex flex-col items-center justify-center">
          <motion.div
            className="w-24 h-24 rounded-full bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 border-4 border-amber-300 shadow-2xl flex items-center justify-center text-zinc-950 text-2xl font-black italic select-none"
            animate={{
              rotateY: [0, 360, 720, 1080, 1440, 1800, 2160],
              scale: [1, 1.2, 1.3, 1.2, 1.1, 1.2, 1],
              y: [0, -100, -130, -100, 0, -20, 0]
            }}
            transition={{
              duration: 3.2,
              ease: "easeInOut"
            }}
          >
            💰
          </motion.div>
          <p className="text-sm font-bold text-amber-400 mt-8 animate-pulse uppercase tracking-wider">Flirting with luck... Spinning coin!</p>
          <p className="text-xs text-zinc-500 mt-1">Called: {tossResultData?.choice}</p>
        </div>
      ) : (
        <div>
          {/* 2. COMPLETED TOSS DECISION PHASE */}
          {activeMatch.tossWinner ? (
            <div className="py-6 space-y-6">
              <div className="flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center text-3xl mb-4">
                  🏆
                </div>
                <p className="text-sm font-bold text-zinc-400">Toss Results</p>
                <h4 className="text-2xl font-black text-amber-400 mt-1 uppercase tracking-wide">
                  {tossWinnerName} won the toss
                </h4>
                <p className="text-xs text-zinc-500 mt-1">
                  Called {activeMatch.tossChoice} correctly.
                </p>
              </div>

              {activeMatch.tossDecision ? (
                <div className="p-4 bg-zinc-950 border border-zinc-850 rounded-2xl max-w-md mx-auto">
                  <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Decision Applied</p>
                  <p className="text-sm font-black text-zinc-200 mt-1.5">
                    {tossWinnerName} elected to <span className="text-amber-400 uppercase">{activeMatch.tossDecision} First</span>
                  </p>
                </div>
              ) : (
                <div className="pt-4 max-w-md mx-auto space-y-4">
                  {isTossWinner ? (
                    <>
                      <p className="text-xs font-extrabold uppercase tracking-widest text-zinc-400">Select your Innings Strategy</p>
                      <div className="grid grid-cols-2 gap-4">
                        <button
                          onClick={() => handleDecision('Bat')}
                          className="p-5 bg-zinc-950 border border-zinc-800 hover:border-amber-500 rounded-2xl font-black uppercase text-sm text-zinc-200 hover:text-amber-400 transition hover:bg-amber-500/5"
                        >
                          🏏 Bat First
                        </button>
                        <button
                          onClick={() => handleDecision('Bowl')}
                          className="p-5 bg-zinc-950 border border-zinc-800 hover:border-amber-500 rounded-2xl font-black uppercase text-sm text-zinc-200 hover:text-amber-400 transition hover:bg-amber-500/5"
                        >
                          ⚾ Bowl First
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="p-6 bg-zinc-950 rounded-2xl border border-zinc-850">
                      <div className="h-6 w-6 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin mx-auto mb-3" />
                      <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Waiting for {tossWinnerName} manager to select Bat/Bowl...</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            // 3. AWAITING TOSS CALL PHASE
            <div className="py-8">
              {isCaller ? (
                <div className="space-y-6">
                  <div className="text-3xl mb-2 animate-bounce">🪙</div>
                  <p className="text-sm font-bold text-zinc-300">Australia received the toss call challenge!</p>
                  <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Choose Heads or Tails</p>
                  
                  <div className="flex justify-center space-x-6">
                    <button
                      onClick={() => handleTossCall('Heads')}
                      disabled={tossCalling}
                      className="px-8 py-4 bg-zinc-950 border border-zinc-800 hover:border-amber-500 rounded-2xl font-black uppercase text-sm text-zinc-300 hover:text-amber-400 transition disabled:opacity-50 shadow-lg hover:shadow-amber-500/5"
                    >
                      👑 Heads
                    </button>
                    <button
                      onClick={() => handleTossCall('Tails')}
                      disabled={tossCalling}
                      className="px-8 py-4 bg-zinc-950 border border-zinc-800 hover:border-amber-500 rounded-2xl font-black uppercase text-sm text-zinc-300 hover:text-amber-400 transition disabled:opacity-50 shadow-lg hover:shadow-amber-500/5"
                    >
                      🦅 Tails
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-8 bg-zinc-950 rounded-2xl border border-zinc-850">
                  <div className="h-6 w-6 border-2 border-zinc-750 border-t-zinc-500 rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Waiting for {callerName} manager to call the toss...</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
