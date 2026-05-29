import { useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import XISelection from './components/XISelection';
import TossLobby from './components/TossLobby';
import MatchCenter from './components/MatchCenter';
import MatchSummary from './components/MatchSummary';
import Celebrate from './components/Celebrate';

function App() {
  const token = useGameStore(state => state.token);
  const user = useGameStore(state => state.user);
  const activeTournament = useGameStore(state => state.activeTournament);
  const activeMatch = useGameStore(state => state.activeMatch);
  
  const loadUserFromStorage = useGameStore(state => state.loadUserFromStorage);
  const initSocket = useGameStore(state => state.initSocket);

  // Check login on startup
  useEffect(() => {
    loadUserFromStorage();
  }, [loadUserFromStorage]);

  const tournamentId = activeTournament?._id || activeTournament?.id;

  // Sync socket connection whenever token or tournament ID changes
  useEffect(() => {
    if (token) {
      initSocket();
    }
  }, [token, tournamentId, initSocket]);

  // 1. Auth check
  if (!token || !user) {
    return <Auth />;
  }

  // 2. Tournament checks
  if (!activeTournament) {
    return <Dashboard />;
  }

  // 3. Match Details checks
  if (!activeMatch) {
    return (
      <>
        <Dashboard />
        <Celebrate />
      </>
    );
  }

  // Match state routing
  let activeScreen = null;
  if (activeMatch.status === 'Not Started') {
    if (activeMatch.confirmed_AUS && activeMatch.confirmed_IND) {
      activeScreen = <TossLobby />;
    } else {
      activeScreen = <XISelection />;
    }
  } else if (activeMatch.status === 'Live') {
    activeScreen = <MatchCenter />;
  } else if (activeMatch.status === 'Completed') {
    activeScreen = <MatchSummary />;
  } else {
    // Failsafe / Cancelled states
    activeScreen = <Dashboard />;
  }

  return (
    <>
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        {activeScreen}
      </div>
      
      {/* Global Overlay Broadcast animations */}
      <Celebrate />
    </>
  );
}

export default App;
