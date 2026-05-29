import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

const API_URL = 'http://localhost:5000';

interface User {
  id: string;
  username: string;
  team: 'AUS' | 'IND';
}

interface Tournament {
  _id: string;
  id?: string;
  code?: string;
  creatorId?: string;
  creatorTeam?: string;
  joinedUserId?: string;
  joinedTeam?: string;
  type: string;
  totalMatches: number;
  matchesRemaining: number;
  currentMatchNo: number;
  winsAUS: number;
  winsIND: number;
  status: string;
  settings: {
    matchOvers: number;
    squadSize: number;
    bouncerLimit: number;
    powerplayOvers: number;
    freeHitEnabled: boolean;
  };
  stats: {
    highestTeamScore: { team: string; runs: number; overs: number; matchNo?: number };
    highestPartnership: { team: string; batsmen: string[]; runs: number; matchNo?: number };
    highestChase: { team: string; runs: number; matchNo?: number };
  };
}

interface Match {
  _id: string;
  id?: string;
  tournamentId: string;
  matchNumber: number;
  status: 'Not Started' | 'Live' | 'Completed' | 'Cancelled';
  
  playingXI_AUS: string[];
  playingXI_IND: string[];
  confirmed_AUS: boolean;
  confirmed_IND: boolean;
  captain_AUS: string;
  captain_IND: string;
  viceCaptain_AUS: string;
  viceCaptain_IND: string;
  battingOrder_AUS: string[];
  battingOrder_IND: string[];
  bowlingOrder_AUS: string[];
  bowlingOrder_IND: string[];

  tossCaller?: 'AUS' | 'IND';
  tossChoice?: 'Heads' | 'Tails';
  tossWinner?: 'AUS' | 'IND';
  tossDecision?: 'Bat' | 'Bowl';

  currentInningsNo: number;
  activeBatsman1?: string;
  activeBatsman2?: string;
  activeBowler?: string;
  isFreeHitActive: boolean;

  innings1: Innings;
  innings2: Innings;

  winner?: 'AUS' | 'IND' | 'tie' | null;
  winMargin?: string;
  playerOfMatch?: string;
  playersAUS_cache?: any[];
  playersIND_cache?: any[];
}

interface Innings {
  battingTeam: 'AUS' | 'IND' | '';
  bowlingTeam: 'AUS' | 'IND' | '';
  runs: number;
  wickets: number;
  overs: number;
  ballsBowled: number;
  target?: number;
  batsmenStats: Array<{
    playerId: string;
    name: string;
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    dismissal: string;
    active: boolean;
  }>;
  bowlerStats: Array<{
    playerId: string;
    name: string;
    overs: number;
    ballsBowled: number;
    runs: number;
    wickets: number;
    bouncersThisOver: number;
  }>;
  extras: {
    wide: number;
    noball: number;
    legbye: number;
    bye: number;
  };
  partnerships: Array<{
    batsman1Id: string;
    batsman2Id: string;
    runs: number;
    balls: number;
    active: boolean;
  }>;
  ballTimeline: Array<{
    over: number;
    ball: number;
    bowlerId: string;
    strikerId: string;
    nonStrikerId: string;
    runs: number;
    extraType: 'none' | 'wide' | 'noball' | 'legbye' | 'bye';
    extraRuns: number;
    isBouncer: boolean;
    isFreeHit: boolean;
    dismissal: string | null;
    dismissedPlayerId: string | null;
    wagonWheelSector: number | null;
  }>;
}

interface Notification {
  _id: string;
  text: string;
  type: string;
  createdAt: string;
}

interface GameStore {
  token: string | null;
  user: User | null;
  socket: Socket | null;
  activeTournament: Tournament | null;
  matches: Match[];
  activeMatch: Match | null;
  presence: { AUS: 'Online' | 'Offline' | 'Reconnecting'; IND: 'Online' | 'Offline' | 'Reconnecting' };
  notifications: Notification[];
  animationEvent: { type: 'four' | 'six' | 'wicket' | 'fifty' | 'hundred' | 'winning_shot'; player?: string; winner?: string; margin?: string } | null;
  
  // Coin spin UI state
  tossSpinning: boolean;
  tossResultData: { choice?: string; result?: string; tossWinner?: string } | null;

