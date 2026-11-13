// 앱과 콘텐츠 도구가 함께 쓰는 타입 (design.md §4)

export type Direction = 'across' | 'down';
export type ClueType = 'definition' | 'association' | 'blank' | 'trivia';
export type Stage = 1 | 2 | 3 | 4 | 5;
export type Category = 'general' | 'loan' | 'idiom' | 'proper' | 'concept';

/** 퍼즐 파일 `src/data/puzzles/pNN.json` (§4.2) */
export interface PuzzleFile {
  number: number;
  theme: string;
  grid: string[];
  clues: Record<string, { type: ClueType; text: string }>;
  targetTimeSec?: number;
  meta?: Record<string, unknown>;
}

/** 파싱된 퍼즐 (§4.3) */
export interface Puzzle {
  number: number;
  stage: Stage;
  theme: string;
  size: number;
  cells: Cell[];
  entries: Entry[];
  targetTimeSec: number;
  fingerprint: string;
}

export interface Cell {
  index: number;
  row: number;
  col: number;
  /** null = 검은 칸 */
  solution: string | null;
  /** 단어가 시작하는 칸의 번호 */
  number?: number;
  acrossId?: string;
  downId?: string;
}

export interface Entry {
  /** 'a2', 'd5' */
  id: string;
  number: number;
  direction: Direction;
  cells: number[];
  answer: string;
  clue: string;
  clueType: ClueType;
}

/** 단어 은행의 한 줄 (§4.1) */
export interface BankWord {
  word: string;
  grade: number;
  category: Category;
  themes: string[];
  note: string;
  /** CSV 줄 번호 (오류 안내용) */
  line?: number;
}

/** localStorage `wl:v1:progress:{번호}` (§4.4) */
export interface Progress {
  fingerprint: string;
  letters: string[];
  revealed: number[];
  elapsedMs: number;
  completed: boolean;
}

/** localStorage `wl:v1:records` 값 (§4.4) */
export interface BestRecord {
  stars: 1 | 2 | 3;
  bestTimeMs: number;
  clearedAt: string;
}
