import { useCallback, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { classicContent } from '../content/classic';
import { modernContent } from '../content/modern';
import { createGame } from '../engine/create-game';
import { reduceGameState } from '../engine/reducer';
import type { EngineErrorCode, GameCommand, GameState } from '../engine/types';
import { clearCurrentGame, loadGame, recordScore, restoreBackup, saveGame } from '../persistence/storage';
import type { LoadGameResult } from '../persistence/storage';
import { GameContext } from './useGame';
import type { DispatchResult, StartGameOptions } from './useGame';

const commandErrors: Record<EngineErrorCode, string> = {
  INVALID_QUANTITY: '请输入有效数量。', ITEM_UNAVAILABLE: '当前站点没有这件商品。',
  INSUFFICIENT_FUNDS: '账户余额不足。', CAPACITY_EXCEEDED: '货架空间不足。',
  INSUFFICIENT_INVENTORY: '库存不足。', ACCOUNT_UNSUPPORTED: '此处不支持该支付方式。',
  WALLET_FROZEN: '电子钱包暂时冻结。', TRANSFER_LIMIT: '已达到今日转账上限。',
  CREDIT_LIMIT: '已达到借款上限。', SAME_LOCATION: '请选择另一个站点。',
  UNKNOWN_LOCATION: '无法到达该站点。', EVENT_PENDING: '请先确认当前事件。',
  FEATURE_UNAVAILABLE: '当前模式不支持这项操作。', GAME_ENDED: '这局游戏已经结束。',
};

function nextSeed(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    return crypto.getRandomValues(new Uint32Array(1))[0];
  }
  return Date.now() >>> 0;
}

interface GameProviderProps {
  children: ReactNode;
  storage?: Storage;
  initialState?: GameState | null;
}

export function GameProvider({ children, storage, initialState = null }: GameProviderProps) {
  const [loadResult, setLoadResult] = useState<LoadGameResult>(() => loadGame(storage));
  const [storageAvailable] = useState(loadResult.kind !== 'unavailable');
  const [state, setState] = useState<GameState | null>(initialState);
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef<GameState | null>(initialState);
  const loadRef = useRef(loadResult);

  const updateLoad = useCallback((result: LoadGameResult) => {
    loadRef.current = result;
    setLoadResult(result);
  }, []);

  const updateState = useCallback((next: GameState | null) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const persist = useCallback((next: GameState): boolean => {
    if (!storageAvailable) return true;
    try {
      saveGame(next, storage);
      return true;
    } catch {
      setError('保存失败，操作未生效。请检查浏览器存储空间后重试。');
      return false;
    }
  }, [storage, storageAvailable]);

  const dispatch = useCallback((command: GameCommand): DispatchResult => {
    const current = stateRef.current;
    if (!current) return { applied: false, persisted: false };
    const pack = current.mode === 'classic' ? classicContent : modernContent;
    const result = reduceGameState(current, command, pack);
    if (!result.ok) {
      setError(commandErrors[result.error.code]);
      return { applied: false, persisted: false };
    }
    if (result.state === current) return { applied: false, persisted: false };
    const persisted = storageAvailable ? persist(result.state) : false;
    if (storageAvailable && !persisted) return { applied: false, persisted: false };
    updateState(result.state);
    updateLoad({ kind: 'ok', state: result.state });
    setError(null);
    if (storageAvailable && result.state.day === result.state.daysTotal && result.state.finalScore !== null) {
      try {
        const finishedAt = new Date().toISOString();
        recordScore({
          id: `${result.state.mode}:${result.state.seed}:${result.state.playerName}`,
          playerName: result.state.playerName,
          mode: result.state.mode,
          score: result.state.finalScore,
          health: result.state.health,
          fame: result.state.fame,
          finishedAt,
        }, storage);
        clearCurrentGame(storage);
        updateLoad({ kind: 'empty' });
      } catch {
        setError('成绩或存档清理失败，本局已保留。');
      }
    }
    return { applied: true, persisted };
  }, [persist, storage, storageAvailable, updateLoad, updateState]);

  const startGame = useCallback((options: StartGameOptions) => {
    if (loadRef.current.kind !== 'empty' && loadRef.current.kind !== 'unavailable') {
      setError('请先确认重新开始，原存档才会被替换。');
      return;
    }
    const pack = options.mode === 'classic' ? classicContent : modernContent;
    const playerName = options.playerName.trim();
    if (!playerName || (options.mode === 'modern' && !pack.identities.some(({ id }) => id === options.identityId))) {
      setError('请填写角色姓名并选择有效身份。');
      return;
    }
    const next = createGame(pack, {
      playerName, identityId: options.mode === 'classic' ? null : options.identityId, seed: nextSeed(),
    });
    if (!persist(next)) return;
    updateState(next);
    updateLoad({ kind: 'ok', state: next });
    setError(null);
  }, [persist, updateLoad, updateState]);

  const continueGame = useCallback(() => {
    if (loadRef.current.kind !== 'ok') return;
    updateState(loadRef.current.state);
    setError(null);
  }, [updateState]);

  const restoreSavedGame = useCallback(() => {
    const restored = restoreBackup(storage);
    if (!restored) {
      setError('没有可恢复的有效备份。');
      return;
    }
    updateLoad({ kind: 'ok', state: restored });
    updateState(restored);
    setError(null);
  }, [storage, updateLoad, updateState]);

  const abandonGame = useCallback(() => {
    if (storageAvailable) {
      try {
        clearCurrentGame(storage);
      } catch {
        setError('无法清除当前存档，请检查浏览器存储权限。');
        return;
      }
    }
    updateState(null);
    updateLoad(storageAvailable ? { kind: 'empty' } : { kind: 'unavailable' });
    setError(null);
  }, [storage, storageAvailable, updateLoad, updateState]);

  const returnToStart = useCallback(() => {
    const current = stateRef.current;
    updateState(null);
    if (loadRef.current.kind !== 'unavailable' && current?.status === 'playing') {
      updateLoad({ kind: 'ok', state: current });
    }
  }, [updateLoad, updateState]);

  return <GameContext.Provider value={{
    state, loadResult, storageAvailable, error, dispatch, startGame, continueGame, restoreSavedGame,
    abandonGame, returnToStart, clearError: () => setError(null),
  }}>{children}</GameContext.Provider>;
}
