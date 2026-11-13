import { describe, expect, it } from 'vitest';
import { checkAnswerFormat, isSyllable, normalizeAnswer, toSyllables } from './hangul';

describe('normalizeAnswer', () => {
  it('공백을 모두 지운다', () => {
    expect(normalizeAnswer(' 무 지\t개 ')).toBe('무지개');
  });

  it('풀어 쓴 자모(NFD)를 완성형(NFC)으로 합친다', () => {
    const decomposed = '무지개'.normalize('NFD');
    expect(decomposed.length).toBeGreaterThan(3);
    expect(normalizeAnswer(decomposed)).toBe('무지개');
  });
});

describe('isSyllable', () => {
  it('가~힣만 완성형 음절로 본다', () => {
    expect(isSyllable('가')).toBe(true);
    expect(isSyllable('힣')).toBe(true);
    expect(isSyllable('ㄱ')).toBe(false);
    expect(isSyllable('ㅏ')).toBe(false);
    expect(isSyllable('a')).toBe(false);
    expect(isSyllable('#')).toBe(false);
    expect(isSyllable('가나')).toBe(false);
  });
});

describe('toSyllables', () => {
  it('글자 단위로 나눈다', () => {
    expect(toSyllables('고양이')).toEqual(['고', '양', '이']);
  });
});

describe('checkAnswerFormat', () => {
  it('완성형 한글이고 길이가 맞으면 ok', () => {
    expect(checkAnswerFormat('고양이', 3)).toEqual({ ok: true, text: '고양이' });
  });

  it('정규화한 뒤에 검사한다', () => {
    expect(checkAnswerFormat(' 고 양이', 3)).toEqual({ ok: true, text: '고양이' });
  });

  it('미완성 자모가 섞이면 notHangul', () => {
    expect(checkAnswerFormat('무지ㄱ', 3)).toEqual({ ok: false, reason: 'notHangul' });
  });

  it('영문·숫자가 섞이면 notHangul', () => {
    expect(checkAnswerFormat('무지1', 3)).toEqual({ ok: false, reason: 'notHangul' });
  });

  it('빈 입력은 notHangul', () => {
    expect(checkAnswerFormat('   ', 3)).toEqual({ ok: false, reason: 'notHangul' });
  });

  it('글자 수가 다르면 length', () => {
    expect(checkAnswerFormat('고양', 3)).toEqual({ ok: false, reason: 'length' });
    expect(checkAnswerFormat('고양이야', 3)).toEqual({ ok: false, reason: 'length' });
  });
});
