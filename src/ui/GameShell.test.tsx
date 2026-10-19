import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { modernState, classicState } from '../test/fixtures';
import { renderAppWithState } from '../test/render-game';

afterEach(cleanup);

describe('GameShell', () => {
  it('shows semantic market and inventory tables and mode-specific status', () => {
    renderAppWithState(modernState({ locationId: 'xizhimen', market: { 'power-bank': 100 }, inventory: { 'power-bank': { quantity: 2, averageCost: 80 } } }));
    expect(screen.getByRole('table', { name: '今日行情' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: '当前存货', hidden: true })).toBeInTheDocument();
    expect(screen.getByText('电子余额')).toBeInTheDocument();
    expect(screen.getByText('信用')).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /充电宝/ })).toBeInTheDocument();
  });

  it('hides modern-only status and services in classic mode', () => {
    renderAppWithState(classicState({ locationId: 'xizhimen', market: { cigarettes: 100 } }));
    expect(screen.queryByText('电子余额')).not.toBeInTheDocument();
    expect(screen.queryByText('信用')).not.toBeInTheDocument();
    expect(screen.queryByText('天气')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '借款' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '医院' })).toBeInTheDocument();
  });

  it('acknowledges an event in a modal before travel', async () => {
    const { user } = renderAppWithState(modernState({ locationId: 'xizhimen', pendingEvents: [{ id: 'news', kind: 'system', title: '今日消息', body: '一条新消息', artId: 'news' }] }));
    expect(screen.getByRole('dialog', { name: '今日消息' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '知道了' }));
    expect(screen.queryByRole('dialog', { name: '今日消息' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: '城市' }));
    expect(screen.getByRole('button', { name: /海淀黄庄/ })).toBeEnabled();
  });

  it('travels to another station and advances the day', async () => {
    const { user } = renderAppWithState(modernState({ locationId: 'xizhimen', cash: 1000, pendingEvents: [] }));
    await user.click(screen.getByRole('tab', { name: '城市' }));
    await user.click(screen.getByRole('button', { name: /海淀黄庄/ }));
    expect(screen.getByText(/第 2 \/ 40 天/)).toBeInTheDocument();
  });
});
