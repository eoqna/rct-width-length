import { describe, expect, it } from 'vitest';
import { hrefFor, parseHash } from './router';

describe('parseHash', () => {
  it('목록·퍼즐·설정', () => {
    expect(parseHash('', false)).toEqual({ name: 'home' });
    expect(parseHash('#/', false)).toEqual({ name: 'home' });
    expect(parseHash('#/p/12', false)).toEqual({ name: 'puzzle', number: 12, reveal: false });
    expect(parseHash('#/settings', false)).toEqual({ name: 'settings' });
  });

  it('잘못된 주소는 목록으로', () => {
    expect(parseHash('#/p/0', false)).toEqual({ name: 'home' });
    expect(parseHash('#/p/51', false)).toEqual({ name: 'home' });
    expect(parseHash('#/p/abc', false)).toEqual({ name: 'home' });
    expect(parseHash('#/nope', false)).toEqual({ name: 'home' });
  });

  it('정답 보기는 개발 빌드에서만', () => {
    expect(parseHash('#/p/12?reveal', true)).toEqual({ name: 'puzzle', number: 12, reveal: true });
    expect(parseHash('#/p/12?reveal', false)).toEqual({ name: 'puzzle', number: 12, reveal: false });
  });

  it('hrefFor는 parseHash의 반대', () => {
    expect(parseHash(hrefFor({ name: 'puzzle', number: 7, reveal: false }), false)).toEqual({
      name: 'puzzle',
      number: 7,
      reveal: false,
    });
  });
});
