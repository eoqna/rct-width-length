// 퍼즐 한 개 검사: F01, G01~G04, W01·W02·W04~W08, C01~C04 (design.md §9.4)
import {
  CATEGORY_MIN_STAGE,
  CLUE_MAX_LENGTH,
  LONG_WORD,
  MIN_WHITE_RATIO,
  NEW_GRADE_RATIO,
  STAGES,
  THEME_RATIO,
  TOTAL_PUZZLES,
  stageOf,
} from '../../data/stages';
import { isSyllable, normalizeAnswer, toSyllables } from '../hangul';
import { BLOCK, parsePuzzle } from '../parse';
import type { BankWord, ClueType, Puzzle, PuzzleFile } from '../types';
import { error, pct, warning, type Issue } from './issue';

const CLUE_TYPES: readonly ClueType[] = ['definition', 'association', 'blank', 'trivia'];
const EPS = 1e-9;

/** F01: JSON 구조. 통과하면 PuzzleFile로 볼 수 있다 */
export function checkFileShape(raw: unknown): Issue[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return [error('F01', '퍼즐 파일이 객체가 아니에요')];
  }
  const f = raw as Record<string, unknown>;
  const at = Number.isInteger(f.number) ? (f.number as number) : undefined;
  const problems: string[] = [];
  if (!Number.isInteger(f.number) || (f.number as number) < 1 || (f.number as number) > TOTAL_PUZZLES) {
    problems.push(`number는 1~${TOTAL_PUZZLES} 정수여야 해요`);
  }
  if (typeof f.theme !== 'string' || f.theme.trim() === '') problems.push('theme이 비어 있어요');
  if (!Array.isArray(f.grid) || f.grid.length === 0 || !f.grid.every((r) => typeof r === 'string')) {
    problems.push('grid는 문자열 배열이어야 해요');
  }
  if (!f.clues || typeof f.clues !== 'object' || Array.isArray(f.clues)) {
    problems.push('clues는 객체여야 해요');
  } else {
    for (const [answer, clue] of Object.entries(f.clues as Record<string, unknown>)) {
      const c = clue as Record<string, unknown> | null;
      if (!c || typeof c !== 'object' || typeof c.text !== 'string' || !CLUE_TYPES.includes(c.type as ClueType)) {
        problems.push(`'${answer}'의 열쇠는 { type: ${CLUE_TYPES.join('|')}, text: 문자열 }이어야 해요`);
      }
    }
  }
  if (f.targetTimeSec !== undefined && !(Number.isInteger(f.targetTimeSec) && (f.targetTimeSec as number) > 0)) {
    problems.push('targetTimeSec는 양의 정수여야 해요');
  }
  return problems.length ? [error('F01', problems.join('; '), at)] : [];
}

/** 격자가 정사각형이고 칸이 완성형 음절 또는 #인가 (크기는 따지지 않음) */
export function gridProblems(grid: readonly string[]): string[] {
  const rows = grid.map((r) => Array.from(r));
  const n = rows.length;
  const problems: string[] = [];
  rows.forEach((row, r) => {
    if (row.length !== n) problems.push(`${r + 1}번째 줄이 ${row.length}칸이에요 (${n}칸이어야 함)`);
    row.forEach((ch, c) => {
      if (ch !== BLOCK && !isSyllable(ch)) problems.push(`(${r + 1},${c + 1}) '${ch}'는 쓸 수 없는 글자예요`);
    });
  });
  return problems;
}

/** 구조상 파싱 가능한 퍼즐이면 파싱 (단계 크기는 따지지 않음) */
export function tryParse(raw: unknown): Puzzle | null {
  if (checkFileShape(raw).length) return null;
  const file = raw as PuzzleFile;
  if (gridProblems(file.grid).length) return null;
  return parsePuzzle(file);
}

export interface PuzzleStats {
  words: number;
  themeWords: number;
  themeRatio: number;
  /** 자기 단계 등급 단어 */
  newGradeWords: number;
  newGradeRatio: number;
  gradeCounts: Record<number, number>;
  whiteCells: number;
  whiteRatio: number;
  rowsUsed: number;
  colsUsed: number;
  longWords: number;
  /** 가로·세로 단어가 함께 지나는 칸 */
  crossings: number;
  definitionClues: number;
}

