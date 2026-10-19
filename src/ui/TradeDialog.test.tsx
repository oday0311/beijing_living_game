import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { modernState } from '../test/fixtures';
import { renderAppWithState } from '../test/render-game';

afterEach(cleanup);

describe('TradeDialog', () => {
  it('buys the selected quantity and reports engine errors without changing state', async () => {
    const { user } = renderAppWithState(modernState({ locationId: 'xizhimen', cash: 500, bank: 0, wallet: 0, market: { 'power-bank': 100 } }));
    await user.click(screen.getByRole('row', { name: /充电宝/ }));
    await user.click(screen.getByRole('button', { name: '买进' }));
    await user.clear(screen.getByLabelText('数量'));
    await user.type(screen.getByLabelText('数量'), '6');
    await user.click(screen.getByRole('button', { name: '确认买进' }));
    await user.click(screen.getByRole('button', { name: '继续支出' }));
    expect(screen.getByRole('alert')).toHaveTextContent('余额不足');
    expect(screen.getByText('¥500')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: '存货' }));
    expect(screen.queryByRole('row', { name: /充电宝.*6 件/ })).not.toBeInTheDocument();
  });

  it('sells stock into the selected account', async () => {
    const { user } = renderAppWithState(modernState({ locationId: 'xizhimen', cash: 100, bank: 0, market: { 'power-bank': 100 }, inventory: { 'power-bank': { quantity: 3, averageCost: 80 } } }));
    await user.click(screen.getByRole('row', { name: /充电宝/ }));
    await user.click(screen.getByRole('button', { name: '卖出' }));
    await user.clear(screen.getByLabelText('数量'));
    await user.type(screen.getByLabelText('数量'), '2');
    await user.selectOptions(screen.getByLabelText('到账账户'), 'bank');
    await user.click(screen.getByRole('button', { name: '确认卖出' }));
    expect(screen.getByText('¥200')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: '存货' }));
    expect(screen.getByRole('table', { name: '当前存货' })).toHaveTextContent('1 件');
  });

  it('buys stock with a valid account and updates both balance and inventory', async () => {
    const { user } = renderAppWithState(modernState({ locationId: 'xizhimen', cash: 500, bank: 0, wallet: 0, market: { 'power-bank': 100 } }));
    await user.click(screen.getByRole('button', { name: '买进' }));
    await user.clear(screen.getByLabelText('数量'));
    await user.type(screen.getByLabelText('数量'), '2');
    await user.click(screen.getByRole('button', { name: '确认买进' }));
    expect(screen.getByText('¥300')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: '存货' }));
    expect(screen.getByRole('table', { name: '当前存货' })).toHaveTextContent('2 件');
  });

  it('restores focus on Escape and disables only malformed quantities', async () => {
    const { user } = renderAppWithState(modernState({ locationId: 'xizhimen', market: { 'power-bank': 100 } }));
    await user.click(screen.getByRole('row', { name: /充电宝/ }));
    const open = screen.getByRole('button', { name: '买进' });
    await user.click(open);
    await user.clear(screen.getByLabelText('数量'));
    expect(screen.getByRole('button', { name: '确认买进' })).toBeDisabled();
    await user.type(screen.getByLabelText('数量'), '999999');
    expect(screen.getByRole('button', { name: '确认买进' })).toBeEnabled();
    await user.keyboard('{Escape}');
    expect(open).toHaveFocus();
  });
});
