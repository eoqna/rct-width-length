// 콘텐츠 파일 읽기·쓰기 (단어 은행, 퍼즐 JSON)
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BankWord, PuzzleFile } from '../../src/domain/types';
import { error, parseBankCsv, validateCollection, type Issue } from '../../src/domain/validate';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const BANK_PATH = join(ROOT, 'content/words.csv');
export const PUZZLE_DIR = join(ROOT, 'src/data/puzzles');
export const REVIEW_DIR = join(ROOT, 'content/review');
export const SYNONYMS_PATH = join(ROOT, 'content/synonyms.txt');

/** 같은 뜻 묶음: 단어 → 묶음 이름 목록 (생성기가 한 퍼즐에 하나만 놓는다) */
export function loadSynonyms(): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  if (!existsSync(SYNONYMS_PATH)) return groups;
  readFileSync(SYNONYMS_PATH, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .forEach((line, k) => {
      for (const word of line.split(/\s+/)) groups.set(word, [...(groups.get(word) ?? []), `g${k}`]);
    });
  return groups;
}

export const puzzleFileName = (n: number) => `p${String(n).padStart(2, '0')}.json`;

export function loadBank(): { words: BankWord[]; issues: Issue[] } {
  if (!existsSync(BANK_PATH)) return { words: [], issues: [error('B01', `단어 은행이 없어요: ${BANK_PATH}`)] };
  return parseBankCsv(readFileSync(BANK_PATH, 'utf8'));
}

export interface LoadedPuzzle {
  name: string;
  data: unknown;
}

/** src/data/puzzles/*.json. JSON 오류·파일 이름 불일치는 F01 */
export function loadPuzzleFiles(): { puzzles: LoadedPuzzle[]; issues: Issue[] } {
  const issues: Issue[] = [];
  const puzzles: LoadedPuzzle[] = [];
  if (!existsSync(PUZZLE_DIR)) return { puzzles, issues };
  for (const name of readdirSync(PUZZLE_DIR).filter((f) => f.endsWith('.json')).sort()) {
    let data: unknown;
    try {
      data = JSON.parse(readFileSync(join(PUZZLE_DIR, name), 'utf8'));
    } catch (e) {
      issues.push(error('F01', `${name}: JSON을 읽을 수 없어요 (${(e as Error).message})`));
      continue;
    }
    const number = (data as { number?: unknown } | null)?.number;
    if (typeof number === 'number' && name !== puzzleFileName(number)) {
      issues.push(error('F01', `${name}: 파일 이름이 번호와 달라요 (${puzzleFileName(number)}여야 함)`, number));
    }
    puzzles.push({ name, data });
  }
  return { puzzles, issues };
}

/** 단어 은행 + 퍼즐 전체 검증 */
export function runValidation(options: { release?: boolean } = {}): Issue[] {
  const bank = loadBank();
  const files = loadPuzzleFiles();
  return [
    ...bank.issues,
    ...files.issues,
    ...validateCollection({ files: files.puzzles.map((p) => p.data), bank: bank.words, release: options.release }),
  ];
}

/** 사람이 읽기 좋게: 격자 한 줄, 열쇠 하나가 한 줄 */
export function serializePuzzle(file: PuzzleFile): string {
  const lines = ['{'];
  lines.push(`  "number": ${file.number},`);
  lines.push(`  "theme": ${JSON.stringify(file.theme)},`);
  if (file.targetTimeSec !== undefined) lines.push(`  "targetTimeSec": ${file.targetTimeSec},`);
  lines.push('  "grid": [');
  file.grid.forEach((row, i) => lines.push(`    ${JSON.stringify(row)}${i < file.grid.length - 1 ? ',' : ''}`));
  lines.push('  ],');
  lines.push('  "clues": {');
  const clues = Object.entries(file.clues);
  clues.forEach(([answer, clue], i) => {
    const body = `{ "type": ${JSON.stringify(clue.type)}, "text": ${JSON.stringify(clue.text)} }`;
    lines.push(`    ${JSON.stringify(answer)}: ${body}${i < clues.length - 1 ? ',' : ''}`);
  });
  lines.push(file.meta ? '  },' : '  }');
  if (file.meta) lines.push(`  "meta": ${JSON.stringify(file.meta)}`);
  lines.push('}');
  return lines.join('\n') + '\n';
}

export function writePuzzle(file: PuzzleFile): string {
  const path = join(PUZZLE_DIR, puzzleFileName(file.number));
  writeFileSync(path, serializePuzzle(file));
  return path;
}

/** 명령줄 인자: --key value / --flag */
export function parseArgs(argv: string[]): Record<string, string | true> {
  const out: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}

/** 터미널용 격자 그림 (검은 칸은 ■) */
export function drawGrid(grid: readonly string[]): string {
  return grid.map((row) => Array.from(row).map((ch) => (ch === '#' ? '■' : ch)).join(' ')).join('\n');
}
