const mongoose = require('mongoose');
const { isMock, getMockModel } = require('../config/db');

// --- Schema Definitions (for Mongoose) ---

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  team: { type: String, enum: ['AUS', 'IND'], required: true },
  createdAt: { type: Date, default: Date.now }
});

const PlayerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  team: { type: String, enum: ['AUS', 'IND'], required: true },
  role: { type: String, enum: ['Batsman', 'Bowler', 'All-Rounder', 'Wicketkeeper'], required: true },
  battingStyle: { type: String, required: true },
  bowlingStyle: { type: String, required: true },
  overallRating: { type: Number, default: 80 },
  battingRating: { type: Number, default: 80 },
  bowlingRating: { type: Number, default: 80 },
  fieldingRating: { type: Number, default: 80 },
  powerplayRating: { type: Number, default: 80 },
  deathOverRating: { type: Number, default: 80 },
  spinSkill: { type: Number, default: 80 },
  paceSkill: { type: Number, default: 80 },
  form: { type: Number, default: 80 }, // out of 100
  fitness: { type: Number, default: 80 }, // out of 100
  experience: { type: Number, default: 80 }, // matches played or index
  
  // Custom properties from Squad database
  timing: { type: Number },
  technique: { type: Number },
  type: { type: String },
  skill: { type: Number },
  move: { type: Number },
  bowlingType: { type: String },
  isRecommendedXI: { type: Boolean }
});

const TournamentSchema = new mongoose.Schema({
  creatorId: { type: String },
  type: { type: String, enum: ['best_of_5', 'best_of_10', 'best_of_20', 'custom'], default: 'best_of_10' },
  totalMatches: { type: Number, default: 10 },
  matchesRemaining: { type: Number, default: 10 },
  currentMatchNo: { type: Number, default: 1 },
  winsAUS: { type: Number, default: 0 },
  winsIND: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'completed'], default: 'active' },
  settings: {
    matchOvers: { type: Number, default: 5 },
    squadSize: { type: Number, default: 22 },
    bouncerLimit: { type: Number, default: 1 },
    powerplayOvers: { type: Number, default: 1 },
    freeHitEnabled: { type: Boolean, default: true }
  },
  stats: {
    highestTeamScore: {
      team: { type: String },
      runs: { type: Number, default: 0 },
      overs: { type: Number, default: 0 },
      matchNo: { type: Number }
    },
    highestPartnership: {
      team: { type: String },
      batsmen: { type: [String] },
      runs: { type: Number, default: 0 },
      matchNo: { type: Number }
    },
    highestChase: {
      team: { type: String },
      runs: { type: Number, default: 0 },
      matchNo: { type: Number }
    }
  },
  createdAt: { type: Date, default: Date.now }
});

