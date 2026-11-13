// 단계 설정 — 앱(목표 시간)과 콘텐츠 도구(생성·검증)가 함께 쓴다 (design.md §9.1)
import type { Category, ClueType, Stage } from '../domain/types';

export interface StageConfig {
  stage: Stage;
  name: string;
  /** 격자 한 변 N */
  size: number;
  words: { min: number; max: number };
  /** 단계 전체 뜻풀이형 열쇠 비율 */
  definitionRatio: number;
  clueTypes: readonly ClueType[];
  targetTimeSec: number;
}

export const STAGES: Readonly<Record<Stage, StageConfig>> = {
  1: {
    stage: 1,
    name: '입문',
    size: 5,
    words: { min: 6, max: 8 },
    definitionRatio: 1,
    clueTypes: ['definition'],
    targetTimeSec: 180,
  },
  2: {
    stage: 2,
    name: '초급',
    size: 6,
    words: { min: 8, max: 10 },
    definitionRatio: 0.8,
    clueTypes: ['definition', 'association'],
    targetTimeSec: 300,
  },
  3: {
    stage: 3,
    name: '중급',
    size: 7,
    words: { min: 10, max: 13 },
    definitionRatio: 0.6,
    clueTypes: ['definition', 'association', 'blank'],
    targetTimeSec: 480,
  },
  4: {
    stage: 4,
    name: '중상급',
    size: 8,
    words: { min: 12, max: 15 },
    definitionRatio: 0.4,
    clueTypes: ['definition', 'association', 'blank', 'trivia'],
    targetTimeSec: 720,
  },
  5: {
    stage: 5,
    name: '상급',
    size: 9,
    words: { min: 14, max: 18 },
    definitionRatio: 0.3,
    clueTypes: ['definition', 'association', 'blank', 'trivia'],
    targetTimeSec: 900,
  },
};

export const STAGE_LIST: readonly StageConfig[] = [1, 2, 3, 4, 5].map((s) => STAGES[s as Stage]);

export const PUZZLES_PER_STAGE = 10;
export const TOTAL_PUZZLES = 50;
export const HINTS_PER_PUZZLE = 3;

/** 퍼즐 번호 → 단계 (⌈번호 / 10⌉, 1~5로 제한) */
export function stageOf(number: number): Stage {
  const s = Math.ceil(number / PUZZLES_PER_STAGE);
  return Math.min(5, Math.max(1, s)) as Stage;
}

/** 단계 안에서 몇 번째 퍼즐인가 (1~10) */
export function positionInStage(number: number): number {
  return ((number - 1) % PUZZLES_PER_STAGE) + 1;
}

// ── 콘텐츠 규칙 (requirements.md §4) ──

/** 범주별 첫 등장 단계 (§4.2 확장 어휘 등장 시점) */
export const CATEGORY_MIN_STAGE: Readonly<Record<Category, Stage>> = {
  general: 1,
  loan: 1,
  concept: 3,
  proper: 4,
  idiom: 4,
};

/** 범주별 최소 등급 (design.md §4.1) */
export const CATEGORY_MIN_GRADE: Readonly<Record<Category, number>> = {
  general: 1,
  loan: 1,
  concept: 3,
  proper: 4,
  idiom: 4,
};

export const CATEGORIES: readonly Category[] = ['general', 'loan', 'idiom', 'proper', 'concept'];

/** 2단계부터: 자기 단계 등급 단어 비율 (단계 안에서 25% → 40%) */
export const NEW_GRADE_RATIO = { from: 0.25, to: 0.4, perPuzzleMax: 0.5 } as const;

/** 주제 단어 비율 */
export const THEME_RATIO = { min: 0.4, max: 0.6 } as const;

/** 5음절 이상 단어: 4단계부터, 퍼즐당 2개 이하 */
export const LONG_WORD = { length: 5, minStage: 4, maxPerPuzzle: 2 } as const;

export const CLUE_MAX_LENGTH = 40;

/** 단계 전체 열쇠 유형 비율 허용 오차 (±10%p) */
export const CLUE_RATIO_TOLERANCE = 0.1;

/** 흰 칸 비율 권장 하한 (G04 경고) */
export const MIN_WHITE_RATIO = 0.4;

/** 단계 안 순번에 따른 새 등급 단어 목표 비율 */
export function targetNewGradeRatio(number: number): number {
  const t = (positionInStage(number) - 1) / (PUZZLES_PER_STAGE - 1);
  return NEW_GRADE_RATIO.from + (NEW_GRADE_RATIO.to - NEW_GRADE_RATIO.from) * t;
}
