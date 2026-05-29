import { useState } from 'react';
import { useGameStore } from '../store/gameStore';

interface LiveAnalyticsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LiveAnalytics({ isOpen, onClose }: LiveAnalyticsProps) {
  const activeMatch = useGameStore(state => state.activeMatch);
  const activeTournament = useGameStore(state => state.activeTournament);

  const [activeTab, setActiveTab] = useState<'wagon' | 'worm' | 'manhattan' | 'winprob'>('wagon');

  if (!activeMatch) return null;

  const inn1 = activeMatch.innings1;
  const inn2 = activeMatch.innings2;
  const currentInningsNo = activeMatch.currentInningsNo;
  const activeInnings = currentInningsNo === 1 ? inn1 : inn2;
  
  const maxOvers = activeTournament?.settings.matchOvers || 5;

  // --- STATS CALCULATIONS ---

  const calculateRates = (innings: typeof inn1) => {
    const balls = innings.ballsBowled;
    if (balls === 0) return { dotPercent: 0, boundaryPercent: 0, rotationPercent: 0 };
    
    let dots = 0, boundaries = 0, rotations = 0;
    innings.ballTimeline.forEach(b => {
      if (b.runs === 0 && b.extraType === 'none' && !b.dismissal) dots++;
      if ((b.runs === 4 || b.runs === 6) && b.extraType !== 'wide') boundaries++;
      if ([1, 2, 3].includes(b.runs) && b.extraType !== 'wide') rotations++;
    });

    return {
      dotPercent: Math.round((dots / balls) * 100),
      boundaryPercent: Math.round((boundaries / balls) * 100),
      rotationPercent: Math.round((rotations / balls) * 100)
    };
  };

  const rates = calculateRates(activeInnings);

  // Pressure Index (0-100)
  // Increases with dot balls, drops with boundaries and runs
  const calculatePressure = (innings: typeof inn1) => {
    const timeline = innings.ballTimeline;
    if (timeline.length === 0) return 30; // base pressure
    
    let pressure = 40;
    const last5 = timeline.slice(-5);
    last5.forEach(b => {
      if (b.runs === 0 && !b.extraType) pressure += 15; // dot ball increases pressure
      if (b.dismissal) pressure += 25; // wicket spikes pressure
      if (b.runs === 4 || b.runs === 6) pressure -= 20; // boundary releases pressure
      if (b.runs === 1 || b.runs === 2) pressure -= 5;
    });

    return Math.min(100, Math.max(0, pressure));
  };

  const pressure = calculatePressure(activeInnings);

  // Win Probability Calculation
  const calculateWinProb = () => {
    if (currentInningsNo === 1) {
      // First innings: base probability on ratings
      return 50; // base split
    }
    
    // Innings 2: chase calculations
    const target = inn2.target || 0;
    const runs = inn2.runs;
    const wickets = inn2.wickets;
    const ballsBowled = inn2.ballsBowled;
    const ballsRemaining = (maxOvers * 6) - ballsBowled;
    const runsNeeded = target - runs;

    if (runsNeeded <= 0) return 0; // Chase completed, ind/batting team won (returns batting team prob, let's keep it simple)
    if (wickets >= 10 || (ballsRemaining <= 0 && runsNeeded > 0)) return 100; // Bowled out or balls finished, bowling team won

    // RRR vs resource calculations
    const rrr = (runsNeeded / (ballsRemaining || 1)) * 6;
    
    // Win prob for batting team (chasing team)
    let battingProb = 50 + (runs / target) * 30 - (rrr - 6) * 12 - wickets * 8;
    battingProb = Math.min(95, Math.max(5, battingProb));
    
    // Map to Australia vs India win percentage
    const isAUSChasing = inn2.battingTeam === 'AUS';
    return isAUSChasing ? Math.round(battingProb) : Math.round(100 - battingProb);
  };

  const ausWinProb = calculateWinProb();

  // Projected Score (1st innings)
  const getProjected = () => {
    if (currentInningsNo === 2) return inn1.runs;
    const balls = inn1.ballsBowled;
    if (balls === 0) return 0;
    const crr = (inn1.runs / balls) * 6;
    return Math.round(crr * maxOvers);
  };

  const projectedScore = getProjected();

  // --- SVG PLOT COORDINATE GENERATION ---

  // 1. Worm Graph calculations
  const getWormPath = (timeline: typeof inn1.ballTimeline) => {
    if (timeline.length === 0) return 'M 0 130';
    
    let cumRuns = 0;
    const coords = [{ x: 10, y: 130 }];
    const maxBalls = maxOvers * 6;
    
    timeline.forEach((ball, idx) => {
      cumRuns += ball.runs + (['wide', 'noball'].includes(ball.extraType) ? 1 : 0);
      const x = 10 + (idx + 1) * (270 / maxBalls);
      const y = 130 - (cumRuns * 1.1); // scaling runs
      coords.push({ x, y });
    });

    return coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
  };