const MatchSchema = new mongoose.Schema({
  tournamentId: { type: String, required: true },
  matchNumber: { type: Number, required: true },
  status: { type: String, enum: ['Not Started', 'Live', 'Completed', 'Cancelled'], default: 'Not Started' },
  
  // XI Selection state
  playingXI_AUS: [{ type: String }],
  playingXI_IND: [{ type: String }],
  confirmed_AUS: { type: Boolean, default: false },
  confirmed_IND: { type: Boolean, default: false },
  captain_AUS: { type: String },
  captain_IND: { type: String },
  viceCaptain_AUS: { type: String },
  viceCaptain_IND: { type: String },
  battingOrder_AUS: [{ type: String }],
  battingOrder_IND: [{ type: String }],
  bowlingOrder_AUS: [{ type: String }],
  bowlingOrder_IND: [{ type: String }],

  // Toss State
  tossCaller: { type: String, enum: ['AUS', 'IND'] },
  tossChoice: { type: String, enum: ['Heads', 'Tails'] },
  tossWinner: { type: String, enum: ['AUS', 'IND'] },
  tossDecision: { type: String, enum: ['Bat', 'Bowl'] },

  // Innings and Play State
  currentInningsNo: { type: Number, default: 1 },
  activeBatsman1: { type: String }, // Striker (Player ID)
  activeBatsman2: { type: String }, // Non-striker (Player ID)
  activeBowler: { type: String }, // Bowler (Player ID)
  
  innings1: {
    battingTeam: { type: String },
    bowlingTeam: { type: String },
    runs: { type: Number, default: 0 },
    wickets: { type: Number, default: 0 },
    overs: { type: Number, default: 0 },
    ballsBowled: { type: Number, default: 0 },
    batsmenStats: [{
      playerId: String,
      name: String,
      runs: { type: Number, default: 0 },
      balls: { type: Number, default: 0 },
      fours: { type: Number, default: 0 },
      sixes: { type: Number, default: 0 },
      dismissal: String, // how they got out
      active: { type: Boolean, default: false }
    }],
    bowlerStats: [{
      playerId: String,
      name: String,
      overs: { type: Number, default: 0 },
      ballsBowled: { type: Number, default: 0 },
      runs: { type: Number, default: 0 },
      wickets: { type: Number, default: 0 },
      bouncersThisOver: { type: Number, default: 0 }
    }],
    extras: {
      wide: { type: Number, default: 0 },
      noball: { type: Number, default: 0 },
      legbye: { type: Number, default: 0 },
      bye: { type: Number, default: 0 }
    },
    partnerships: [{
      batsman1Id: String,
      batsman2Id: String,
      runs: { type: Number, default: 0 },
      balls: { type: Number, default: 0 },
      active: { type: Boolean, default: false }
    }],
    ballTimeline: [{
      over: Number,
      ball: Number,
      bowlerId: String,
      strikerId: String,
      nonStrikerId: String,
      runs: Number,
      extraType: String, // 'wide', 'noball', 'legbye', 'bye', 'none'
      extraRuns: Number,
      isBouncer: Boolean,
      isFreeHit: Boolean,
      dismissal: String,
      dismissedPlayerId: String,
      wagonWheelSector: Number // 1-8 representing angle sectors
    }]
  },
  
  innings2: {
    battingTeam: { type: String },
    bowlingTeam: { type: String },
    runs: { type: Number, default: 0 },
    wickets: { type: Number, default: 0 },
    overs: { type: Number, default: 0 },
    ballsBowled: { type: Number, default: 0 },
    target: { type: Number },
    batsmenStats: [{
      playerId: String,
      name: String,
      runs: { type: Number, default: 0 },
      balls: { type: Number, default: 0 },
      fours: { type: Number, default: 0 },
      sixes: { type: Number, default: 0 },
      dismissal: String,
      active: { type: Boolean, default: false }
    }],
    bowlerStats: [{
      playerId: String,
      name: String,
      overs: { type: Number, default: 0 },
      ballsBowled: { type: Number, default: 0 },
      runs: { type: Number, default: 0 },
      wickets: { type: Number, default: 0 },
      bouncersThisOver: { type: Number, default: 0 }
    }],
    extras: {
      wide: { type: Number, default: 0 },
      noball: { type: Number, default: 0 },
      legbye: { type: Number, default: 0 },
      bye: { type: Number, default: 0 }
    },
    partnerships: [{
      batsman1Id: String,
      batsman2Id: String,
      runs: { type: Number, default: 0 },
      balls: { type: Number, default: 0 },
      active: { type: Boolean, default: false }
    }],
    ballTimeline: [{
      over: Number,
      ball: Number,
      bowlerId: String,
      strikerId: String,
      nonStrikerId: String,
      runs: Number,
      extraType: String,
      extraRuns: Number,
      isBouncer: Boolean,
      isFreeHit: Boolean,
      dismissal: String,
      dismissedPlayerId: String,
      wagonWheelSector: Number
    }]
  },
  
  isFreeHitActive: { type: Boolean, default: false },
  winner: { type: String, enum: ['AUS', 'IND', 'tie', null], default: null },
  winMargin: { type: String }, // e.g. "by 10 runs", "by 5 wickets"
  playerOfMatch: { type: String }, // Player ID or Name
  createdAt: { type: Date, default: Date.now }
});

const NotificationSchema = new mongoose.Schema({
  tournamentId: { type: String, required: true },
  text: { type: String, required: true },
  type: { type: String, enum: ['joined', 'left', 'toss', 'wicket', 'boundary', 'milestone', 'match_won', 'tournament_won', 'info'], default: 'info' },
  createdAt: { type: Date, default: Date.now }
});

// --- Raw Complete Squad Databases ---

