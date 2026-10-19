import { afterEach, expect, it, vi } from 'vitest';
import { playCue } from './sounds';

afterEach(() => vi.unstubAllGlobals());

it('does not construct AudioContext when disabled', () => {
  const AudioContext = vi.fn();
  vi.stubGlobal('AudioContext', AudioContext);
  playCue('buy', false);
  expect(AudioContext).not.toHaveBeenCalled();
});

it('silently ignores unavailable Web Audio', () => {
  vi.stubGlobal('AudioContext', undefined);
  expect(() => playCue('event', true)).not.toThrow();
});
