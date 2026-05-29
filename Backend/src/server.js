require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { connectDB, isMock } = require('./config/db');
const { User, Player, Tournament, Match, Notification } = require('./models/models');
const { setupSockets } = require('./sockets/socket');

const app = express();
const server = http.createServer(app);

// Configure CORS for both API requests and Socket.IO
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning']
};
app.use(cors(corsOptions));
app.use(express.json());

const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const JWT_SECRET = process.env.JWT_SECRET || 'cricket_secret_key_12345';
const PORT = process.env.PORT || 5000;

// --- JWT Auth Middleware ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access token missing' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token is invalid or expired' });
    req.user = user;
    next();
  });
};

// --- AUTH ROUTES ---

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, team } = req.body;
    if (!username || !password || !team) {
      return res.status(400).json({ error: 'Username, password and team are required' });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      username,
      password: hashedPassword,
      team
    });

    const token = jwt.sign({ id: newUser._id || newUser.id, username, team }, JWT_SECRET, { expiresIn: '24h' });
    res.status(201).json({ token, user: { id: newUser._id || newUser.id, username, team } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign({ id: user._id || user.id, username, team: user.team }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user._id || user.id, username, team: user.team } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user._id || user.id, username: user.username, team: user.team });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- TOURNAMENT ROUTES ---

