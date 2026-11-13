import { describe, expect, it } from 'vitest';
import {
  createGameReducer,
  createInitialState,
  hintsLeft,
  isEntrySolved,
  isPuzzleComplete,
  sanitizeProgress,
  toProgress,
  type GameState,
} from './game';
import { parsePuzzle } from './parse';
import type { PuzzleFile } from './types';

// 가로 2 고양이(5,6,7) · 4 기러기(17,18,19) / 세로 1 태양(1,6) · 2 고릴라(5,10,15) · 3 이야기(7,12,17) · 5 기차(19,24)
const file: PuzzleFile = {
  number: 2,
  theme: '동물',
  grid: ['#태###', '고양이##', '릴#야##', '라#기러기', '####차'],
  clues: {
    고양이: { type: 'definition', text: '야옹 하고 우는 동물' },
    기러기: { type: 'definition', text: '가을 철새' },
    태양: { type: 'definition', text: '낮의 별' },
    고릴라: { type: 'definition', text: '큰 동물' },
    이야기: { type: 'definition', text: '옛날 옛적에' },
    기차: { type: 'definition', text: '철길 탈것' },
  },
};
const puzzle = parsePuzzle(file);
const reduce = createGameReducer(puzzle);
const entry = (id: string) => puzzle.entries.find((e) => e.id === id)!;

/** 주어진 단어들을 맞힌 상태 */
function withSolved(ids: string[], base: GameState = createInitialState(puzzle)): GameState {
  const letters = [...base.letters];
  for (const id of ids) for (const i of entry(id).cells) letters[i] = puzzle.cells[i].solution!;
  return { ...base, letters };
}

describe('createInitialState', () => {
  it('새 게임은 빈 칸, 첫 단어의 첫 칸에서 시작', () => {
    const s = createInitialState(puzzle);
    expect(s.letters).toHaveLength(25);
    expect(s.letters.every((l) => l === '')).toBe(true);
    expect(s.activeEntryId).toBe('a2');
    expect(s.activeCell).toBe(5);
    expect(s.completed).toBe(false);
    expect(s.elapsedMs).toBe(0);
    expect(s.feedback).toBeUndefined();
  });

  it('저장된 진행이 있으면 이어서, 첫 안 푼 단어의 첫 빈 칸을 고른다', () => {
    const letters = withSolved(['a2']).letters;
    const s = createInitialState(puzzle, { letters, revealed: [], elapsedMs: 5000, completed: false });
    expect(s.elapsedMs).toBe(5000);
    expect(s.activeEntryId).toBe('a4');
    expect(s.activeCell).toBe(17);
  });
});

describe('isEntrySolved / isPuzzleComplete', () => {
  it('단어의 칸이 모두 차면 맞힌 단어', () => {
    const s = withSolved(['a2', 'a4']);
    expect(isEntrySolved(entry('a2'), s.letters)).toBe(true);
    // 이야기(7,12,17): 7·17은 교차로 찼지만 12가 비어 있음
    expect(isEntrySolved(entry('d3'), s.letters)).toBe(false);
  });

  it('흰 칸이 모두 차면 완료', () => {
    expect(isPuzzleComplete(puzzle, withSolved(['a2', 'a4']).letters)).toBe(false);
    expect(isPuzzleComplete(puzzle, withSolved(['a2', 'a4', 'd1', 'd2', 'd3', 'd5']).letters)).toBe(true);
  });
});

