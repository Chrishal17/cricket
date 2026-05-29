import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

export default function XISelection() {
  const activeMatch = useGameStore(state => state.activeMatch);
  const user = useGameStore(state => state.user);
  const confirmPlayingXI = useGameStore(state => state.confirmPlayingXI);
  const closeMatch = useGameStore(state => state.closeMatch);

  const [playingXI, setPlayingXI] = useState<any[]>([]);
  const [bench, setBench] = useState<any[]>([]);
  const [captainId, setCaptainId] = useState<string>('');
  const [viceCaptainId, setViceCaptainId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const team = user?.team || 'AUS';
  const matchId = activeMatch?._id || activeMatch?.id || '';

  // Fetch squad on load
  useEffect(() => {
    const fetchSquad = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/players');
        if (res.ok) {
          const allPlayers = await res.json();
          // Filter by manager's team
          const teamSquad = allPlayers.filter((p: any) => p.team === team);

          // Check if there is already a saved playing XI in the activeMatch
          const savedIds = team === 'AUS' ? activeMatch?.playingXI_AUS : activeMatch?.playingXI_IND;
          
          let defaultXI = [];
          let defaultBench = [];
          
          if (savedIds && savedIds.length === 11) {
            // Map the saved IDs back to player objects, keeping the saved order!
            defaultXI = savedIds.map(id => teamSquad.find((p: any) => (p._id || p.id) === id)).filter(Boolean);
            
            // Any player in teamSquad that is not in defaultXI goes to bench
            defaultBench = teamSquad.filter((p: any) => !savedIds.includes(p._id || p.id));
            
            // Restore captain and vice captain ids
            const savedCaptainId = team === 'AUS' ? activeMatch?.captain_AUS : activeMatch?.captain_IND;
            const savedViceCaptainId = team === 'AUS' ? activeMatch?.viceCaptain_AUS : activeMatch?.viceCaptain_IND;
            if (savedCaptainId) setCaptainId(savedCaptainId);
            if (savedViceCaptainId) setViceCaptainId(savedViceCaptainId);
          } else {
            // Populate default Playing XI from Recommended squad members
            const recommended = teamSquad.filter((p: any) => p.isRecommendedXI || p.recommendedXI === 'YES');
            if (recommended.length === 11) {
              defaultXI = recommended;
              defaultBench = teamSquad.filter((p: any) => !recommended.some((r: any) => r.name === p.name));
            } else {
              const shuffled = [...teamSquad].sort(() => 0.5 - Math.random());
              defaultXI = shuffled.slice(0, 11);
              defaultBench = shuffled.slice(11);
            }
            
            // Set Pat Cummins or Rohit Sharma as default captains if they exist
            const cap = defaultXI.find((p: any) => p.name.includes('Cummins') || p.name.includes('Rohit'));
            const vc = defaultXI.find((p: any) => !p.name.includes('Cummins') && !p.name.includes('Rohit'));
            
            setCaptainId(cap ? (cap._id || cap.id) : (defaultXI[0]?._id || defaultXI[0]?.id || ''));
            setViceCaptainId(vc ? (vc._id || vc.id) : (defaultXI[1]?._id || defaultXI[1]?.id || ''));
          }

          setPlayingXI(defaultXI);
          setBench(defaultBench);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchSquad();
  }, [team, matchId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 bg-zinc-900 border border-zinc-800 rounded-2xl">
        <div className="h-8 w-8 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Check if current user's team is already confirmed
  const isConfirmed = team === 'AUS' ? activeMatch?.confirmed_AUS : activeMatch?.confirmed_IND;
  const opponentConfirmed = team === 'AUS' ? activeMatch?.confirmed_IND : activeMatch?.confirmed_AUS;

  const handleRemove = (player: any) => {
    if (isConfirmed) return;
    setPlayingXI(prev => prev.filter(p => p._id !== player._id));
    setBench(prev => [...prev, player]);
    
    // reset captain/vc if they were removed
    const id = player._id || player.id;
    if (captainId === id) setCaptainId('');
    if (viceCaptainId === id) setViceCaptainId('');
  };

  const handleAdd = (player: any) => {
    if (isConfirmed) return;
    if (playingXI.length >= 11) {
      alert('Selected Playing XI is already full (11 players). Remove a player first.');
      return;
    }
    setBench(prev => prev.filter(p => p._id !== player._id));
    setPlayingXI(prev => [...prev, player]);

    // set default captain/vc if empty
    const id = player._id || player.id;
    if (!captainId) setCaptainId(id);
    else if (!viceCaptainId) setViceCaptainId(id);
  };

  const moveUp = (index: number) => {
    if (isConfirmed || index === 0) return;
    const newXI = [...playingXI];
    const temp = newXI[index];
    newXI[index] = newXI[index - 1];
    newXI[index - 1] = temp;
    setPlayingXI(newXI);
  };

  const moveDown = (index: number) => {
    if (isConfirmed || index === playingXI.length - 1) return;
    const newXI = [...playingXI];
    const temp = newXI[index];
    newXI[index] = newXI[index + 1];
    newXI[index + 1] = temp;
    setPlayingXI(newXI);
  };

  const handleConfirm = () => {
    if (playingXI.length !== 11) {
      alert('You must select exactly 11 players.');
      return;
    }
    if (!captainId) {
      alert('Please designate a Captain.');
      return;
    }
    if (!viceCaptainId) {
      alert('Please designate a Vice Captain.');
      return;
    }
    if (captainId === viceCaptainId) {
      alert('Captain and Vice Captain must be different players.');
      return;
    }

    const ids = playingXI.map(p => p._id || p.id);
    confirmPlayingXI(activeMatch?._id || activeMatch?.id || '', {
      playingXI: ids,
      captain: captainId,
      viceCaptain: viceCaptainId,
      battingOrder: ids, // default batting order matches XI order
      bowlingOrder: ids.filter(id => {
        const p = playingXI.find(x => (x._id || x.id) === id);
        return p?.role === 'Bowler' || p?.role === 'All-Rounder';
      })
    });
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={closeMatch}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-1.5"
          >
            <span>←</span> <span>Dashboard</span>
          </button>
          <div>
            <h2 className="text-xl font-extrabold text-zinc-100 flex items-center space-x-2">
              <span>{team === 'AUS' ? '🇦🇺 Australia Manager' : '🇮🇳 India Manager'}</span>
              <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded font-mono">Team Selection</span>
            </h2>
            <p className="text-xs text-zinc-500 mt-1">Configure your playing XI, set the batting order, and assign captains.</p>
          </div>
        </div>

        {/* Confirmation status tags */}
        <div className="flex items-center space-x-3 text-xs">
          <div className={`px-3 py-1.5 rounded-lg font-bold border ${isConfirmed ? 'bg-green-950/20 border-green-500 text-green-400' : 'bg-zinc-950 border-zinc-800 text-zinc-500'}`}>
            {isConfirmed ? '✓ Confirmed' : '✕ Awaiting Your XI'}
          </div>
          <div className={`px-3 py-1.5 rounded-lg font-bold border ${opponentConfirmed ? 'bg-green-950/20 border-green-500 text-green-400' : 'bg-zinc-950 border-zinc-800 text-zinc-500'}`}>
            {opponentConfirmed ? '✓ Opponent Ready' : '✕ Opponent Team Setup'}
          </div>
        </div>
      </div>

      {isConfirmed ? (
        <div className="text-center p-8 bg-zinc-950 rounded-2xl border border-zinc-850">
          <div className="h-10 w-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-bold text-zinc-300">Playing XI Confirmed Successfully!</p>
          <p className="text-xs text-zinc-500 mt-1">Waiting for the opponent manager to confirm their Playing XI to proceed to the Toss.</p>
          
          <div className="mt-8 text-left max-w-md mx-auto space-y-2 border border-zinc-800 p-4 bg-zinc-900 rounded-xl">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-800 pb-1.5 mb-2">Confirmed Linup</h3>
            {playingXI.map((p, idx) => (
              <div key={p._id || p.id} className="text-xs flex justify-between items-center text-zinc-300">
                <span>{idx + 1}. {p.name} {p._id === captainId ? '(C)' : p._id === viceCaptainId ? '(VC)' : ''}</span>
                <span className="text-[10px] text-zinc-500 uppercase">{p.role}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Selected XI (Batting Order) */}
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-zinc-950 px-4 py-2.5 rounded-xl border border-zinc-850">
              <span className="text-xs font-extrabold uppercase tracking-widest text-zinc-400">Selected Playing XI (Batting Order)</span>
              <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${playingXI.length === 11 ? 'bg-green-950 text-green-400' : 'bg-red-950 text-red-400'}`}>
                {playingXI.length} / 11 selected
              </span>
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin">
              {playingXI.length === 0 ? (
                <p className="text-zinc-600 text-xs italic text-center p-8 bg-zinc-950/20 border border-dashed border-zinc-850 rounded-xl">No players selected. Click add on the bench list.</p>
              ) : (
                playingXI.map((player, idx) => {
                  const id = player._id || player.id;
                  const isCap = captainId === id;
                  const isVc = viceCaptainId === id;

                  return (
                    <div key={id} className="flex items-center justify-between p-3 bg-zinc-950 rounded-xl border border-zinc-800 hover:border-zinc-700 transition">
                      <div className="flex items-center space-x-3">
                        {/* Batting order adjuster */}
                        <div className="flex flex-col space-y-1">
                          <button
                            onClick={() => moveUp(idx)}
                            disabled={idx === 0}
                            className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30 disabled:hover:text-zinc-600"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => moveDown(idx)}
                            disabled={idx === playingXI.length - 1}
                            className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30 disabled:hover:text-zinc-600"
                          >
                            ▼
                          </button>
                        </div>
                        
                        <div>
                          <p className="text-xs font-bold text-zinc-200 flex items-center space-x-1.5">
                            <span>{idx + 1}. {player.name}</span>
                            {isCap && <span className="bg-amber-500 text-zinc-950 text-[9px] font-extrabold px-1 rounded">C</span>}
                            {isVc && <span className="bg-zinc-750 text-zinc-300 text-[9px] font-extrabold px-1 rounded">VC</span>}
                          </p>
                          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5">{player.role} • Ovr: {player.overallRating}</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {/* Captain designation */}
                        <button
                          onClick={() => setCaptainId(id)}
                          className={`text-[9px] uppercase font-bold px-2 py-1 rounded transition ${isCap ? 'bg-amber-500 text-zinc-950' : 'bg-zinc-850 text-zinc-400 hover:bg-zinc-800'}`}
                        >
                          C
                        </button>
                        {/* VC designation */}
                        <button
                          onClick={() => setViceCaptainId(id)}
                          className={`text-[9px] uppercase font-bold px-2 py-1 rounded transition ${isVc ? 'bg-zinc-700 text-zinc-200 font-bold' : 'bg-zinc-850 text-zinc-400 hover:bg-zinc-800'}`}
                        >
                          VC
                        </button>
                        {/* Remove */}
                        <button
                          onClick={() => handleRemove(player)}
                          className="text-red-500 hover:text-red-400 font-bold text-lg px-2"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Bench Squad */}
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-zinc-950 px-4 py-2.5 rounded-xl border border-zinc-850">
              <span className="text-xs font-extrabold uppercase tracking-widest text-zinc-400">Available Squad / Bench</span>
              <span className="text-xs font-bold text-zinc-500 font-mono">
                {bench.length} benched
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin">
              {bench.map((player) => (
                <div
                  key={player._id || player.id}
                  onClick={() => handleAdd(player)}
                  className="p-3 bg-zinc-950 border border-zinc-850 hover:border-amber-500/50 rounded-xl cursor-pointer transition flex justify-between items-center group"
                >
                  <div>
                    <p className="text-xs font-bold text-zinc-200 group-hover:text-amber-400 transition">{player.name}</p>
                    <p className="text-[9px] text-zinc-500 uppercase tracking-widest mt-0.5">{player.role} • Rating: {player.overallRating}</p>
                    {/* Attributes summary */}
                    <div className="flex space-x-1.5 mt-1 text-[8px] text-zinc-600 font-semibold font-mono">
                      <span>Bat: {player.battingRating}</span>
                      <span>Bowl: {player.bowlingRating}</span>
                      <span>Fit: {player.fitness}</span>
                    </div>
                  </div>
                  <span className="text-amber-500 font-bold text-lg opacity-40 group-hover:opacity-100 transition">+</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {!isConfirmed && (
        <div className="border-t border-zinc-800 pt-6 mt-8 flex items-center justify-between">
          <p className="text-xs text-zinc-500">Make sure you have exactly 11 players with 1 Captain and 1 Vice Captain assigned.</p>
          <button
            onClick={handleConfirm}
            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-zinc-950 font-black uppercase tracking-wider text-sm px-8 py-3.5 rounded-xl shadow-lg hover:shadow-amber-500/10 transition"
          >
            Confirm playing xi
          </button>
        </div>
      )}
    </div>
  );
}