app.get('/api/tournament/active', authenticateToken, async (req, res) => {
  try {
    // Queries compatible with Mongoose and file-based MockModel (avoiding complex $or)
    let activeTour = await Tournament.findOne({ creatorId: req.user.id, status: 'active' });
    if (!activeTour) {
      activeTour = await Tournament.findOne({ joinedUserId: req.user.id, status: 'active' });
    }
    res.json(activeTour || null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tournament/create', authenticateToken, async (req, res) => {
  try {
    // Delete any active tournament first for this user (compatibility-friendly separate queries)
    await Tournament.deleteMany({ creatorId: req.user.id, status: 'active' });
    await Tournament.deleteMany({ joinedUserId: req.user.id, status: 'active' });

    const { type, settings } = req.body;
    let totalMatches = 10;
    if (type === 'best_of_5') totalMatches = 5;
    else if (type === 'best_of_10') totalMatches = 10;
    else if (type === 'best_of_20') totalMatches = 20;
    else if (type === 'custom' && req.body.totalMatches) totalMatches = parseInt(req.body.totalMatches);

    // Generate unique 6-character secret code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let secretCode = '';
    for (let i = 0; i < 6; i++) {
      secretCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const newTournament = await Tournament.create({
      creatorId: req.user.id,
      code: secretCode,
      creatorTeam: req.user.team,
      joinedUserId: null,
      joinedTeam: null,
      type,
      totalMatches,
      matchesRemaining: totalMatches,
      currentMatchNo: 1,
      winsAUS: 0,
      winsIND: 0,
      status: 'active',
      settings: settings || {
        matchOvers: 5,
        squadSize: 11,
        bouncerLimit: 1,
        powerplayOvers: 1,
        freeHitEnabled: true
      }
    });

    const tournamentId = newTournament._id || newTournament.id;

    // Pre-create all matches in the tournament
    for (let i = 1; i <= totalMatches; i++) {
      await Match.create({
        tournamentId,
        matchNumber: i,
        status: 'Not Started',
        playingXI_AUS: [],
        playingXI_IND: [],
        innings1: { runs: 0, wickets: 0, overs: 0, ballsBowled: 0, batsmenStats: [], bowlerStats: [], partnerships: [], ballTimeline: [], battingTeam: '', bowlingTeam: '' },
        innings2: { runs: 0, wickets: 0, overs: 0, ballsBowled: 0, batsmenStats: [], bowlerStats: [], partnerships: [], ballTimeline: [], battingTeam: '', bowlingTeam: '' }
      });
    }

    // Seed notification
    await Notification.create({
      tournamentId,
      text: `🏆 New tournament started! Code: ${secretCode}. Best of ${totalMatches} series.`,
      type: 'info'
    });

    // Broadcast a global socket event to notify all connected clients
    io.emit('tournament_created', { tournament: newTournament });

    res.status(201).json(newTournament);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tournament/join', authenticateToken, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Secret code is required' });
    }

    const searchCode = code.toUpperCase().trim();
    const tournament = await Tournament.findOne({ code: searchCode, status: 'active' });
    if (!tournament) {
      return res.status(404).json({ error: 'Active tournament not found with this secret code' });
    }

    if (tournament.creatorId === req.user.id) {
      return res.status(400).json({ error: 'You are the creator of this tournament. Share the code with another manager.' });
    }

    // Delete any currently active tournaments for the joining user to avoid conflicts
    await Tournament.deleteMany({ creatorId: req.user.id, status: 'active' });
    await Tournament.deleteMany({ joinedUserId: req.user.id, status: 'active' });

    tournament.joinedUserId = req.user.id;
    tournament.joinedTeam = req.user.team;

    if (typeof tournament.save === 'function') {
      await tournament.save();
    } else {
      await Tournament.findByIdAndUpdate(tournament._id || tournament.id, tournament);
    }

    const tournamentId = tournament._id || tournament.id;

    // Seed notification
    await Notification.create({
      tournamentId,
      text: `🤝 Manager @${req.user.username} (${req.user.team}) joined the arena! Let the games begin.`,
      type: 'joined'
    });

    // Broadcast to the tournament room that the tournament state has been updated
    io.to(`tournament_${tournamentId}`).emit('tournament_updated', { tournament });

    res.json(tournament);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Calculate and retrieve Leaderboard Stats (Orange Cap, Purple Cap, Most Sixes/Fours, etc.)
app.get('/api/tournament/:tourId/analytics', async (req, res) => {
  try {
    const { tourId } = req.params;
    const completedMatches = await Match.find({ tournamentId: tourId, status: 'Completed' });
    const allPlayers = await Player.find({});

    const playersStats = {}; // playerId -> stats object
    allPlayers.forEach(p => {
      const pid = p._id ? p._id.toString() : p.id;
      playersStats[pid] = {
        id: pid,
        name: p.name,
        team: p.team,
        role: p.role,
        runs: 0,
        ballsFaced: 0,
        fours: 0,
        sixes: 0,
        wickets: 0,
        runsConceded: 0,
        ballsBowled: 0,
        dotBalls: 0,
        matchesPlayed: 0,
        potmAwardCount: 0
      };
    });

    // Compile stats from each completed match
    completedMatches.forEach(match => {
      // PotM award count
      if (match.playerOfMatch) {
        const matchingPlayer = allPlayers.find(p => p.name === match.playerOfMatch);
        if (matchingPlayer) {
          const pid = matchingPlayer._id ? matchingPlayer._id.toString() : matchingPlayer.id;
          if (playersStats[pid]) {
            playersStats[pid].potmAwardCount += 1;
          }
        }
      }

      [match.innings1, match.innings2].forEach(innings => {
        // Batsmen stats
        innings.batsmenStats.forEach(b => {
          if (playersStats[b.playerId]) {
            playersStats[b.playerId].runs += b.runs;
            playersStats[b.playerId].ballsFaced += b.balls;
            playersStats[b.playerId].fours += b.fours;
            playersStats[b.playerId].sixes += b.sixes;
            if (b.balls > 0) {
              playersStats[b.playerId].matchesPlayed += 1; // played in this match
            }
          }
        });

        // Bowler stats
        innings.bowlerStats.forEach(bo => {
          if (playersStats[bo.playerId]) {
            playersStats[bo.playerId].wickets += bo.wickets;
            playersStats[bo.playerId].runsConceded += bo.runs;
            playersStats[bo.playerId].ballsBowled += bo.ballsBowled;
            if (bo.ballsBowled > 0) {
              playersStats[bo.playerId].matchesPlayed += 1;
            }
          }
        });

        // Track dot balls from ball timeline
        innings.ballTimeline.forEach(ball => {
          if (ball.runs === 0 && ball.extraType === 'none' && !ball.dismissal) {
            if (playersStats[ball.bowlerId]) {
              playersStats[ball.bowlerId].dotBalls += 1;
            }
          }
        });
      });
    });

    const statsArray = Object.values(playersStats);

    // Orange Cap (Most Runs)
    const orangeCap = [...statsArray].sort((a, b) => b.runs - a.runs || a.ballsFaced - b.ballsFaced);
    
    // Purple Cap (Most Wickets)
    const purpleCap = [...statsArray].sort((a, b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded);

    // Most Sixes
    const mostSixes = [...statsArray].sort((a, b) => b.sixes - a.sixes).slice(0, 5);

    // Most Fours
    const mostFours = [...statsArray].sort((a, b) => b.fours - a.fours).slice(0, 5);

    // Best Strike Rate (minimum 20 runs scored)
    const bestStrikeRate = [...statsArray]
      .filter(p => p.runs >= 15)
      .map(p => ({ ...p, strikeRate: (p.runs / (p.ballsFaced || 1)) * 100 }))
      .sort((a, b) => b.strikeRate - a.strikeRate)
      .slice(0, 5);

    // Best Economy Rate (minimum 12 balls bowled)
    const bestEconomy = [...statsArray]
      .filter(p => p.ballsBowled >= 12)
      .map(p => ({ ...p, economy: (p.runsConceded / (p.ballsBowled || 1)) * 6 }))
      .sort((a, b) => a.economy - b.economy)
      .slice(0, 5);

    // Most Dot Balls
    const mostDots = [...statsArray].sort((a, b) => b.dotBalls - a.dotBalls).slice(0, 5);

    // Most MVP Player Points
    // MVP Formula: runs * 1 + sixes * 2 + fours * 1 + wickets * 20 + dotBalls * 0.5 - runsConceded * 0.2
    const mvpPointsList = statsArray.map(p => {
      const pts = p.runs * 1 + p.sixes * 2 + p.fours * 1 + p.wickets * 20 + p.dotBalls * 0.5 - p.runsConceded * 0.2;
      return {
        id: p.id,
        name: p.name,
        team: p.team,
        points: parseFloat(pts.toFixed(1)),
        runs: p.runs,
        wickets: p.wickets
      };
    }).sort((a, b) => b.points - a.points);

    res.json({
      orangeCap: orangeCap.slice(0, 5),
      purpleCap: purpleCap.slice(0, 5),
      mostSixes,
      mostFours,
      bestStrikeRate,
      bestEconomy,
      mostDots,
      mvp: mvpPointsList.slice(0, 5),
      matchMVP: completedMatches.map(m => ({ matchNo: m.matchNumber, pom: m.playerOfMatch }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tournament/:tourId/notifications', async (req, res) => {
  try {
    const list = await Notification.find({ tournamentId: req.params.tourId })
      .sort({ createdAt: -1 })
      .limit(30);
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- MATCH ROUTES ---

app.get('/api/tournaments/:tourId/matches', async (req, res) => {
  try {
    const matches = await Match.find({ tournamentId: req.params.tourId }).sort({ matchNumber: 1 });
    res.json(matches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/matches/:matchId', async (req, res) => {
  try {
    const match = await Match.findById(req.params.matchId);
    if (!match) return res.status(404).json({ error: 'Match not found' });
    res.json(match);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- PLAYERS API ---

app.get('/api/players', async (req, res) => {
  try {
    const players = await Player.find({});
    res.json(players);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- INNIPNGS/TIMELINE RESET FOR RESTARTING A MATCH ---
app.post('/api/matches/:matchId/restart', authenticateToken, async (req, res) => {
  try {
    const match = await Match.findById(req.params.matchId);
    if (!match) return res.status(404).json({ error: 'Match not found' });

    match.status = 'Not Started';
    match.currentInningsNo = 1;
    match.activeBatsman1 = null;
    match.activeBatsman2 = null;
    match.activeBowler = null;
    match.isFreeHitActive = false;
    match.tossCaller = null;
    match.tossWinner = null;
    match.tossDecision = null;
    match.confirmed_AUS = false;
    match.confirmed_IND = false;

    // Reset scorecards
    match.innings1 = { runs: 0, wickets: 0, overs: 0, ballsBowled: 0, batsmenStats: [], bowlerStats: [], partnerships: [], ballTimeline: [], battingTeam: '', bowlingTeam: '' };
    match.innings2 = { runs: 0, wickets: 0, overs: 0, ballsBowled: 0, batsmenStats: [], bowlerStats: [], partnerships: [], ballTimeline: [], battingTeam: '', bowlingTeam: '' };

    if (isMock()) {
      await Match.findByIdAndUpdate(req.params.matchId, match);
    } else {
      await match.save();
    }

    res.json({ message: 'Match reset successfully', match });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Start database and start listening
connectDB().then(async () => {
  const { Player, seedPlayers } = require('./models/models');
  await seedPlayers(Player);

  setupSockets(io);
  
  server.listen(PORT, () => {
    console.log(`📡 Express server is broadcasting on http://localhost:${PORT}`);
  });
});
