import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { memoryStorage, modernState } from '../test/fixtures';
import { renderAppWithState } from '../test/render-game';
import { playCue } from '../audio/sounds';
import { GameProvider } from '../game/GameProvider';
import { AppContent } from '../App';

vi.mock('../audio/sounds', () => ({ playCue: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('does not play a travel cue when the fare cannot be paid', async () => {
  const { user } = renderAppWithState(modernState({ locationId: 'xizhimen', cash: 0 }));
  await user.click(screen.getByRole('tab', { name: '城市' }));
  await user.click(screen.getByRole('button', { name: '国贸' }));
  await user.click(screen.getByRole('button', { name: '确认换站' }));
  expect(screen.getByText(/第 1 \/ 40 天/)).toBeInTheDocument();
  expect(playCue).not.toHaveBeenCalledWith('travel', true);
});

it('plays a travel cue after a successful move', async () => {
  const { user } = renderAppWithState(modernState({ locationId: 'xizhimen', cash: 1000 }));
  await user.click(screen.getByRole('tab', { name: '城市' }));
  await user.click(screen.getByRole('button', { name: '国贸' }));
  await user.click(screen.getByRole('button', { name: '确认换站' }));
  expect(playCue).toHaveBeenCalledWith('travel', true);
});

it('does not play buy or sell cues when the engine rejects the command', async () => {
  const { user } = renderAppWithState(modernState({
    locationId: 'xizhimen', cash: 1000, wallet: Number.MAX_SAFE_INTEGER, walletFrozenDays: 1,
    market: { 'power-bank': 100 }, inventory: { 'power-bank': { quantity: 1, averageCost: 80 } },
  }));
  await user.click(screen.getByRole('button', { name: '买进' }));
  await user.selectOptions(screen.getByLabelText('支付账户'), 'wallet');
  await user.click(screen.getByRole('button', { name: '确认买进' }));
  expect(playCue).not.toHaveBeenCalledWith('buy', true);
  await user.click(screen.getByRole('button', { name: '卖出' }));
  await user.selectOptions(screen.getByLabelText('到账账户'), 'wallet');
  await user.click(screen.getByRole('button', { name: '确认卖出' }));
  expect(playCue).not.toHaveBeenCalledWith('sell', true);
});

it('plays buy and sell cues only after successful trades', async () => {
  const { user } = renderAppWithState(modernState({
    locationId: 'xizhimen', cash: 1000, market: { 'power-bank': 100 },
  }));
  await user.click(screen.getByRole('button', { name: '买进' }));
  await user.click(screen.getByRole('button', { name: '确认买进' }));
  expect(playCue).toHaveBeenCalledWith('buy', true);
  await user.click(screen.getByRole('button', { name: '卖出' }));
  await user.click(screen.getByRole('button', { name: '确认卖出' }));
  expect(playCue).toHaveBeenCalledWith('sell', true);
});

it('applies trades and travel in memory without playing persisted-success cues', async () => {
  const storage = memoryStorage();
  storage.getItem = () => { throw new Error('blocked'); };
  storage.setItem = () => { throw new Error('blocked'); };
  const user = userEvent.setup();
  render(<GameProvider storage={storage} initialState={modernState({
    locationId: 'xizhimen', cash: 1000, market: { 'power-bank': 100 },
  })}><AppContent storage={storage} /></GameProvider>);

  await user.click(screen.getByRole('button', { name: '买进' }));
  await user.click(screen.getByRole('button', { name: '确认买进' }));
  expect(screen.getByRole('button', { name: '卖出' })).toBeEnabled();
  expect(playCue).not.toHaveBeenCalledWith('buy', true);

  await user.click(screen.getByRole('button', { name: '卖出' }));
  await user.click(screen.getByRole('button', { name: '确认卖出' }));
  expect(playCue).not.toHaveBeenCalledWith('sell', true);

  await user.click(screen.getByRole('tab', { name: '城市' }));
  await user.click(screen.getByRole('button', { name: '国贸' }));
  await user.click(screen.getByRole('button', { name: '确认换站' }));
  expect(screen.getByText(/第 2 \/ 40 天/)).toBeInTheDocument();
  expect(playCue).not.toHaveBeenCalledWith('travel', true);
});