const rawIndiaList = [
  // Recommended Playing XI
  { name: 'Rohit Sharma', timing: 86, technique: 82, type: 'RAD', skill: 48, move: 52, bowlingType: 'Off Break', recommendedXI: 'YES' },
  { name: 'Virat Kohli', timing: 89, technique: 85, type: 'RAD', skill: 45, move: 47, bowlingType: 'Medium', recommendedXI: 'YES' },
  { name: 'Suryakumar Yadav', timing: 82, technique: 78, type: 'RAD', skill: 40, move: 42, bowlingType: 'Off Break', recommendedXI: 'YES' },
  { name: 'KL Rahul', timing: 83, technique: 80, type: 'BAL', skill: 0, move: 0, bowlingType: 'NA', recommendedXI: 'YES' },
  { name: 'Tilak Varma', timing: 80, technique: 71, type: 'RAD', skill: 55, move: 50, bowlingType: 'Off Break', recommendedXI: 'YES' },
  { name: 'Hardik Pandya', timing: 85, technique: 67, type: 'BRU', skill: 69, move: 74, bowlingType: 'Medium Fast', recommendedXI: 'YES' },
  { name: 'Axar Patel', timing: 76, technique: 67, type: 'RAD', skill: 72, move: 68, bowlingType: 'Slow Left Arm', recommendedXI: 'YES' },
  { name: 'Kuldeep Yadav', timing: 46, technique: 52, type: 'BAL', skill: 77, move: 81, bowlingType: 'Slow Left Arm', recommendedXI: 'YES' },
  { name: 'Arshdeep Singh', timing: 45, technique: 35, type: 'BRU', skill: 73, move: 77, bowlingType: 'Medium Fast', recommendedXI: 'YES' },
  { name: 'Jasprit Bumrah', timing: 38, technique: 43, type: 'BAL', skill: 85, move: 87, bowlingType: 'Fast', recommendedXI: 'YES' },
  { name: 'Mohammed Shami', timing: 40, technique: 45, type: 'BAL', skill: 84, move: 86, bowlingType: 'Fast', recommendedXI: 'YES' },

  // Remaining Squad
  { name: 'Shubman Gill', timing: 88, technique: 82, type: 'RAD', skill: 32, move: 34, bowlingType: 'NA', recommendedXI: 'NO' },
  { name: 'Shreyas Iyer', timing: 84, technique: 80, type: 'RAD', skill: 30, move: 35, bowlingType: 'NA', recommendedXI: 'NO' },
  { name: 'Ravindra Jadeja', timing: 75, technique: 70, type: 'BAL', skill: 84, move: 82, bowlingType: 'Slow Left Arm', recommendedXI: 'NO' },
  { name: 'Yashasvi Jaiswal', timing: 82, technique: 74, type: 'RAD', skill: 25, move: 28, bowlingType: 'NA', recommendedXI: 'NO' },
  { name: 'Sanju Samson', timing: 80, technique: 75, type: 'RAD', skill: 0, move: 0, bowlingType: 'NA', recommendedXI: 'NO' },
  { name: 'Rishabh Pant', timing: 79, technique: 73, type: 'BRU', skill: 0, move: 0, bowlingType: 'NA', recommendedXI: 'NO' },
  { name: 'Nitish Kumar Reddy', timing: 76, technique: 68, type: 'BRU', skill: 70, move: 72, bowlingType: 'Medium Fast', recommendedXI: 'NO' },
  { name: 'Ravi Bishnoi', timing: 42, technique: 47, type: 'BAL', skill: 79, move: 82, bowlingType: 'Leg Break', recommendedXI: 'NO' },
  { name: 'Mayank Yadav', timing: 38, technique: 40, type: 'DEF', skill: 84, move: 85, bowlingType: 'Fast', recommendedXI: 'NO' },
  { name: 'Rinku Singh', timing: 79, technique: 72, type: 'BRU', skill: 22, move: 25, bowlingType: 'NA', recommendedXI: 'NO' },
  { name: 'Jitesh Sharma', timing: 74, technique: 69, type: 'BRU', skill: 0, move: 0, bowlingType: 'NA', recommendedXI: 'NO' },
  { name: 'Sai Sudharsan', timing: 81, technique: 78, type: 'BAL', skill: 20, move: 24, bowlingType: 'NA', recommendedXI: 'NO' },
  { name: 'R Sai Kishore', timing: 44, technique: 48, type: 'BAL', skill: 76, move: 79, bowlingType: 'Slow Left Arm', recommendedXI: 'NO' },
  { name: 'Riyan Parag', timing: 75, technique: 67, type: 'BRU', skill: 65, move: 66, bowlingType: 'Leg Break', recommendedXI: 'NO' },
  { name: 'Dhruv Jurel', timing: 73, technique: 68, type: 'BAL', skill: 0, move: 0, bowlingType: 'NA', recommendedXI: 'NO' },
  { name: 'Tushar Deshpande', timing: 40, technique: 42, type: 'BAL', skill: 72, move: 74, bowlingType: 'Medium Fast', recommendedXI: 'NO' },
  { name: 'Harshit Rana', timing: 42, technique: 44, type: 'BRU', skill: 73, move: 75, bowlingType: 'Fast Medium', recommendedXI: 'NO' },
  { name: 'Rajat Patidar', timing: 66, technique: 74, type: 'BAL', skill: 43, move: 40, bowlingType: 'Off Break', recommendedXI: 'NO' },
  { name: 'Avesh Khan', timing: 41, technique: 43, type: 'BAL', skill: 72, move: 75, bowlingType: 'Fast Medium', recommendedXI: 'NO' },
  { name: 'Mukesh Kumar', timing: 42, technique: 45, type: 'BAL', skill: 71, move: 73, bowlingType: 'Medium Fast', recommendedXI: 'NO' },
  { name: 'Ruturaj Gaikwad', timing: 85, technique: 82, type: 'BAL', skill: 20, move: 22, bowlingType: 'NA', recommendedXI: 'NO' },
  { name: 'Ishan Kishan', timing: 79, technique: 74, type: 'BRU', skill: 0, move: 0, bowlingType: 'NA', recommendedXI: 'NO' },
  { name: 'Shivam Dube', timing: 78, technique: 66, type: 'BRU', skill: 66, move: 69, bowlingType: 'Medium', recommendedXI: 'NO' },
  { name: 'Washington Sundar', timing: 74, technique: 69, type: 'BAL', skill: 73, move: 70, bowlingType: 'Off Break', recommendedXI: 'NO' },
  { name: 'Prasidh Krishna', timing: 39, technique: 44, type: 'BAL', skill: 76, move: 78, bowlingType: 'Fast Medium', recommendedXI: 'NO' },
  { name: 'Mohammed Siraj', timing: 40, technique: 43, type: 'BRU', skill: 81, move: 84, bowlingType: 'Fast', recommendedXI: 'NO' },
  { name: 'Rahul Tripathi', timing: 80, technique: 70, type: 'RAD', skill: 25, move: 28, bowlingType: 'NA', recommendedXI: 'NO' },
  { name: 'Deepak Hooda', timing: 77, technique: 69, type: 'BRU', skill: 58, move: 60, bowlingType: 'Off Break', recommendedXI: 'NO' },
  { name: 'Shivam Mavi', timing: 40, technique: 43, type: 'BAL', skill: 74, move: 77, bowlingType: 'Fast Medium', recommendedXI: 'NO' },
  { name: 'Yuzvendra Chahal', timing: 42, technique: 48, type: 'BAL', skill: 81, move: 84, bowlingType: 'Leg Break', recommendedXI: 'NO' },
  { name: 'Dinesh Karthik', timing: 70, technique: 72, type: 'BAL', skill: 0, move: 0, bowlingType: 'NA', recommendedXI: 'NO' },
  { name: 'Ravichandran Ashwin', timing: 65, technique: 62, type: 'BAL', skill: 84, move: 82, bowlingType: 'Off Break', recommendedXI: 'NO' },
  { name: 'Bhuvneshwar Kumar', timing: 43, technique: 48, type: 'BAL', skill: 80, move: 81, bowlingType: 'Medium Fast', recommendedXI: 'NO' },
  { name: 'Harshal Patel', timing: 44, technique: 47, type: 'BRU', skill: 78, move: 80, bowlingType: 'Medium Fast', recommendedXI: 'NO' },
  { name: 'Venkatesh Iyer', timing: 77, technique: 68, type: 'BRU', skill: 65, move: 66, bowlingType: 'Medium Fast', recommendedXI: 'NO' },
  { name: 'Shardul Thakur', timing: 48, technique: 50, type: 'BRU', skill: 76, move: 78, bowlingType: 'Medium Fast', recommendedXI: 'NO' },
  { name: 'Umran Malik', timing: 34, technique: 36, type: 'BRU', skill: 85, move: 86, bowlingType: 'Fast', recommendedXI: 'NO' },
  { name: 'Rahul Chahar', timing: 44, technique: 49, type: 'BAL', skill: 77, move: 81, bowlingType: 'Leg Break', recommendedXI: 'NO' },
  { name: 'Varun Chakravarthy', timing: 45, technique: 48, type: 'BAL', skill: 80, move: 83, bowlingType: 'Mystery Spin', recommendedXI: 'NO' },
  { name: 'Deepak Chahar', timing: 45, technique: 50, type: 'BAL', skill: 78, move: 80, bowlingType: 'Medium Fast', recommendedXI: 'NO' },
  { name: 'Prithvi Shaw', timing: 81, technique: 68, type: 'BRU', skill: 20, move: 25, bowlingType: 'NA', recommendedXI: 'NO' },
  { name: 'Krunal Pandya', timing: 70, technique: 64, type: 'BAL', skill: 72, move: 71, bowlingType: 'Slow Left Arm', recommendedXI: 'NO' },
  { name: 'T Natarajan', timing: 42, technique: 45, type: 'BAL', skill: 80, move: 82, bowlingType: 'Medium Fast', recommendedXI: 'NO' },
  { name: 'Devdutt Padikkal', timing: 78, technique: 76, type: 'BAL', skill: 18, move: 22, bowlingType: 'NA', recommendedXI: 'NO' },
  { name: 'Navdeep Saini', timing: 38, technique: 40, type: 'BRU', skill: 78, move: 80, bowlingType: 'Fast', recommendedXI: 'NO' },
  { name: 'Shikhar Dhawan', timing: 82, technique: 78, type: 'BAL', skill: 15, move: 18, bowlingType: 'NA', recommendedXI: 'NO' },
  { name: 'Jayant Yadav', timing: 60, technique: 58, type: 'BAL', skill: 72, move: 74, bowlingType: 'Off Break', recommendedXI: 'NO' },
  { name: 'Manish Pandey', timing: 76, technique: 74, type: 'BAL', skill: 20, move: 22, bowlingType: 'NA', recommendedXI: 'NO' },
  { name: 'Umesh Yadav', timing: 39, technique: 41, type: 'BRU', skill: 79, move: 81, bowlingType: 'Fast', recommendedXI: 'NO' },
  { name: 'Khaleel Ahmed', timing: 42, technique: 44, type: 'BAL', skill: 74, move: 76, bowlingType: 'Medium Fast', recommendedXI: 'NO' },
  { name: 'Manan Agarwal', timing: 70, technique: 79, type: 'BAL', skill: 0, move: 0, bowlingType: 'NA', recommendedXI: 'NO' },
  { name: 'Rahul Tewatia', timing: 72, technique: 56, type: 'BRU', skill: 67, move: 70, bowlingType: 'Leg Break', recommendedXI: 'NO' },
  { name: 'Krishnappa Gowtham', timing: 68, technique: 54, type: 'BRU', skill: 66, move: 66, bowlingType: 'Off Break', recommendedXI: 'NO' },
  { name: 'Nitish Rana', timing: 75, technique: 67, type: 'RAD', skill: 44, move: 46, bowlingType: 'Off Break', recommendedXI: 'NO' },
  { name: 'Chetan Sakariya', timing: 42, technique: 48, type: 'BAL', skill: 69, move: 74, bowlingType: 'Medium Fast', recommendedXI: 'NO' },
  { name: 'Shahbaz Ahmed', timing: 67, technique: 60, type: 'RAD', skill: 69, move: 67, bowlingType: 'Slow Left Arm', recommendedXI: 'NO' },
  { name: 'Kartik Sen', timing: 41, technique: 47, type: 'BAL', skill: 69, move: 71, bowlingType: 'Fast Medium', recommendedXI: 'NO' },
  { name: 'Sandeep Warrier', timing: 42, technique: 48, type: 'BAL', skill: 68, move: 68, bowlingType: 'Medium Fast', recommendedXI: 'NO' },
  { name: 'Jaydev Unadkat', timing: 39, technique: 44, type: 'BAL', skill: 68, move: 72, bowlingType: 'Fast Medium', recommendedXI: 'NO' }
];

