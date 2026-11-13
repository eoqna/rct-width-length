import { describe, expect, it } from 'vitest';
import { createRng } from './rng';

describe('createRng', () => {
  it('같은 시드는 같은 수열', () => {
    const a = createRng(123);
    const b = createRng(123);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });

  it('0 이상 1 미만', () => {
    const r = createRng(9);
    for (let i = 0; i < 1000; i++) {
      const x = r.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('int(n)은 0 이상 n 미만 정수', () => {
    const r = createRng(5);
    for (let i = 0; i < 200; i++) {
      const x = r.int(4);
      expect(Number.isInteger(x) && x >= 0 && x < 4).toBe(true);
    }
  });
});