describe('tapCell', () => {
  it('검은 칸은 무시', () => {
    const s = createInitialState(puzzle);
    expect(reduce(s, { type: 'tapCell', index: 0 })).toBe(s);
  });

  it('현재 방향 단어가 없으면 다른 방향 단어를 고른다', () => {
    const s = reduce(createInitialState(puzzle), { type: 'tapCell', index: 1 });
    expect(s.activeEntryId).toBe('d1');
    expect(s.activeCell).toBe(1);
  });

  it('두 방향이 모두 있으면 현재 방향을 유지한다', () => {
    let s = reduce(createInitialState(puzzle), { type: 'selectEntry', entryId: 'a4' });
    s = reduce(s, { type: 'tapCell', index: 7 });
    expect(s.activeEntryId).toBe('a2');
    expect(s.activeCell).toBe(7);
  });

  it('활성 칸을 다시 누르면 방향이 바뀐다', () => {
    let s = reduce(createInitialState(puzzle), { type: 'tapCell', index: 7 });
    expect(s.activeEntryId).toBe('a2');
    s = reduce(s, { type: 'tapCell', index: 7 });
    expect(s.activeEntryId).toBe('d3');
    s = reduce(s, { type: 'tapCell', index: 7 });
    expect(s.activeEntryId).toBe('a2');
  });

  it('현재 방향 단어를 이미 맞혔고 다른 방향은 안 풀었으면 그쪽을 고른다', () => {
    const s = reduce(withSolved(['a2']), { type: 'tapCell', index: 6 });
    expect(s.activeEntryId).toBe('d1');
  });

  it('선택을 바꾸면 판정 안내를 지운다', () => {
    const wrong = reduce(createInitialState(puzzle), { type: 'submitWord', text: '고구마' });
    expect(wrong.feedback?.kind).toBe('wrong');
    expect(reduce(wrong, { type: 'tapCell', index: 1 }).feedback).toBeUndefined();
  });
});

describe('setActiveCell', () => {
  it('현재 단어 안에서만 활성 칸을 옮긴다', () => {
    const s = createInitialState(puzzle);
    expect(reduce(s, { type: 'setActiveCell', index: 6 }).activeCell).toBe(6);
    expect(reduce(s, { type: 'setActiveCell', index: 12 })).toBe(s);
  });
});

describe('selectEntry', () => {
  it('그 단어의 첫 빈 칸을 활성 칸으로', () => {
    const s = reduce(withSolved(['a2']), { type: 'selectEntry', entryId: 'd3' });
    expect(s.activeEntryId).toBe('d3');
    expect(s.activeCell).toBe(12);
  });

  it('맞힌 단어도 고를 수 있고 활성 칸은 첫 칸', () => {
    const s = reduce(withSolved(['a2']), { type: 'selectEntry', entryId: 'a2' });
    expect(s.activeEntryId).toBe('a2');
    expect(s.activeCell).toBe(5);
  });

  it('없는 단어는 무시', () => {
    const s = createInitialState(puzzle);
    expect(reduce(s, { type: 'selectEntry', entryId: 'a99' })).toBe(s);
  });
});

describe('moveEntry', () => {
  it('열쇠 순서로 다음·이전 안 푼 단어, 끝에서 처음으로 순환', () => {
    const s = createInitialState(puzzle);
    expect(reduce(s, { type: 'moveEntry', delta: 1 }).activeEntryId).toBe('a4');
    expect(reduce(s, { type: 'moveEntry', delta: -1 }).activeEntryId).toBe('d5');
  });

  it('맞힌 단어는 건너뛴다', () => {
    const s = withSolved(['a4', 'd1']);
    expect(reduce(s, { type: 'moveEntry', delta: 1 }).activeEntryId).toBe('d2');
  });

  it('모두 맞혔으면 모든 단어를 차례로 돈다', () => {
    const all = withSolved(['a2', 'a4', 'd1', 'd2', 'd3', 'd5']);
    expect(reduce(all, { type: 'moveEntry', delta: 1 }).activeEntryId).toBe('a4');
  });
});