  // Actions
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, team: 'AUS' | 'IND') => Promise<void>;
  logout: () => void;
  loadUserFromStorage: () => Promise<void>;
  
  fetchActiveTournament: () => Promise<void>;
  createTournament: (type: string, settings: any, totalMatches?: number) => Promise<void>;
  joinTournament: (code: string) => Promise<void>;
  fetchMatches: () => Promise<void>;
  fetchMatchDetails: (matchId: string) => Promise<void>;
  restartMatch: (matchId: string) => Promise<void>;
  
  initSocket: () => void;
  disconnectSocket: () => void;
  
  // Real-time Action Triggers via Sockets
  confirmPlayingXI: (matchId: string, data: any) => void;
  startToss: (matchId: string, choice: 'Heads' | 'Tails') => void;
  submitTossDecision: (matchId: string, decision: 'Bat' | 'Bowl') => void;
  startInnings: (matchId: string, batsman1Id: string, batsman2Id: string, bowlerId: string) => void;
  selectBowler: (matchId: string, bowlerId: string) => void;
  submitBall: (matchId: string, ballData: any) => void;
  cancelMatch: (matchId: string) => void;
  clearAnimationEvent: () => void;
  closeMatch: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  token: localStorage.getItem('token'),
  user: null,
  socket: null,
  activeTournament: null,
  matches: [],
  activeMatch: null,
  presence: { AUS: 'Offline', IND: 'Offline' },
  notifications: [],
  animationEvent: null,
  tossSpinning: false,
  tossResultData: null,

  login: async (username, password) => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    localStorage.setItem('token', data.token);
    set({ token: data.token, user: data.user });
    get().initSocket();
  },

  register: async (username, password, team) => {
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, team })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    localStorage.setItem('token', data.token);
    set({ token: data.token, user: data.user });
    get().initSocket();
  },

  logout: () => {
    localStorage.removeItem('token');
    get().disconnectSocket();
    set({ token: null, user: null, activeTournament: null, activeMatch: null, matches: [], notifications: [] });
  },

  loadUserFromStorage: async () => {
    const token = get().token;
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.error) {
        get().logout();
      } else {
        set({ user: data });
        get().initSocket();
        await get().fetchActiveTournament();
      }
    } catch {
      set({ presence: { AUS: 'Offline', IND: 'Offline' } });
    }
  },

  fetchActiveTournament: async () => {
    const token = get().token;
    if (!token) return;
    const res = await fetch(`${API_URL}/api/tournament/active`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      set({ activeTournament: data });
      if (data) {
        get().initSocket();
        await get().fetchMatches();
        // Load notification feed
        const notifRes = await fetch(`${API_URL}/api/tournament/${data._id || data.id}/notifications`);
        if (notifRes.ok) {
          set({ notifications: await notifRes.json() });
        }
      }
    }
  },

  createTournament: async (type, settings, totalMatches) => {
    const token = get().token;
    const res = await fetch(`${API_URL}/api/tournament/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ type, settings, totalMatches })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    set({ activeTournament: data, activeMatch: null });
    get().initSocket();
    await get().fetchMatches();
  },

  joinTournament: async (code) => {
    const token = get().token;
    const res = await fetch(`${API_URL}/api/tournament/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ code })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    set({ activeTournament: data, activeMatch: null });
    get().initSocket();
    await get().fetchMatches();
  },

  fetchMatches: async () => {
    const tour = get().activeTournament;
    if (!tour) return;

    const res = await fetch(`${API_URL}/api/tournaments/${tour._id || tour.id}/matches`);
    if (res.ok) {
      set({ matches: await res.json() });
    }
  },

  fetchMatchDetails: async (matchId) => {
    const res = await fetch(`${API_URL}/api/matches/${matchId}`);
    if (res.ok) {
      set({ activeMatch: await res.json() });
    }
  },

  restartMatch: async (matchId) => {
    const token = get().token;
    const res = await fetch(`${API_URL}/api/matches/${matchId}/restart`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      set({ activeMatch: data.match });
      get().fetchMatches();
    }
  },

  initSocket: () => {
    const { token, user, activeTournament, socket: existingSocket } = get();
    if (!token || !user || !activeTournament) return;

    if (existingSocket) {
      if (existingSocket.disconnected) {
        existingSocket.connect();
      } else {
        // Emit user_joined for the current active tournament in case it changed or to re-sync
        existingSocket.emit('user_joined', {
          tournamentId: activeTournament._id || activeTournament.id,
          team: user.team,
          userId: user.id,
          username: user.username
        });
      }
      return;
    }

    const socket = io(API_URL);

    socket.on('connect', () => {
      console.log('🔌 Connected to server socket');
      const currentTour = get().activeTournament;
      const currentUser = get().user;
      if (currentTour && currentUser) {
        socket.emit('user_joined', {
          tournamentId: currentTour._id || currentTour.id,
          team: currentUser.team,
          userId: currentUser.id,
          username: currentUser.username
        });
      }
    });

    socket.on('presence_update', (pres) => {
      set({ presence: pres });
    });

    socket.on('state_sync', ({ match, tournament }) => {
      if (match) set({ activeMatch: match });
      if (tournament) set({ activeTournament: tournament });
    });

    socket.on('toss_flipped', ({ choice, result, tossWinner }) => {
      set({ tossSpinning: true, tossResultData: { choice, result, tossWinner } });
      
      // Update local activeMatch state with the toss results so the UI transitions
      set((state) => {
        if (state.activeMatch) {
          return {
            activeMatch: {
              ...state.activeMatch,
              tossChoice: choice,
              tossWinner: tossWinner
            }
          };
        }
        return {};
      });

      setTimeout(() => {
        set({ tossSpinning: false });
      }, 3500); // coin spin duration
    });

    socket.on('toss_decision_applied', ({ match }) => {
      set({ activeMatch: match, tossResultData: null });
    });

    socket.on('playing_xi_updated', ({ match }) => {
      set({ activeMatch: match });
    });

    socket.on('innings_started', ({ match }) => {
      set({ activeMatch: match });
    });

    socket.on('ball_processed', ({ match, tournament, animationEvent }) => {
      set({ activeMatch: match, activeTournament: tournament });
      if (animationEvent) {
        set({ animationEvent });
      }
    });

    socket.on('bowler_selected', ({ match }) => {
      set({ activeMatch: match });
    });

    socket.on('match_cancelled_sync', ({ match }) => {
      set({ activeMatch: match });
    });

    socket.on('notification', (notif) => {
      set((state) => ({ notifications: [notif, ...state.notifications].slice(0, 30) }));
    });

    set({ socket });
  },

  disconnectSocket: () => {
    const socket = get().socket;
    if (socket) {
      socket.disconnect();
      set({ socket: null });
    }
  },

  confirmPlayingXI: (matchId, data) => {
    const socket = get().socket;
    const tour = get().activeTournament;
    if (socket && tour) {
      socket.emit('confirm_playing_xi', {
        tournamentId: tour._id || tour.id,
        matchId,
        team: get().user?.team,
        ...data
      });
    }
  },

  startToss: (matchId, choice) => {
    const socket = get().socket;
    const tour = get().activeTournament;
    if (socket && tour) {
      socket.emit('toss_started', {
        tournamentId: tour._id || tour.id,
        matchId,
        caller: get().user?.team,
        choice
      });
    }
  },

  submitTossDecision: (matchId, decision) => {
    const socket = get().socket;
    const tour = get().activeTournament;
    if (socket && tour) {
      socket.emit('toss_decision', {
        tournamentId: tour._id || tour.id,
        matchId,
        decision
      });
    }
  },

  startInnings: (matchId, batsman1Id, batsman2Id, bowlerId) => {
    const socket = get().socket;
    const tour = get().activeTournament;
    if (socket && tour) {
      socket.emit('start_innings', {
        tournamentId: tour._id || tour.id,
        matchId,
        batsman1Id,
        batsman2Id,
        bowlerId
      });
    }
  },

  selectBowler: (matchId, bowlerId) => {
    const socket = get().socket;
    const tour = get().activeTournament;
    if (socket && tour) {
      socket.emit('select_bowler', {
        tournamentId: tour._id || tour.id,
        matchId,
        bowlerId
      });
    }
  },

  submitBall: (matchId, ballData) => {
    const socket = get().socket;
    const tour = get().activeTournament;
    if (socket && tour) {
      socket.emit('submit_ball', {
        tournamentId: tour._id || tour.id,
        matchId,
        ballData
      });
    }
  },

  cancelMatch: (matchId) => {
    const socket = get().socket;
    const tour = get().activeTournament;
    if (socket && tour) {
      socket.emit('cancel_match', {
        tournamentId: tour._id || tour.id,
        matchId
      });
    }
  },

  closeMatch: () => {
    set({ activeMatch: null });
  },

  clearAnimationEvent: () => {
    set({ animationEvent: null });
  }
}));
