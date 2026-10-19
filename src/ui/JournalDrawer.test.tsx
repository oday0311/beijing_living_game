import { cleanup, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { modernState } from '../test/fixtures';
import { renderAppWithState } from '../test/render-game';

afterEach(cleanup);

it('groups journal entries by day and filters transaction entries', async () => {
  const { user } = renderAppWithState(modernState({ journal: [
    { id: '1:1', day: 1, title: 'Buy', detail: '买入充电宝', delta: { cash: -50 } },
    { id: '2:1', day: 2, title: '热浪', detail: '健康下降', delta: { health: -4 } },
  ] }));
  await user.click(screen.getByRole('button', { name: '旅程日记' }));
  expect(screen.getByRole('dialog', { name: '旅程日记' })).toHaveTextContent('第 1 天');
  expect(screen.getByRole('dialog', { name: '旅程日记' })).toHaveTextContent('第 2 天');
  await user.click(screen.getByRole('button', { name: '交易' }));
  expect(screen.getByRole('dialog', { name: '旅程日记' })).toHaveTextContent('买入充电宝');
  expect(screen.getByRole('dialog', { name: '旅程日记' })).not.toHaveTextContent('健康下降');
});

it('shows engine travel records with localized station names', async () => {
  const { user } = renderAppWithState(modernState({ journal: [
    { id: '1:1', day: 1, title: 'Travel', detail: 'guomao', delta: { cash: -4 } },
  ] }));
  await user.click(screen.getByRole('button', { name: '旅程日记' }));
  expect(screen.getByRole('dialog', { name: '旅程日记' })).toHaveTextContent('换站');
  expect(screen.getByRole('dialog', { name: '旅程日记' })).toHaveTextContent('国贸');
  expect(screen.getByRole('dialog', { name: '旅程日记' })).not.toHaveTextContent('guomao');
});

it('uses the content pack to classify market events without keyword matches', async () => {
  const { user } = renderAppWithState(modernState({ journal: [
    { id: '1:1', day: 1, title: '咖啡节', detail: '摊位比座位多。' },
    { id: '1:2', day: 1, title: 'Travel', detail: 'guomao' },
  ] }));
  await user.click(screen.getByRole('button', { name: '旅程日记' }));
  await user.click(screen.getByRole('button', { name: '行情' }));
  expect(screen.getByRole('dialog', { name: '旅程日记' })).toHaveTextContent('咖啡节');
  expect(screen.getByRole('dialog', { name: '旅程日记' })).not.toHaveTextContent('换站');
});

it('combines the day selector and category filter', async () => {
  const { user } = renderAppWithState(modernState({ journal: [
    { id: '1:1', day: 1, title: '咖啡节', detail: '第一天行情。' },
    { id: '2:1', day: 2, title: '热浪', detail: '第二天健康。', delta: { health: -4 } },
    { id: '2:2', day: 2, title: '演出取消', detail: '第二天行情。' },
  ] }));
  await user.click(screen.getByRole('button', { name: '旅程日记' }));
  await user.selectOptions(screen.getByRole('combobox', { name: '日期' }), '2');
  await user.click(screen.getByRole('button', { name: '行情' }));
  const dialog = screen.getByRole('dialog', { name: '旅程日记' });
  expect(dialog).toHaveTextContent('第 2 天');
  expect(dialog).toHaveTextContent('演出取消');
  expect(dialog).not.toHaveTextContent('咖啡节');
  expect(dialog).not.toHaveTextContent('热浪');
  await user.selectOptions(screen.getByRole('combobox', { name: '日期' }), 'all');
  expect(dialog).toHaveTextContent('咖啡节');
});
