import { z } from 'zod';
import type { GameState } from '../engine/types';

const finite = z.number().finite();
const integer = z.number().int().finite();
const nonnegativeInteger = integer.min(0);
const nullableInteger = integer.nullable();

const trendSchema = z.strictObject({
  id: z.string(), category: z.string(), multiplier: finite, daysLeft: nonnegativeInteger, reason: z.string(),
});

const forecastSchema = z.strictObject({ day: integer, trends: z.array(trendSchema) });

const eventSchema = z.strictObject({
  id: z.string(),
  kind: z.enum(['market', 'health', 'money', 'weather', 'identity', 'system']),
  title: z.string(), body: z.string(), artId: z.string(),
});

const deltaSchema = z.strictObject({
  cash: finite.optional(), bank: finite.optional(), wallet: finite.optional(), debt: finite.optional(),
  health: finite.optional(), fame: finite.optional(), credit: finite.optional(), capacity: finite.optional(),
  walletFrozenDays: finite.optional(), onTimeRepayments: finite.optional(),
});

const journalSchema = z.strictObject({
  id: z.string(), day: integer, title: z.string(), detail: z.string(), delta: deltaSchema.optional(),
});

const modernSchema = z.strictObject({
  onTimeRepayments: nonnegativeInteger,
  dailyWalletTransferred: nonnegativeInteger,
  shopkeeperCapacityBonus: nonnegativeInteger,
  freeTransitUses: nonnegativeInteger,
  revealTrendDaysBonus: nonnegativeInteger,
  revealAllThroughDay: nullableInteger,
  forecastMarketEvents: z.array(forecastSchema),
  visibleTrendForecast: z.array(forecastSchema),
  repaymentDueDay: nullableInteger,
  repaymentDueAmount: nonnegativeInteger,
  repaidTowardDue: nonnegativeInteger,
  lastQualifiedRepaymentDay: nullableInteger,
  pendingQualifiedRepayment: z.boolean(),
  graduateGrowthDay: nullableInteger,
  overduePenalties: nonnegativeInteger,
});

export const gameStateSchema: z.ZodType<GameState> = z.strictObject({
  schemaVersion: z.literal(1),
  mode: z.enum(['classic', 'modern']),
  playerName: z.string(),
  seed: integer,
  rngState: nonnegativeInteger.max(0xffffffff),
  day: integer.min(1).max(40),
  daysTotal: z.literal(40),
  locationId: z.string().nullable(),
  cash: finite, bank: finite, wallet: finite, debt: finite,
  health: finite, fame: finite,
  credit: z.enum(['D', 'C', 'B', 'A', 'S']),
  capacity: finite,
  inventory: z.record(z.string(), z.strictObject({ quantity: nonnegativeInteger, averageCost: finite })),
  market: z.record(z.string(), finite),
  weatherId: z.string().nullable(),
  trends: z.array(trendSchema),
  identityId: z.string().nullable(),
  walletFrozenDays: nonnegativeInteger,
  modern: modernSchema.nullable(),
  pendingEvents: z.array(eventSchema),
  journal: z.array(journalSchema),
  status: z.enum(['playing', 'won', 'lost']),
  finalScore: finite.nullable(),
}).superRefine((state, context) => {
  if ((state.mode === 'modern') !== (state.modern !== null)) {
    context.addIssue({ code: 'custom', path: ['modern'], message: 'Mode and modern state do not match' });
  }
});

export const settingsSchema = z.strictObject({
  soundEnabled: z.boolean(),
  animationsEnabled: z.boolean(),
  compactDisplay: z.boolean(),
});

export type GameSettings = z.infer<typeof settingsSchema>;

export const defaultSettings: GameSettings = {
  soundEnabled: true,
  animationsEnabled: true,
  compactDisplay: false,
};

export const scoreSchema = z.strictObject({
  id: z.string().min(1),
  playerName: z.string(),
  mode: z.enum(['classic', 'modern']),
  score: finite,
  health: finite,
  fame: finite,
  finishedAt: z.string().datetime(),
});

export type ScoreEntry = z.infer<typeof scoreSchema>;
