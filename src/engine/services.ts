import type { ContentPack } from '../content/contract';
import { failure, success } from './command-result';
import { borrowModern, recordRepayment } from './modern';
import type { CommandResult, GameCommand, GameState } from './types';

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
  if (pack.mode !== 'classic') {
    return failure(state, 'FEATURE_UNAVAILABLE', 'Modern treatment payments are not available yet.');
  }
  if (!validAmount(command.points)) {
    return failure(state, 'INVALID_QUANTITY', 'Treatment points must be a positive integer.');
  }
  const accountError = cashOnly(state, command.account);
  if (accountError) return accountError;
  const points = Math.min(command.points, 100 - state.health);
  if (points <= 0) {
    return failure(state, 'INVALID_QUANTITY', 'Health is already full.');
  }
  const cost = points * 3500;
  if (!Number.isSafeInteger(cost) || state.cash < cost) {
    return failure(state, 'INSUFFICIENT_FUNDS', 'Cash cannot cover this treatment.');
  }
  return success(state, { cash: state.cash - cost, health: state.health + points }, {
    title: 'Treatment', detail: `${points} health`, delta: { cash: -cost, health: points },
  });
}

export function upgradeHousing(state: GameState, command: HousingCommand, pack: ContentPack): CommandResult {
  if (pack.mode !== 'classic') {
    return failure(state, 'FEATURE_UNAVAILABLE', 'Modern housing payments are not available yet.');
  }
  const accountError = cashOnly(state, command.account);
  if (accountError) return accountError;
  if (state.capacity + 10 > 140) {
    return failure(state, 'CAPACITY_EXCEEDED', 'Housing is at maximum capacity.');
  }
  if (state.cash < 30_000) {
    return failure(state, 'INSUFFICIENT_FUNDS', 'Housing requires at least 30,000 cash.');
  }
  const remainingCash = state.cash - housingUpgradeCost(state.cash);
  return success(state, { cash: remainingCash, capacity: state.capacity + 10 }, {
    title: 'Housing upgrade', detail: `${state.capacity + 10} capacity`,
    delta: { cash: remainingCash - state.cash },
  });
}
