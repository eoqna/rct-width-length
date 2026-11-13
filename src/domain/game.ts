// 게임 상태와 순수 리듀서 (design.md §6)
// 격자에는 맞힌 글자만 들어간다. 그래서 단어를 맞혔는지는 "칸이 모두 찼는가"로 계산한다.
import { HINTS_PER_PUZZLE } from '../data/stages';
import { checkAnswerFormat } from './hangul';
import type { Entry, Progress, Puzzle } from './types';

export type FeedbackKind = 'correct' | 'wrong' | 'notHangul' | 'length';

export interface Feedback {
  kind: FeedbackKind;
  /** 같은 결과가 반복돼도 연출·입력창 비우기를 다시 하기 위한 일련번호 */
  seq: number;
}

export interface GameState {
  /** 칸별 확정 글자(모두 정답). 빈 칸·검은 칸은 '' */
  letters: string[];
  /** 힌트로 공개한 칸 */
  revealed: number[];
  activeEntryId: string;
  activeCell: number;
  completed: boolean;
  elapsedMs: number;
  /** 마지막 제출 결과 */
  feedback?: Feedback;
  /** 제출 일련번호 (계속 증가) */
  seq: number;
}

export type GameAction =
  | { type: 'tapCell'; index: number }
  | { type: 'setActiveCell'; index: number }
  | { type: 'selectEntry'; entryId: string }
  | { type: 'moveEntry'; delta: 1 | -1 }
  | { type: 'submitWord'; text: string }
  | { type: 'useHint' }
  | { type: 'tick'; deltaMs: number }
  | { type: 'restart' };

export type SavedGame = Omit<Progress, 'fingerprint'>;

export function isEntrySolved(entry: Entry, letters: readonly string[]): boolean {
  return entry.cells.every((i) => letters[i] !== '');
}

export function isPuzzleComplete(puzzle: Puzzle, letters: readonly string[]): boolean {
  return puzzle.cells.every((c) => c.solution === null || letters[c.index] !== '');
}

export function firstEmptyCell(entry: Entry, letters: readonly string[]): number {
  return entry.cells.find((i) => letters[i] === '') ?? entry.cells[0];
}

export function hintsLeft(state: Pick<GameState, 'revealed'>): number {
  return Math.max(0, HINTS_PER_PUZZLE - state.revealed.length);
}

/**
 * 열쇠 순서(가로 → 세로)로 다음·이전 안 푼 단어. 끝에서 처음으로 순환한다.
 * 안 푼 단어가 하나도 없으면 모든 단어를 차례로 돈다.
 */
export function findNextEntry(
  puzzle: Puzzle,
  letters: readonly string[],
  fromId: string,
  delta: 1 | -1,
): Entry {
  const list = puzzle.entries;
  const len = list.length;
  const from = Math.max(0, list.findIndex((e) => e.id === fromId));
  const at = (k: number) => list[(((from + delta * k) % len) + len) % len];
  for (let k = 1; k <= len; k++) {
    const e = at(k);
    if (!isEntrySolved(e, letters)) return e;
  }
  return at(1);
}

export function createInitialState(puzzle: Puzzle, saved?: SavedGame): GameState {
  const letters = saved ? [...saved.letters] : puzzle.cells.map(() => '');
  const first = puzzle.entries.find((e) => !isEntrySolved(e, letters)) ?? puzzle.entries[0];
  return {
    letters,
    revealed: saved ? [...saved.revealed] : [],
    activeEntryId: first.id,
    activeCell: firstEmptyCell(first, letters),
    completed: isPuzzleComplete(puzzle, letters),
    elapsedMs: saved?.elapsedMs ?? 0,
    seq: 0,
  };
}

