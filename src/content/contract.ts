import type { Account, GameEvent, GameState, Mode } from '../engine/types';

export interface GoodDefinition { id: string; name: string; category: string; basePrice: number; priceRange: number }
export interface LocationDefinition {
  id: string; name: string; lineIds: string[]; neighborIds: string[];
  acceptedAccounts: Account[];
  services: Array<'bank' | 'hospital' | 'housing'>;
  serviceAccounts?: Partial<Record<'hospital' | 'housing', Account[]>>;
  demand: Record<string, number>;
}
export interface IdentityDefinition {
  id: string; name: string; description: string;
  effect: { kind: 'transit' | 'trend-visibility' | 'capacity' | 'credit-growth'; value: number };
  eventWeights?: Partial<Record<'market' | 'health' | 'money' | 'identity', number>>;
}
export interface EffectDefinition {
  kind: string; target?: string; multiplier?: number; amount?: number;
  debtAmount?: number; duration?: number; maxBonus?: number;
  condition?: string; journalNotice?: string;
  secondary?: Omit<EffectDefinition, 'secondary'>;
}
export interface EventDefinition {
  id: string; kind: GameEvent['kind']; title: string; body: string; artId: string;
  frequency: number;
  effect: EffectDefinition;
}
export interface WeatherDefinition {
  id: string; name: string; aqiLabel: string; eventId: string;
  // Display-only projections of the linked event effect; apply eventId's effect once.
  healthEventWeight: number;
  categoryMultipliers: Record<string, number>;
}
export interface ContentPack {
  mode: Mode; daysTotal: 40;
  initial: Pick<GameState, 'cash' | 'bank' | 'wallet' | 'debt' | 'health' | 'fame' | 'credit' | 'capacity' | 'locationId'>;
  goods: GoodDefinition[]; locations: LocationDefinition[]; identities: IdentityDefinition[];
  weather: WeatherDefinition[];
  events: { market: EventDefinition[]; health: EventDefinition[]; money: EventDefinition[]; identity: EventDefinition[] };
}
