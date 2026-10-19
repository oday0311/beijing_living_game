import type { ContentPack } from '../content/contract';
import { failure } from './command-result';
import { acknowledgeEvent, travel } from './day-cycle';
import { SeededRng } from './rng';
import { borrow, heal, repayDebt, upgradeHousing } from './services';
import { buy, sell, transfer } from './transactions';
import type { CommandResult, GameCommand, GameState } from './types';

export function reduceGameState(state: GameState, command: GameCommand, pack: ContentPack): CommandResult {
  if (command.type === 'ACK_EVENT') return { ok: true, state: acknowledgeEvent(state) };
  if (state.status !== 'playing') return failure(state, 'GAME_ENDED', 'The game has ended.');

  switch (command.type) {
    case 'BUY': return buy(state, command, pack);
    case 'SELL': return sell(state, command, pack);
    case 'TRANSFER': return transfer(state, command);
    case 'REPAY_DEBT': return repayDebt(state, command, pack);
    case 'BORROW': return borrow(state, command, pack);
    case 'HEAL': return heal(state, command, pack);
    case 'UPGRADE_HOUSING': return upgradeHousing(state, command, pack);
    case 'TRAVEL': return travel(state, command.targetId, pack, new SeededRng(state.rngState));
  }
}