const rawAusList = [
  // Recommended Playing XI
  { name: 'Travis Head', timing: 87, technique: 69, type: 'BRU', skill: 48, move: 55, bowlingType: 'Off Break', recommendedXI: 'YES' },
  { name: 'Josh Philippe', timing: 80, technique: 62, type: 'BRU', skill: 0, move: 0, bowlingType: 'NA', recommendedXI: 'YES' },
  { name: 'Ben McDermott', timing: 66, technique: 75, type: 'BAL', skill: 0, move: 0, bowlingType: 'NA', recommendedXI: 'YES' },
  { name: 'Mitchell Marsh', timing: 79, technique: 70, type: 'RAD', skill: 62, move: 64, bowlingType: 'Medium Fast', recommendedXI: 'YES' },
  { name: 'Tim David', timing: 85, technique: 67, type: 'BRU', skill: 54, move: 48, bowlingType: 'Off Break', recommendedXI: 'YES' },
  { name: 'Matthew Short', timing: 74, technique: 66, type: 'RAD', skill: 42, move: 40, bowlingType: 'Off Break', recommendedXI: 'YES' },
  { name: 'Matthew Wade', timing: 83, technique: 65, type: 'BRU', skill: 0, move: 0, bowlingType: 'NA', recommendedXI: 'YES' },
  { name: 'Josh Hazlewood', timing: 37, technique: 46, type: 'DEF', skill: 79, move: 75, bowlingType: 'Fast Medium', recommendedXI: 'YES' },
  { name: 'Pat Cummins', timing: 72, technique: 63, type: 'RAD', skill: 83, move: 79, bowlingType: 'Fast', recommendedXI: 'YES' },
  { name: 'Mitchell Starc', timing: 68, technique: 54, type: 'BRU', skill: 85, move: 81, bowlingType: 'Fast', recommendedXI: 'YES' },
  { name: 'Adam Zampa', timing: 44, technique: 50, type: 'BAL', skill: 77, move: 81, bowlingType: 'Leg Break', recommendedXI: 'YES' },

  // Remaining Squad
  { name: 'David Warner', timing: 84, technique: 66, type: 'BRU', skill: 39, move: 42, bowlingType: 'Leg Break', recommendedXI: 'NO' },
  { name: 'Nathan Ellis', timing: 52, technique: 40, type: 'BRU', skill: 70, move: 72, bowlingType: 'Medium Fast', recommendedXI: 'NO' },
  { name: 'Aaron Finch', timing: 80, technique: 71, type: 'RAD', skill: 39, move: 41, bowlingType: 'Slow Left Arm', recommendedXI: 'NO' },
  { name: 'Ashton Agar', timing: 68, technique: 76, type: 'BAL', skill: 72, move: 70, bowlingType: 'Slow Left Arm', recommendedXI: 'NO' },
  { name: 'Mitchell Swepson', timing: 39, technique: 49, type: 'DEF', skill: 71, move: 69, bowlingType: 'Leg Break', recommendedXI: 'NO' },
  { name: 'Jhye Richardson', timing: 39, technique: 49, type: 'DEF', skill: 72, move: 70, bowlingType: 'Fast', recommendedXI: 'NO' },
  { name: 'Nathan Lyon', timing: 53, technique: 47, type: 'RAD', skill: 83, move: 85, bowlingType: 'Off Break', recommendedXI: 'NO' },
  { name: 'Dan Christian', timing: 72, technique: 56, type: 'BRU', skill: 67, move: 71, bowlingType: 'Fast Medium', recommendedXI: 'NO' },
  { name: 'Daniel Sams', timing: 69, technique: 55, type: 'BRU', skill: 68, move: 65, bowlingType: 'Fast Medium', recommendedXI: 'NO' },
  { name: 'Moises Henriques', timing: 76, technique: 68, type: 'RAD', skill: 64, move: 65, bowlingType: 'Medium Fast', recommendedXI: 'NO' },
  { name: 'D\'Arcy Short', timing: 76, technique: 68, type: 'RAD', skill: 55, move: 60, bowlingType: 'Slow Left Arm', recommendedXI: 'NO' },
  { name: 'Josh Inglis', timing: 69, technique: 77, type: 'BAL', skill: 0, move: 0, bowlingType: 'NA', recommendedXI: 'NO' },
  { name: 'Glenn Maxwell', timing: 88, technique: 70, type: 'BRU', skill: 53, move: 51, bowlingType: 'Off Break', recommendedXI: 'NO' },
  { name: 'Marcus Stoinis', timing: 84, technique: 66, type: 'BRU', skill: 64, move: 66, bowlingType: 'Medium', recommendedXI: 'NO' },
  { name: 'Kane Richardson', timing: 37, technique: 48, type: 'DEF', skill: 71, move: 68, bowlingType: 'Fast Medium', recommendedXI: 'NO' },
  { name: 'Steve Smith', timing: 76, technique: 86, type: 'BAL', skill: 52, move: 57, bowlingType: 'Leg Break', recommendedXI: 'NO' },
  { name: 'Marnus Labuschagne', timing: 74, technique: 84, type: 'BAL', skill: 53, move: 59, bowlingType: 'Leg Break', recommendedXI: 'NO' },
  { name: 'Alex Carey', timing: 70, technique: 79, type: 'BAL', skill: 0, move: 0, bowlingType: 'NA', recommendedXI: 'NO' },
  { name: 'Cameron Green', timing: 85, technique: 66, type: 'BRU', skill: 67, move: 73, bowlingType: 'Fast Medium', recommendedXI: 'NO' },
  { name: 'Sean Abbott', timing: 50, technique: 40, type: 'BRU', skill: 69, move: 70, bowlingType: 'Fast Medium', recommendedXI: 'NO' },
  { name: 'Jason Behrendorff', timing: 37, technique: 46, type: 'DEF', skill: 75, move: 76, bowlingType: 'Fast Medium', recommendedXI: 'NO' },
  { name: 'Tanveer Sangha', timing: 42, technique: 48, type: 'BAL', skill: 65, move: 69, bowlingType: 'Leg Break', recommendedXI: 'NO' },
  { name: 'Ashton Turner', timing: 80, technique: 62, type: 'BRU', skill: 49, move: 63, bowlingType: 'Off Break', recommendedXI: 'NO' },
  { name: 'Peter Handscomb', timing: 68, technique: 76, type: 'BAL', skill: 0, move: 0, bowlingType: 'NA', recommendedXI: 'NO' },
  { name: 'Nathan Coulter-Nile', timing: 63, technique: 49, type: 'BRU', skill: 75, move: 71, bowlingType: 'Fast', recommendedXI: 'NO' },
  { name: 'Shaun Marsh', timing: 69, technique: 78, type: 'BAL', skill: 40, move: 42, bowlingType: 'Slow Left Arm', recommendedXI: 'NO' },
  { name: 'Chris Lynn', timing: 84, technique: 66, type: 'BRU', skill: 0, move: 0, bowlingType: 'NA', recommendedXI: 'NO' },
  { name: 'Usman Khawaja', timing: 66, technique: 84, type: 'DEF', skill: 0, move: 0, bowlingType: 'NA', recommendedXI: 'NO' },
  { name: 'Tim Paine', timing: 67, technique: 76, type: 'BAL', skill: 0, move: 0, bowlingType: 'NA', recommendedXI: 'NO' },
  { name: 'Peter Siddle', timing: 43, technique: 49, type: 'BAL', skill: 75, move: 70, bowlingType: 'Fast Medium', recommendedXI: 'NO' },
  { name: 'Jackson Bird', timing: 38, technique: 48, type: 'DEF', skill: 71, move: 69, bowlingType: 'Fast Medium', recommendedXI: 'NO' },
  { name: 'Chadd Sayers', timing: 41, technique: 47, type: 'BAL', skill: 70, move: 66, bowlingType: 'Medium Fast', recommendedXI: 'NO' },
  { name: 'Billy Stanlake', timing: 38, technique: 48, type: 'DEF', skill: 70, move: 71, bowlingType: 'Fast', recommendedXI: 'NO' },
  { name: 'Nic Maddinson', timing: 77, technique: 61, type: 'BRU', skill: 45, move: 47, bowlingType: 'Slow Left Arm', recommendedXI: 'NO' },
  { name: 'Jack Wildermuth', timing: 63, technique: 72, type: 'BAL', skill: 65, move: 65, bowlingType: 'Medium Fast', recommendedXI: 'NO' },
  { name: 'Riley Meredith', timing: 46, technique: 36, type: 'BRU', skill: 68, move: 71, bowlingType: 'Fast Medium', recommendedXI: 'NO' },
  { name: 'Matt Kuhnemann', timing: 42, technique: 48, type: 'BAL', skill: 69, move: 67, bowlingType: 'Slow Left Arm', recommendedXI: 'NO' },
  { name: 'Scott Boland', timing: 50, technique: 40, type: 'BRU', skill: 74, move: 79, bowlingType: 'Fast Medium', recommendedXI: 'NO' },
  { name: 'Michael Neser', timing: 67, technique: 53, type: 'BRU', skill: 70, move: 72, bowlingType: 'Medium', recommendedXI: 'NO' },
  { name: 'Spencer Johnson', timing: 43, technique: 49, type: 'BAL', skill: 72, move: 68, bowlingType: 'Fast Medium', recommendedXI: 'NO' },
  { name: 'Wes Agar', timing: 40, technique: 46, type: 'BAL', skill: 66, move: 67, bowlingType: 'Fast', recommendedXI: 'NO' },
  { name: 'Jake Fraser-McGurk', timing: 75, technique: 67, type: 'RAD', skill: 60, move: 65, bowlingType: 'Leg Break', recommendedXI: 'NO' },
  { name: 'Will Sutherland', timing: 60, technique: 67, type: 'BAL', skill: 69, move: 71, bowlingType: 'Medium', recommendedXI: 'NO' },
  { name: 'Lance Morris', timing: 42, technique: 48, type: 'BAL', skill: 68, move: 70, bowlingType: 'Medium Fast', recommendedXI: 'NO' },
  { name: 'Xavier Bartlett', timing: 38, technique: 48, type: 'DEF', skill: 69, move: 66, bowlingType: 'Fast Medium', recommendedXI: 'NO' },
  { name: 'Ben Dwarshuis', timing: 47, technique: 37, type: 'BRU', skill: 69, move: 65, bowlingType: 'Fast Medium', recommendedXI: 'NO' },
  { name: 'Aaron Hardie', timing: 75, technique: 59, type: 'BRU', skill: 69, move: 71, bowlingType: 'Medium Fast', recommendedXI: 'NO' },
  { name: 'Matt Beardman', timing: 52, technique: 40, type: 'BRU', skill: 71, move: 73, bowlingType: 'Fast Medium', recommendedXI: 'NO' },
  { name: 'Cooper Connolly', timing: 75, technique: 67, type: 'RAD', skill: 58, move: 48, bowlingType: 'Slow Left Arm', recommendedXI: 'NO' },
  { name: 'Mitchell Owen', timing: 54, technique: 60, type: 'BAL', skill: 36, move: 38, bowlingType: 'Medium', recommendedXI: 'NO' },
  { name: 'Matt Renshaw', timing: 65, technique: 82, type: 'DEF', skill: 0, move: 0, bowlingType: 'NA', recommendedXI: 'NO' }
];

