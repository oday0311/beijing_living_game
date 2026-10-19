import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { modernContent } from './content/modern';
import { createGame } from './engine/create-game';
import { CURRENT_SAVE_KEY, BACKUP_SAVE_KEY, saveGame } from './persistence/storage';
import { classicState, event, memoryStorage } from './test/fixtures';
import { renderAppWithState } from './test/render-game';

describe('App', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('starts a classic session and restores it after mounting again', async () => {
    const user = userEvent.setup();
    const view = render(<App />);
    await user.type(screen.getByLabelText('角色姓名'), '小北');
    await user.click(screen.getByRole('button', { name: '开始游戏' }));
    expect(screen.getByRole('heading', { name: /小北的北京日程/ })).toBeInTheDocument();
    expect(window.localStorage.getItem(CURRENT_SAVE_KEY)).not.toBeNull();
    view.unmount();
    render(<App />);
    expect(screen.getByRole('button', { name: '继续游戏' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '继续游戏' }));
    expect(screen.getByRole('heading', { name: /小北的北京日程/ })).toBeInTheDocument();
  });

  it('keeps a damaged save until new game is explicitly confirmed', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(CURRENT_SAVE_KEY, '{broken');
    render(<App />);
    expect(screen.getByRole('button', { name: '恢复上一份有效存档' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '新开游戏' }));
    expect(window.localStorage.getItem(CURRENT_SAVE_KEY)).toBe('{broken');
    await user.click(screen.getByRole('button', { name: '确认新开' }));
    expect(window.localStorage.getItem(CURRENT_SAVE_KEY)).toBeNull();
    expect(screen.getByLabelText('角色姓名')).toHaveFocus();
  });

  it('restores the valid backup from a damaged current save', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    saveGame(classicState({ playerName: '旧档', day: 7 }), storage);
    window.localStorage.setItem(BACKUP_SAVE_KEY, storage.getItem(CURRENT_SAVE_KEY)!);
    window.localStorage.setItem(CURRENT_SAVE_KEY, '{broken');
    render(<App />);
    await user.click(screen.getByRole('button', { name: '恢复上一份有效存档' }));
    expect(screen.getByRole('heading', { name: /旧档的北京日程/ })).toBeInTheDocument();
  });

  it('focuses the new-game form after confirmed restart', async () => {
    const user = userEvent.setup();
    saveGame(classicState({ playerName: '旧档' }), window.localStorage);
    render(<StrictMode><App /></StrictMode>);
    await user.click(screen.getByRole('button', { name: '重新开始' }));
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    await user.click(screen.getByRole('button', { name: '确认重新开始' }));
    expect(screen.getByLabelText('角色姓名')).toHaveFocus();
    expect(focus.mock.instances.filter((element) => element instanceof HTMLElement && element.id === 'player-name')).toHaveLength(1);
    focus.mockRestore();
    await user.type(screen.getByLabelText('角色姓名'), '新档');
    await user.click(screen.getByRole('button', { name: '开始游戏' }));
    await user.click(screen.getByRole('button', { name: '返回入口' }));
    expect(screen.getByRole('button', { name: '继续游戏' })).toHaveFocus();
  });

  it('consumes focus after starting from a damaged save', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(CURRENT_SAVE_KEY, '{broken');
    render(<App />);
    await user.click(screen.getByRole('button', { name: '新开游戏' }));
    await user.click(screen.getByRole('button', { name: '确认新开' }));
    expect(screen.getByLabelText('角色姓名')).toHaveFocus();
    await user.type(screen.getByLabelText('角色姓名'), '新档');
    await user.click(screen.getByRole('button', { name: '开始游戏' }));
    await user.click(screen.getByRole('button', { name: '返回入口' }));
    expect(screen.getByRole('button', { name: '继续游戏' })).toHaveFocus();
  });

  it('focuses the entry once after settlement restart in StrictMode', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    const finished = classicState({ day: 40, status: 'won', finalScore: 100, cash: 100, debt: 0 });
    saveGame(finished, storage);
    render(<StrictMode><App storage={storage} initialState={finished} /></StrictMode>);
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    await user.click(within(screen.getByRole('dialog', { name: '本局结算' })).getByRole('button', { name: '重新开始' }));
    expect(screen.getByLabelText('角色姓名')).toHaveFocus();
    expect(focus.mock.instances.filter((element) => element instanceof HTMLElement && element.id === 'player-name')).toHaveLength(1);
  });

  it('restores settlement when continuing a finished game after returning to entry', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    const finished = classicState({ day: 40, status: 'won', finalScore: 100, cash: 100, debt: 0 });
    saveGame(finished, storage);
    render(<App storage={storage} initialState={finished} />);
    await user.click(within(screen.getByRole('dialog', { name: '本局结算' })).getByRole('button', { name: '返回入口' }));
    expect(screen.getByRole('button', { name: '继续游戏' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: '继续游戏' }));
    expect(screen.getByRole('dialog', { name: '本局结算' })).toBeInTheDocument();
  });

  it('resumes final-day event acknowledgements after reload before showing settlement', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    const finished = classicState({ day: 40, status: 'won', finalScore: 100, cash: 100, debt: 0,
      pendingEvents: [event('第一条消息'), { ...event('第二条消息'), id: 'second' }] });
    saveGame(finished, storage);
    const first = render(<App storage={storage} />);
    expect(screen.getByRole('button', { name: '继续游戏' })).toBeInTheDocument();
    first.unmount();
    render(<App storage={storage} />);
    await user.click(screen.getByRole('button', { name: '继续游戏' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('第一条消息');
    await user.click(screen.getByRole('button', { name: '知道了' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('第二条消息');
    await user.click(screen.getByRole('button', { name: '知道了' }));
    expect(screen.getByRole('dialog', { name: '本局结算' })).toHaveTextContent('100');
  });

  it('focuses the entry after settings reset but not after cancellation', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    const state = classicState();
    saveGame(state, storage);
    render(<StrictMode><App storage={storage} initialState={state} /></StrictMode>);
    await user.click(screen.getByRole('button', { name: '设置' }));
    const reset = screen.getByRole('button', { name: '重置本局' });
    reset.focus();
    await user.keyboard('{Enter}');
    await user.tab();
    expect(screen.getByRole('button', { name: '取消' })).toHaveFocus();
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    await user.keyboard('{Enter}');
    expect(reset).toHaveFocus();
    expect(focus.mock.instances.filter((element) => element === reset)).toHaveLength(1);
    expect(screen.getByRole('dialog', { name: '设置' })).toBeInTheDocument();
    await user.tab();
    expect(screen.getByRole('button', { name: '完成' })).toHaveFocus();
    expect(screen.queryByLabelText('角色姓名')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '重置本局' }));
    focus.mockClear();
    await user.click(screen.getByRole('button', { name: '确认重置' }));
    expect(screen.getByLabelText('角色姓名')).toHaveFocus();
    expect(focus.mock.instances.filter((element) => element instanceof HTMLElement && element.id === 'player-name')).toHaveLength(1);
  });

  it('links each tab to its panel and follows the keyboard tab pattern', async () => {
    const state = createGame(modernContent, { playerName: '小北', identityId: 'courier', seed: 1 });
    const { user } = renderAppWithState(state);
    const tabs = [
      screen.getByRole('tab', { name: '行情' }),
      screen.getByRole('tab', { name: '存货' }),
      screen.getByRole('tab', { name: '城市' }),
    ];
    for (const tab of tabs) {
      const panel = document.getElementById(tab.getAttribute('aria-controls')!);
      expect(tab.id).toBeTruthy();
      expect(panel).toHaveAttribute('role', 'tabpanel');
      expect(panel).toHaveAttribute('aria-labelledby', tab.id);
    }
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, -1, -1]);
    await user.click(tabs[0]);
    await user.keyboard('{ArrowRight}');
    expect(tabs[1]).toHaveFocus();
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'game-panel-inventory');
    await user.keyboard('{ArrowLeft}');
    expect(tabs[0]).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(tabs[2]).toHaveFocus();
    await user.keyboard('{Home}');
    expect(tabs[0]).toHaveFocus();
    await user.keyboard('{End}');
    expect(tabs[2]).toHaveFocus();
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([-1, -1, 0]);
  });
});