export function analyzePuzzle(puzzle: Puzzle, bank: ReadonlyMap<string, BankWord>): PuzzleStats {
  const words = puzzle.entries.length;
  const info = puzzle.entries.map((e) => bank.get(e.answer));
  const themeWords = info.filter((w) => w?.themes.includes(puzzle.theme)).length;
  const newGradeWords = info.filter((w) => w?.grade === puzzle.stage).length;
  const gradeCounts: Record<number, number> = {};
  for (const w of info) if (w) gradeCounts[w.grade] = (gradeCounts[w.grade] ?? 0) + 1;
  const white = puzzle.cells.filter((c) => c.solution !== null);
  const n = puzzle.size;
  return {
    words,
    themeWords,
    themeRatio: words ? themeWords / words : 0,
    newGradeWords,
    newGradeRatio: words ? newGradeWords / words : 0,
    gradeCounts,
    whiteCells: white.length,
    whiteRatio: white.length / (n * n),
    rowsUsed: new Set(white.map((c) => c.row)).size,
    colsUsed: new Set(white.map((c) => c.col)).size,
    longWords: puzzle.entries.filter((e) => e.cells.length >= LONG_WORD.length).length,
    crossings: white.filter((c) => c.acrossId && c.downId).length,
    definitionClues: puzzle.entries.filter((e) => e.clueType === 'definition').length,
  };
}

/** 열쇠에 정답의 연속 2음절이 들어 있으면 그 조각 */
export function leakedPiece(answer: string, clue: string): string | null {
  const chars = toSyllables(answer);
  const text = normalizeAnswer(clue);
  for (let i = 0; i + 1 < chars.length; i++) {
    const piece = chars[i] + chars[i + 1];
    if (text.includes(piece)) return piece;
  }
  return null;
}

