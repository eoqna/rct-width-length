// npm run generate -- --number 12 --theme 음식 [--seed 123] [--attempts 3000] [--force] [--dry]
// 단어 은행에서 조건에 맞는 단어를 골라 격자를 만들고 pNN.json을 쓴다 (design.md §9.2)
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  CATEGORY_MIN_STAGE,
  LONG_WORD,
  STAGES,
  TOTAL_PUZZLES,
  stageOf,
  targetNewGradeRatio,
} from '../src/data/stages';
import { parsePuzzle } from '../src/domain/parse';
import type { ClueType, Puzzle, PuzzleFile } from '../src/domain/types';
import { analyzePuzzle, formatIssue, hasErrors, tryParse, validateBank, validatePuzzle } from '../src/domain/validate';
import { PUZZLE_DIR, drawGrid, loadBank, loadPuzzleFiles, loadSynonyms, parseArgs, puzzleFileName, writePuzzle } from './lib/content';
import { generateGrid, type Candidate } from './lib/placer';
import { createRng, randomSeed, type Rng } from './lib/rng';

const pct = (x: number) => `${Math.round(x * 100)}%`;

function fail(message: string): never {
  console.error(`생성 실패: ${message}`);
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));
const number = Number(args.number);
if (!Number.isInteger(number) || number < 1 || number > TOTAL_PUZZLES) fail(`--number는 1~${TOTAL_PUZZLES}`);
const stage = stageOf(number);
const cfg = STAGES[stage];
const attempts = args.attempts ? Number(args.attempts) : 3000;
const path = join(PUZZLE_DIR, puzzleFileName(number));

// 기존 파일 (덮어쓰기 확인, 주제·열쇠 이어받기)
const loaded = loadPuzzleFiles();
const previous = loaded.puzzles.find((p) => (p.data as PuzzleFile | null)?.number === number)?.data as
  | PuzzleFile
  | undefined;
if (existsSync(path) && args.force !== true && args.dry !== true) fail(`${puzzleFileName(number)}이 이미 있어요 (--force로 덮어쓰기)`);
const theme = typeof args.theme === 'string' ? args.theme : previous?.theme;
if (!theme) fail('--theme이 필요해요');

const bank = loadBank();
const bankIssues = [...bank.issues, ...validateBank(bank.words)];
if (hasErrors(bankIssues)) {
  bankIssues.forEach((i) => console.error(formatIssue(i)));
  fail('단어 은행 오류를 먼저 고쳐 주세요');
}

// 재사용 규칙 (D13): 같은 단계 금지, 전체 2회까지 — 이 번호의 기존 퍼즐은 빼고 센다
const others: Puzzle[] = loaded.puzzles
  .map((p) => tryParse(p.data))
  .filter((p): p is Puzzle => p !== null && p.number !== number);
const uses = new Map<string, { total: number; sameStage: boolean }>();
for (const p of others) {
  for (const answer of new Set(p.entries.map((e) => e.answer))) {
    const u = uses.get(answer) ?? { total: 0, sameStage: false };
    u.total++;
    if (p.stage === stage) u.sameStage = true;
    uses.set(answer, u);
  }
}

const synonyms = loadSynonyms();
const candidates: Candidate[] = [];
for (const w of bank.words) {
  const len = Array.from(w.word).length;
  if (len < 2 || len > cfg.size) continue;
  if (w.grade > stage || CATEGORY_MIN_STAGE[w.category] > stage) continue;
  if (len >= LONG_WORD.length && stage < LONG_WORD.minStage) continue;
  const u = uses.get(w.word);
  if (u && (u.sameStage || u.total >= 2)) continue;
  candidates.push({
    word: w.word,
    isTheme: w.themes.includes(theme),
    isNew: stage >= 2 && w.grade === stage,
    isReused: (u?.total ?? 0) > 0,
    conflicts: synonyms.get(w.word),
  });
}
const themeCount = candidates.filter((c) => c.isTheme).length;
console.log(
  `p${String(number).padStart(2, '0')} · ${stage}단계 ${cfg.size}×${cfg.size} · 주제 '${theme}' · 후보 ${candidates.length}개 (주제 ${themeCount}개)`,
);
if (themeCount < Math.ceil(cfg.words.min * 0.4)) fail(`주제 '${theme}' 단어가 너무 적어요 (${themeCount}개)`);