// Helper mapper to transform tabular details into Player Schema attributes
function mapPlayer(raw) {
  let role = 'Batsman';
  const keeperNames = [
    'KL Rahul', 'Sanju Samson', 'Rishabh Pant', 'Jitesh Sharma', 'Dhruv Jurel', 'Ishan Kishan', 'Dinesh Karthik',
    'Josh Philippe', 'Ben McDermott', 'Matthew Wade', 'Josh Inglis', 'Alex Carey', 'Tim Paine', 'Peter Handscomb'
  ];
  
  if (keeperNames.includes(raw.name)) {
    role = 'Wicketkeeper';
  } else if (raw.bowlingType !== 'NA' && raw.skill >= 60 && raw.timing >= 60) {
    role = 'All-Rounder';
  } else if (raw.bowlingType !== 'NA' && raw.skill >= 60 && raw.timing < 60) {
    role = 'Bowler';
  } else if (raw.bowlingType !== 'NA' && raw.timing < 50) {
    role = 'Bowler';
  } else {
    role = 'Batsman';
  }

  // Right-hand vs Left-hand batters
  const leftBatters = [
    'Tilak Varma', 'Axar Patel', 'Arshdeep Singh', 'Ravindra Jadeja', 'Yashasvi Jaiswal', 'Rishabh Pant',
    'Sai Sudharsan', 'Dhruv Jurel', 'Ishan Kishan', 'Shivam Dube', 'Dinesh Karthik', 'Krunal Pandya',
    'Devdutt Padikkal', 'Shikhar Dhawan', 'Shahbaz Ahmed', 'Travis Head', 'Ben McDermott', 'Matthew Wade',
    'Mitchell Starc', 'David Warner', 'Ashton Agar', 'Daniel Sams', 'D\'Arcy Short', 'Alex Carey', 'Sean Abbott',
    'Jason Behrendorff', 'Shaun Marsh', 'Usman Khawaja', 'Nic Maddinson', 'Matt Kuhnemann', 'Ben Dwarshuis'
  ];
  const battingStyle = leftBatters.includes(raw.name) ? 'Left-hand bat' : 'Right-hand bat';

  let bowlingStyle = 'Right-arm medium';
  if (raw.bowlingType === 'NA') {
    bowlingStyle = 'None';
  } else {
    const leftArmBowlers = [
      'Arshdeep Singh', 'Axar Patel', 'Ravindra Jadeja', 'R Sai Kishore', 'Krunal Pandya', 'Chetan Sakariya',
      'Shahbaz Ahmed', 'Khaleel Ahmed', 'Mitchell Starc', 'Aaron Finch', 'Ashton Agar', 'D\'Arcy Short',
      'Jason Behrendorff', 'Shaun Marsh', 'Nic Maddinson', 'Matt Kuhnemann', 'Cooper Connolly'
    ];
    const arm = leftArmBowlers.includes(raw.name) ? 'Left-arm' : 'Right-arm';
    
    if (['Off Break', 'Mystery Spin', 'Slow Left Arm', 'Leg Break'].includes(raw.bowlingType)) {
      if (raw.bowlingType === 'Leg Break') {
        bowlingStyle = `${arm} legbreak`;
      } else if (raw.bowlingType === 'Off Break') {
        bowlingStyle = `${arm} offbreak`;
      } else if (raw.bowlingType === 'Slow Left Arm') {
        bowlingStyle = `${arm} orthodox`;
      } else {
        bowlingStyle = `${arm} mystery spin`;
      }
    } else {
      if (raw.bowlingType === 'Fast') {
        bowlingStyle = `${arm} fast`;
      } else if (raw.bowlingType === 'Medium Fast' || raw.bowlingType === 'Fast Medium') {
        bowlingStyle = `${arm} fast-medium`;
      } else {
        bowlingStyle = `${arm} medium`;
      }
    }
  }

  const battingRating = raw.timing;
  const bowlingRating = raw.skill;
  const overallRating = Math.max(battingRating, bowlingRating);

  return {
    name: raw.name,
    team: raw.team,
    role,
    battingStyle,
    bowlingStyle,
    overallRating,
    battingRating,
    bowlingRating,
    fieldingRating: Math.round(75 + Math.random() * 20),
    powerplayRating: raw.type === 'RAD' || raw.type === 'BRU' ? Math.round(raw.timing + 5) : raw.timing,
    deathOverRating: raw.type === 'BRU' ? Math.round(raw.timing + 10) : raw.timing,
    spinSkill: ['Off Break', 'Mystery Spin', 'Slow Left Arm', 'Leg Break'].includes(raw.bowlingType) ? raw.skill : 20,
    paceSkill: ['Fast', 'Medium Fast', 'Fast Medium', 'Medium'].includes(raw.bowlingType) ? raw.skill : 20,
    form: raw.technique,
    fitness: 90,
    experience: raw.timing + raw.skill,
    
    // Seed raw details
    timing: raw.timing,
    technique: raw.technique,
    type: raw.type,
    skill: raw.skill,
    move: raw.move,
    bowlingType: raw.bowlingType,
    isRecommendedXI: raw.recommendedXI === 'YES'
  };
}