export function validatePuzzle(raw: unknown, bank: ReadonlyMap<string, BankWord>): Issue[] {
  const shape = checkFileShape(raw);
  if (shape.length) return shape;
  const file = raw as PuzzleFile;
  const at = file.number;
  const stage = stageOf(file.number);
  const cfg = STAGES[stage];

  // G01 — 크기·글자
  const g01 = gridProblems(file.grid);
  if (file.grid.length !== cfg.size) {
    g01.unshift(`${stage}단계 격자는 ${cfg.size}×${cfg.size}이어야 해요 (지금 ${file.grid.length}줄)`);
  }
  if (g01.length) return [error('G01', g01.join('; '), at)];

  const issues: Issue[] = [];
  const puzzle = parsePuzzle(file);
  const n = puzzle.size;
  const white = puzzle.cells.filter((c) => c.solution !== null);

  // G02 — 외딴 칸
  const lonely = white.filter((c) => !c.acrossId && !c.downId);
  if (lonely.length) {
    const where = lonely.map((c) => `(${c.row + 1},${c.col + 1})`).join(' ');
    issues.push(error('G02', `어느 단어에도 속하지 않는 칸: ${where}`, at));
  }

  // G03 — 연결
  if (white.length) {
    const seen = new Set<number>([white[0].index]);
    const stack = [white[0].index];
    while (stack.length) {
      const i = stack.pop() as number;
      const r = Math.floor(i / n);
      const c = i % n;
      for (const [rr, cc] of [
        [r - 1, c],
        [r + 1, c],
        [r, c - 1],
        [r, c + 1],
      ]) {
        if (rr < 0 || rr >= n || cc < 0 || cc >= n) continue;
        const j = rr * n + cc;
        if (!seen.has(j) && puzzle.cells[j].solution !== null) {
          seen.add(j);
          stack.push(j);
        }
      }
    }
    if (seen.size !== white.length) {
      issues.push(error('G03', `흰 칸이 하나로 이어지지 않아요 (${white.length - seen.size}칸 떨어짐)`, at));
    }
  }

  const stats = analyzePuzzle(puzzle, bank);

  // G04 — 격자 사용 (경고)
  if (stats.rowsUsed < n || stats.colsUsed < n) {
    issues.push(warning('G04', `격자를 끝까지 쓰지 않았어요 (행 ${stats.rowsUsed}/${n}, 열 ${stats.colsUsed}/${n})`, at));
  }
  if (stats.whiteRatio < MIN_WHITE_RATIO - EPS) {
    issues.push(warning('G04', `흰 칸 비율 ${pct(stats.whiteRatio)} (${pct(MIN_WHITE_RATIO)} 이상 권장)`, at));
  }

  // W01·W02·W04
  const counts = new Map<string, number>();
  for (const e of puzzle.entries) counts.set(e.answer, (counts.get(e.answer) ?? 0) + 1);
  for (const [answer, count] of counts) {
    if (count > 1) issues.push(error('W02', `'${answer}'가 ${count}번 나와요`, at));
    const w = bank.get(answer);
    if (!w) {
      issues.push(error('W01', `'${answer}'가 단어 은행에 없어요`, at));
      continue;
    }
    if (w.grade > stage) issues.push(error('W04', `'${answer}'는 ${w.grade}등급이라 ${stage}단계에 쓸 수 없어요`, at));
    const minStage = CATEGORY_MIN_STAGE[w.category];
    if (minStage && stage < minStage) {
      issues.push(error('W04', `'${answer}'(${w.category})는 ${minStage}단계부터 쓸 수 있어요`, at));
    }
  }

  // W05 — 단어 수
  if (stats.words < cfg.words.min || stats.words > cfg.words.max) {
    issues.push(error('W05', `단어 ${stats.words}개 (${stage}단계는 ${cfg.words.min}~${cfg.words.max}개)`, at));
  }

  // W06 — 새 등급 단어 (퍼즐 단위)
  if (stage >= 2) {
    if (stats.newGradeWords < 1) {
      issues.push(error('W06', `${stage}등급 단어가 하나도 없어요 (1개 이상)`, at));
    } else if (stats.newGradeRatio > NEW_GRADE_RATIO.perPuzzleMax + EPS) {
      issues.push(
        error('W06', `${stage}등급 단어 비율 ${pct(stats.newGradeRatio)} (${pct(NEW_GRADE_RATIO.perPuzzleMax)} 이하)`, at),
      );
    }
  }

  // W07 — 주제 비율
  if (stats.themeRatio < THEME_RATIO.min - EPS || stats.themeRatio > THEME_RATIO.max + EPS) {
    issues.push(
      error(
        'W07',
        `주제('${puzzle.theme}') 단어 ${stats.themeWords}/${stats.words} = ${pct(stats.themeRatio)} (${pct(THEME_RATIO.min)}~${pct(THEME_RATIO.max)})`,
        at,
      ),
    );
  }

  // W08 — 긴 단어
  if (stats.longWords > 0 && stage < LONG_WORD.minStage) {
    issues.push(error('W08', `${LONG_WORD.length}음절 이상 단어는 ${LONG_WORD.minStage}단계부터 쓸 수 있어요`, at));
  } else if (stats.longWords > LONG_WORD.maxPerPuzzle) {
    issues.push(error('W08', `${LONG_WORD.length}음절 이상 단어가 ${stats.longWords}개 (${LONG_WORD.maxPerPuzzle}개 이하)`, at));
  }

  // C01~C04 — 열쇠
  const answers = new Set(puzzle.entries.map((e) => e.answer));
  for (const answer of answers) {
    const clue = file.clues[answer];
    if (!clue) {
      issues.push(error('C01', `'${answer}'의 열쇠가 없어요`, at));
      continue;
    }
    const piece = leakedPiece(answer, clue.text);
    if (piece) issues.push(error('C02', `'${answer}'의 열쇠에 '${piece}'가 들어 있어요`, at));
    const length = Array.from(clue.text.trim()).length;
    if (length < 1 || length > CLUE_MAX_LENGTH) {
      issues.push(error('C03', `'${answer}'의 열쇠가 ${length}자예요 (1~${CLUE_MAX_LENGTH}자)`, at));
    }
    if (!cfg.clueTypes.includes(clue.type)) {
      issues.push(error('C04', `'${answer}'의 열쇠 유형 ${clue.type}는 ${stage}단계에서 쓸 수 없어요`, at));
    }
  }
  for (const key of Object.keys(file.clues)) {
    if (!answers.has(key)) issues.push(error('C01', `격자에 없는 열쇠 '${key}'`, at));
  }

  return issues;
}
