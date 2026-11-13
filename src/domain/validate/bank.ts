// 단어 은행 읽기와 B01 검사 (design.md §4.1)
import { CATEGORIES, CATEGORY_MIN_GRADE } from '../../data/stages';
import { isSyllable, toSyllables } from '../hangul';
import type { BankWord, Category } from '../types';
import { error, type Issue } from './issue';

export const BANK_HEADER = ['word', 'grade', 'category', 'themes', 'note'] as const;

/** 한 줄을 칸으로 나눈다. 큰따옴표로 감싼 칸 안의 쉼표·"" 를 처리한다 */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export function parseBankCsv(text: string): { words: BankWord[]; issues: Issue[] } {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const issues: Issue[] = [];
  const words: BankWord[] = [];

  const header = splitCsvLine(lines[0] ?? '').map((h) => h.trim());
  if (header.join(',') !== BANK_HEADER.join(',')) {
    issues.push(error('B01', `단어 은행 머리글은 "${BANK_HEADER.join(',')}"여야 해요 (지금: "${header.join(',')}")`));
    return { words, issues };
  }

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    if (raw.trim() === '') continue;
    const line = i + 1;
    const cols = splitCsvLine(raw);
    if (cols.length !== BANK_HEADER.length) {
      issues.push(error('B01', `${line}번째 줄: 칸이 ${cols.length}개예요 (${BANK_HEADER.length}개여야 함)`));
      continue;
    }
    const [w, grade, category, themes, note] = cols.map((c) => c.trim());
    words.push({
      word: w.normalize('NFC'),
      grade: Number(grade),
      category: category as Category,
      themes: themes
        .split('|')
        .map((t) => t.trim())
        .filter(Boolean),
      note,
      line,
    });
  }
  return { words, issues };
}

/** B01: 형식, 중복, 등급·범주 값, 범주별 최소 등급 */
export function validateBank(words: readonly BankWord[]): Issue[] {
  const issues: Issue[] = [];
  const seen = new Map<string, BankWord>();
  for (const w of words) {
    const at = w.line ? `${w.line}번째 줄 ` : '';
    const label = `${at}'${w.word}'`;
    const chars = toSyllables(w.word);
    if (chars.length < 2 || !chars.every(isSyllable)) {
      issues.push(error('B01', `${label}: 완성형 한글 2음절 이상이어야 해요`));
    }
    const dup = seen.get(w.word);
    if (dup) {
      issues.push(error('B01', `${label}: 중복된 단어예요${dup.line ? ` (${dup.line}번째 줄과 같음)` : ''}`));
    } else {
      seen.set(w.word, w);
    }
    if (!Number.isInteger(w.grade) || w.grade < 1 || w.grade > 5) {
      issues.push(error('B01', `${label}: 등급은 1~5여야 해요`));
    }
    if (!CATEGORIES.includes(w.category)) {
      issues.push(error('B01', `${label}: 범주 '${w.category}'는 쓸 수 없어요 (${CATEGORIES.join('·')})`));
    } else if (w.grade < CATEGORY_MIN_GRADE[w.category]) {
      issues.push(
        error('B01', `${label}: ${w.category} 단어는 ${CATEGORY_MIN_GRADE[w.category]}등급 이상이어야 해요`),
      );
    }
  }
  return issues;
}
