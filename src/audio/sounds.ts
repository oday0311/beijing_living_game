export type Cue = 'buy' | 'sell' | 'travel' | 'event';

const notes: Record<Cue, [number, number]> = {
  buy: [523, 659], sell: [659, 440], travel: [392, 587], event: [440, 523],
};

export function playCue(cue: Cue, enabled: boolean): void {
  if (!enabled || typeof AudioContext === 'undefined') return;
  try {
    const context = new AudioContext();
    const start = context.currentTime;
    notes[cue].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const at = start + index * 0.09;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.055, at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.17);
    });
    window.setTimeout(() => { void context.close().catch(() => {}); }, 400);
  } catch { /* Audio is optional, including when autoplay is blocked. */ }
}
