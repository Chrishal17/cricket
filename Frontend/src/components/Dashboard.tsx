import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

export default function Dashboard() {
  const activeTournament = useGameStore(state => state.activeTournament);
  const matches = useGameStore(state => state.matches);
  const user = useGameStore(state => state.user);
  const presence = useGameStore(state => state.presence);
  const notifications = useGameStore(state => state.notifications);
  const createTournament = useGameStore(state => state.createTournament);
  const logout = useGameStore(state => state.logout);
  const fetchMatchDetails = useGameStore(state => state.fetchMatchDetails);
  const restartMatch = useGameStore(state => state.restartMatch);

  // Local state for statistics dashboard
  const [analytics, setAnalytics] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [activeTab, setActiveTab] = useState<'orange' | 'purple' | 'mvp' | 'sixes' | 'economy'>('orange');

  // Local state for creating new tournament
  const [tourType, setTourType] = useState('best_of_10');
  const [customMatches, setCustomMatches] = useState(10);
  const [matchOvers, setMatchOvers] = useState(5);
  const [bouncerLimit, setBouncerLimit] = useState(1);
  const [freeHitEnabled, setFreeHitEnabled] = useState(true);

  const fetchAnalytics = async () => {
    if (!activeTournament) return;
    setLoadingAnalytics(true);
    try {
      const tourId = activeTournament._id || activeTournament.id;
      const res = await fetch(`http://localhost:5000/api/tournament/${tourId}/analytics`);
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  useEffect(() => {
    if (activeTournament) {
      fetchAnalytics();
    }
  }, [activeTournament, matches]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createTournament(tourType, {
        matchOvers,
        bouncerLimit,
        freeHitEnabled,
        squadSize: 11
      });
    } catch (err: any) {
      alert(err.message || 'Failed to create tournament');
    }
  };

  // Helper calculation for Net Run Rate (NRR)
  // Let's compute NRR for IND and AUS based on matches list
  const computeNRR = () => {
    let ausRunsScored = 0, ausOversFaced = 0;
    let ausRunsConceded = 0, ausOversBowled = 0;
    let indRunsScored = 0, indOversFaced = 0;
    let indRunsConceded = 0, indOversBowled = 0;

    matches.filter(m => m.status === 'Completed').forEach(m => {
      const inn1 = m.innings1;
      const inn2 = m.innings2;
      
      const team1 = inn1.battingTeam;
      const team2 = inn2.battingTeam;

      const runs1 = inn1.runs;
      const wickets1 = inn1.wickets;
      const balls1 = inn1.ballsBowled;
      // If team all out, they are considered to face their full quota of overs
      const maxBalls = (activeTournament?.settings.matchOvers || 5) * 6;
      const facedBalls1 = wickets1 === 10 ? maxBalls : balls1;

      const runs2 = inn2.runs;
      const wickets2 = inn2.wickets;
      const balls2 = inn2.ballsBowled;
      const facedBalls2 = wickets2 === 10 ? maxBalls : balls2;

      if (team1 === 'AUS') {
        ausRunsScored += runs1;
        ausOversFaced += facedBalls1;
        ausRunsConceded += runs2;
        ausOversBowled += facedBalls2;
      } else {
        indRunsScored += runs1;
        indOversFaced += facedBalls1;
        indRunsConceded += runs2;
        indOversBowled += facedBalls2;
      }

      if (team2 === 'AUS') {
        ausRunsScored += runs2;
        ausOversFaced += facedBalls2;
        ausRunsConceded += runs1;
        ausOversBowled += facedBalls1;
      } else {
        indRunsScored += runs2;
        indOversFaced += facedBalls2;
        indRunsConceded += runs1;
        indOversBowled += facedBalls1;
      }
    });

    const calculateRate = (runs: number, balls: number) => {
      const overs = balls / 6;
      return overs > 0 ? runs / overs : 0;
    };

    const ausRateScored = calculateRate(ausRunsScored, ausOversFaced);
    const ausRateConceded = calculateRate(ausRunsConceded, ausOversBowled);
    const indRateScored = calculateRate(indRunsScored, indOversFaced);
    const indRateConceded = calculateRate(indRunsConceded, indOversBowled);

    return {
      AUS: parseFloat((ausRateScored - ausRateConceded).toFixed(3)),
      IND: parseFloat((indRateScored - indRateConceded).toFixed(3))
    };
  };

  const nrr = computeNRR();

  if (!activeTournament) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center px-4 relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-amber-500/10 blur-[120px]" />
        <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-8 relative z-10">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent italic">
              START TOURNAMENT
            </h1>
            <p className="text-zinc-500 text-sm mt-1 uppercase tracking-widest">
              Manager Room: {user?.username} ({user?.team})
            </p>
          </div>

          <form onSubmit={handleCreate} className="space-y-6">
            <div>
              <label className="block text-zinc-400 text-xs uppercase tracking-wider mb-2 font-bold">
                Tournament Series Length
              </label>
              <select
                value={tourType}
                onChange={(e) => setTourType(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-lg px-4 py-3 text-zinc-200 outline-none text-sm"
              >
                <option value="best_of_5">Best of 5 Matches</option>
                <option value="best_of_10">Best of 10 Matches (Recommended)</option>
                <option value="best_of_20">Best of 20 Matches</option>
                <option value="custom">Custom Length</option>
              </select>
            </div>

            {tourType === 'custom' && (
              <div>
                <label className="block text-zinc-400 text-xs uppercase tracking-wider mb-2 font-bold">
                  Number of Matches
                </label>
                <input
                  type="number"
                  value={customMatches}
                  onChange={(e) => setCustomMatches(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-lg px-4 py-3 text-zinc-200 outline-none text-sm"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-zinc-400 text-xs uppercase tracking-wider mb-2 font-bold">
                  Match Overs
                </label>
                <select
                  value={matchOvers}
                  onChange={(e) => setMatchOvers(parseInt(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-lg px-3 py-3 text-zinc-200 outline-none text-sm"
                >
                  <option value="2">2 Overs (Quickie)</option>
                  <option value="5">5 Overs (T5 Standard)</option>
                  <option value="10">10 Overs</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-400 text-xs uppercase tracking-wider mb-2 font-bold">
                  Bouncer Limit / Over
                </label>
                <select
                  value={bouncerLimit}
                  onChange={(e) => setBouncerLimit(parseInt(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-lg px-3 py-3 text-zinc-200 outline-none text-sm"
                >
                  <option value="1">1 Bouncer (Standard)</option>
                  <option value="2">2 Bouncers</option>
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-4 bg-zinc-950 rounded-xl border border-zinc-800">
              <input
                id="freehit"
                type="checkbox"
                checked={freeHitEnabled}
                onChange={(e) => setFreeHitEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-800 text-amber-500 bg-zinc-900 focus:ring-amber-500"
              />
              <label htmlFor="freehit" className="text-sm font-bold text-zinc-300 select-none">
                Enable Free Hit after No Balls
              </label>
            </div>

            <div className="flex space-x-4 pt-4">
              <button
                type="button"
                onClick={logout}
                className="flex-1 border border-zinc-800 hover:bg-zinc-800/30 text-zinc-400 font-bold uppercase py-3.5 rounded-xl transition text-sm"
              >
                Log Out
              </button>
              <button
                type="submit"
                className="flex-[2] bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-zinc-950 font-extrabold uppercase py-3.5 rounded-xl shadow-lg transition text-sm"
              >
                Generate Fixtures
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Calculate lead status
  const total = activeTournament.totalMatches;
  const progressPercent = ((total - activeTournament.matchesRemaining) / total) * 100;
  
  let leadText = 'Series is currently drawn';
  let leadColor = 'text-zinc-400';
  if (activeTournament.winsAUS > activeTournament.winsIND) {
    leadText = `Australia leads by ${activeTournament.winsAUS - activeTournament.winsIND} win${activeTournament.winsAUS - activeTournament.winsIND > 1 ? 's' : ''}`;
    leadColor = 'text-yellow-400';
  } else if (activeTournament.winsIND > activeTournament.winsAUS) {
    leadText = `India leads by ${activeTournament.winsIND - activeTournament.winsAUS} win${activeTournament.winsIND - activeTournament.winsAUS > 1 ? 's' : ''}`;
    leadColor = 'text-blue-400';
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-12">
      {/* Broadcaster Bar Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-6 py-4 flex items-center justify-between sticky top-0 z-40 shadow-md">
        <div className="flex items-center space-x-3">
          <span className="text-2xl font-black italic bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent">
            CRIC-SYNCO
          </span>
          <span className="bg-zinc-800 text-zinc-400 text-[10px] uppercase font-extrabold px-2 py-0.5 rounded tracking-widest">
            Broadcast Live
          </span>
        </div>

        {/* Presence Board */}
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-zinc-400">AUS (🇦🇺) Manager:</span>
            <span className={presence.AUS === 'Online' ? 'text-green-400 font-bold' : 'text-red-500 font-semibold'}>
              {presence.AUS === 'Online' ? '🟢 Online' : '🔴 Offline'}
            </span>
          </div>
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-zinc-400">IND (🇮🇳) Manager:</span>
            <span className={presence.IND === 'Online' ? 'text-green-400 font-bold' : 'text-red-500 font-semibold'}>
              {presence.IND === 'Online' ? '🟢 Online' : '🔴 Offline'}
            </span>
          </div>

          <div className="h-6 w-px bg-zinc-800" />
          <button
            onClick={logout}
            className="text-xs font-bold text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:bg-zinc-800 px-3 py-1.5 rounded-lg transition"
          >
            Leave Arena
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: Series metrics and settings */}
        <div className="space-y-8">
          
          {/* Series Standings Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 text-[10px] uppercase tracking-wider font-extrabold text-zinc-500">
              Series Board
            </div>
            
            <h2 className="text-zinc-400 text-xs font-extrabold uppercase tracking-widest mb-4">
              Tournament Standings
            </h2>

            {/* Score comparison */}
            <div className="flex items-center justify-between mb-6">
              <div className="text-center">
                <span className="text-4xl">🇦🇺</span>
                <p className="text-xs font-bold text-zinc-400 mt-1">Australia</p>
                <p className="text-3xl font-black text-yellow-400 mt-2">{activeTournament.winsAUS}</p>
                <p className="text-[10px] text-zinc-500 mt-1 font-mono">NRR: {nrr.AUS >= 0 ? `+${nrr.AUS}` : nrr.AUS}</p>
              </div>
              
              <div className="text-zinc-700 text-lg font-black italic">VS</div>

              <div className="text-center">
                <span className="text-4xl">🇮🇳</span>
                <p className="text-xs font-bold text-zinc-400 mt-1">India</p>
                <p className="text-3xl font-black text-blue-400 mt-2">{activeTournament.winsIND}</p>
                <p className="text-[10px] text-zinc-500 mt-1 font-mono">NRR: {nrr.IND >= 0 ? `+${nrr.IND}` : nrr.IND}</p>
              </div>
            </div>

            {/* Leader description */}
            <div className={`p-3 bg-zinc-950 rounded-lg text-center font-bold text-xs border border-zinc-800/80 ${leadColor}`}>
              👑 {leadText}
            </div>

            {/* Progress bar */}
            <div className="mt-6">
              <div className="flex justify-between text-xs text-zinc-500 mb-1.5 font-bold">
                <span>{activeTournament.totalMatches - activeTournament.matchesRemaining} Played</span>
                <span>{activeTournament.matchesRemaining} Remaining</span>
              </div>
              <div className="w-full bg-zinc-950 h-2.5 rounded-full overflow-hidden border border-zinc-800">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Record statistics */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
            <h2 className="text-zinc-400 text-xs font-extrabold uppercase tracking-widest mb-4">
              Tournament Records
            </h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-zinc-950 rounded-xl border border-zinc-800/50">
                <div>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Highest Team Total</p>
                  <p className="text-sm font-black text-zinc-300">
                    {activeTournament.stats.highestTeamScore?.runs ? (
                      <>
                        {activeTournament.stats.highestTeamScore.team === 'AUS' ? 'AUS' : 'IND'}{' '}
                        {activeTournament.stats.highestTeamScore.runs}/{activeTournament.stats.highestTeamScore.overs} overs
                      </>
                    ) : 'N/A'}
                  </p>
                </div>
                {activeTournament.stats.highestTeamScore?.matchNo && (
                  <span className="text-[10px] bg-zinc-850 text-zinc-400 px-2 py-1 rounded">Match {activeTournament.stats.highestTeamScore.matchNo}</span>
                )}
              </div>

              <div className="flex justify-between items-center p-3 bg-zinc-950 rounded-xl border border-zinc-800/50">
                <div>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Highest Partnership</p>
                  <p className="text-sm font-black text-zinc-300">
                    {activeTournament.stats.highestPartnership?.runs ? (
                      <>
                        {activeTournament.stats.highestPartnership.runs} runs{' '}
                        <span className="text-[10px] text-zinc-500 font-normal">
                          ({activeTournament.stats.highestPartnership.batsmen.join(' & ')})
                        </span>
                      </>
                    ) : 'N/A'}
                  </p>
                </div>
                {activeTournament.stats.highestPartnership?.matchNo && (
                  <span className="text-[10px] bg-zinc-850 text-zinc-400 px-2 py-1 rounded">Match {activeTournament.stats.highestPartnership.matchNo}</span>
                )}
              </div>
            </div>
          </div>

          {/* Real-time Ticker Feed */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl flex flex-col h-[280px]">
            <h2 className="text-zinc-400 text-xs font-extrabold uppercase tracking-widest mb-3 flex justify-between items-center">
              <span>Live Broadcaster Feed</span>
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            </h2>
            <div className="flex-1 overflow-y-auto pr-2 space-y-3 scrollbar-thin text-xs">
              {notifications.length === 0 ? (
                <p className="text-zinc-600 italic text-center pt-8">No live alerts yet</p>
              ) : (
                notifications.map((notif) => {
                  let badgeColor = 'bg-zinc-800 text-zinc-400';
                  if (notif.type === 'wicket') badgeColor = 'bg-red-950 text-red-400 border border-red-900';
                  else if (notif.type === 'boundary') badgeColor = 'bg-emerald-950 text-emerald-400 border border-emerald-900';
                  else if (notif.type === 'milestone') badgeColor = 'bg-amber-950 text-amber-400 border border-amber-900';
                  else if (notif.type === 'match_won' || notif.type === 'tournament_won') badgeColor = 'bg-purple-950 text-purple-400 border border-purple-900 font-bold';

                  return (
                    <div key={notif._id} className="p-2.5 bg-zinc-950 rounded-lg border border-zinc-800/80 flex items-start space-x-2">
                      <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded shrink-0 ${badgeColor}`}>
                        {notif.type}
                      </span>
                      <p className="text-zinc-300 font-medium leading-relaxed">{notif.text}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

        {/* MIDDLE COLUMN: Match Schedule and Lobbies */}
        <div className="space-y-6">
          <h2 className="text-zinc-400 text-xs font-extrabold uppercase tracking-widest flex items-center justify-between">
            <span>Tournament Fixtures</span>
            <span className="text-[10px] bg-zinc-900 border border-zinc-850 px-2.5 py-1 rounded text-zinc-500 font-bold">
              {matches.length} Scheduled Matches
            </span>
          </h2>

          <div className="space-y-4 max-h-[700px] overflow-y-auto pr-2 scrollbar-thin">
            {matches.map((match) => {
              let statusText = 'Not Started';
              let borderClass = 'border-zinc-850';
              let badgeColor = 'bg-zinc-800 text-zinc-500';

              if (match.status === 'Live') {
                statusText = '📺 Live Match';
                borderClass = 'border-red-600/50 shadow-md shadow-red-950/20';
                badgeColor = 'bg-red-950 text-red-400 animate-pulse border border-red-900';
              } else if (match.status === 'Completed') {
                statusText = '✓ Completed';
                borderClass = 'border-zinc-850 opacity-80';
                badgeColor = 'bg-zinc-850 text-zinc-400';
              } else if (match.status === 'Cancelled') {
                statusText = '✕ Cancelled';
                borderClass = 'border-zinc-900 opacity-60';
                badgeColor = 'bg-zinc-900 text-zinc-600 line-through';
              }

              return (
                <div
                  key={match._id || match.id}
                  className={`bg-zinc-900 border ${borderClass} rounded-2xl p-5 hover:border-zinc-700 transition flex flex-col justify-between`}
                >
                  <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-4">
                    <span className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider">
                      Match {match.matchNumber} of {total}
                    </span>
                    <span className={`text-[9px] uppercase font-extrabold px-2 py-0.5 rounded ${badgeColor}`}>
                      {statusText}
                    </span>
                  </div>

                  {/* Team vs Team description */}
                  <div className="flex items-center justify-between px-2 mb-4">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">🇦🇺</span>
                      <span className="text-sm font-extrabold text-zinc-300">AUS</span>
                      {match.status === 'Completed' && match.innings1.battingTeam === 'AUS' && (
                        <span className="text-xs font-bold text-zinc-500">({match.innings1.runs}/{match.innings1.wickets})</span>
                      )}
                      {match.status === 'Completed' && match.innings2.battingTeam === 'AUS' && (
                        <span className="text-xs font-bold text-zinc-500">({match.innings2.runs}/{match.innings2.wickets})</span>
                      )}
                    </div>
                    
                    <span className="text-zinc-600 text-xs italic font-semibold">vs</span>

                    <div className="flex items-center space-x-3">
                      {match.status === 'Completed' && match.innings2.battingTeam === 'IND' && (
                        <span className="text-xs font-bold text-zinc-500">({match.innings2.runs}/{match.innings2.wickets})</span>
                      )}
                      {match.status === 'Completed' && match.innings1.battingTeam === 'IND' && (
                        <span className="text-xs font-bold text-zinc-500">({match.innings1.runs}/{match.innings1.wickets})</span>
                      )}
                      <span className="text-sm font-extrabold text-zinc-300">IND</span>
                      <span className="text-2xl">🇮🇳</span>
                    </div>
                  </div>

                  {/* Summary / Controls */}
                  {match.status === 'Completed' ? (
                    <div className="flex items-center justify-between pt-2 border-t border-zinc-800/30">
                      <p className="text-xs font-bold text-emerald-400 italic">
                        🏆 {match.winner === 'AUS' ? 'Australia' : (match.winner === 'IND' ? 'India' : 'Tie')} won {match.winMargin}
                      </p>
                      <button
                        onClick={() => fetchMatchDetails(match._id || match.id || '')}
                        className="text-[10px] bg-zinc-850 hover:bg-zinc-850 border border-zinc-850 hover:border-zinc-700 font-extrabold uppercase px-3 py-1.5 rounded-lg transition"
                      >
                        Match Analytics
                      </button>
                    </div>
                  ) : match.status === 'Cancelled' ? (
                    <div className="flex items-center justify-between pt-2 border-t border-zinc-800/30">
                      <p className="text-xs font-bold text-zinc-500 italic">
                        Match cancelled by managers
                      </p>
                      <button
                        onClick={() => restartMatch(match._id || match.id || '')}
                        className="text-[10px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-extrabold uppercase px-3 py-1.5 rounded-lg border border-amber-500/20 transition"
                      >
                        Reset & Play
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between pt-2 border-t border-zinc-800/30">
                      <p className="text-xs text-zinc-500">
                        {match.status === 'Live' ? 'In progress in real-time' : 
                         match.matchNumber === activeTournament?.currentMatchNo ? 'Next Active Match' : 'Upcoming Fixture'}
                      </p>
                      {match.status === 'Live' || match.matchNumber === activeTournament?.currentMatchNo ? (
                        <button
                          onClick={() => fetchMatchDetails(match._id || match.id || '')}
                          className="text-[10px] bg-amber-500 hover:bg-amber-600 text-zinc-950 font-extrabold uppercase px-4 py-2 rounded-lg transition"
                        >
                          {match.status === 'Live' ? 'Enter Live Center' : 'Open Match Lobby'}
                        </button>
                      ) : (
                        <button
                          disabled
                          className="text-[10px] bg-zinc-800/60 text-zinc-600 font-extrabold uppercase px-4 py-2 rounded-lg border border-zinc-850 cursor-not-allowed"
                        >
                          Lobby Locked
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: Statistics Leaderboard */}
        <div className="space-y-6">
          <h2 className="text-zinc-400 text-xs font-extrabold uppercase tracking-widest">
            Tournament Stats Leaders
          </h2>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl min-h-[500px] flex flex-col">
            {/* Tabs selector */}
            <div className="flex border-b border-zinc-800 mb-6 text-[10px] font-extrabold uppercase tracking-wider">
              <button
                onClick={() => setActiveTab('orange')}
                className={`pb-3 pr-2.5 transition ${activeTab === 'orange' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Orange Cap
              </button>
              <button
                onClick={() => setActiveTab('purple')}
                className={`pb-3 px-2.5 transition ${activeTab === 'purple' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Purple Cap
              </button>
              <button
                onClick={() => setActiveTab('mvp')}
                className={`pb-3 px-2.5 transition ${activeTab === 'mvp' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                MVP
              </button>
              <button
                onClick={() => setActiveTab('sixes')}
                className={`pb-3 px-2.5 transition ${activeTab === 'sixes' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Sixes
              </button>
            </div>

            {loadingAnalytics ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="h-8 w-8 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
              </div>
            ) : !analytics ? (
              <div className="flex-1 flex items-center justify-center text-zinc-600 text-xs italic text-center">
                Stats populate when the first match is completed.
              </div>
            ) : (
              <div className="flex-1 space-y-4">
                
                {/* ORANGE CAP TAB */}
                {activeTab === 'orange' && (
                  <div className="space-y-3">
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Most Runs Scored</p>
                    {analytics.orangeCap?.length === 0 ? (
                      <p className="text-zinc-600 italic text-xs">No runs scored yet</p>
                    ) : (
                      analytics.orangeCap.map((player: any, idx: number) => (
                        <div key={player.id} className="flex items-center justify-between p-3 bg-zinc-950 rounded-xl border border-zinc-800/80">
                          <div className="flex items-center space-x-3">
                            <span className="text-xs font-extrabold text-zinc-500 w-4">#{idx + 1}</span>
                            <span className="text-xl">{player.team === 'AUS' ? '🇦🇺' : '🇮🇳'}</span>
                            <div>
                              <p className="text-xs font-bold text-zinc-200">{player.name}</p>
                              <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-semibold">{player.role}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-amber-400">{player.runs} Runs</p>
                            <p className="text-[9px] text-zinc-500 font-mono">SR: {((player.runs / (player.ballsFaced || 1)) * 100).toFixed(1)}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* PURPLE CAP TAB */}
                {activeTab === 'purple' && (
                  <div className="space-y-3">
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Most Wickets Taken</p>
                    {analytics.purpleCap?.length === 0 ? (
                      <p className="text-zinc-600 italic text-xs">No wickets taken yet</p>
                    ) : (
                      analytics.purpleCap.map((player: any, idx: number) => (
                        <div key={player.id} className="flex items-center justify-between p-3 bg-zinc-950 rounded-xl border border-zinc-800/80">
                          <div className="flex items-center space-x-3">
                            <span className="text-xs font-extrabold text-zinc-500 w-4">#{idx + 1}</span>
                            <span className="text-xl">{player.team === 'AUS' ? '🇦🇺' : '🇮🇳'}</span>
                            <div>
                              <p className="text-xs font-bold text-zinc-200">{player.name}</p>
                              <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-semibold">{player.role}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-blue-400">{player.wickets} Wkts</p>
                            <p className="text-[9px] text-zinc-500 font-mono">Eco: {((player.runsConceded / (player.ballsBowled || 1)) * 6).toFixed(2)}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* MVP TAB */}
                {activeTab === 'mvp' && (
                  <div className="space-y-3">
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Most Valuable Player Points</p>
                    {analytics.mvp?.length === 0 ? (
                      <p className="text-zinc-600 italic text-xs">No MVP points logged yet</p>
                    ) : (
                      analytics.mvp.map((player: any, idx: number) => (
                        <div key={player.id} className="flex items-center justify-between p-3 bg-zinc-950 rounded-xl border border-zinc-800/80">
                          <div className="flex items-center space-x-3">
                            <span className="text-xs font-extrabold text-zinc-500 w-4">#{idx + 1}</span>
                            <span className="text-xl">{player.team === 'AUS' ? '🇦🇺' : '🇮🇳'}</span>
                            <div>
                              <p className="text-xs font-bold text-zinc-200">{player.name}</p>
                              <p className="text-[9px] text-zinc-500 font-semibold">{player.runs} Runs / {player.wickets} Wkts</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-purple-400">{player.points} Pts</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* SIXES TAB */}
                {activeTab === 'sixes' && (
                  <div className="space-y-3">
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Most Sixes</p>
                    {analytics.mostSixes?.length === 0 ? (
                      <p className="text-zinc-600 italic text-xs font-semibold">No sixes hit yet</p>
                    ) : (
                      analytics.mostSixes.map((player: any, idx: number) => (
                        <div key={player.id} className="flex items-center justify-between p-3 bg-zinc-950 rounded-xl border border-zinc-800/80">
                          <div className="flex items-center space-x-3">
                            <span className="text-xs font-extrabold text-zinc-500 w-4">#{idx + 1}</span>
                            <span className="text-xl">{player.team === 'AUS' ? '🇦🇺' : '🇮🇳'}</span>
                            <div>
                              <p className="text-xs font-bold text-zinc-200">{player.name}</p>
                              <p className="text-[9px] text-zinc-500 font-semibold">Fours: {player.fours}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-amber-500">{player.sixes} Sixes</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
