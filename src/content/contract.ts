import type { Account, GameEvent, GameState, Mode } from '../engine/types';

export interface GoodDefinition { id: string; name: string; category: string; basePrice: number; priceRange: number }
export interface LocationDefinition {
  id: string; name: string; lineIds: string[]; neighborIds: string[];
  acceptedAccounts: Account[];
  services: Array<'bank' | 'hospital' | 'housing'>;
  demand: Record<string, number>;
}
export interface IdentityDefinition {
  id: string; name: string; description: string;
  effect: { kind: 'transit' | 'trend-visibility' | 'capacity' | 'credit-growth'; value: number };
}
export interface EventDefinition {
  id: string; kind: GameEvent['kind']; title: string; body: string; artId: string;
  frequency: number;
  effect: { kind: string; target?: string; multiplier?: number; amount?: number; duration?: number };
}
export interface ContentPack {
  mode: Mode; daysTotal: 40;
  initial: Pick<GameState, 'cash' | 'bank' | 'wallet' | 'debt' | 'health' | 'fame' | 'credit' | 'capacity' | 'locationId'>;
  goods: GoodDefinition[]; locations: LocationDefinition[]; identities: IdentityDefinition[];
  weather: EventDefinition[];
  events: { market: EventDefinition[]; health: EventDefinition[]; money: EventDefinition[]; identity: EventDefinition[] };
}
