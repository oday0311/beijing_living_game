import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('shows both playable modes', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: '北京浮生记' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '经典模式' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新北京模式' })).toBeInTheDocument();
  });
});
