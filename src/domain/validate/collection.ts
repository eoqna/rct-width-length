// 전체 모음 검사: W03, 단계 단위 W06·C05, S01·S02, B01 (design.md §9.4)
import {
  CLUE_RATIO_TOLERANCE,
  NEW_GRADE_RATIO,
  PUZZLES_PER_STAGE,
  STAGES,
  TOTAL_PUZZLES,
  positionInStage,
} from '../../data/stages';
import type { BankWord, Puzzle, Stage } from '../types';
import { validateBank } from './bank';
import { error, pct, warning, type Issue } from './issue';
import { analyzePuzzle, tryParse, validatePuzzle } from './puzzle';

const EPS = 1e-9;
const avg = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** W06 단계 단위: 평균 25~40%, 앞 5개 평균 ≤ 뒤 5개 평균. ratios는 단계 안 순번 순 */
export function checkStageNewGrade(stage: Stage, ratios: readonly number[]): Issue[] {
  const issues: Issue[] = [];
  const mean = avg(ratios);
  const problems: string[] = [];
  if (mean < NEW_GRADE_RATIO.from - EPS || mean > NEW_GRADE_RATIO.to + EPS) {
    problems.push(`평균 ${pct(mean)} (${pct(NEW_GRADE_RATIO.from)}~${pct(NEW_GRADE_RATIO.to)})`);
  }
  const half = Math.floor(ratios.length / 2);
  const front = avg(ratios.slice(0, half));
  const back = avg(ratios.slice(half));
  if (front > back + EPS) problems.push(`앞 ${half}개 평균 ${pct(front)} > 뒤 ${ratios.length - half}개 평균 ${pct(back)}`);
  if (problems.length) issues.push(error('W06', `${stage}단계 ${stage}등급 단어 비율: ${problems.join(', ')}`));
  return issues;
}

/** C05: 단계 전체 뜻풀이 비율이 기준 ±10%p */
export function checkStageClueRatio(stage: Stage, definitions: number, total: number): Issue[] {
  const target = STAGES[stage].definitionRatio;
  const ratio = total ? definitions / total : 0;
  if (Math.abs(ratio - target) > CLUE_RATIO_TOLERANCE + EPS) {
    return [error('C05', `${stage}단계 뜻풀이 비율 ${pct(ratio)} (기준 ${pct(target)} ±${pct(CLUE_RATIO_TOLERANCE)}p)`)];
  }
  return [];
}

export interface CollectionInput {
  files: readonly unknown[];
  bank: readonly BankWord[];
  /** 배포 전 검사: 빠진 퍼즐이 있으면 오류 */
  release?: boolean;
}

export function validateCollection({ files, bank, release = false }: CollectionInput): Issue[] {
  const issues: Issue[] = [...validateBank(bank)];
  const bankMap = new Map(bank.map((w) => [w.word, w]));

  const perPuzzle = files.map((f) => validatePuzzle(f, bankMap));
  issues.push(...perPuzzle.flat());

  const parsed = files.map(tryParse);
  const puzzles = parsed.filter((p): p is Puzzle => p !== null);

  // S01 — 번호
  const byNumber = new Map<number, Puzzle[]>();
  for (const p of puzzles) byNumber.set(p.number, [...(byNumber.get(p.number) ?? []), p]);
  for (const [number, list] of byNumber) {
    if (list.length > 1) issues.push(error('S01', `퍼즐 번호 ${number}가 ${list.length}개예요`, number));
  }
  const missing: number[] = [];
  for (let n = 1; n <= TOTAL_PUZZLES; n++) if (!byNumber.has(n)) missing.push(n);
  if (missing.length) {
    const message = `빠진 퍼즐 ${missing.length}개: ${missing.join(', ')}`;
    issues.push(release ? error('S01', message) : warning('S01', message));
  }

  // S02 — 주제 중복
  const byTheme = new Map<string, number[]>();
  for (const p of puzzles) byTheme.set(p.theme, [...(byTheme.get(p.theme) ?? []), p.number]);
  for (const [theme, numbers] of byTheme) {
    if (numbers.length > 1) issues.push(warning('S02', `주제 '${theme}'가 겹쳐요: ${numbers.join(', ')}번`));
  }

  // W03 — 재사용
  const uses = new Map<string, Puzzle[]>();
  for (const p of puzzles) {
    for (const answer of new Set(p.entries.map((e) => e.answer))) {
      uses.set(answer, [...(uses.get(answer) ?? []), p]);
    }
  }
  for (const [answer, list] of uses) {
    const numbers = list.map((p) => p.number).sort((a, b) => a - b);
    if (list.length > 2) {
      issues.push(error('W03', `'${answer}'를 ${list.length}번 썼어요 (최대 2번): ${numbers.join(', ')}번`));
    }
    const stages = list.map((p) => p.stage);
    if (new Set(stages).size < stages.length) {
      issues.push(error('W03', `'${answer}'를 같은 단계에서 다시 썼어요: ${numbers.join(', ')}번`));
    }
  }

  // 단계 단위 — 그 단계 퍼즐 10개가 모두 문제없이 있을 때만
  for (const stage of [1, 2, 3, 4, 5] as Stage[]) {
    const members = puzzles
      .filter((p) => p.stage === stage)
      .sort((a, b) => a.number - b.number);
    const numbers = new Set(members.map((p) => p.number));
    if (numbers.size !== PUZZLES_PER_STAGE || members.length !== PUZZLES_PER_STAGE) continue;

    const stats = members.map((p) => analyzePuzzle(p, bankMap));
    if (stage >= 2) {
      const ratios: number[] = [];
      members.forEach((p, k) => (ratios[positionInStage(p.number) - 1] = stats[k].newGradeRatio));
      issues.push(...checkStageNewGrade(stage, ratios));
    }
    const definitions = stats.reduce((a, s) => a + s.definitionClues, 0);
    const total = stats.reduce((a, s) => a + s.words, 0);
    issues.push(...checkStageClueRatio(stage, definitions, total));
  }

  return issues;
}
