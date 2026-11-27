export type MatchOutcome = 'WIN' | 'LOSS' | 'DRAW';
export const COINS_PER_ROUND = 1;

export interface MatchResult {
  id: string;
  outcome: MatchOutcome;
  mode: 'AI' | 'ONLINE';
  at: number;
}
export interface PlayerRecord {
  wins: number; losses: number; draws: number;
  coins: number;
  currentStreak: number; bestStreak: number;
  processedMatchIds: string[];
  pendingOnlineMatches: string[];
  recentResults: MatchResult[];
}
export function emptyRecord(): PlayerRecord {
  return {wins:0,losses:0,draws:0,coins:0,currentStreak:0,bestStreak:0,processedMatchIds:[],pendingOnlineMatches:[],recentResults:[]};
}
function count(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? Math.max(0,Math.min(1e9,Math.floor(value))) : 0; }
export function restoreRecord(raw: unknown): PlayerRecord {
  const v = raw && typeof raw === 'object' ? raw as Record<string,unknown> : {};
  const wins=count(v['wins']);
  const losses=count(v['losses']);
  const draws=count(v['draws']);
  const storedCoins = v['coins'];
  const coins = typeof storedCoins === 'number' && Number.isFinite(storedCoins)
    ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(storedCoins)))
    : (wins + losses + draws) * COINS_PER_ROUND;
  const streak=Math.min(wins,count(v['currentStreak']));
  const ids=(value:unknown,limit:number) => Array.isArray(value) ? [...new Set(value.filter((x): x is string=>typeof x === 'string' && x.length>0 && x.length<=160))].slice(-limit) : [];
  const recentResults = Array.isArray(v['recentResults'])
    ? v['recentResults']
      .filter((result): result is MatchResult => result && typeof result.id === 'string'
        && ['WIN', 'LOSS', 'DRAW'].includes(result.outcome)
        && ['AI', 'ONLINE'].includes(result.mode) && Number.isFinite(result.at))
      .slice(-12)
      .map(({ id, outcome, mode, at }) => ({ id, outcome, mode, at }))
    : [];
  return {wins,losses,draws,coins,currentStreak:streak,bestStreak:Math.min(wins,Math.max(streak,count(v['bestStreak']))),processedMatchIds:ids(v['processedMatchIds'],100),pendingOnlineMatches:ids(v['pendingOnlineMatches'],10),recentResults};
}
