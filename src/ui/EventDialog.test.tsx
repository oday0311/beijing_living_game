import { cleanup, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { modernState } from '../test/fixtures';
import { renderAppWithState } from '../test/render-game';

afterEach(cleanup);

it('acknowledges queued events one at a time and maps art by artId', async () => {
  const { user } = renderAppWithState(modernState({ pendingEvents: [
    { id: 'first', kind: 'market', title: '第一件事', body: '第一条', artId: 'market/coffee-festival' },
    { id: 'second', kind: 'health', title: '第二件事', body: '第二条', artId: 'health/heavy-rain' },
  ] }));
  expect(screen.getByRole('dialog')).toHaveTextContent('第一件事');
  expect(screen.getByRole('img', { name: '第一件事插画' })).toHaveAttribute('src', '/assets/events/modern-market.webp');
  await user.click(screen.getByRole('button', { name: '知道了' }));
  expect(screen.getByRole('dialog')).toHaveTextContent('第二件事');
  expect(screen.getByRole('img', { name: '第二件事插画' })).toHaveAttribute('src', '/assets/events/modern-weather.webp');
});
