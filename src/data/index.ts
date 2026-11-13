// 퍼즐 50개를 앱에 번들하고 파싱한다 (design.md A5)
import { parsePuzzle } from '../domain/parse';
import type { Puzzle, PuzzleFile, Stage } from '../domain/types';

const modules = import.meta.glob<PuzzleFile>('./puzzles/p*.json', { eager: true, import: 'default' });

function load(): Puzzle[] {
  const list: Puzzle[] = [];
  for (const [path, file] of Object.entries(modules)) {
    try {
      list.push(parsePuzzle(file));
    } catch (e) {
      // 배포 빌드는 검증기가 막는다. 개발 중 깨진 파일은 건너뛰고 알린다
      console.error(`퍼즐을 읽을 수 없어요: ${path}`, e);
    }
  }
  return list.sort((a, b) => a.number - b.number);
}

export const PUZZLES: readonly Puzzle[] = load();

const byNumber = new Map(PUZZLES.map((p) => [p.number, p]));

export function getPuzzle(number: number): Puzzle | undefined {
  return byNumber.get(number);
}

export function puzzlesOfStage(stage: Stage): Puzzle[] {
  return PUZZLES.filter((p) => p.stage === stage);
}
