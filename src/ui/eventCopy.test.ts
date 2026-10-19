import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../engine/types';
import { eventCopy } from './eventCopy';

const event = (id: string, body = 'English event'): GameEvent => ({ id, kind: 'system', title: body, body, artId: id });

describe('eventCopy', () => {
  it('localizes journey, liquidation, hospital and other system notices', () => {
    for (const id of ['journey-complete', 'auto-liquidation', 'departure-warning', 'health-crisis', 'death', 'debt-penalty']) {
      const copy = eventCopy(event(id));
      expect(copy.title).toMatch(/[\u3400-\u9fff]/);
      expect(copy.body).toMatch(/[\u3400-\u9fff]/);
      expect(copy.body).not.toContain('English');
    }
    expect(eventCopy(event('hospitalization', 'Hospitalized for 2 day(s); debt increased by 2500.')).body)
      .toContain('住院 2 天，债务增加 ¥2,500');
  });

  it('keeps Chinese authored notices and localizes unknown English system notices', () => {
    expect(eventCopy(event('custom', '自定义城市消息'))).toEqual({ title: '自定义城市消息', body: '自定义城市消息' });
    expect(eventCopy(event('unknown'))).toEqual({ title: '城市消息', body: '发生了一件新事，请查看旅程记录。' });
    expect(eventCopy({ ...event('mixed', '已有中文正文'), title: 'Unknown title' })).toEqual({ title: '城市消息', body: '已有中文正文' });
  });
});
