import { cleanup, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { modernState } from '../test/fixtures';
import { renderAppWithState } from '../test/render-game';

afterEach(cleanup);

it('shows the quoted fare and waits for confirmation before travel', async () => {
  const { user } = renderAppWithState(modernState({ locationId: 'xizhimen', cash: 1000 }));
  await user.click(screen.getByRole('tab', { name: '城市' }));
  await user.click(screen.getByRole('button', { name: /国贸/ }));
  expect(screen.getByRole('dialog', { name: /前往国贸/ })).toHaveTextContent('票价');
  expect(screen.getByText(/第 1 \/ 40 天/)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '确认换站' }));
  expect(screen.getByText(/第 2 \/ 40 天/)).toBeInTheDocument();
});

it('shows line markers, interchange stations and the current station', async () => {
  const { user } = renderAppWithState(modernState({ locationId: 'xizhimen' }));
  await user.click(screen.getByRole('tab', { name: '城市' }));
  expect(screen.getByRole('button', { name: /西直门/ })).toHaveAttribute('aria-current', 'location');
  expect(screen.getByRole('button', { name: /海淀黄庄/ })).toHaveTextContent('换乘');
});
