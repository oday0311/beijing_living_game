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

  it('shows AQI, weather effects and every active trend in words', () => {
    renderAppWithState(modernState({ locationId: 'xizhimen', weatherId: 'heat', trends: [
      { id: 'up', category: 'power-bank', multiplier: 1.7, daysLeft: 2, reason: '雨天需求' },
      { id: 'down', category: 'outdoor', multiplier: 0.7, daysLeft: 1, reason: '寒潮' },
    ] }));
    expect(screen.getByText('AQI')).toBeInTheDocument();
    expect(screen.getByText('良')).toBeInTheDocument();
    expect(screen.getByText(/健康 -4/)).toBeInTheDocument();
    expect(screen.getByText(/充电宝.*上涨.*雨天需求.*剩余 2 天/)).toBeInTheDocument();
    expect(screen.getByText(/户外.*下跌.*寒潮.*剩余 1 天/)).toBeInTheDocument();
  });

  it('quotes the actual route and fare before travel', async () => {
    const state = modernState({ locationId: 'xizhimen', weatherId: 'rain', identityId: 'courier', modern: {
      ...modernState().modern!, freeTransitUses: 0,
    } });
    const { user } = renderAppWithState(state);
    await user.click(screen.getByRole('tab', { name: '城市' }));
    const destination = screen.getByRole('button', { name: /海淀黄庄/ });
    expect(destination).toHaveTextContent('西直门 → 海淀黄庄');
    expect(destination).toHaveTextContent('4号线');
    expect(destination).toHaveTextContent('0 次换乘');
    expect(destination).toHaveTextContent('车费 ¥2');
  });

  it('localizes system events and gives unknown English events a Chinese fallback', async () => {
    const { user } = renderAppWithState(modernState({ pendingEvents: [
      { id: 'hospitalization', kind: 'system', title: 'Hospitalized', body: 'Hospitalized for 2 day(s); debt increased by 2500.', artId: 'hospitalization' },
      { id: 'mystery', kind: 'system', title: 'Something happened', body: 'Unknown event', artId: 'mystery' },
    ] }));
    expect(screen.getByRole('dialog')).toHaveTextContent('住院 2 天');
    expect(screen.getByRole('dialog')).toHaveTextContent('¥2,500');
    await user.click(screen.getByRole('button', { name: '知道了' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('城市消息');
    expect(screen.getByRole('dialog')).not.toHaveTextContent('Unknown event');
  });

  it('restores focus to the page heading when the travel trigger becomes disabled', async () => {
    const { user } = renderAppWithState(modernState({ locationId: 'xizhimen', cash: 1000, pendingEvents: [] }));
    await user.click(screen.getByRole('tab', { name: '城市' }));
    await user.click(screen.getByRole('button', { name: /海淀黄庄/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '知道了' }));
    expect(screen.getByRole('heading', { name: 'Player的北京日程' })).toHaveFocus();
  });
});
