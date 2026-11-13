import { describe, expect, it } from 'vitest';
import { fingerprintGrid } from './fingerprint';

describe('fingerprintGrid', () => {
  const grid = ['#태###', '고양이##', '릴#야##', '라#기러기', '####차'];

  it('8자리 16진수 문자열을 돌려준다', () => {
    expect(fingerprintGrid(grid)).toMatch(/^[0-9a-f]{8}$/);
  });

  it('같은 격자는 같은 지문', () => {
    expect(fingerprintGrid([...grid])).toBe(fingerprintGrid(grid));
  });

  it('글자 하나만 달라도 지문이 바뀐다', () => {
    const changed = [...grid];
    changed[4] = '####자';
    expect(fingerprintGrid(changed)).not.toBe(fingerprintGrid(grid));
  });

  it('줄 경계가 달라지면 지문이 바뀐다', () => {
    expect(fingerprintGrid(['가나', '다라'])).not.toBe(fingerprintGrid(['가', '나다라']));
  });
});