describe('submitWord', () => {
  const start = createInitialState(puzzle);

  it('완성형 한글이 아니면 notHangul, 칸은 그대로', () => {
    const s = reduce(start, { type: 'submitWord', text: '고양ㅇ' });
    expect(s.feedback?.kind).toBe('notHangul');
    expect(s.letters).toEqual(start.letters);
  });

  it('글자 수가 다르면 length', () => {
    expect(reduce(start, { type: 'submitWord', text: '고양' }).feedback?.kind).toBe('length');
  });

  it('틀리면 wrong, 칸과 선택은 그대로', () => {
    const s = reduce(start, { type: 'submitWord', text: '고구마' });
    expect(s.feedback?.kind).toBe('wrong');
    expect(s.letters).toEqual(start.letters);
    expect(s.activeEntryId).toBe('a2');
  });

  it('맞으면 칸을 채우고 다음 안 푼 단어의 첫 빈 칸으로', () => {
    const s = reduce(start, { type: 'submitWord', text: '고양이' });
    expect(s.feedback?.kind).toBe('correct');
    expect([5, 6, 7].map((i) => s.letters[i])).toEqual(['고', '양', '이']);
    expect(s.activeEntryId).toBe('a4');
    expect(s.activeCell).toBe(17);
  });

  it('입력은 정규화한 뒤 비교한다', () => {
    expect(reduce(start, { type: 'submitWord', text: ' 고 양이 ' }).feedback?.kind).toBe('correct');
  });

  it('교차로 다 찬 단어는 다음 단어에서 건너뛴다', () => {
    // 태양(1,6): 6은 고양이로 참. 1만 힌트로 채운 뒤 고양이를 맞히면 d1도 풀림
    let s = reduce(start, { type: 'selectEntry', entryId: 'd1' });
    s = reduce(s, { type: 'useHint' });
    s = reduce(s, { type: 'selectEntry', entryId: 'a2' });
    s = withSolved(['a4', 'd2', 'd3'], s);
    s = reduce(s, { type: 'submitWord', text: '고양이' });
    expect(isEntrySolved(entry('d1'), s.letters)).toBe(true);
    expect(s.activeEntryId).toBe('d5');
  });

  it('이미 맞힌 단어에 제출하면 무시', () => {
    const solved = reduce(withSolved(['a2']), { type: 'selectEntry', entryId: 'a2' });
    expect(reduce(solved, { type: 'submitWord', text: '고양이' })).toBe(solved);
  });

  it('마지막 단어를 맞히면 완료', () => {
    let s = withSolved(['a2', 'a4', 'd1', 'd2', 'd3']);
    s = reduce(s, { type: 'selectEntry', entryId: 'd5' });
    s = reduce(s, { type: 'submitWord', text: '기차' });
    expect(s.completed).toBe(true);
    expect(s.feedback?.kind).toBe('correct');
  });

  it('같은 결과가 반복돼도 일련번호가 오른다', () => {
    const a = reduce(start, { type: 'submitWord', text: '고구마' });
    const b = reduce(a, { type: 'submitWord', text: '고구마' });
    expect(b.feedback!.seq).toBeGreaterThan(a.feedback!.seq);
  });
});

describe('useHint', () => {
  it('활성 칸의 정답을 공개하고 기록한다', () => {
    const s = reduce(createInitialState(puzzle), { type: 'useHint' });
    expect(s.letters[5]).toBe('고');
    expect(s.revealed).toEqual([5]);
    expect(hintsLeft(s)).toBe(2);
  });

  it('공개한 뒤 아직 안 풀렸으면 단어의 다음 빈 칸으로', () => {
    expect(reduce(createInitialState(puzzle), { type: 'useHint' }).activeCell).toBe(6);
  });

  it('채워진 칸에는 쓸 수 없다', () => {
    const s = reduce(withSolved(['d2']), { type: 'setActiveCell', index: 5 });
    expect(reduce(s, { type: 'useHint' })).toBe(s);
  });

  it('3회를 다 쓰면 더 쓸 수 없다', () => {
    let s = createInitialState(puzzle);
    for (let i = 0; i < 3; i++) s = reduce(s, { type: 'useHint' });
    expect(hintsLeft(s)).toBe(0);
    const after = reduce(s, { type: 'selectEntry', entryId: 'a4' });
    expect(reduce(after, { type: 'useHint' })).toBe(after);
  });

  it('힌트로 흰 칸이 모두 차면 완료', () => {
    const letters = withSolved(['a2', 'a4', 'd1', 'd2', 'd3']).letters;
    let s = createInitialState(puzzle, { letters, revealed: [], elapsedMs: 0, completed: false });
    s = reduce(s, { type: 'selectEntry', entryId: 'd5' });
    expect(s.activeCell).toBe(24);
    s = reduce(s, { type: 'useHint' });
    expect(s.completed).toBe(true);
  });
});

