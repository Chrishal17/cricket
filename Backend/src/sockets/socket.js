const { Match, Tournament, Notification, Player } = require('../models/models');
const { updateInningsScore } = require('../utils/rules');

// Maps socket.id to user data
const activeSockets = new Map();

// Helper to get tournament room name
const getRoomName = (tournamentId) => `tournament_${tournamentId}`;

// Helper to broadcast presence update
const broadcastPresence = (io, tournamentId) => {
  let ausOnline = false;
  let indOnline = false;

  for (let [socketId, data] of activeSockets.entries()) {
    if (data.tournamentId === tournamentId) {
      if (data.team === 'AUS') ausOnline = true;
      if (data.team === 'IND') indOnline = true;
    }
  }

  io.to(getRoomName(tournamentId)).emit('presence_update', {
    AUS: ausOnline ? 'Online' : 'Offline',
    IND: indOnline ? 'Online' : 'Offline'
  });
};

const setupSockets = (io) => {
  io.on('connection', (socket) => {
    console.log(`🔌 New client connected: ${socket.id}`);

    // Join tournament room
    socket.on('user_joined', async ({ tournamentId, team, userId, username }) => {
      socket.join(getRoomName(tournamentId));
      activeSockets.set(socket.id, { tournamentId, team, userId, username });

      console.log(`👤 User ${username} (${team}) joined tournament ${tournamentId}`);

      // Broadcast notification
      const text = `${team === 'AUS' ? 'Australia' : 'India'} manager has joined.`;
      const notif = await Notification.create({ tournamentId, text, type: 'joined' });
      io.to(getRoomName(tournamentId)).emit('notification', notif);

      // Send current match state if exists
      const tournament = await Tournament.findById(tournamentId);
      if (tournament) {
        const match = await Match.findOne({ tournamentId, matchNumber: tournament.currentMatchNo });
        if (match) {
          io.to(getRoomName(tournamentId)).emit('state_sync', { match, tournament });
        } else {
          io.to(getRoomName(tournamentId)).emit('state_sync', { tournament });
        }
      }

      // Broadcast updated online presence
      broadcastPresence(io, tournamentId);
    });

    // Toss actions
    socket.on('toss_started', async ({ tournamentId, matchId, caller, choice }) => {
      const match = await Match.findById(matchId);
      if (!match) return;

      const randomResult = Math.random() < 0.5 ? 'Heads' : 'Tails';
      const tossWinner = (choice === randomResult) ? caller : (caller === 'AUS' ? 'IND' : 'AUS');

      match.tossCaller = caller;
      match.tossChoice = choice;
      match.tossWinner = tossWinner;
      
      if (isMockMatch(match)) {
        await Match.findByIdAndUpdate(matchId, match);
      } else {
        await match.save();
      }

      // Broadcast toss coin animation details
      io.to(getRoomName(tournamentId)).emit('toss_flipped', {
        matchId,
        choice,
        result: randomResult,
        tossWinner
      });

      // Notification
      const text = `Toss won by ${tossWinner === 'AUS' ? 'Australia' : 'India'} (Called ${choice}, landed ${randomResult})`;
      const notif = await Notification.create({ tournamentId, text, type: 'toss' });
      io.to(getRoomName(tournamentId)).emit('notification', notif);
    });

    socket.on('toss_decision', async ({ tournamentId, matchId, decision }) => {
      const match = await Match.findById(matchId);
      if (!match) return;

      match.tossDecision = decision;
      
      // Determine batting first/second
      const battingFirst = decision === 'Bat' ? match.tossWinner : (match.tossWinner === 'AUS' ? 'IND' : 'AUS');
      const bowlingFirst = battingFirst === 'AUS' ? 'IND' : 'AUS';

      match.innings1.battingTeam = battingFirst;
      match.innings1.bowlingTeam = bowlingFirst;
      match.innings2.battingTeam = bowlingFirst;
      match.innings2.bowlingTeam = battingFirst;

      // Generate base lists for innings batsmen/bowlers
      const matchPlayersAUS = await Player.find({ team: 'AUS' });
      const matchPlayersIND = await Player.find({ team: 'IND' });

      // Match selected XIs to starting records
      const fillBatsmen = (xi, players) => {
        return xi.map(id => {
          const p = players.find(x => x._id === id || x.id === id);
          return {
            playerId: id,
            name: p ? p.name : 'Unknown Player',
            runs: 0,
            balls: 0,
            fours: 0,
            sixes: 0,
            active: false,
            dismissal: ''
          };
        });
      };

      const fillBowlers = (xi, players) => {
        return xi.map(id => {
          const p = players.find(x => x._id === id || x.id === id);
          return {
            playerId: id,
            name: p ? p.name : 'Unknown Bowler',
            overs: 0,
            ballsBowled: 0,
            runs: 0,
            wickets: 0,
            bouncersThisOver: 0
          };
        });
      };

      match.innings1.batsmenStats = fillBatsmen(
        battingFirst === 'AUS' ? match.playingXI_AUS : match.playingXI_IND,
        battingFirst === 'AUS' ? matchPlayersAUS : matchPlayersIND
      );
      match.innings1.bowlerStats = fillBowlers(
        bowlingFirst === 'AUS' ? match.playingXI_AUS : match.playingXI_IND,
        bowlingFirst === 'AUS' ? matchPlayersAUS : matchPlayersIND
      );

      match.innings2.batsmenStats = fillBatsmen(
        bowlingFirst === 'AUS' ? match.playingXI_AUS : match.playingXI_IND,
        bowlingFirst === 'AUS' ? matchPlayersAUS : matchPlayersIND
      );
      match.innings2.bowlerStats = fillBowlers(
        battingFirst === 'AUS' ? match.playingXI_AUS : match.playingXI_IND,
        battingFirst === 'AUS' ? matchPlayersAUS : matchPlayersIND
      );

      if (isMockMatch(match)) {
        await Match.findByIdAndUpdate(matchId, match);
      } else {
        await match.save();
      }

      io.to(getRoomName(tournamentId)).emit('toss_decision_applied', { match });
    });

    // Playing XI confirm
    socket.on('confirm_playing_xi', async ({ tournamentId, matchId, team, playingXI, captain, viceCaptain, battingOrder, bowlingOrder }) => {
      const match = await Match.findById(matchId);
      if (!match) return;

      const players = await Player.find({ team });

      if (team === 'AUS') {
        match.playingXI_AUS = playingXI;
        match.captain_AUS = captain;
        match.viceCaptain_AUS = viceCaptain;
        match.battingOrder_AUS = battingOrder;
        match.bowlingOrder_AUS = bowlingOrder;
        match.confirmed_AUS = true;
      } else {
        match.playingXI_IND = playingXI;
        match.captain_IND = captain;
        match.viceCaptain_IND = viceCaptain;
        match.battingOrder_IND = battingOrder;
        match.bowlingOrder_IND = bowlingOrder;
        match.confirmed_IND = true;
      }

      if (isMockMatch(match)) {
        await Match.findByIdAndUpdate(matchId, match);
      } else {
        await match.save();
      }

      // Check if both confirmed
      const updatedMatch = await Match.findById(matchId);
      if (updatedMatch.confirmed_AUS && updatedMatch.confirmed_IND) {
        // Randomly choose toss caller
        updatedMatch.tossCaller = Math.random() < 0.5 ? 'AUS' : 'IND';
        if (isMockMatch(updatedMatch)) {
          await Match.findByIdAndUpdate(matchId, updatedMatch);
        } else {
          await updatedMatch.save();
        }
      }

      io.to(getRoomName(tournamentId)).emit('playing_xi_updated', { match: updatedMatch });
    });

    // Innings start
    socket.on('start_innings', async ({ tournamentId, matchId, batsman1Id, batsman2Id, bowlerId }) => {
      const match = await Match.findById(matchId);
      if (!match) return;

      const activeInnings = match.currentInningsNo === 1 ? match.innings1 : match.innings2;
      
      // Set active players
      match.activeBatsman1 = batsman1Id;
      match.activeBatsman2 = batsman2Id;
      match.activeBowler = bowlerId;

      // Mark the active batsmen in stats list
      activeInnings.batsmenStats.forEach(b => {
        if (b.playerId === batsman1Id || b.playerId === batsman2Id) {
          b.active = true;
        } else {
          b.active = false;
        }
      });

      // Initialize partnership
      activeInnings.partnerships = [{
        batsman1Id: batsman1Id,
        batsman2Id: batsman2Id,
        runs: 0,
        balls: 0,
        active: true
      }];

      match.status = 'Live';

      if (isMockMatch(match)) {
        await Match.findByIdAndUpdate(matchId, match);
      } else {
        await match.save();
      }

      io.to(getRoomName(tournamentId)).emit('innings_started', { match });
    });

    // Ball Submitted (Core Engine link)
    socket.on('submit_ball', async ({ tournamentId, matchId, ballData }) => {
      const tournament = await Tournament.findById(tournamentId);
      const match = await Match.findById(matchId);
      if (!match || !tournament) return;

      const activeInningsNo = match.currentInningsNo;
      const activeInnings = activeInningsNo === 1 ? match.innings1 : match.innings2;

      // Find player names from stats list
      const strikerObj = activeInnings.batsmenStats.find(b => b.playerId === match.activeBatsman1);
      const nonStrikerObj = activeInnings.batsmenStats.find(b => b.playerId === match.activeBatsman2);
      const bowlerObj = activeInnings.bowlerStats.find(b => b.playerId === match.activeBowler);

      if (!strikerObj || !nonStrikerObj || !bowlerObj) {
        console.error('❌ Active striker, nonstriker or bowler not found in stats lists!');
        return;
      }

      // Execute rules updater
      const bouncerLimit = tournament.settings.bouncerLimit || 1;
      const {
        strikerId,
        nonStrikerId,
        isFreeHitActive,
        overCompleted,
        wicketFallen,
        dismissedPlayerName,
        totalRunsAdded
      } = updateInningsScore(
        activeInnings, 
        ballData, 
        { id: match.activeBowler, name: bowlerObj.name }, 
        { id: match.activeBatsman1, name: strikerObj.name }, 
        { id: match.activeBatsman2, name: nonStrikerObj.name },
        match.isFreeHitActive,
        bouncerLimit
      );

      // Save state adjustments
      match.activeBatsman1 = strikerId;
      match.activeBatsman2 = nonStrikerId;
      match.isFreeHitActive = isFreeHitActive;

      // Check for milestones / animations to push
      let animationEvent = null;
      if (wicketFallen) {
        animationEvent = { type: 'wicket', player: dismissedPlayerName };
        const text = `WICKET! ${dismissedPlayerName} dismissed. Score: ${activeInnings.runs}/${activeInnings.wickets}`;
        const notif = await Notification.create({ tournamentId, text, type: 'wicket' });
        io.to(getRoomName(tournamentId)).emit('notification', notif);
      } else {
        if (ballData.runsScored === 4 && ballData.extraType !== 'wide') {
          animationEvent = { type: 'four' };
        } else if (ballData.runsScored === 6 && ballData.extraType !== 'wide') {
          animationEvent = { type: 'six' };
        }

        // Check active batsman milestones
        const currentStrikerStats = activeInnings.batsmenStats.find(b => b.playerId === strikerId);
        if (currentStrikerStats) {
          if (currentStrikerStats.runs === 50 && (currentStrikerStats.runs - totalRunsAdded < 50)) {
            animationEvent = { type: 'fifty', player: currentStrikerStats.name };
            const text = `MILESTONE! Fifty for ${currentStrikerStats.name} off ${currentStrikerStats.balls} balls.`;
            const notif = await Notification.create({ tournamentId, text, type: 'milestone' });
            io.to(getRoomName(tournamentId)).emit('notification', notif);
          } else if (currentStrikerStats.runs === 100 && (currentStrikerStats.runs - totalRunsAdded < 100)) {
            animationEvent = { type: 'hundred', player: currentStrikerStats.name };
            const text = `MILESTONE! Century for ${currentStrikerStats.name} off ${currentStrikerStats.balls} balls!`;
            const notif = await Notification.create({ tournamentId, text, type: 'milestone' });
            io.to(getRoomName(tournamentId)).emit('notification', notif);
          }
        }
      }

      // Check Innings End conditions
      const maxOvers = tournament.settings.matchOvers || 5;
      const ballsLimit = maxOvers * 6;
      let inningsCompleted = false;

      if (activeInningsNo === 1) {
        // Innings 1 ends when all out or balls limit hit
        if (activeInnings.wickets >= 10 || activeInnings.ballsBowled >= ballsLimit) {
          inningsCompleted = true;
          match.currentInningsNo = 2;
          match.innings2.target = activeInnings.runs + 1;
          match.activeBatsman1 = null;
          match.activeBatsman2 = null;
          match.activeBowler = null;
          match.isFreeHitActive = false;

          const text = `Innings 1 Completed. ${activeInnings.battingTeam === 'AUS' ? 'Australia' : 'India'} scored ${activeInnings.runs}/${activeInnings.wickets} in ${activeInnings.overs} overs. Target: ${match.innings2.target} runs.`;
          const notif = await Notification.create({ tournamentId, text, type: 'info' });
          io.to(getRoomName(tournamentId)).emit('notification', notif);
        }
      } else {
        // Innings 2 ends when runs passed target, all out, or balls limit hit
        const target = activeInnings.target;
        const reachedTarget = activeInnings.runs >= target;
        const allOut = activeInnings.wickets >= 10;
        const oversDone = activeInnings.ballsBowled >= ballsLimit;

        if (reachedTarget || allOut || oversDone) {
          inningsCompleted = true;
          match.status = 'Completed';
          
          // Determine winner
          let winner = null;
          let winMargin = '';

          if (activeInnings.runs >= target) {
            winner = activeInnings.battingTeam;
            const wicketsRemaining = 10 - activeInnings.wickets;
            winMargin = `by ${wicketsRemaining} wicket${wicketsRemaining > 1 ? 's' : ''}`;
          } else if (activeInnings.runs < target - 1) {
            winner = activeInnings.bowlingTeam;
            const runsDifference = (target - 1) - activeInnings.runs;
            winMargin = `by ${runsDifference} run${runsDifference > 1 ? 's' : ''}`;
          } else {
            winner = 'tie';
            winMargin = 'match tied';
          }

          match.winner = winner;
          match.winMargin = winMargin;

          // Compute Player of Match (Simple logic: highest runs scorer or bowler with most wickets)
          let bestPlayer = 'No one';
          let bestVal = 0;
          
          // Combine both innings batsmen & bowlers
          const candidates = [];
          [match.innings1, match.innings2].forEach(inn => {
            inn.batsmenStats.forEach(b => {
              candidates.push({ name: b.name, score: b.runs * 1.5 + (b.runs > 50 ? 25 : 0) });
            });
            inn.bowlerStats.forEach(bo => {
              candidates.push({ name: bo.name, score: bo.wickets * 25 + (30 - bo.runs) });
            });
          });
          candidates.sort((a, b) => b.score - a.score);
          if (candidates.length > 0) {
            bestPlayer = candidates[0].name;
          }
          match.playerOfMatch = bestPlayer;

          // Update Tournament Standing
          if (winner === 'AUS') tournament.winsAUS += 1;
          if (winner === 'IND') tournament.winsIND += 1;
          
          tournament.currentMatchNo += 1;
          tournament.matchesRemaining -= 1;

          // Check if tournament completed
          if (tournament.matchesRemaining === 0) {
            tournament.status = 'completed';
            const tourWinner = tournament.winsAUS > tournament.winsIND ? 'AUS' : (tournament.winsIND > tournament.winsAUS ? 'IND' : 'Draw');
            
            const tText = `🏆 TOURNAMENT COMPLETED! Winner: ${tourWinner === 'AUS' ? 'Australia' : (tourWinner === 'IND' ? 'India' : 'Draw')}`;
            const tNotif = await Notification.create({ tournamentId, text: tText, type: 'tournament_won' });
            io.to(getRoomName(tournamentId)).emit('notification', tNotif);
          }

          // Compute records for tournament dashboard
          // Highest Team Score
          [match.innings1, match.innings2].forEach((inn, idx) => {
            if (inn.runs > (tournament.stats.highestTeamScore.runs || 0)) {
              tournament.stats.highestTeamScore = {
                team: inn.battingTeam,
                runs: inn.runs,
                overs: inn.overs,
                matchNo: tournament.currentMatchNo - 1
              };
            }
          });

          // Highest Partnership
          [match.innings1, match.innings2].forEach((inn) => {
            inn.partnerships.forEach(p => {
              if (p.runs > (tournament.stats.highestPartnership.runs || 0)) {
                const b1 = inn.batsmenStats.find(x => x.playerId === p.batsman1Id);
                const b2 = inn.batsmenStats.find(x => x.playerId === p.batsman2Id);
                tournament.stats.highestPartnership = {
                  team: inn.battingTeam,
                  batsmen: [b1 ? b1.name : 'Unknown', b2 ? b2.name : 'Unknown'],
                  runs: p.runs,
                  matchNo: tournament.currentMatchNo - 1
                };
              }
            });
          });

          if (isMockMatch(match)) {
            await Tournament.findByIdAndUpdate(tournamentId, tournament);
          } else {
            await tournament.save();
          }

          // Push winning animation trigger
          animationEvent = { type: 'winning_shot', winner: winner === 'AUS' ? 'Australia' : 'India', margin: winMargin };

          const text = `MATCH COMPLETED! ${winner === 'AUS' ? 'Australia' : 'India'} won ${winMargin}. POM: ${bestPlayer}`;
          const notif = await Notification.create({ tournamentId, text, type: 'match_won' });
          io.to(getRoomName(tournamentId)).emit('notification', notif);
        }
      }

      // If over completed, clear bowler so bowling team must select new bowler next over
      if (overCompleted && !inningsCompleted) {
        match.activeBowler = null;
      }

      if (isMockMatch(match)) {
        await Match.findByIdAndUpdate(matchId, match);
      } else {
        await match.save();
      }

      // Read latest state to broadcast
      const freshMatch = await Match.findById(matchId);
      const freshTournament = await Tournament.findById(tournamentId);

      io.to(getRoomName(tournamentId)).emit('ball_processed', {
        match: freshMatch,
        tournament: freshTournament,
        animationEvent
      });
    });

    // Select Bowler
    socket.on('select_bowler', async ({ tournamentId, matchId, bowlerId }) => {
      const match = await Match.findById(matchId);
      if (!match) return;

      match.activeBowler = bowlerId;
      
      if (isMockMatch(match)) {
        await Match.findByIdAndUpdate(matchId, match);
      } else {
        await match.save();
      }

      io.to(getRoomName(tournamentId)).emit('bowler_selected', { match });
    });

    // Cancel Match
    socket.on('cancel_match', async ({ tournamentId, matchId }) => {
      const match = await Match.findById(matchId);
      if (!match) return;

      // Delete live run-time progress but keep playing XI details & status: Cancelled
      match.status = 'Cancelled';
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

      // Clear scorecards
      match.innings1 = { runs: 0, wickets: 0, overs: 0, ballsBowled: 0, batsmenStats: [], bowlerStats: [], partnerships: [], ballTimeline: [], battingTeam: '', bowlingTeam: '' };
      match.innings2 = { runs: 0, wickets: 0, overs: 0, ballsBowled: 0, batsmenStats: [], bowlerStats: [], partnerships: [], ballTimeline: [], battingTeam: '', bowlingTeam: '' };

      if (isMockMatch(match)) {
        await Match.findByIdAndUpdate(matchId, match);
      } else {
        await match.save();
      }

      const text = `Match ${match.matchNumber} was cancelled by managers. Ready to restart.`;
      const notif = await Notification.create({ tournamentId, text, type: 'info' });
      io.to(getRoomName(tournamentId)).emit('notification', notif);

      io.to(getRoomName(tournamentId)).emit('match_cancelled_sync', { match });
    });

    // Handle Disconnection
    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
      
      const socketData = activeSockets.get(socket.id);
      if (socketData) {
        const { tournamentId, team, username } = socketData;
        activeSockets.delete(socket.id);

        console.log(`👤 User ${username} (${team}) left tournament ${tournamentId}`);

        // Broadcast offline presence
        broadcastPresence(io, tournamentId);

        // Notify room
        Notification.create({
          tournamentId,
          text: `${team === 'AUS' ? 'Australia' : 'India'} manager has disconnected.`,
          type: 'left'
        }).then(notif => {
          io.to(getRoomName(tournamentId)).emit('notification', notif);
        });
      }
    });
  });
};

function isMockMatch(match) {
  // Checks if the match object has mock structure (does not have .save as a function)
  return typeof match.save !== 'function';
}

module.exports = {
  setupSockets
};