export function createGameReducer(puzzle: Puzzle) {
  const entryById = new Map(puzzle.entries.map((e) => [e.id, e]));

  const select = (state: GameState, entry: Entry, cell?: number): GameState => ({
    ...state,
    activeEntryId: entry.id,
    activeCell: cell ?? firstEmptyCell(entry, state.letters),
    feedback: undefined,
  });

  return function gameReducer(state: GameState, action: GameAction): GameState {
    switch (action.type) {
      case 'tapCell': {
        const cell = puzzle.cells[action.index];
        if (!cell || cell.solution === null) return state;
        const dir = entryById.get(state.activeEntryId)?.direction ?? 'across';
        const sameId = dir === 'across' ? cell.acrossId : cell.downId;
        const otherId = dir === 'across' ? cell.downId : cell.acrossId;

        if (action.index === state.activeCell) {
          // 활성 칸을 다시 누르면 방향 전환 (두 방향이 모두 있을 때)
          if (sameId && otherId) return select(state, entryById.get(otherId)!, action.index);
          const onlyId = (sameId ?? otherId)!;
          return onlyId === state.activeEntryId
            ? state
            : select(state, entryById.get(onlyId)!, action.index);
        }

        let targetId = (sameId ?? otherId)!;
        if (sameId && otherId) {
          const same = entryById.get(sameId)!;
          const other = entryById.get(otherId)!;
          if (isEntrySolved(same, state.letters) && !isEntrySolved(other, state.letters)) {
            targetId = otherId;
          }
        }
        return select(state, entryById.get(targetId)!, action.index);
      }

      case 'setActiveCell': {
        const entry = entryById.get(state.activeEntryId);
        if (!entry || !entry.cells.includes(action.index) || action.index === state.activeCell) {
          return state;
        }
        return { ...state, activeCell: action.index };
      }

      case 'selectEntry': {
        const entry = entryById.get(action.entryId);
        return entry ? select(state, entry) : state;
      }

      case 'moveEntry':
        return select(state, findNextEntry(puzzle, state.letters, state.activeEntryId, action.delta));

      case 'submitWord': {
        if (state.completed) return state;
        const entry = entryById.get(state.activeEntryId);
        if (!entry || isEntrySolved(entry, state.letters)) return state;

        const seq = state.seq + 1;
        const format = checkAnswerFormat(action.text, entry.cells.length);
        if (!format.ok) return { ...state, seq, feedback: { kind: format.reason, seq } };
        if (format.text !== entry.answer) return { ...state, seq, feedback: { kind: 'wrong', seq } };

        const letters = [...state.letters];
        for (const i of entry.cells) letters[i] = puzzle.cells[i].solution as string;
        const completed = isPuzzleComplete(puzzle, letters);
        const solved: GameState = { ...state, letters, completed, seq, feedback: { kind: 'correct', seq } };
        if (completed) return solved;
        const next = findNextEntry(puzzle, letters, entry.id, 1);
        return { ...solved, activeEntryId: next.id, activeCell: firstEmptyCell(next, letters) };
      }

      case 'useHint': {
        if (state.completed || hintsLeft(state) === 0) return state;
        const i = state.activeCell;
        const cell = puzzle.cells[i];
        if (!cell || cell.solution === null || state.letters[i] !== '') return state;

        const letters = [...state.letters];
        letters[i] = cell.solution;
        const entry = entryById.get(state.activeEntryId);
        const activeCell = entry && !isEntrySolved(entry, letters) ? firstEmptyCell(entry, letters) : i;
        return {
          ...state,
          letters,
          revealed: [...state.revealed, i],
          completed: isPuzzleComplete(puzzle, letters),
          activeCell,
          feedback: undefined,
        };
      }

      case 'tick':
        if (state.completed || !(action.deltaMs > 0)) return state;
        return { ...state, elapsedMs: state.elapsedMs + action.deltaMs };

      case 'restart':
        // 일련번호는 이어 가서 입력창이 이전 안내와 헷갈리지 않게 한다
        return { ...createInitialState(puzzle), seq: state.seq };
    }
  };
}

/** 저장할 진행 데이터 */
export function toProgress(puzzle: Puzzle, state: GameState): Progress {
  return {
    fingerprint: puzzle.fingerprint,
    letters: [...state.letters],
    revealed: [...state.revealed],
    elapsedMs: Math.round(state.elapsedMs),
    completed: state.completed,
  };
}

/**
 * 저장된 진행을 검사한다. 손상·형식 불일치·지문 불일치·정답이 아닌 글자가 있으면 null (NFR-09).
 * 완료 여부는 칸을 보고 다시 계산한다.
 */
export function sanitizeProgress(puzzle: Puzzle, raw: unknown): Progress | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  if (p.fingerprint !== puzzle.fingerprint) return null;

  const { letters, revealed, elapsedMs } = p;
  if (!Array.isArray(letters) || letters.length !== puzzle.cells.length) return null;
  for (let i = 0; i < letters.length; i++) {
    if (letters[i] !== '' && letters[i] !== puzzle.cells[i].solution) return null;
  }

  if (!Array.isArray(revealed) || revealed.length > HINTS_PER_PUZZLE) return null;
  const seen = new Set<number>();
  for (const i of revealed) {
    if (!Number.isInteger(i) || seen.has(i)) return null;
    const cell = puzzle.cells[i];
    if (!cell || cell.solution === null || letters[i] !== cell.solution) return null;
    seen.add(i);
  }

  if (typeof elapsedMs !== 'number' || !Number.isFinite(elapsedMs) || elapsedMs < 0) return null;

  return {
    fingerprint: puzzle.fingerprint,
    letters: [...(letters as string[])],
    revealed: [...(revealed as number[])],
    elapsedMs,
    completed: isPuzzleComplete(puzzle, letters as string[]),
  };
}