describe('tick', () => {
  it('경과 시간을 더한다', () => {
    expect(reduce(createInitialState(puzzle), { type: 'tick', deltaMs: 1000 }).elapsedMs).toBe(1000);
  });
});

describe('완료 상태', () => {
  const done: GameState = { ...withSolved(['a2', 'a4', 'd1', 'd2', 'd3', 'd5']), completed: true };

  it('칸을 바꾸는 액션과 tick은 무시', () => {
    expect(reduce(done, { type: 'tick', deltaMs: 1000 })).toBe(done);
    expect(reduce(done, { type: 'useHint' })).toBe(done);
    expect(reduce(done, { type: 'submitWord', text: '고양이' })).toBe(done);
  });

  it('선택 이동은 된다', () => {
    expect(reduce(done, { type: 'tapCell', index: 24 }).activeEntryId).toBe('d5');
  });
});

describe('restart', () => {
  it('칸·힌트·시간·완료를 모두 처음으로', () => {
    const done: GameState = {
      ...withSolved(['a2', 'a4', 'd1', 'd2', 'd3', 'd5']),
      revealed: [5],
      elapsedMs: 9000,
      completed: true,
    };
    const s = reduce(done, { type: 'restart' });
    expect(s.letters.every((l) => l === '')).toBe(true);
    expect(s.revealed).toEqual([]);
    expect(s.elapsedMs).toBe(0);
    expect(s.completed).toBe(false);
    expect(s.activeEntryId).toBe('a2');
  });
});

describe('sanitizeProgress / toProgress', () => {
  const valid = toProgress(puzzle, reduce(createInitialState(puzzle), { type: 'useHint' }));

  it('저장 형식으로 바꾸고 다시 읽을 수 있다', () => {
    expect(valid).toMatchObject({ fingerprint: puzzle.fingerprint, revealed: [5], completed: false });
    expect(sanitizeProgress(puzzle, JSON.parse(JSON.stringify(valid)))).toEqual(valid);
  });

  it('지문이 다르면 버린다', () => {
    expect(sanitizeProgress(puzzle, { ...valid, fingerprint: 'deadbeef' })).toBeNull();
  });

  it('형식이 깨졌으면 버린다', () => {
    expect(sanitizeProgress(puzzle, null)).toBeNull();
    expect(sanitizeProgress(puzzle, '{')).toBeNull();
    expect(sanitizeProgress(puzzle, { ...valid, letters: ['고'] })).toBeNull();
    expect(sanitizeProgress(puzzle, { ...valid, elapsedMs: -1 })).toBeNull();
    expect(sanitizeProgress(puzzle, { ...valid, revealed: [0] })).toBeNull();
    expect(sanitizeProgress(puzzle, { ...valid, revealed: [5, 6, 7, 10] })).toBeNull();
  });

  it('정답이 아닌 글자가 있으면 버린다', () => {
    const letters = [...valid.letters];
    letters[6] = '앙';
    expect(sanitizeProgress(puzzle, { ...valid, letters })).toBeNull();
  });

  it('완료 여부는 칸으로 다시 계산한다', () => {
    expect(sanitizeProgress(puzzle, { ...valid, completed: true })?.completed).toBe(false);
  });
});