  const pathInn1 = getWormPath(inn1.ballTimeline);
  const pathInn2 = getWormPath(inn2.ballTimeline);

  // 2. Manhattan Graph calculations (runs per over)
  const getManhattanRuns = (timeline: typeof inn1.ballTimeline) => {
    const runsPerOver = Array(maxOvers).fill(0);
    timeline.forEach(b => {
      const overIndex = b.over;
      if (overIndex < maxOvers) {
        runsPerOver[overIndex] += b.runs + (['wide', 'noball'].includes(b.extraType) ? 1 : 0);
      }
    });
    return runsPerOver;
  };

  const manhattan1 = getManhattanRuns(inn1.ballTimeline);
  const manhattan2 = getManhattanRuns(inn2.ballTimeline);

  // 3. Wagon Wheel calculations (runs by sector 1-8)
  const getWagonWheelRuns = (timeline: typeof inn1.ballTimeline) => {
    const sectorRuns = Array(9).fill(0); // 1-8 index
    timeline.forEach(b => {
      if (b.wagonWheelSector && b.wagonWheelSector >= 1 && b.wagonWheelSector <= 8) {
        sectorRuns[b.wagonWheelSector] += b.runs;
      }
    });
    return sectorRuns;
  };

  const sectors = getWagonWheelRuns(activeInnings.ballTimeline);

  // Sector lines coordinate helpers
  // Sectors are 1 to 8 around 360 deg: 1 is fine leg, 2 is square leg, etc.
  const getSectorAngle = (sector: number) => {
    // 8 segments starting from -90 deg (top)
    return (sector - 1) * 45 - 90;
  };

