import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { CURRENT_SAVE_KEY, BACKUP_SAVE_KEY, saveGame } from './persistence/storage';
import { classicState, memoryStorage } from './test/fixtures';

describe('App', () => {
  beforeEach(() => window.localStorage.clear());

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
    expect(screen.getByLabelText('角色姓名')).toBeInTheDocument();
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
});
