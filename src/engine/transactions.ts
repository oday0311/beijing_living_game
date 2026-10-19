import type { ContentPack } from '../content/contract';
import { failure, success } from './command-result';
import type { Account, CommandResult, GameCommand, GameState } from './types';

type BuyCommand = Omit<Extract<GameCommand, { type: 'BUY' }>, 'type'>;
type SellCommand = Omit<Extract<GameCommand, { type: 'SELL' }>, 'type'>;
type TransferCommand = Omit<Extract<GameCommand, { type: 'TRANSFER' }>, 'type'>;

const accounts: Account[] = ['cash', 'bank', 'wallet'];

function isAccount(value: string): value is Account {
  return accounts.includes(value as Account);
}

function validAmount(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function marketTradeError(state: GameState, itemId: string, account: Account, pack: ContentPack): CommandResult | null {
  if (!pack.goods.some((good) => good.id === itemId) || !validAmount(state.market[itemId])) {
    return failure(state, 'ITEM_UNAVAILABLE', 'This item is not listed in the current market.');
  }
  const location = pack.locations.find((place) => place.id === state.locationId);
  if (!isAccount(account) || !location?.acceptedAccounts.includes(account)) {
    return failure(state, 'ACCOUNT_UNSUPPORTED', 'This payment account is not accepted here.');
  }
  return null;
}

export function buy(state: GameState, command: BuyCommand, pack: ContentPack): CommandResult {
  if (!validAmount(command.quantity)) {
    return failure(state, 'INVALID_QUANTITY', 'Purchase quantity must be a positive integer.');
  }
  const tradeError = marketTradeError(state, command.itemId, command.account, pack);
  if (tradeError) return tradeError;

  const price = state.market[command.itemId];
  const cost = price * command.quantity;
  if (!Number.isSafeInteger(cost) || state[command.account] < cost) {
    return failure(state, 'INSUFFICIENT_FUNDS', 'The account cannot cover this purchase.');
  }
  const occupied = Object.values(state.inventory).reduce((sum, lot) => sum + lot.quantity, 0);
  if (occupied + command.quantity > state.capacity) {
    return failure(state, 'CAPACITY_EXCEEDED', 'There is not enough storage space.');
  }

  const oldLot = state.inventory[command.itemId];
  const quantity = (oldLot?.quantity ?? 0) + command.quantity;
  const averageCost = Math.trunc(((oldLot?.averageCost ?? 0) * (oldLot?.quantity ?? 0) + cost) / quantity);
  return success(state, {
    [command.account]: state[command.account] - cost,
    inventory: { ...state.inventory, [command.itemId]: { quantity, averageCost } },
  }, {
    title: 'Purchase', detail: `${command.quantity} ${command.itemId}`,
    delta: { [command.account]: -cost },
  });
}

export function sell(state: GameState, command: SellCommand, pack: ContentPack): CommandResult {
  if (!validAmount(command.quantity)) {
    return failure(state, 'INVALID_QUANTITY', 'Sale quantity must be a positive integer.');
  }
  const tradeError = marketTradeError(state, command.itemId, command.account, pack);
  if (tradeError) return tradeError;

  const lot = state.inventory[command.itemId];
  if (!lot || lot.quantity < command.quantity) {
    return failure(state, 'INSUFFICIENT_INVENTORY', 'There are not enough goods to sell.');
  }
  const proceeds = state.market[command.itemId] * command.quantity;
  if (!Number.isSafeInteger(proceeds) || !Number.isSafeInteger(state[command.account] + proceeds)) {
    return failure(state, 'INVALID_QUANTITY', 'Sale total exceeds supported integer range.');
  }
  const inventory = { ...state.inventory };
  if (lot.quantity === command.quantity) delete inventory[command.itemId];
  else inventory[command.itemId] = { ...lot, quantity: lot.quantity - command.quantity };
  return success(state, {
    [command.account]: state[command.account] + proceeds,
    inventory,
  }, {
    title: 'Sale', detail: `${command.quantity} ${command.itemId}`,
    delta: { [command.account]: proceeds },
  });
}

export function transfer(state: GameState, command: TransferCommand): CommandResult {
  if (!validAmount(command.amount)) {
    return failure(state, 'INVALID_QUANTITY', 'Transfer amount must be a positive integer.');
  }
  if (!isAccount(command.from) || !isAccount(command.to) || command.from === command.to) {
    return failure(state, 'ACCOUNT_UNSUPPORTED', 'Choose two distinct accounts.');
  }
  if (state.mode === 'classic' && (command.from === 'wallet' || command.to === 'wallet')) {
    return failure(state, 'ACCOUNT_UNSUPPORTED', 'Classic transfers only support cash and bank.');
  }
  if (state[command.from] < command.amount) {
    return failure(state, 'INSUFFICIENT_FUNDS', 'The source account cannot cover this transfer.');
  }
  if (!Number.isSafeInteger(state[command.to] + command.amount)) {
    return failure(state, 'INVALID_QUANTITY', 'Transfer total exceeds supported integer range.');
  }
  return success(state, {
    [command.from]: state[command.from] - command.amount,
    [command.to]: state[command.to] + command.amount,
  }, {
    title: 'Transfer', detail: `${command.from} to ${command.to}`,
    delta: { [command.from]: -command.amount, [command.to]: command.amount },
  });
}
