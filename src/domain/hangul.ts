// 한글 입력 정규화와 음절 판별 (requirements.md §3.3·§3.4)

const SYLLABLE_FIRST = 0xac00; // 가
const SYLLABLE_LAST = 0xd7a3; // 힣

/** NFC로 합치고 공백을 모두 지운다 */
export function normalizeAnswer(text: string): string {
  return text.normalize('NFC').replace(/\s+/gu, '');
}

/** 완성형 한글 음절(가~힣) 한 글자인가 */
export function isSyllable(ch: string): boolean {
  if (ch.length !== 1) return false;
  const code = ch.charCodeAt(0);
  return code >= SYLLABLE_FIRST && code <= SYLLABLE_LAST;
}

export function toSyllables(text: string): string[] {
  return Array.from(text);
}

export type FormatResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'notHangul' | 'length' };

/**
 * 제출 전 형식 검사. 형식 오류는 오답으로 치지 않는다.
 * - 완성형 한글 밖의 글자(미완성 자모·영문·숫자)나 빈 입력 → notHangul
 * - 글자 수가 단어 길이와 다름 → length
 */
export function checkAnswerFormat(raw: string, length: number): FormatResult {
  const text = normalizeAnswer(raw);
  const chars = toSyllables(text);
  if (chars.length === 0 || !chars.every(isSyllable)) {
    return { ok: false, reason: 'notHangul' };
  }
  if (chars.length !== length) return { ok: false, reason: 'length' };
  return { ok: true, text };
}