  return (
    <div
      className={`fixed top-0 right-0 h-full w-[400px] bg-zinc-900 border-l border-zinc-800 shadow-2xl z-50 transition-all duration-300 transform ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
    >
      <div className="flex flex-col h-full">
        {/* Sidebar Header */}
        <div className="flex justify-between items-center p-5 border-b border-zinc-800 bg-zinc-950">
          <div>
            <h2 className="text-sm font-black text-zinc-100 uppercase tracking-widest flex items-center space-x-1.5">
              <span>📊 Live Analytics Sidebar</span>
              <span className="h-1.5 w-1.5 bg-amber-500 rounded-full animate-ping" />
            </h2>
            <p className="text-[10px] text-zinc-500 font-semibold uppercase mt-0.5">Real-Time Match Metrics</p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 text-sm font-extrabold p-2 rounded-lg border border-zinc-850 hover:bg-zinc-800 transition"
          >
            Close ✕
          </button>
        </div>

        {/* Live Metrics Grid */}
        <div className="p-5 grid grid-cols-2 gap-4 bg-zinc-950/40 border-b border-zinc-850">
          <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-850 text-center">
            <p className="text-[8px] text-zinc-500 uppercase tracking-widest font-black">Pressure Index</p>
            <p className="text-lg font-black mt-1 text-red-500 animate-pulse">{pressure}%</p>
            <div className="w-full bg-zinc-900 h-1.5 rounded-full mt-1.5 overflow-hidden border border-zinc-850">
              <div className="bg-red-600 h-full rounded-full transition-all duration-300" style={{ width: `${pressure}%` }} />
            </div>
          </div>

          <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-850 text-center">
            <p className="text-[8px] text-zinc-500 uppercase tracking-widest font-black">Projected Total</p>
            <p className="text-lg font-black mt-1 text-amber-400">{projectedScore}</p>
            <p className="text-[8px] text-zinc-600 mt-1 uppercase tracking-widest">Innings 1 Run Rate</p>
          </div>
        </div>

        {/* Segment Toggles */}
        <div className="flex bg-zinc-950 border-b border-zinc-800 text-[10px] font-extrabold uppercase tracking-wider text-center">
          <button
            onClick={() => setActiveTab('wagon')}
            className={`flex-1 py-3 transition ${activeTab === 'wagon' ? 'bg-zinc-900 text-amber-400 border-b border-amber-400' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Wagon Wheel
          </button>
          <button
            onClick={() => setActiveTab('worm')}
            className={`flex-1 py-3 transition ${activeTab === 'worm' ? 'bg-zinc-900 text-amber-400 border-b border-amber-400' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Worm Graph
          </button>
          <button
            onClick={() => setActiveTab('manhattan')}
            className={`flex-1 py-3 transition ${activeTab === 'manhattan' ? 'bg-zinc-900 text-amber-400 border-b border-amber-400' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Manhattan
          </button>
          <button
            onClick={() => setActiveTab('winprob')}
            className={`flex-1 py-3 transition ${activeTab === 'winprob' ? 'bg-zinc-900 text-amber-400 border-b border-amber-400' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Win Prob
          </button>
        </div>

        {/* Charts Container */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin">
          
          {/* TAB 1: WAGON WHEEL */}
          {activeTab === 'wagon' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs">
                <span className="font-extrabold text-zinc-400">Scoring Directions</span>
                <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded uppercase">
                  {activeInnings.battingTeam === 'AUS' ? 'AUS Batting' : 'IND Batting'}
                </span>
              </div>
              
              <div className="flex justify-center">
                <svg className="w-56 h-56 bg-zinc-950 border border-zinc-850 rounded-full" viewBox="0 0 200 200">
                  {/* Outer boundaries */}
                  <circle cx="100" cy="100" r="90" fill="none" stroke="#27272a" strokeWidth="2" strokeDasharray="3,3" />
                  <circle cx="100" cy="100" r="70" fill="none" stroke="#27272a" strokeWidth="1" />
                  
                  {/* Pitch representation */}
                  <rect x="94" y="80" width="12" height="40" fill="#3f3f46" rx="1" />
                  
                  {/* Sector vectors */}
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(s => {
                    const angle = getSectorAngle(s);
                    const rad = (angle * Math.PI) / 180;
                    const val = sectors[s] || 0;
                    // Length proportional to runs
                    const length = Math.min(85, 20 + val * 6);
                    const tx = 100 + length * Math.cos(rad);
                    const ty = 100 + length * Math.sin(rad);

                    return (
                      <g key={s}>
                        {/* Vector vector line */}
                        {val > 0 && (
                          <line
                            x1="100"
                            y1="100"
                            x2={tx}
                            y2={ty}
                            stroke={val >= 4 ? '#fbbf24' : '#60a5fa'}
                            strokeWidth={val >= 6 ? '3.5' : val >= 4 ? '2.5' : '1.5'}
                            strokeLinecap="round"
                          />
                        )}
                        {/* Segment text indicators around perimeter */}
                        <text
                          x={100 + 82 * Math.cos(rad)}
                          y={100 + 82 * Math.sin(rad) + 3}
                          fill="#52525b"
                          fontSize="7"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {val > 0 ? `${val}` : ''}
                        </text>
                      </g>
                    );
                  })}
                  
                  {/* Crease node */}
                  <circle cx="100" cy="100" r="4" fill="#fbbf24" />
                </svg>
              </div>

              {/* Legends */}
              <div className="grid grid-cols-2 gap-2 text-[10px] text-zinc-500 font-bold font-mono">
                <div className="flex items-center space-x-1.5 justify-center">
                  <span className="w-3.5 h-1.5 bg-amber-400 rounded-sm" />
                  <span>Boundaries (4s/6s)</span>
                </div>
                <div className="flex items-center space-x-1.5 justify-center">
                  <span className="w-3.5 h-1.5 bg-blue-400 rounded-sm" />
                  <span>Singles/Doubles</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: WORM GRAPH */}
          {activeTab === 'worm' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs">
                <span className="font-extrabold text-zinc-400">Innings Run Comparison</span>
                <span className="text-[10px] text-zinc-500">Cumulative Runs vs Balls</span>
              </div>

              <div className="bg-zinc-950 p-3 rounded-2xl border border-zinc-850">
                <svg className="w-full h-40" viewBox="0 0 300 150">
                  {/* Grid Lines */}
                  <line x1="10" y1="130" x2="280" y2="130" stroke="#27272a" strokeWidth="1.5" />
                  <line x1="10" y1="10" x2="10" y2="130" stroke="#27272a" strokeWidth="1.5" />
                  
                  <line x1="10" y1="90" x2="280" y2="90" stroke="#18181b" strokeWidth="1" strokeDasharray="2,2" />
                  <line x1="10" y1="50" x2="280" y2="50" stroke="#18181b" strokeWidth="1" strokeDasharray="2,2" />

                  {/* Draw Innings 1 Path */}
                  {inn1.ballsBowled > 0 && (
                    <path
                      d={pathInn1}
                      fill="none"
                      stroke={inn1.battingTeam === 'AUS' ? '#fbbf24' : '#3b82f6'}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  )}

                  {/* Draw Innings 2 Path */}
                  {inn2.ballsBowled > 0 && (
                    <path
                      d={pathInn2}
                      fill="none"
                      stroke={inn2.battingTeam === 'AUS' ? '#fbbf24' : '#3b82f6'}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  )}

                  {/* Label tags */}
                  <text x="12" y="142" fill="#52525b" fontSize="8" fontWeight="bold">0 Overs</text>
                  <text x="250" y="142" fill="#52525b" fontSize="8" fontWeight="bold">5 Overs</text>
                </svg>
              </div>

              {/* Legends */}
              <div className="flex justify-center space-x-6 text-[10px] font-bold">
                <div className="flex items-center space-x-1.5">
                  <span className="w-3 h-3 rounded-full bg-yellow-400" />
                  <span className="text-zinc-400">AUS ({inn1.battingTeam === 'AUS' ? 'Innings 1' : 'Innings 2'})</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-zinc-400">IND ({inn1.battingTeam === 'IND' ? 'Innings 1' : 'Innings 2'})</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MANHATTAN GRAPH */}
          {activeTab === 'manhattan' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs">
                <span className="font-extrabold text-zinc-400">Runs Scored Per Over</span>
                <span className="text-[10px] text-zinc-500">Bar comparisons</span>
              </div>

              <div className="bg-zinc-950 p-3 rounded-2xl border border-zinc-850">
                <svg className="w-full h-40" viewBox="0 0 300 150">
                  <line x1="10" y1="130" x2="280" y2="130" stroke="#27272a" strokeWidth="1.5" />
                  
                  {/* Drawing Bars */}
                  {Array(maxOvers).fill(0).map((_, idx) => {
                    const val1 = manhattan1[idx] || 0;
                    const val2 = manhattan2[idx] || 0;

                    const width = 16;
                    const xBase = 25 + idx * 52;
                    
                    const height1 = val1 * 4;
                    const height2 = val2 * 4;

                    const color1 = inn1.battingTeam === 'AUS' ? '#fbbf24' : '#3b82f6';
                    const color2 = inn2.battingTeam === 'AUS' ? '#fbbf24' : '#3b82f6';

                    return (
                      <g key={idx}>
                        {/* Bar 1 */}
                        {val1 > 0 && (
                          <rect
                            x={xBase}
                            y={130 - height1}
                            width={width}
                            height={height1}
                            fill={color1}
                            rx="1"
                          />
                        )}
                        {/* Bar 2 */}
                        {val2 > 0 && (
                          <rect
                            x={xBase + width + 4}
                            y={130 - height2}
                            width={width}
                            height={height2}
                            fill={color2}
                            rx="1"
                          />
                        )}
                        
                        {/* Over label */}
                        <text x={xBase + 12} y="142" fill="#52525b" fontSize="8" fontWeight="bold" textAnchor="middle">
                          Over {idx + 1}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          )}

          {/* TAB 4: WIN PROBABILITY TIMELINE */}
          {activeTab === 'winprob' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs">
                <span className="font-extrabold text-zinc-400">Win Probability Swings</span>
                <span className="text-[10px] text-zinc-500">Live Prediction Dial</span>
              </div>

              {/* Graphical Probability Ring */}
              <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-850 flex flex-col items-center">
                <svg className="w-32 h-32" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#27272a" strokeWidth="8" />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth="8"
                    strokeDasharray={`${(ausWinProb / 100) * 251.2} 251.2`}
                    transform="rotate(-90 50 50)"
                    strokeLinecap="round"
                    className="transition-all duration-500"
                  />
                  <text x="50" y="55" fill="#f4f4f5" fontSize="16" fontWeight="bold" textAnchor="middle" className="font-mono">
                    {ausWinProb}%
                  </text>
                </svg>
                
                <div className="flex justify-between w-full mt-4 text-[10px] font-bold">
                  <div className="text-center">
                    <p className="text-yellow-400">Australia</p>
                    <p className="text-xs text-zinc-300 font-mono mt-0.5">{ausWinProb}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-blue-500">India</p>
                    <p className="text-xs text-zinc-300 font-mono mt-0.5">{100 - ausWinProb}%</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Secondary percentages list */}
          <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 space-y-3.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-zinc-500 font-semibold uppercase text-[9px] tracking-wider">Dot Ball Percentage</span>
              <span className="font-bold text-zinc-200">{rates.dotPercent}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-500 font-semibold uppercase text-[9px] tracking-wider">Boundary Ratio</span>
              <span className="font-bold text-zinc-200">{rates.boundaryPercent}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-500 font-semibold uppercase text-[9px] tracking-wider">Strike Rotation</span>
              <span className="font-bold text-zinc-200">{rates.rotationPercent}%</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
