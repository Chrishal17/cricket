/**
 * Cricket Rules Engine and State Updater
 */

function updateInningsScore(innings, ballData, bowler, striker, nonStriker, isFreeHitActive, bouncerLimit) {
  const {
    runsScored,     // runs off the bat or extras (0-6)
    extraType,      // 'none', 'wide', 'noball', 'legbye', 'bye'
    isBouncer,      // boolean
    wicket,         // boolean
    dismissalType,  // 'Bowled', 'Caught', 'LBW', 'Run Out', 'Stumping', 'Hit Wicket', etc.
    dismissedPlayerId,
    newBatsmanId,
    newBatsmanName,
    fielderName,
    wagonWheelSector // 1-8
  } = ballData;

  let totalRunsAdded = 0;
  let isBallLegal = true;
  let nextFreeHitActive = isFreeHitActive;
  let dismissedPlayerName = '';

  // Get active striker/non-striker stats objects in innings
  let strikerStats = innings.batsmenStats.find(b => b.playerId === striker.id);
  if (!strikerStats) {
    strikerStats = { playerId: striker.id, name: striker.name, runs: 0, balls: 0, fours: 0, sixes: 0, active: true };
    innings.batsmenStats.push(strikerStats);
  }
  
  let nonStrikerStats = innings.batsmenStats.find(b => b.playerId === nonStriker.id);
  if (!nonStrikerStats) {
    nonStrikerStats = { playerId: nonStriker.id, name: nonStriker.name, runs: 0, balls: 0, fours: 0, sixes: 0, active: true };
    innings.batsmenStats.push(nonStrikerStats);
  }

  // Get bowler stats in innings
  let bowlerStats = innings.bowlerStats.find(b => b.playerId === bowler.id);
  if (!bowlerStats) {
    bowlerStats = { playerId: bowler.id, name: bowler.name, overs: 0, ballsBowled: 0, runs: 0, wickets: 0, bouncersThisOver: 0 };
    innings.bowlerStats.push(bowlerStats);
  }

  // Get active partnership
  let activePartnership = innings.partnerships.find(p => p.active);
  if (!activePartnership) {
    activePartnership = {
      batsman1Id: striker.id,
      batsman2Id: nonStriker.id,
      runs: 0,
      balls: 0,
      active: true
    };
    innings.partnerships.push(activePartnership);
  }

  // 1. Process Bouncer and potential automatic No Ball
  let finalExtraType = extraType || 'none';
  let finalIsBouncer = !!isBouncer;
  if (finalIsBouncer) {
    bowlerStats.bouncersThisOver = (bowlerStats.bouncersThisOver || 0) + 1;
    if (bowlerStats.bouncersThisOver > bouncerLimit) {
      // Second bouncer: Automatic No Ball & Free Hit
      if (finalExtraType === 'none') {
        finalExtraType = 'noball';
      }
    }
  }

  // 2. Calculate runs and extras
  if (finalExtraType === 'wide') {
    isBallLegal = false;
    totalRunsAdded = 1 + runsScored; // wide penalty + extra runs ran
    innings.extras.wide += totalRunsAdded;
    bowlerStats.runs += totalRunsAdded;
    // Striker does not face wide ball, partnership does not record a ball
  } 
  else if (finalExtraType === 'noball') {
    isBallLegal = false;
    totalRunsAdded = 1 + runsScored; // no-ball penalty + runs scored off bat
    innings.extras.noball += 1;
    
    // Batsman gets runs if hit, and faces a ball
    strikerStats.runs += runsScored;
    strikerStats.balls += 1;
    activePartnership.runs += runsScored;
    activePartnership.balls += 1;
    if (runsScored === 4) strikerStats.fours += 1;
    if (runsScored === 6) strikerStats.sixes += 1;
    
    bowlerStats.runs += totalRunsAdded;
    // No-ball activates Free Hit for next delivery
    nextFreeHitActive = true;
  } 
  else if (finalExtraType === 'bye' || finalExtraType === 'legbye') {
    isBallLegal = true;
    totalRunsAdded = runsScored;
    if (finalExtraType === 'bye') {
      innings.extras.bye += runsScored;
    } else {
      innings.extras.legbye += runsScored;
    }
    
    // Batsman faces ball, but doesn't get runs
    strikerStats.balls += 1;
    activePartnership.balls += 1;
    // Bowler does not concede bye/legbye runs in official stats
  } 
  else {
    // Normal legal ball
    isBallLegal = true;
    totalRunsAdded = runsScored;
    
    strikerStats.runs += runsScored;
    strikerStats.balls += 1;
    activePartnership.runs += runsScored;
    activePartnership.balls += 1;
    if (runsScored === 4) strikerStats.fours += 1;
    if (runsScored === 6) strikerStats.sixes += 1;
    
    bowlerStats.runs += runsScored;
  }

  innings.runs += totalRunsAdded;

  // 3. Process Wicket
  let wicketFallen = false;
  let finalDismissal = '';
  let activeStrikerId = striker.id;
  let activeNonStrikerId = nonStriker.id;

  if (wicket) {
    // Under Free Hit rules, only Run Out is a legal dismissal
    if (isFreeHitActive && dismissalType !== 'Run Out') {
      // Ignored! Cannot be out under Free Hit
      finalDismissal = 'Not Out (Free Hit)';
    } else {
      wicketFallen = true;
      innings.wickets += 1;

      // Determine who was out
      let outPlayerId = striker.id;
      if (dismissedPlayerId) {
        outPlayerId = dismissedPlayerId;
      }
      
      const outStats = innings.batsmenStats.find(b => b.playerId === outPlayerId);
      if (outStats) {
        dismissedPlayerName = outStats.name;
        outStats.active = false;
        
        let desc = dismissalType;
        if (dismissalType === 'Bowled') {
          desc = `b. ${bowler.name}`;
        } else if (dismissalType === 'Caught') {
          desc = `c. ${fielderName || 'fielder'} b. ${bowler.name}`;
        } else if (dismissalType === 'LBW') {
          desc = `lbw b. ${bowler.name}`;
        } else if (dismissalType === 'Stumping') {
          desc = `st. ${fielderName || 'wicketkeeper'} b. ${bowler.name}`;
        } else if (dismissalType === 'Run Out') {
          desc = `run out (${fielderName || 'fielder'})`;
        } else if (dismissalType === 'Hit Wicket') {
          desc = `hit wicket b. ${bowler.name}`;
        }
        outStats.dismissal = desc;
        finalDismissal = `${outStats.name} ${desc}`;
      }

      // Bowler gets credit for wicket if not run out/retired/obstructing
      const bowlerGetsWicket = ['Bowled', 'Caught', 'LBW', 'Stumping', 'Hit Wicket'].includes(dismissalType);
      if (bowlerGetsWicket) {
        bowlerStats.wickets += 1;
      }

      // Close the current partnership
      activePartnership.active = false;

      // Swap in new batsman if team not all out (10 wickets)
      if (innings.wickets < 10 && newBatsmanId) {
        const newStats = {
          playerId: newBatsmanId,
          name: newBatsmanName,
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
          active: true
        };
        innings.batsmenStats.push(newStats);

        // Replace the outgoing player
        if (outPlayerId === striker.id) {
          activeStrikerId = newBatsmanId;
        } else {
          activeNonStrikerId = newBatsmanId;
        }

        // Open new partnership
        innings.partnerships.push({
          batsman1Id: activeStrikerId,
          batsman2Id: activeNonStrikerId,
          runs: 0,
          balls: 0,
          active: true
        });
      }
    }
  }

  // 4. Over progression and Bowler stats
  let overCompleted = false;
  if (isBallLegal) {
    innings.ballsBowled += 1;
    bowlerStats.ballsBowled += 1;

    // Update bowler overs display (e.g. 5 balls = 0.5 overs, 6 balls = 1.0 over)
    const balls = bowlerStats.ballsBowled;
    bowlerStats.overs = Math.floor(balls / 6) + (balls % 6) / 10;

    const totalBalls = innings.ballsBowled;
    innings.overs = Math.floor(totalBalls / 6) + (totalBalls % 6) / 10;

    // Check if over completed (6 legal balls)
    if (balls % 6 === 0) {
      overCompleted = true;
      bowlerStats.bouncersThisOver = 0;
    }
  }

  // 5. Strike Rotation
  // Swap strike on odd runs scored (if not a wide/noball, or runs scored off noball/wide)
  // Leg Byes / Byes also swap strike if odd
  const rotationRuns = (finalExtraType === 'wide' || finalExtraType === 'noball') ? runsScored : totalRunsAdded;
  let shouldSwapStrike = rotationRuns % 2 === 1;

  if (shouldSwapStrike && !wicketFallen) {
    const temp = activeStrikerId;
    activeStrikerId = activeNonStrikerId;
    activeNonStrikerId = temp;
  }

  // At the end of a completed over, strike always swaps
  if (overCompleted && !wicketFallen) {
    const temp = activeStrikerId;
    activeStrikerId = activeNonStrikerId;
    activeNonStrikerId = temp;
  }

  // 6. Free Hit Toggle (turns off if current ball was a legal free hit delivery)
  if (isFreeHitActive && isBallLegal) {
    nextFreeHitActive = false;
  }

  // 7. Record the ball in the timeline
  const currentBallRecord = {
    over: Math.floor((innings.ballsBowled - (isBallLegal ? 1 : 0)) / 6),
    ball: (innings.ballsBowled - (isBallLegal ? 1 : 0)) % 6 + 1,
    bowlerId: bowler.id,
    strikerId: striker.id,
    nonStrikerId: nonStriker.id,
    runs: runsScored,
    extraType: finalExtraType,
    extraRuns: (finalExtraType === 'wide' || finalExtraType === 'noball') ? 1 : 0,
    isBouncer: finalIsBouncer,
    isFreeHit: isFreeHitActive,
    dismissal: wicketFallen ? dismissalType : null,
    dismissedPlayerId: wicketFallen ? dismissedPlayerId : null,
    wagonWheelSector: wagonWheelSector || null
  };

  innings.ballTimeline.push(currentBallRecord);

  return {
    strikerId: activeStrikerId,
    nonStrikerId: activeNonStrikerId,
    isFreeHitActive: nextFreeHitActive,
    overCompleted,
    wicketFallen,
    dismissedPlayerName,
    totalRunsAdded
  };
}

module.exports = {
  updateInningsScore
};
