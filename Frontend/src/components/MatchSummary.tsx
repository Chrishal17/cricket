import { useState } from 'react';
import { useGameStore } from '../store/gameStore';

export default function MatchSummary() {
  const activeMatch = useGameStore(state => state.activeMatch);
  const activeTournament = useGameStore(state => state.activeTournament);
  const restartMatch = useGameStore(state => state.restartMatch);

  // Scorecard toggle tabs (Innings 1 vs Innings 2 details)
  const [activeInningsTab, setActiveInningsTab] = useState<1 | 2>(1);

  if (!activeMatch || !activeTournament) return null;

  const inn1 = activeMatch.innings1;
  const inn2 = activeMatch.innings2;

  const matchId = activeMatch._id || activeMatch.id || '';

  const getPlayerName = (id: string, team: 'AUS' | 'IND') => {
    const cache = team === 'AUS' ? activeMatch.playersAUS_cache : activeMatch.playersIND_cache;
    const found = cache?.find((p: any) => p._id === id || p.id === id);
    return found ? found.name : 'Unknown';
  };

  const handleRestart = () => {
    if (window.confirm('Are you sure you want to reset this match and play it again? All score details will be lost.')) {
      restartMatch(matchId);
    }
  };

  // Close this summary view in gameStore (sets activeMatch back to null, returns to Dashboard)
  const handleClose = () => {
    useGameStore.setState({ activeMatch: null });
  };

  const currentTabInnings = activeInningsTab === 1 ? inn1 : inn2;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-16">
      
      {/* Broadcast Style Header Banner */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center space-x-3">
          <span className="text-sm font-black uppercase text-zinc-300">Match {activeMatch.matchNumber} Post-Match Review</span>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleRestart}
            className="bg-zinc-850 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-zinc-400 font-extrabold text-xs uppercase px-4 py-2 rounded-lg transition"
          >
            Play Replay / Reset
          </button>
          <button
            onClick={handleClose}
            className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-extrabold text-xs uppercase px-4 py-2 rounded-lg transition"
          >
            Back to Standings
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 mt-8 space-y-8">
        
        {/* Victory Board Header Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden text-center">
          <div className="absolute inset-0 bg-radial from-amber-500/5 via-transparent to-transparent pointer-events-none" />
          
          <span className="text-5xl block mb-3">🏆</span>
          <h1 className="text-3xl font-black bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 bg-clip-text text-transparent italic drop-shadow-md uppercase tracking-wider">
            Match Completed
          </h1>
          <h2 className="text-xl font-bold text-zinc-100 mt-2">
            {activeMatch.winner === 'AUS' ? '🇦🇺 Australia won' : activeMatch.winner === 'IND' ? '🇮🇳 India won' : 'Match Tied'}{' '}
            <span className="text-emerald-400">{activeMatch.winMargin}</span>
          </h2>
          
          {/* Player of match tag */}
          <div className="inline-block mt-6 px-5 py-2.5 bg-zinc-950 border border-zinc-850 rounded-2xl text-xs">
            <span className="text-zinc-500 font-extrabold uppercase tracking-wider block">Player of the Match</span>
            <span className="text-amber-400 font-black text-sm mt-1 block">⭐ {activeMatch.playerOfMatch} ⭐</span>
          </div>

          {/* Innings Summaries row */}
          <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto mt-8 border-t border-zinc-800/60 pt-6">
            <div className="text-center p-3 bg-zinc-950/30 rounded-2xl border border-zinc-850/50">
              <p className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-wider">
                {inn1.battingTeam === 'AUS' ? 'AUS (Innings 1)' : 'IND (Innings 1)'}
              </p>
              <p className="text-lg font-black text-zinc-200 mt-1">{inn1.runs}/{inn1.wickets}</p>
              <p className="text-[10px] text-zinc-500 font-mono mt-0.5">CRR: {((inn1.runs / (inn1.ballsBowled || 1)) * 6).toFixed(2)} ({inn1.overs} ov)</p>
            </div>

            <div className="text-center p-3 bg-zinc-950/30 rounded-2xl border border-zinc-850/50">
              <p className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-wider">
                {inn2.battingTeam === 'AUS' ? 'AUS (Innings 2)' : 'IND (Innings 2)'}
              </p>
              <p className="text-lg font-black text-zinc-200 mt-1">{inn2.runs}/{inn2.wickets}</p>
              <p className="text-[10px] text-zinc-500 font-mono mt-0.5">CRR: {((inn2.runs / (inn2.ballsBowled || 1)) * 6).toFixed(2)} ({inn2.overs} ov)</p>
            </div>
          </div>
        </div>

        {/* INNINGS TABS */}
        <div className="flex space-x-3 border-b border-zinc-800 text-xs font-bold uppercase tracking-wider">
          <button
            onClick={() => setActiveInningsTab(1)}
            className={`pb-3.5 px-2 transition ${activeInningsTab === 1 ? 'text-amber-500 border-b-2 border-amber-500' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Innings 1: {inn1.battingTeam === 'AUS' ? 'Australia Batting' : 'India Batting'}
          </button>
          <button
            onClick={() => setActiveInningsTab(2)}
            className={`pb-3.5 px-2 transition ${activeInningsTab === 2 ? 'text-amber-500 border-b-2 border-amber-500' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Innings 2: {inn2.battingTeam === 'AUS' ? 'Australia Batting' : 'India Batting'}
          </button>
        </div>

        {/* BATTING SCORECARD */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-4">
          <h3 className="text-xs font-extrabold uppercase tracking-widest text-zinc-400">Batting scorecard</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 font-bold uppercase tracking-wider">
                  <th className="pb-3">Batsman</th>
                  <th className="pb-3">Dismissal</th>
                  <th className="pb-3 text-center">Runs</th>
                  <th className="pb-3 text-center">Balls</th>
                  <th className="pb-3 text-center">4s</th>
                  <th className="pb-3 text-center">6s</th>
                  <th className="pb-3 text-center">SR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {currentTabInnings.batsmenStats.map((batsman) => (
                  <tr key={batsman.playerId} className="text-zinc-300">
                    <td className="py-3.5 font-bold text-zinc-200">{batsman.name}</td>
                    <td className="py-3.5 text-zinc-500 italic max-w-xs truncate">{batsman.dismissal || 'not out'}</td>
                    <td className="py-3.5 text-center font-black text-amber-400 text-sm">{batsman.runs}</td>
                    <td className="py-3.5 text-center font-mono text-zinc-400">{batsman.balls}</td>
                    <td className="py-3.5 text-center text-zinc-500 font-mono">{batsman.fours}</td>
                    <td className="py-3.5 text-center text-zinc-500 font-mono">{batsman.sixes}</td>
                    <td className="py-3.5 text-center font-mono text-zinc-400">
                      {((batsman.runs / (batsman.balls || 1)) * 100).toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Extras details summary */}
          <div className="flex justify-between items-center p-3 bg-zinc-950 rounded-2xl border border-zinc-850 text-xs mt-4">
            <span className="text-zinc-500 font-bold uppercase text-[10px]">Extras</span>
            <span className="text-zinc-300 font-semibold">
              Total: {currentTabInnings.extras.wide + currentTabInnings.extras.noball + currentTabInnings.extras.bye + currentTabInnings.extras.legbye} (
              Wd: {currentTabInnings.extras.wide}, Nb: {currentTabInnings.extras.noball}, B: {currentTabInnings.extras.bye}, Lb: {currentTabInnings.extras.legbye}
              )
            </span>
          </div>
        </div>

        {/* BOWLING SCORECARD */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-4">
          <h3 className="text-xs font-extrabold uppercase tracking-widest text-zinc-400">Bowling scorecard</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 font-bold uppercase tracking-wider">
                  <th className="pb-3">Bowler</th>
                  <th className="pb-3 text-center">Overs</th>
                  <th className="pb-3 text-center">Runs</th>
                  <th className="pb-3 text-center">Wickets</th>
                  <th className="pb-3 text-center">Economy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {currentTabInnings.bowlerStats.map((bowler) => (
                  <tr key={bowler.playerId} className="text-zinc-300">
                    <td className="py-3.5 font-bold text-zinc-200">{bowler.name}</td>
                    <td className="py-3.5 text-center font-mono text-zinc-400">{bowler.overs}</td>
                    <td className="py-3.5 text-center font-black text-zinc-250">{bowler.runs}</td>
                    <td className="py-3.5 text-center font-black text-blue-400 text-sm">{bowler.wickets}</td>
                    <td className="py-3.5 text-center font-mono text-zinc-400">
                      {((bowler.runs / (bowler.ballsBowled || 1)) * 6).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FALL OF WICKETS & PARTNERSHIPS SPLIT GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Fall of Wickets list */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-zinc-400">Fall Of Wickets</h3>
            <div className="space-y-2.5">
              {currentTabInnings.ballTimeline
                .filter(b => b.dismissal)
                .map((ball, idx) => {
                  const outName = getPlayerName(ball.dismissedPlayerId || '', currentTabInnings.battingTeam as 'AUS' | 'IND');
                  
                  // Compute runs scored up to that ball
                  let runsAtWicket = 0;
                  const idxInTimeline = currentTabInnings.ballTimeline.indexOf(ball);
                  for (let i = 0; i <= idxInTimeline; i++) {
                    const temp = currentTabInnings.ballTimeline[i];
                    runsAtWicket += temp.runs + (['wide', 'noball'].includes(temp.extraType) ? 1 : 0);
                  }

                  return (
                    <div key={idx} className="flex justify-between items-center p-3 bg-zinc-950 rounded-xl border border-zinc-850/50 text-xs">
                      <div>
                        <p className="font-bold text-zinc-300">{idx + 1}-{runsAtWicket}</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">{outName} (ov: {ball.over}.{ball.ball})</p>
                      </div>
                      <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider">Out</span>
                    </div>
                  );
                })}
              {currentTabInnings.ballTimeline.filter(b => b.dismissal).length === 0 && (
                <p className="text-zinc-600 italic text-xs py-2">No wickets fell during this innings.</p>
              )}
            </div>
          </div>

          {/* Partnerships board */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-zinc-400">Partnership details</h3>
            <div className="space-y-2.5">
              {currentTabInnings.partnerships.map((p, idx) => {
                const b1 = getPlayerName(p.batsman1Id, currentTabInnings.battingTeam as 'AUS' | 'IND');
                const b2 = getPlayerName(p.batsman2Id, currentTabInnings.battingTeam as 'AUS' | 'IND');
                
                return (
                  <div key={idx} className="p-3 bg-zinc-950 rounded-xl border border-zinc-850/50 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-zinc-300">{p.runs} Runs</span>
                      <span className="text-[10px] text-zinc-500 font-mono">{p.balls} Balls</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1 uppercase font-semibold">{b1} & {b2}</p>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </main>
    </div>
  );
}
