// 퍼즐 파일 → 런타임 모델 (design.md §4.3). 앱과 도구가 같은 함수를 쓴다.
import { STAGES, stageOf } from '../data/stages';
import { fingerprintGrid } from './fingerprint';
import type { Cell, Direction, Entry, Puzzle, PuzzleFile } from './types';

export const BLOCK = '#';

/** 격자 문자열을 칸 글자 2차원 배열로. 정사각형이 아니면 오류 */
export function splitGrid(grid: readonly string[]): string[][] {
  const rows = grid.map((row) => Array.from(row));
  const n = rows.length;
  if (n === 0) throw new Error('격자가 비어 있어요');
  rows.forEach((row, r) => {
    if (row.length !== n) {
      throw new Error(`격자 ${r + 1}번째 줄이 ${row.length}칸이에요 (${n}칸이어야 함)`);
    }
  });
  return rows;
}

interface Run {
  direction: Direction;
  cells: number[];
}

/** 가로·세로로 2칸 이상 이어진 흰 칸 묶음 */
export function findRuns(rows: readonly string[][]): Run[] {
  const n = rows.length;
  const white = (r: number, c: number) =>
    r >= 0 && r < n && c >= 0 && c < n && rows[r][c] !== BLOCK;
  const runs: Run[] = [];
  for (const direction of ['across', 'down'] as const) {
    const [dr, dc] = direction === 'across' ? [0, 1] : [1, 0];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!white(r, c) || white(r - dr, c - dc)) continue;
        const cells: number[] = [];
        let rr = r;
        let cc = c;
        while (white(rr, cc)) {
          cells.push(rr * n + cc);
          rr += dr;
          cc += dc;
        }
        if (cells.length >= 2) runs.push({ direction, cells });
      }
    }
  }
  return runs;
}

export function parsePuzzle(file: PuzzleFile): Puzzle {
  const rows = splitGrid(file.grid);
  const n = rows.length;
  const stage = stageOf(file.number);

  const cells: Cell[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const ch = rows[r][c];
      cells.push({ index: r * n + c, row: r, col: c, solution: ch === BLOCK ? null : ch });
    }
  }

  // 행 우선으로 단어 시작 칸에 번호 (두 방향이 같은 칸에서 시작하면 공유)
  const runs = findRuns(rows);
  const starts = new Set(runs.map((run) => run.cells[0]));
  let next = 1;
  for (const cell of cells) {
    if (starts.has(cell.index)) cell.number = next++;
  }

  const toEntry = (run: Run): Entry => {
    const number = cells[run.cells[0]].number as number;
    const answer = run.cells.map((i) => cells[i].solution).join('');
    const clue = file.clues[answer];
    return {
      id: `${run.direction === 'across' ? 'a' : 'd'}${number}`,
      number,
      direction: run.direction,
      cells: run.cells,
      answer,
      clue: clue?.text ?? '',
      clueType: clue?.type ?? 'definition',
    };
  };

  const byNumber = (a: Entry, b: Entry) => a.number - b.number;
  const across = runs.filter((r) => r.direction === 'across').map(toEntry).sort(byNumber);
  const down = runs.filter((r) => r.direction === 'down').map(toEntry).sort(byNumber);
  const entries = [...across, ...down];

  for (const entry of entries) {
    for (const i of entry.cells) {
      if (entry.direction === 'across') cells[i].acrossId = entry.id;
      else cells[i].downId = entry.id;
    }
  }

  return {
    number: file.number,
    stage,
    theme: file.theme,
    size: n,
    cells,
    entries,
    targetTimeSec: file.targetTimeSec ?? STAGES[stage].targetTimeSec,
    fingerprint: fingerprintGrid(file.grid),
  };
}
