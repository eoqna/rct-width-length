// 시드 고정 난수 (mulberry32) — 같은 시드면 같은 격자가 나온다

export interface Rng {
  /** 0 이상 1 미만 */
  next(): number;
  /** 0 이상 n 미만 정수 */
  int(n: number): number;
  pick<T>(items: readonly T[]): T;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number) => Math.floor(next() * n);
  return { next, int, pick: (items) => items[int(items.length)] };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
