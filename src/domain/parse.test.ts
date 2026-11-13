import { describe, expect, it } from 'vitest';
import { fingerprintGrid } from './fingerprint';
import { parsePuzzle } from './parse';
import type { PuzzleFile } from './types';

// design.md §4.2 예시
const example: PuzzleFile = {
  number: 2,
  theme: '동물',
  grid: ['#태###', '고양이##', '릴#야##', '라#기러기', '####차'],
  clues: {
    고양이: { type: 'definition', text: '야옹 하고 울며 쥐를 잘 잡는 동물' },
    기러기: { type: 'definition', text: '가을에 줄지어 날아오는 철새' },
    태양: { type: 'definition', text: '낮 하늘에서 빛과 열을 내리쬐는 별' },
    고릴라: { type: 'definition', text: '몸집이 크고 가슴을 쿵쿵 두드리는 동물' },
    이야기: { type: 'definition', text: "할머니가 '옛날 옛적에' 하며 들려주는 것" },
    기차: { type: 'definition', text: '철길 위를 달리는 긴 탈것' },
  },
};

describe('parsePuzzle', () => {
  const puzzle = parsePuzzle(example);

  it('크기·단계·주제를 계산한다', () => {
    expect(puzzle.size).toBe(5);
    expect(puzzle.stage).toBe(1);
    expect(puzzle.theme).toBe('동물');
    expect(puzzle.number).toBe(2);
  });

  it('단계는 ⌈번호 / 10⌉', () => {
    expect(parsePuzzle({ ...example, number: 10 }).stage).toBe(1);
    expect(parsePuzzle({ ...example, number: 11 }).stage).toBe(2);
    expect(parsePuzzle({ ...example, number: 50 }).stage).toBe(5);
  });

  it('목표 시간은 파일 값, 없으면 단계 기본값', () => {
    expect(puzzle.targetTimeSec).toBe(180);
    expect(parsePuzzle({ ...example, targetTimeSec: 240 }).targetTimeSec).toBe(240);
  });

  it('지문은 격자의 지문', () => {
    expect(puzzle.fingerprint).toBe(fingerprintGrid(example.grid));
  });

  it('칸을 행 우선으로 만들고 검은 칸은 solution이 null', () => {
    expect(puzzle.cells).toHaveLength(25);
    expect(puzzle.cells[0]).toMatchObject({ index: 0, row: 0, col: 0, solution: null });
    expect(puzzle.cells[6]).toMatchObject({ index: 6, row: 1, col: 1, solution: '양' });
  });

  it('행 우선으로 번호를 매기고 같은 칸에서 시작하면 번호를 공유한다', () => {
    const numbered = puzzle.cells.filter((c) => c.number).map((c) => [c.index, c.number]);
    expect(numbered).toEqual([
      [1, 1],
      [5, 2],
      [7, 3],
      [17, 4],
      [19, 5],
    ]);
  });

  it('단어는 가로(번호순) → 세로(번호순)', () => {
    expect(puzzle.entries.map((e) => `${e.id}:${e.answer}`)).toEqual([
      'a2:고양이',
      'a4:기러기',
      'd1:태양',
      'd2:고릴라',
      'd3:이야기',
      'd5:기차',
    ]);
  });

  it('단어마다 칸 목록과 열쇠가 붙는다', () => {
    const d3 = puzzle.entries.find((e) => e.id === 'd3');
    expect(d3).toMatchObject({
      number: 3,
      direction: 'down',
      cells: [7, 12, 17],
      clue: "할머니가 '옛날 옛적에' 하며 들려주는 것",
      clueType: 'definition',
    });
  });

  it('칸마다 소속 단어를 기록한다', () => {
    expect(puzzle.cells[6]).toMatchObject({ acrossId: 'a2', downId: 'd1' });
    expect(puzzle.cells[19]).toMatchObject({ acrossId: 'a4', downId: 'd5' });
    expect(puzzle.cells[12].acrossId).toBeUndefined();
    expect(puzzle.cells[12].downId).toBe('d3');
  });

  it('열쇠가 없는 단어는 빈 열쇠로 둔다 (검증기가 잡음)', () => {
    const { 기차: _omit, ...rest } = example.clues;
    void _omit;
    const p = parsePuzzle({ ...example, clues: rest });
    expect(p.entries.find((e) => e.id === 'd5')?.clue).toBe('');
  });

  it('줄 길이가 다르면 오류', () => {
    expect(() => parsePuzzle({ ...example, grid: ['가나', '다'] })).toThrow();
  });
});