const ausSquad = rawAusList.map(p => mapPlayer({ ...p, team: 'AUS' }));
const indSquad = rawIndiaList.map(p => mapPlayer({ ...p, team: 'IND' }));

// Helper to seed players if squad is empty
async function seedPlayers(PlayerModel) {
  try {
    // Delete any old incomplete seeding first to avoid duplicate names and force new full seeds
    await PlayerModel.deleteMany({});
    console.log('🌱 Seeding Australia (62) and India (70) player squads...');
    const allPlayers = [...ausSquad, ...indSquad];
    await PlayerModel.insertMany(allPlayers);
    console.log('✅ Seeding completed successfully. 132 players pre-loaded.');
  } catch (error) {
    console.error('❌ Player seeding error:', error);
  }
}

// --- Expose Models ---

const UserMongoose = mongoose.model('User', UserSchema);
const PlayerMongoose = mongoose.model('Player', PlayerSchema);
const TournamentMongoose = mongoose.model('Tournament', TournamentSchema);
const MatchMongoose = mongoose.model('Match', MatchSchema);
const NotificationMongoose = mongoose.model('Notification', NotificationSchema);

const getActiveModel = (name, defaultData = []) => {
  if (isMock()) {
    return getMockModel(name, defaultData);
  }
  switch (name) {
    case 'User': return UserMongoose;
    case 'Player': return PlayerMongoose;
    case 'Tournament': return TournamentMongoose;
    case 'Match': return MatchMongoose;
    case 'Notification': return NotificationMongoose;
  }
};

const delegate = (modelName, defaultData = []) => {
  return {
    find: (q) => getActiveModel(modelName, defaultData).find(q),
    findOne: (q) => getActiveModel(modelName, defaultData).findOne(q),
    findById: (id) => getActiveModel(modelName, defaultData).findById(id),
    findByIdAndUpdate: (id, u, o) => getActiveModel(modelName, defaultData).findByIdAndUpdate(id, u, o),
    create: (doc) => getActiveModel(modelName, defaultData).create(doc),
    updateOne: (q, u) => getActiveModel(modelName, defaultData).updateOne(q, u),
    deleteMany: (q) => getActiveModel(modelName, defaultData).deleteMany(q),
    insertMany: (docs) => getActiveModel(modelName, defaultData).insertMany(docs),
  };
};

const User = delegate('User');
const Player = delegate('Player', [...ausSquad, ...indSquad]);
const Tournament = delegate('Tournament');
const Match = delegate('Match');
const Notification = delegate('Notification');

module.exports = {
  User,
  Player,
  Tournament,
  Match,
  Notification,
  seedPlayers
};
