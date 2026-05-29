import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [team, setTeam] = useState<'AUS' | 'IND'>('AUS');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loginAction = useGameStore(state => state.login);
  const registerAction = useGameStore(state => state.register);
  const apiUrl = useGameStore(state => state.apiUrl);
  const setApiUrl = useGameStore(state => state.setApiUrl);
  const [showSettings, setShowSettings] = useState(false);
  const [localApiUrl, setLocalApiUrl] = useState(apiUrl);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        await loginAction(username, password);
      } else {
        await registerAction(username, password, team);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-radial from-slate-900 via-zinc-950 to-black px-4 relative overflow-hidden">
      {/* Decorative ambient glow circles */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-amber-500/10 blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-md bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl p-8 relative z-10">
        {/* Broadcaster Style Logo Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold tracking-wider bg-gradient-to-r from-amber-400 via-amber-200 to-blue-400 bg-clip-text text-transparent italic drop-shadow-md">
            CRIC-SYNCO
          </h1>
          <p className="text-zinc-500 text-sm mt-1 uppercase tracking-widest font-semibold">
            Real-Time Multiplayer Arena
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-zinc-800 mb-6">
          <button
            onClick={() => { setIsLogin(true); setError(''); }}
            className={`flex-1 py-3 text-center font-bold transition ${isLogin ? 'text-amber-400 border-b-2 border-amber-400' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            Login Manager
          </button>
          <button
            onClick={() => { setIsLogin(false); setError(''); }}
            className={`flex-1 py-3 text-center font-bold transition ${!isLogin ? 'text-amber-400 border-b-2 border-amber-400' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            New Franchise
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-950/50 border border-red-800 rounded-lg text-red-400 text-xs font-semibold">
            ❌ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-zinc-400 text-xs uppercase tracking-wider mb-2 font-bold">
              Manager Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-lg px-4 py-3 text-zinc-200 outline-none text-sm transition"
              placeholder="e.g. Cummins_Fan_88"
            />
          </div>

          <div>
            <label className="block text-zinc-400 text-xs uppercase tracking-wider mb-2 font-bold">
              Access Code (Password)
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-lg px-4 py-3 text-zinc-200 outline-none text-sm transition"
              placeholder="••••••••"
            />
          </div>

          {/* Franchise Selection (Only on register) */}
          {!isLogin && (
            <div>
              <label className="block text-zinc-400 text-xs uppercase tracking-wider mb-3 font-bold">
                Acquire Franchise
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setTeam('AUS')}
                  className={`flex flex-col items-center justify-center p-4 border rounded-xl transition ${team === 'AUS' ? 'bg-amber-950/20 border-amber-500 text-amber-300' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
                >
                  <span className="text-3xl mb-1">🇦🇺</span>
                  <span className="text-xs font-bold uppercase tracking-wider">Australia</span>
                  <span className="text-[10px] text-zinc-500 mt-1">Yellow Jackets</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTeam('IND')}
                  className={`flex flex-col items-center justify-center p-4 border rounded-xl transition ${team === 'IND' ? 'bg-blue-950/20 border-blue-500 text-blue-300' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
                >
                  <span className="text-3xl mb-1">🇮🇳</span>
                  <span className="text-xs font-bold uppercase tracking-wider">India</span>
                  <span className="text-[10px] text-zinc-500 mt-1">Men in Blue</span>
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-zinc-950 font-extrabold uppercase tracking-wider text-sm py-3.5 rounded-xl shadow-lg shadow-amber-500/10 active:scale-[0.98] transition disabled:opacity-50 disabled:pointer-events-none mt-2"
          >
            {loading ? 'Entering Arena...' : isLogin ? 'Launch Dashboard' : 'Confirm Franchise'}
          </button>
        </form>

        <div className="mt-8 text-center text-zinc-600 text-xs">
          For two players. One must be Australia manager, one India.
        </div>

        {/* Server Settings Expandable */}
        <div className="mt-6 border-t border-zinc-800/50 pt-4">
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="text-[11px] text-zinc-500 hover:text-zinc-300 font-bold uppercase tracking-wider flex items-center justify-center mx-auto space-x-1"
          >
            <span>⚙️</span> <span>{showSettings ? 'Hide Server Configuration' : 'Configure Server Connection'}</span>
          </button>

          {showSettings && (
            <div className="mt-4 p-4 bg-zinc-950/80 border border-zinc-800 rounded-xl space-y-3">
              <div>
                <label className="block text-zinc-500 text-[10px] uppercase tracking-wider mb-1.5 font-bold">
                  Backend Server URL
                </label>
                <input
                  type="text"
                  value={localApiUrl}
                  onChange={(e) => {
                    setLocalApiUrl(e.target.value);
                    setApiUrl(e.target.value);
                  }}
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500 rounded-lg px-3 py-2 text-zinc-300 outline-none text-xs transition"
                  placeholder="http://localhost:5000"
                />
              </div>
              <p className="text-[10px] text-zinc-500 leading-relaxed text-left">
                💡 <strong>Playing from different locations?</strong> Run a tunnel tool like <code>ngrok http 5000</code> on your backend machine and enter the generated public address here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
