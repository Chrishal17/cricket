import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import LiveAnalytics from './LiveAnalytics';

export default function MatchCenter() {
  const activeMatch = useGameStore(state => state.activeMatch);
  const activeTournament = useGameStore(state => state.activeTournament);
  const user = useGameStore(state => state.user);
  const presence = useGameStore(state => state.presence);
  const submitBall = useGameStore(state => state.submitBall);
  const selectBowler = useGameStore(state => state.selectBowler);
  const startInnings = useGameStore(state => state.startInnings);
  const cancelMatch = useGameStore(state => state.cancelMatch);

  // Layout UI states
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Innings Startup selections
  const [bat1, setBat1] = useState('');
  const [bat2, setBat2] = useState('');
  const [startBowler, setStartBowler] = useState('');

  // Over progression selections
  const [nextBowler, setNextBowler] = useState('');

  // Ball-by-Ball Input States (For the bowling manager)
  const [runs, setRuns] = useState<number>(0);
  const [extra, setExtra] = useState<'none' | 'wide' | 'noball' | 'legbye' | 'bye'>('none');
  const [isBouncer, setIsBouncer] = useState(false);
  const [wheelSector, setWheelSector] = useState<number>(5); // default Cover/Mid-off straight

  // Wicket Form States
  const [isWicket, setIsWicket] = useState(false);
  const [dismissalType, setDismissalType] = useState('Bowled');
  const [dismissedId, setDismissedId] = useState('');
  const [newBatsmanId, setNewBatsmanId] = useState('');
  const [fielderName, setFielderName] = useState('');

  if (!activeMatch || !activeTournament) return null;

  const team = user?.team || 'AUS';
  const matchId = activeMatch._id || activeMatch.id || '';

  const inn1 = activeMatch.innings1;
  const inn2 = activeMatch.innings2;
  const currentInningsNo = activeMatch.currentInningsNo;
  const activeInnings = currentInningsNo === 1 ? inn1 : inn2;
  const opponentTeam = team === 'AUS' ? 'IND' : 'AUS';

  // Opponent connection blocker check
  const isOpponentOffline = presence[opponentTeam] !== 'Online';

  // Check roles: who is batting vs bowling in the active innings
  const battingTeam = activeInnings.battingTeam;
  const bowlingTeam = activeInnings.bowlingTeam;
  
  const isBatting = team === battingTeam;
  const isBowling = team === bowlingTeam;

  const maxOvers = activeTournament.settings.matchOvers || 5;

  // --- DERIVED METRICS ---

  const crr = activeInnings.ballsBowled > 0 ? parseFloat(((activeInnings.runs / activeInnings.ballsBowled) * 6).toFixed(2)) : 0.00;
  const ballsRemaining = (maxOvers * 6) - activeInnings.ballsBowled;

  let rrr = 0;
  let runsNeeded = 0;
  if (currentInningsNo === 2 && activeInnings.target) {
    runsNeeded = activeInnings.target - activeInnings.runs;
    rrr = ballsRemaining > 0 ? parseFloat(((runsNeeded / ballsRemaining) * 6).toFixed(2)) : 0;
  }

  // Find active striker and non-striker names
  const striker = activeInnings.batsmenStats.find(b => b.playerId === activeMatch.activeBatsman1 && b.active);
  const nonStriker = activeInnings.batsmenStats.find(b => b.playerId === activeMatch.activeBatsman2 && b.active);
  const activeBowlerObj = activeInnings.bowlerStats.find(b => b.playerId === activeMatch.activeBowler);

  // Bowler restriction checks:
  // Find which bowler bowled the last legal ball in timeline (so they can't bowl consecutive overs)
  const getLastBowlerId = () => {
    const timeline = activeInnings.ballTimeline;
    if (timeline.length === 0) return null;
    // Find the last over's bowler
    const lastBall = timeline[timeline.length - 1];
    return lastBall ? lastBall.bowlerId : null;
  };
  const lastBowlerId = getLastBowlerId();

  // Get available batters in playing XI who are NOT yet out, and NOT currently batting
  const getAvailableBatsmenList = () => {
    const xi = battingTeam === 'AUS' ? activeMatch.playingXI_AUS : activeMatch.playingXI_IND;
    const dismissedIds = activeInnings.batsmenStats.filter(b => !b.active && b.dismissal).map(b => b.playerId);
    
    return xi.filter(id => {
      if (dismissedIds.includes(id)) return false;
      if (id === activeMatch.activeBatsman1 || id === activeMatch.activeBatsman2) return false;
      return true;
    });
  };

  // Get players cache to pull names
  const getPlayerName = (id: string) => {
    const cache = battingTeam === 'AUS' ? activeMatch.playersAUS_cache : activeMatch.playersIND_cache;
    const bCache = bowlingTeam === 'AUS' ? activeMatch.playersAUS_cache : activeMatch.playersIND_cache;
    
    const combined = [...(cache || []), ...(bCache || [])];
    const found = combined.find((p: any) => p._id === id || p.id === id);
    return found ? found.name : 'Incoming Batter';
  };

  // Get list of available bowlers (players in bowling XI who have bowled less than max overs, e.g. 1 over max in T5)
  const getAvailableBowlers = () => {
    const xi = bowlingTeam === 'AUS' ? activeMatch.playingXI_AUS : activeMatch.playingXI_IND;
    const cache = bowlingTeam === 'AUS' ? activeMatch.playersAUS_cache : activeMatch.playersIND_cache;

    return xi.filter(id => {
      // Cannot bowl consecutive overs
      if (id === lastBowlerId) return false;
      
      const stats = activeInnings.bowlerStats.find(b => b.playerId === id);
      const bowledBalls = stats ? stats.ballsBowled : 0;
      // Max 1 over per bowler rule default
      const limitBalls = 6; 
      return bowledBalls < limitBalls;
    }).map(id => {
      const p = cache?.find((x: any) => x._id === id || x.id === id);
      return { id, name: p ? p.name : 'Bowler' };
    });
  };

  // --- EVENT SUBMISSIONS ---

  const handleStartInningsSubmit = () => {
    if (!bat1 || !bat2 || !startBowler) {
      alert('Select opening batsman 1, batsman 2, and the opening bowler.');
      return;
    }
    if (bat1 === bat2) {
      alert('Opening batsmen must be different players.');
      return;
    }
    startInnings(matchId, bat1, bat2, startBowler);
  };

  const handleBowlerSelectSubmit = () => {
    if (!nextBowler) {
      alert('Please select a bowler for the new over.');
      return;
    }
    selectBowler(matchId, nextBowler);
    setNextBowler('');
  };

  const handleBallSubmit = () => {
    if (isWicket && !newBatsmanId && activeInnings.wickets < 9) {
      alert('Please select the incoming batsman for the wicket.');
      return;
    }

    const payload = {
      runsScored: runs,
      extraType: extra,
      isBouncer,
      wicket: isWicket,
      dismissalType: isWicket ? dismissalType : null,
      dismissedPlayerId: isWicket ? dismissedId : null,
      newBatsmanId: isWicket ? newBatsmanId : null,
      newBatsmanName: isWicket && newBatsmanId ? getPlayerName(newBatsmanId) : '',
      fielderName: isWicket ? fielderName : '',
      wagonWheelSector: wheelSector
    };

    submitBall(matchId, payload);

    // Reset ball entry states
    setRuns(0);
    setExtra('none');
    setIsBouncer(false);
    setIsWicket(false);
    setDismissedId('');
    setNewBatsmanId('');
    setFielderName('');
  };

  const triggerCancel = () => {
    cancelMatch(matchId);
    setShowCancelConfirm(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-12 relative">
      
      {/* 🔴 DISCONNECT OVERLAY */}
      {isOpponentOffline && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center pointer-events-auto">
          <div className="text-center p-8 bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl max-w-sm">
            <span className="text-5xl animate-pulse block mb-4">🟡</span>
            <h3 className="text-lg font-black text-zinc-100 uppercase tracking-wider">Opponent Disconnected</h3>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
              Waiting for {opponentTeam === 'AUS' ? 'Australia' : 'India'} manager to reconnect... The match scoring controls have been locked to maintain sync.
            </p>
          </div>
        </div>
      )}

      {/* Broadcast Live Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => window.location.reload()}
            className="text-xs font-bold text-zinc-400 hover:text-zinc-200 border border-zinc-800 px-3 py-1.5 rounded-lg transition"
          >
            ← Leave Match
          </button>
          <span className="text-sm font-black uppercase text-zinc-300">Match {activeMatch.matchNumber} Live Arena</span>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-extrabold text-xs uppercase px-4 py-2 rounded-lg transition"
          >
            📊 Show Analytics
          </button>
          <button
            onClick={() => setShowCancelConfirm(true)}
            className="bg-red-650 hover:bg-red-700 text-zinc-100 font-extrabold text-xs uppercase px-3 py-2 rounded-lg border border-red-800/80 transition"
          >
            Cancel Match
          </button>
        </div>
      </header>

      {/* Cancel Confirm Popup */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl max-w-sm text-center">
            <h3 className="text-base font-bold text-zinc-200 uppercase">Are you sure?</h3>
            <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
              This will completely delete ball-by-ball progress for Match {activeMatch.matchNumber}. The match can be restarted.
            </p>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 py-2 rounded-lg bg-zinc-800 text-zinc-400 font-bold text-xs"
              >
                Go Back
              </button>
              <button
                onClick={triggerCancel}
                className="flex-1 py-2 rounded-lg bg-red-650 text-zinc-100 font-bold text-xs"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-6 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN & MIDDLE: Scoreboard display */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Main Score Board */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 text-[10px] uppercase font-mono tracking-widest text-zinc-500">
              Innings {currentInningsNo}
            </div>

            <div className="flex justify-between items-start">
              <div>
                <p className="text-zinc-500 text-xs font-extrabold uppercase tracking-widest">
                  {activeInnings.battingTeam === 'AUS' ? '🇦🇺 Australia Bats' : '🇮🇳 India Bats'}
                </p>
                <div className="flex items-baseline space-x-3 mt-2">
                  <span className="text-6xl font-black tracking-tight text-zinc-100">
                    {activeInnings.runs}/{activeInnings.wickets}
                  </span>
                  <span className="text-sm font-bold text-zinc-400">
                    ({activeInnings.overs} / {maxOvers} ov)
                  </span>
                </div>
              </div>

              {/* Run Rates Display */}
              <div className="text-right">
                <p className="text-zinc-500 text-[10px] uppercase tracking-wider font-extrabold">Run Rates</p>
                <p className="text-sm font-bold text-zinc-300 mt-1 font-mono">CRR: {crr}</p>
                {currentInningsNo === 2 && (
                  <p className="text-sm font-bold text-amber-400 font-mono mt-0.5">RRR: {rrr}</p>
                )}
              </div>
            </div>

            {/* Innings 2 Target Board */}
            {currentInningsNo === 2 && activeInnings.target && (
              <div className="mt-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-850 flex items-center justify-between text-xs">
                <span className="font-extrabold text-zinc-400">CHASE METRIC</span>
                <span className="font-black text-amber-400">
                  {runsNeeded} runs needed off {ballsRemaining} balls (Target: {activeInnings.target})
                </span>
              </div>
            )}

            {/* Recent Balls timeline */}
            <div className="mt-6 border-t border-zinc-800/50 pt-4 flex items-center space-x-3 text-xs">
              <span className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">This Over:</span>
              <div className="flex space-x-1.5 overflow-x-auto py-1.5">
                {activeInnings.ballTimeline.slice(-6).map((ball, idx) => {
                  let text = ball.runs.toString();
                  let color = 'bg-zinc-800 text-zinc-300';
                  
                  if (ball.extraType === 'wide') {
                    text = `${ball.runs + 1}Wd`;
                    color = 'bg-blue-950 text-blue-400 border border-blue-900';
                  } else if (ball.extraType === 'noball') {
                    text = `${ball.runs + 1}Nb`;
                    color = 'bg-cyan-950 text-cyan-400 border border-cyan-900';
                  } else if (ball.dismissal) {
                    text = 'W';
                    color = 'bg-red-950 text-red-400 border border-red-900 font-bold';
                  } else if (ball.runs === 4) {
                    color = 'bg-amber-950 text-amber-400 border border-amber-900 font-extrabold';
                  } else if (ball.runs === 6) {
                    color = 'bg-pink-950 text-pink-400 border border-pink-900 font-extrabold';
                  }

                  return (
                    <span
                      key={idx}
                      className={`h-7 min-w-7 px-1.5 rounded-full flex items-center justify-center text-[10px] font-bold ${color}`}
                    >
                      {text}
                    </span>
                  );
                })}
                {activeInnings.ballTimeline.length === 0 && (
                  <span className="text-zinc-600 italic">Over starting</span>
                )}
              </div>
            </div>
          </div>

          {/* ACTIVE BATSMEN TABLE */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl">
            <h3 className="text-zinc-400 text-xs font-extrabold uppercase tracking-widest mb-4">Batsmen</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500 font-bold uppercase tracking-wider">
                    <th className="pb-3">Batsman</th>
                    <th className="pb-3 text-center">Runs</th>
                    <th className="pb-3 text-center">Balls</th>
                    <th className="pb-3 text-center">SR</th>
                    <th className="pb-3 text-center">4s</th>
                    <th className="pb-3 text-center">6s</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40">
                  {/* Striker */}
                  {striker && (
                    <tr className="font-bold text-zinc-200">
                      <td className="py-3.5 flex items-center space-x-1.5">
                        <span className="text-yellow-400">★</span>
                        <span>{striker.name}</span>
                      </td>
                      <td className="py-3.5 text-center text-sm font-black text-amber-400">{striker.runs}</td>
                      <td className="py-3.5 text-center font-mono text-zinc-400">{striker.balls}</td>
                      <td className="py-3.5 text-center font-mono text-zinc-400">
                        {((striker.runs / (striker.balls || 1)) * 100).toFixed(1)}
                      </td>
                      <td className="py-3.5 text-center text-zinc-500 font-mono">{striker.fours}</td>
                      <td className="py-3.5 text-center text-zinc-500 font-mono">{striker.sixes}</td>
                    </tr>
                  )}
                  {/* Non-striker */}
                  {nonStriker && (
                    <tr className="text-zinc-400">
                      <td className="py-3.5 pl-5">{nonStriker.name}</td>
                      <td className="py-3.5 text-center font-black text-zinc-300">{nonStriker.runs}</td>
                      <td className="py-3.5 text-center font-mono">{nonStriker.balls}</td>
                      <td className="py-3.5 text-center font-mono">
                        {((nonStriker.runs / (nonStriker.balls || 1)) * 100).toFixed(1)}
                      </td>
                      <td className="py-3.5 text-center text-zinc-600 font-mono">{nonStriker.fours}</td>
                      <td className="py-3.5 text-center text-zinc-600 font-mono">{nonStriker.sixes}</td>
                    </tr>
                  )}
                  {!striker && !nonStriker && (
                    <tr>
                      <td colSpan={6} className="text-zinc-650 italic text-center py-6">Batsmen awaiting selection</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ACTIVE BOWLER DETAILS */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl">
            <h3 className="text-zinc-400 text-xs font-extrabold uppercase tracking-widest mb-4">Bowler</h3>
            <div className="flex items-center justify-between">
              {activeBowlerObj ? (
                <>
                  <div>
                    <p className="text-sm font-black text-zinc-200">{activeBowlerObj.name}</p>
                    <div className="flex space-x-4 mt-2 text-xs font-mono text-zinc-500">
                      <span>Overs: {activeBowlerObj.overs}</span>
                      <span>Runs: {activeBowlerObj.runs}</span>
                      <span>Wkts: {activeBowlerObj.wickets}</span>
                      <span>Eco: {((activeBowlerObj.runs / (activeBowlerObj.ballsBowled || 1)) * 6).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Bouncers indicators */}
                  <div className="text-right">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">Bouncer Tracker</p>
                    <div className="flex space-x-1.5 mt-2 justify-end">
                      {Array(activeTournament.settings.bouncerLimit || 1).fill(0).map((_, idx) => {
                        const bowled = (activeBowlerObj.bouncersThisOver || 0) > idx;
                        return (
                          <span
                            key={idx}
                            className={`h-4.5 w-4.5 rounded-full flex items-center justify-center text-[8px] font-bold border ${bowled ? 'bg-red-650 border-red-800 text-zinc-100' : 'bg-zinc-950 border-zinc-800 text-zinc-650'}`}
                          >
                            B
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-zinc-650 text-xs italic text-center py-2 w-full">Bowler awaiting selection for new over</p>
              )}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Action and entry boards */}
        <div className="space-y-6">
          
          {/* A. START INNINGS SETUP FORM */}
          {activeMatch.status === 'Live' && !activeMatch.activeBatsman1 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-5">
              <h3 className="text-base font-extrabold text-zinc-100 uppercase tracking-wide border-b border-zinc-800 pb-2">Innings Startup</h3>
              
              {isBatting ? (
                <div className="space-y-4">
                  <p className="text-xs text-zinc-400 leading-relaxed">You are batting first! Designate your opening batsmen.</p>
                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-2 font-bold">Striker Batsman 1</label>
                    <select
                      value={bat1}
                      onChange={(e) => setBat1(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-300 outline-none"
                    >
                      <option value="">-- Choose Striker --</option>
                      {getAvailableBatsmenList().map(id => (
                        <option key={id} value={id}>{getPlayerName(id)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-2 font-bold">Non-Striker Batsman 2</label>
                    <select
                      value={bat2}
                      onChange={(e) => setBat2(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-300 outline-none"
                    >
                      <option value="">-- Choose Non-Striker --</option>
                      {getAvailableBatsmenList().map(id => (
                        <option key={id} value={id}>{getPlayerName(id)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-850 text-center text-xs text-zinc-500">
                  Waiting for batting manager to select opening batsmen...
                </div>
              )}

              {isBowling ? (
                <div className="space-y-4">
                  <p className="text-xs text-zinc-400 leading-relaxed">You are bowling! Designate your opening bowler.</p>
                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-2 font-bold">Opening Bowler</label>
                    <select
                      value={startBowler}
                      onChange={(e) => setStartBowler(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-300 outline-none"
                    >
                      <option value="">-- Choose Bowler --</option>
                      {getAvailableBowlers().map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-850 text-center text-xs text-zinc-500">
                  Waiting for bowling manager to select opening bowler...
                </div>
              )}

              <button
                onClick={handleStartInningsSubmit}
                className="w-full bg-amber-500 hover:bg-amber-600 text-zinc-950 font-black uppercase tracking-wider text-xs py-3 rounded-xl transition"
              >
                Confirm & Launch Play
              </button>
            </div>
          )}

          {/* B. SELECT BOWLER FOR NEW OVER FORM */}
          {activeMatch.status === 'Live' && activeMatch.activeBatsman1 && !activeMatch.activeBowler && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-4">
              <h3 className="text-sm font-extrabold text-zinc-200 uppercase tracking-wide">Select Bowler (New Over)</h3>
              
              {isBowling ? (
                <div className="space-y-4">
                  <p className="text-xs text-zinc-400">Select a bowler for the new over. Note: Bowlers cannot bowl consecutive overs.</p>
                  <select
                    value={nextBowler}
                    onChange={(e) => setNextBowler(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-300 outline-none"
                  >
                    <option value="">-- Select Bowler --</option>
                    {getAvailableBowlers().map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleBowlerSelectSubmit}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-zinc-950 font-black uppercase tracking-wider text-xs py-3 rounded-xl transition"
                  >
                    Confirm Bowler
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-850 text-center text-xs text-zinc-500">
                  Waiting for bowling manager to select the bowler for the new over...
                </div>
              )}
            </div>
          )}

          {/* C. BALL BY BALL INPUT PANEL */}
          {activeMatch.status === 'Live' && activeMatch.activeBatsman1 && activeMatch.activeBowler && (
            <div className="space-y-6">
              
              {isBowling ? (
                <div className="bg-zinc-900 border border-zinc-850 rounded-3xl p-6 shadow-xl space-y-6">
                  <h3 className="text-sm font-extrabold text-zinc-200 uppercase tracking-widest border-b border-zinc-800 pb-2">Bowl Controls</h3>
                  
                  {/* Runs selectors */}
                  <div className="space-y-2">
                    <label className="block text-[10px] text-zinc-500 uppercase tracking-wider font-extrabold">Runs Scored off Bat</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[0, 1, 2, 3, 4, 5, 6].map(num => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setRuns(num)}
                          className={`py-3 rounded-lg font-black font-mono transition ${runs === num ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20' : 'bg-zinc-950 border border-zinc-800 text-zinc-300 hover:border-zinc-700'}`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Extras / Specials tags */}
                  <div className="space-y-3">
                    <label className="block text-[10px] text-zinc-500 uppercase tracking-wider font-extrabold">Delivery Extras / Bouncer</label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: 'Normal', value: 'none' },
                        { label: 'Wide', value: 'wide' },
                        { label: 'No Ball', value: 'noball' },
                        { label: 'Bye', value: 'bye' },
                        { label: 'Leg Bye', value: 'legbye' }
                      ].map(item => (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => setExtra(item.value as any)}
                          className={`text-[10px] uppercase font-extrabold px-3 py-2 rounded-lg border transition ${extra === item.value ? 'bg-amber-500/10 border-amber-500 text-amber-400' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}
                        >
                          {item.label}
                        </button>
                      ))}
                      
                      <button
                        type="button"
                        onClick={() => setIsBouncer(!isBouncer)}
                        className={`text-[10px] uppercase font-extrabold px-3 py-2 rounded-lg border transition ${isBouncer ? 'bg-red-500/10 border-red-500 text-red-400 font-bold' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}
                      >
                        Bouncer {isBouncer ? '✓' : ''}
                      </button>
                    </div>
                  </div>

                  {/* Wagon Wheel target sector picker */}
                  <div className="space-y-3">
                    <label className="block text-[10px] text-zinc-500 uppercase tracking-wider font-extrabold">Hit Direction (Wagon Wheel)</label>
                    <div className="grid grid-cols-4 gap-2 text-[9px] font-bold">
                      {[
                        { label: 'Fine Leg', val: 1 },
                        { label: 'Square Leg', val: 2 },
                        { label: 'Mid-Wicket', val: 3 },
                        { label: 'Mid-On', val: 4 },
                        { label: 'Mid-Off', val: 5 },
                        { label: 'Cover', val: 6 },
                        { label: 'Point', val: 7 },
                        { label: 'Third Man', val: 8 }
                      ].map(item => (
                        <button
                          key={item.val}
                          type="button"
                          onClick={() => setWheelSector(item.val)}
                          className={`py-2 rounded-lg border text-center transition ${wheelSector === item.val ? 'bg-amber-500/10 border-amber-500 text-amber-400 font-extrabold' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* WICKET TOGGLE AND SUB-FORM */}
                  <div className="border-t border-zinc-800/60 pt-4 space-y-4">
                    <button
                      type="button"
                      onClick={() => {
                        setIsWicket(!isWicket);
                        setDismissedId(activeMatch.activeBatsman1 || '');
                      }}
                      className={`w-full py-3 rounded-xl border font-black uppercase text-xs transition ${isWicket ? 'bg-red-650 border-red-800 text-zinc-100 shadow-md shadow-red-950/20' : 'bg-zinc-950 border-zinc-800 text-red-500 hover:bg-red-950/20'}`}
                    >
                      ⚠️ Log Wicket {isWicket ? 'Active' : ''}
                    </button>

                    {isWicket && (
                      <div className="p-4 bg-zinc-950 border border-zinc-850 rounded-2xl space-y-3 text-xs">
                        <div>
                          <label className="block text-[9px] text-zinc-500 uppercase tracking-wider mb-1.5 font-bold">Dismissal Style</label>
                          <select
                            value={dismissalType}
                            onChange={(e) => setDismissalType(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-zinc-300 outline-none"
                          >
                            <option value="Bowled">Bowled</option>
                            <option value="Caught">Caught</option>
                            <option value="LBW">LBW</option>
                            <option value="Run Out">Run Out</option>
                            <option value="Stumping">Stumping</option>
                            <option value="Hit Wicket">Hit Wicket</option>
                            <option value="Retired Hurt">Retired Hurt</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[9px] text-zinc-500 uppercase tracking-wider mb-1.5 font-bold">Dismissed Batsman</label>
                          <select
                            value={dismissedId}
                            onChange={(e) => setDismissedId(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-zinc-300 outline-none"
                          >
                            <option value={activeMatch.activeBatsman1}>{getPlayerName(activeMatch.activeBatsman1 || '')} (Striker)</option>
                            <option value={activeMatch.activeBatsman2}>{getPlayerName(activeMatch.activeBatsman2 || '')} (Non-Striker)</option>
                          </select>
                        </div>

                        {['Caught', 'Run Out', 'Stumping'].includes(dismissalType) && (
                          <div>
                            <label className="block text-[9px] text-zinc-500 uppercase tracking-wider mb-1.5 font-bold">Fielder Involved</label>
                            <input
                              type="text"
                              value={fielderName}
                              onChange={(e) => setFielderName(e.target.value)}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 outline-none focus:border-amber-500"
                              placeholder="e.g. Jadeja"
                            />
                          </div>
                        )}

                        {activeInnings.wickets < 9 && (
                          <div>
                            <label className="block text-[9px] text-zinc-500 uppercase tracking-wider mb-1.5 font-bold">Incoming Batsman</label>
                            <select
                              value={newBatsmanId}
                              onChange={(e) => setNewBatsmanId(e.target.value)}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-zinc-300 outline-none"
                            >
                              <option value="">-- Select Batsman --</option>
                              {getAvailableBatsmenList().map(id => (
                                <option key={id} value={id}>{getPlayerName(id)}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Free Hit alert banner */}
                  {activeMatch.isFreeHitActive && (
                    <div className="bg-cyan-950/20 border border-cyan-800/80 p-3.5 rounded-xl text-xs text-cyan-400 font-extrabold uppercase text-center animate-pulse">
                      ⚡ Free Hit Activated! Only Run Out is valid dismissal. ⚡
                    </div>
                  )}

                  {/* Submit Ball */}
                  <button
                    onClick={handleBallSubmit}
                    className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-zinc-950 font-black uppercase tracking-wider text-xs py-4 rounded-xl shadow-lg transition active:scale-[0.98]"
                  >
                    Submit Delivery
                  </button>
                </div>
              ) : (
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-xl text-center space-y-4">
                  <div className="h-10 w-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mx-auto" />
                  <h4 className="text-sm font-extrabold text-zinc-300 uppercase tracking-wider">Opponent is Bowling</h4>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    India manager is logging delivery figures in real-time. Stand by at the crease... The scoreboard will update instantly.
                  </p>
                </div>
              )}
            </div>
          )}

        </div>

      </main>

      {/* Slide-out Collapsible Live Analytics Sidebar */}
      <LiveAnalytics isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </div>
  );
}
