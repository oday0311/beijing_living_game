import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { classicState, memoryStorage } from '../test/fixtures';
import { renderAppWithState, renderGame } from '../test/render-game';
import { AppContent } from '../App';
import { loadSettings, recordScore } from '../persistence/storage';

afterEach(cleanup);

describe('auxiliary views', () => {
  it('persists sound and motion preferences', async () => {
    const { user, storage } = renderAppWithState(classicState());
    await user.click(screen.getByRole('button', { name: '设置' }));
    const dialog = screen.getByRole('dialog', { name: '设置' });
    await user.click(within(dialog).getByRole('checkbox', { name: '音效' }));
    await user.click(within(dialog).getByRole('checkbox', { name: '动态效果' }));
    expect(loadSettings(storage)).toMatchObject({ soundEnabled: false, animationsEnabled: false });
  });

  it('shows separate ranked lists for both modes', async () => {
    const storage = memoryStorage();
    recordScore({ id: 'classic:1', playerName: '老城', mode: 'classic', score: 1200,
      health: 80, fame: 3, finishedAt: '2026-10-19T00:00:00.000Z' }, storage);
    recordScore({ id: 'modern:1', playerName: '新城', mode: 'modern', score: 1300,
      health: 90, fame: 5, finishedAt: '2026-10-19T00:00:00.000Z' }, storage);
    const { user } = renderGame(classicState(), <AppContent storage={storage} />, storage);
    await user.click(screen.getByRole('button', { name: '排行榜' }));
    expect(screen.getByText('老城')).toBeInTheDocument();
    expect(screen.queryByText('新城')).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: '新北京模式' }));
    expect(screen.getByText('新城')).toBeInTheDocument();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByText('老城')).toBeInTheDocument();
  });

  it('shows settlement, score calculation and attribution', async () => {
    const { user } = renderAppWithState(classicState({ day: 40, status: 'won', finalScore: 123456,
      cash: 120000, bank: 4000, debt: 544 }));
    const settlement = screen.getByRole('dialog', { name: '本局结算' });
    expect(settlement).toHaveTextContent('123,456');
    expect(settlement).toHaveTextContent('现金 + 银行存款 + 电子余额 - 债务');
    await user.click(within(settlement).getByRole('button', { name: '返回入口' }));
    await user.click(screen.getByRole('button', { name: '关于' }));
    expect(screen.getByText(/郭祥昊/)).toBeInTheDocument();
    expect(screen.getByText(/GNU General Public License v2/)).toBeInTheDocument();
  });

  it('offers rules and local-save help from the game', async () => {
    const { user } = renderAppWithState(classicState());
    await user.click(screen.getByRole('button', { name: '帮助' }));
    expect(screen.getByRole('dialog', { name: '游戏帮助' })).toHaveTextContent('40 天');
    expect(screen.getByRole('dialog', { name: '游戏帮助' })).toHaveTextContent('自动保存');
  });
});
