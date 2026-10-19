import type { ContentPack } from '../content/contract';
import { failure, success } from './command-result';
import { borrowModern, recordRepayment } from './modern';
import type { Account, CommandResult, GameCommand, GameState } from './types';

type RepayCommand = Omit<Extract<GameCommand, { type: 'REPAY_DEBT' }>, 'type'>;
type BorrowCommand = Omit<Extract<GameCommand, { type: 'BORROW' }>, 'type'>;
type HealCommand = Omit<Extract<GameCommand, { type: 'HEAL' }>, 'type'>;
type HousingCommand = Omit<Extract<GameCommand, { type: 'UPGRADE_HOUSING' }>, 'type'>;

function validAmount(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function cashOnly(state: GameState, account: string): CommandResult | null {
  return account === 'cash' ? null : failure(state, 'ACCOUNT_UNSUPPORTED', 'This service accepts cash only.');
}

export function housingUpgradeCost(cash: number): number {
  const remainingCash = cash === 30_000 ? 5_000 : Math.trunc(cash / 2) - 2_000;
  return cash - remainingCash;
}

export interface ServiceQuote { cost: number; points?: number; capacity?: number; accounts: Account[] }

export function quoteService(state: GameState, kind: 'heal' | 'housing', requestedPoints: number, pack: ContentPack): ServiceQuote | null {
  const location = pack.locations.find(({ id }) => id === state.locationId);
  if (pack.mode === 'modern' && !location?.services.includes(kind === 'heal' ? 'hospital' : 'housing')) return null;
  const accounts: Account[] = pack.mode === 'classic' ? ['cash'] : location?.serviceAccounts?.[kind === 'heal' ? 'hospital' : 'housing'] ?? [];
  if (kind === 'heal') {
    if (!validAmount(requestedPoints)) return null;
    const points = Math.min(requestedPoints, 100 - state.health);
    if (points <= 0) return null;
    return { cost: points * 3500, points, accounts };
  }
  if (state.capacity + 10 > 140) return null;
  return { cost: pack.mode === 'classic' ? housingUpgradeCost(state.cash) : 5000,
    capacity: state.capacity + 10, accounts };
}

export function repayDebt(state: GameState, command: RepayCommand, pack: ContentPack): CommandResult {
  if (!validAmount(command.amount)) {
    return failure(state, 'INVALID_QUANTITY', 'Repayment must be a positive integer.');
  }
  if (pack.mode === 'classic') {
    const accountError = cashOnly(state, command.account);
    if (accountError) return accountError;
  } else if (!['cash', 'bank', 'wallet'].includes(command.account)) {
    return failure(state, 'ACCOUNT_UNSUPPORTED', 'Unknown payment account.');
  }
  if (command.account === 'wallet' && state.walletFrozenDays > 0) {
    return failure(state, 'WALLET_FROZEN', 'Wallet spending is temporarily frozen.');
  }
  if (command.amount > state.debt) {
    return failure(state, 'INVALID_QUANTITY', 'Repayment cannot exceed debt.');
  }
  if (command.amount > state[command.account]) {
    return failure(state, 'INSUFFICIENT_FUNDS', 'Account cannot cover this repayment.');
  }
  const repaid = pack.mode === 'modern' ? recordRepayment(state, command.amount, state.debt - command.amount) : state;
  const tiers = ['D', 'C', 'B', 'A', 'S'];
  const creditChange = tiers.indexOf(repaid.credit) - tiers.indexOf(state.credit);
  return success(state, { [command.account]: state[command.account] - command.amount, debt: state.debt - command.amount,
    credit: repaid.credit, modern: repaid.modern }, {
    title: 'Debt repayment', detail: `${command.amount}`,
    delta: { [command.account]: -command.amount, debt: -command.amount,
      ...(creditChange ? { credit: creditChange } : {}) },
  });
}

export function borrow(state: GameState, command: BorrowCommand, pack: ContentPack): CommandResult {
  if (pack.mode === 'modern') return borrowModern(state, command.amount);
  return failure(state, 'FEATURE_UNAVAILABLE', `Borrowing ${command.amount} is not available in ${pack.mode} mode.`);
}

export function heal(state: GameState, command: HealCommand, pack: ContentPack): CommandResult {
  if (pack.mode === 'modern' && !pack.locations.find(({ id }) => id === state.locationId)?.services.includes('hospital'))
    return failure(state, 'FEATURE_UNAVAILABLE', 'No hospital is available at this station.');
  if (!validAmount(command.points)) {
    return failure(state, 'INVALID_QUANTITY', 'Treatment points must be a positive integer.');
  }
  if (pack.mode === 'classic') {
    const accountError = cashOnly(state, command.account);
    if (accountError) return accountError;
  }
  const quote = quoteService(state, 'heal', command.points, pack);
  if (!quote) {
    return failure(state, 'INVALID_QUANTITY', 'Health is already full.');
  }
  if (!quote.accounts.includes(command.account)) return failure(state, 'ACCOUNT_UNSUPPORTED', 'Account not accepted here.');
  if (command.account === 'wallet' && state.walletFrozenDays > 0)
    return failure(state, 'WALLET_FROZEN', 'Wallet spending is temporarily frozen.');
  if (!Number.isSafeInteger(quote.cost) || state[command.account] < quote.cost) {
    return failure(state, 'INSUFFICIENT_FUNDS', 'Account cannot cover this treatment.');
  }
  return success(state, { [command.account]: state[command.account] - quote.cost, health: state.health + quote.points! }, {
    title: '医院治疗', detail: `健康增加 ${quote.points} 点，费用 ${quote.cost} 元`, delta: { [command.account]: -quote.cost, health: quote.points },
  });
}

export function upgradeHousing(state: GameState, command: HousingCommand, pack: ContentPack): CommandResult {
  if (pack.mode === 'modern' && !pack.locations.find(({ id }) => id === state.locationId)?.services.includes('housing'))
    return failure(state, 'FEATURE_UNAVAILABLE', 'No housing service is available at this station.');
  if (pack.mode === 'classic') {
    const accountError = cashOnly(state, command.account);
    if (accountError) return accountError;
  }
  if (state.capacity + 10 > 140) {
    return failure(state, 'CAPACITY_EXCEEDED', 'Housing is at maximum capacity.');
  }
  if (pack.mode === 'classic' && state.cash < 30_000) {
    return failure(state, 'INSUFFICIENT_FUNDS', 'Housing requires at least 30,000 cash.');
  }
  const quote = quoteService(state, 'housing', 0, pack)!;
  if (!quote.accounts.includes(command.account)) return failure(state, 'ACCOUNT_UNSUPPORTED', 'Account not accepted here.');
  if (command.account === 'wallet' && state.walletFrozenDays > 0)
    return failure(state, 'WALLET_FROZEN', 'Wallet spending is temporarily frozen.');
  if (state[command.account] < quote.cost) return failure(state, 'INSUFFICIENT_FUNDS', 'Account cannot cover this upgrade.');
  return success(state, { [command.account]: state[command.account] - quote.cost, capacity: quote.capacity! }, {
    title: '住房扩容', detail: `容量增加至 ${quote.capacity} 格，费用 ${quote.cost} 元`,
    delta: { [command.account]: -quote.cost, capacity: 10 },
  });
}
