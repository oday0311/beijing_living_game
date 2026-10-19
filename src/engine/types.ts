export type Mode = 'classic' | 'modern';
export type Account = 'cash' | 'bank' | 'wallet';
export type CreditTier = 'D' | 'C' | 'B' | 'A' | 'S';

export interface InventoryLot { quantity: number; averageCost: number }
export interface Trend { id: string; category: string; multiplier: number; daysLeft: number; reason: string }
export interface TrendForecast { day: number; trends: Trend[] }
export interface GameEvent { id: string; kind: 'market' | 'health' | 'money' | 'weather' | 'identity' | 'system'; title: string; body: string; artId: string }
export interface JournalEntry { id: string; day: number; title: string; detail: string; delta?: Partial<Record<Account | 'debt' | 'health' | 'fame' | 'credit' | 'capacity' | 'walletFrozenDays' | 'onTimeRepayments', number>> }

export interface GameState {
  schemaVersion: 1;
  mode: Mode;
  playerName: string;
  seed: number;
  rngState: number;
  day: number;
  daysTotal: 40;
  locationId: string | null;
  cash: number;
  bank: number;
  wallet: number;
  debt: number;
  health: number;
  fame: number;
  credit: CreditTier;
  capacity: number;
  inventory: Record<string, InventoryLot>;
  market: Record<string, number>;
  weatherId: string | null;
  trends: Trend[];
  identityId: string | null;
  walletFrozenDays: number;
  modern: {
    onTimeRepayments: number;
    dailyWalletTransferred: number;
    shopkeeperCapacityBonus: number;
    freeTransitUses: number;
    revealTrendDaysBonus: number;
    revealAllThroughDay: number | null;
    forecastMarketEvents: TrendForecast[];
    visibleTrendForecast: TrendForecast[];
    repaymentDueDay: number | null;
    repaymentDueAmount: number;
    repaidTowardDue: number;
    lastQualifiedRepaymentDay: number | null;
    pendingQualifiedRepayment: boolean;
    graduateGrowthDay: number | null;
    overduePenalties: number;
  } | null;
  pendingEvents: GameEvent[];
  journal: JournalEntry[];
  status: 'playing' | 'won' | 'lost';
  finalScore: number | null;
}

export interface RandomSource { readonly state: number; int(maxExclusive: number): number }

export type GameCommand =
  | { type: 'BUY'; itemId: string; quantity: number; account: Account }
  | { type: 'SELL'; itemId: string; quantity: number; account: Account }
  | { type: 'TRANSFER'; from: Account; to: Account; amount: number }
  | { type: 'REPAY_DEBT'; amount: number; account: Account }
  | { type: 'BORROW'; amount: number }
  | { type: 'HEAL'; points: number; account: Account }
  | { type: 'UPGRADE_HOUSING'; account: Account }
  | { type: 'TRAVEL'; targetId: string }
  | { type: 'ACK_EVENT' };

export type EngineErrorCode =
  | 'INVALID_QUANTITY' | 'ITEM_UNAVAILABLE' | 'INSUFFICIENT_FUNDS'
  | 'CAPACITY_EXCEEDED' | 'INSUFFICIENT_INVENTORY' | 'ACCOUNT_UNSUPPORTED'
  | 'WALLET_FROZEN' | 'TRANSFER_LIMIT' | 'CREDIT_LIMIT'
  | 'SAME_LOCATION' | 'UNKNOWN_LOCATION' | 'EVENT_PENDING' | 'FEATURE_UNAVAILABLE' | 'GAME_ENDED';

export type CommandResult =
  | { ok: true; state: GameState }
  | { ok: false; state: GameState; error: { code: EngineErrorCode; message: string } };