// 시드를 주지 않았으면 몇 번 바꿔 가며 시도
const seeds = typeof args.seed === 'string' ? [Number(args.seed)] : Array.from({ length: 5 }, randomSeed);
let result: ReturnType<typeof generateGrid> = null;
let seed = seeds[0];
for (const s of seeds) {
  seed = s;
  result = generateGrid({
    size: cfg.size,
    words: cfg.words,
    candidates,
    rng: createRng(s),
    attempts,
    maxLongWords: stage >= LONG_WORD.minStage ? LONG_WORD.maxPerPuzzle : 0,
    targetNewRatio: stage >= 2 ? targetNewGradeRatio(number) : null,
    penalizeLong: stage <= 2,
  });
  if (result) break;
}
if (!result) fail('조건을 만족하는 격자를 못 만들었어요. 주제 단어 보강 → 주제 바꾸기 → 손 보정 순으로 해 보세요');

// 열쇠: 기존 열쇠는 이어받고, 새 단어에는 단계 비율에 맞춘 추천 유형 + 빈 text
function recommendTypes(words: string[], rng: Rng): Record<string, ClueType> {
  const types: Record<string, ClueType> = {};
  const kept = words.filter((w) => previous?.clues[w]);
  for (const w of kept) types[w] = previous!.clues[w].type;
  const fresh = words.filter((w) => !previous?.clues[w]);
  for (let i = fresh.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [fresh[i], fresh[j]] = [fresh[j], fresh[i]];
  }
  let defs = Math.round(cfg.definitionRatio * words.length) - kept.filter((w) => types[w] === 'definition').length;
  const others = cfg.clueTypes.filter((t) => t !== 'definition');
  fresh.forEach((w, k) => {
    if (defs > 0 || others.length === 0) {
      types[w] = 'definition';
      defs--;
    } else {
      types[w] = others[k % others.length];
    }
  });
  return types;
}

const puzzleForOrder = parsePuzzle({ number, theme, grid: result.grid, clues: {} });
const ordered = puzzleForOrder.entries.map((e) => e.answer);
const types = recommendTypes([...ordered], createRng(seed + 1));
const file: PuzzleFile = {
  number,
  theme,
  ...(previous?.targetTimeSec ? { targetTimeSec: previous.targetTimeSec } : {}),
  grid: result.grid,
  clues: Object.fromEntries(
    ordered.map((w) => [w, { type: types[w], text: previous?.clues[w]?.text ?? '' }]),
  ),
  meta: { seed, attempts },
};

// 출력
const bankMap = new Map(bank.words.map((w) => [w.word, w]));
const stats = analyzePuzzle(parsePuzzle(file), bankMap);
console.log(`\n${drawGrid(file.grid)}\n`);
for (const e of puzzleForOrder.entries) {
  const w = bankMap.get(e.answer)!;
  const mark = w.themes.includes(theme) ? '●' : ' ';
  console.log(`  ${e.direction === 'across' ? '가로' : '세로'} ${String(e.number).padStart(2)} ${mark} ${e.answer} (${w.grade}등급 ${w.category})`);
}
const grades = Object.entries(stats.gradeCounts)
  .map(([g, n]) => `${g}등급 ${n}`)
  .join(' · ');
console.log(
  `\n단어 ${stats.words}개 · 주제 ${pct(stats.themeRatio)} · ${grades}` +
    (stage >= 2 ? ` · 새 등급 ${pct(stats.newGradeRatio)} (목표 ${pct(targetNewGradeRatio(number))})` : '') +
    ` · 흰 칸 ${pct(stats.whiteRatio)} · 교차 ${stats.crossings} · 시드 ${seed}`,
);
const issues = validatePuzzle(file, bankMap).filter((i) => i.code !== 'C03');
issues.forEach((i) => console.log(formatIssue(i)));
const empty = Object.values(file.clues).filter((c) => !c.text).length;
if (empty) console.log(`열쇠 ${empty}개를 써야 해요`);

if (args.dry === true) {
  console.log('(--dry: 저장하지 않음)');
} else {
  console.log(`저장: ${writePuzzle(file)}`);
}
