export type MatchOutcome = 'WIN' | 'LOSS' | 'DRAW';
export const INITIAL_RATING = 1200;
export const MIN_RATING = 800;
export const MAX_RATING = 4000;
export function validRating(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(MIN_RATING, Math.min(MAX_RATING, Math.round(value))) : INITIAL_RATING;
}
export function ratingAfterMatch(rating: number, opponent: number, outcome: MatchOutcome): number {
  const current = validRating(rating);
  const expected = 1 / (1 + 10 ** ((validRating(opponent) - current) / 400));
  const score = outcome === 'WIN' ? 1 : outcome === 'DRAW' ? 0.5 : 0;
  const raw = 24 * (score - expected);
  return validRating(current + Math.sign(raw) * Math.round(Math.abs(raw)));
}

export interface MatchResult {
  id: string;
  outcome: MatchOutcome;
  mode: 'AI' | 'ONLINE';
  rating: number;
  delta: number;
  at: number;
}
export interface PlayerRecord {
  elo: number; wins: number; losses: number; draws: number;
  currentStreak: number; bestStreak: number;
  processedMatchIds: string[];
  pendingOnlineMatches: string[];
  recentResults: MatchResult[];
}
export function emptyRecord(): PlayerRecord {
  return {elo:1200,wins:0,losses:0,draws:0,currentStreak:0,bestStreak:0,processedMatchIds:[],pendingOnlineMatches:[],recentResults:[]};
}
function count(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? Math.max(0,Math.min(1e9,Math.floor(value))) : 0; }
export function restoreRecord(raw: unknown): PlayerRecord {
  const v = raw && typeof raw === 'object' ? raw as Record<string,unknown> : {};
  const wins=count(v['wins']);
  const streak=Math.min(wins,count(v['currentStreak']));
  const ids=(value:unknown,limit:number) => Array.isArray(value) ? [...new Set(value.filter((x): x is string=>typeof x === 'string' && x.length>0 && x.length<=160))].slice(-limit) : [];
  const recentResults: MatchResult[] = Array.isArray(v['recentResults']) ? v['recentResults'].filter((r):r is MatchResult=>r && typeof r.id==='string' && ['WIN','LOSS','DRAW'].includes(r.outcome) && ['AI','ONLINE'].includes(r.mode) && Number.isFinite(r.rating) && Number.isFinite(r.delta) && Number.isFinite(r.at)).slice(-12) : [];
  return {elo:validRating(v['elo']),wins,losses:count(v['losses']),draws:count(v['draws']),currentStreak:streak,bestStreak:Math.min(wins,Math.max(streak,count(v['bestStreak']))),processedMatchIds:ids(v['processedMatchIds'],100),pendingOnlineMatches:ids(v['pendingOnlineMatches'],10),recentResults};
}
