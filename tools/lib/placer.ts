// 격자 생성기 핵심: 무작위 탐욕 배치를 여러 번 시도해 가장 좋은 결과를 고른다 (design.md §9.2)
//
// 배치 규칙 (의도하지 않은 단어가 생기지 않게)
// - 겹치는 칸은 같은 음절이고, 그 칸에 같은 방향 단어가 이미 지나가지 않음
// - 새로 채우는 칸의 양옆(수직 방향 이웃)은 비어 있음
// - 단어 바로 앞뒤 칸은 비어 있음
// - 이미 놓은 단어와 연속 2음절이 겹치지 않음 (종이·색종이·종이학 같은 중복 방지)
// - 같은 뜻 묶음(content/synonyms.txt)의 단어는 하나만 (검정·검은색, 지하철·전철)
// 이 규칙을 지키면 격자의 가로·세로 흰 칸 묶음은 놓은 단어와 정확히 같다.
import { LONG_WORD, MIN_WHITE_RATIO, NEW_GRADE_RATIO, THEME_RATIO } from '../../src/data/stages';
import type { Rng } from './rng';

export interface Candidate {
  word: string;
  /** 퍼즐 주제 단어인가 */
  isTheme: boolean;
  /** 자기 단계 등급(새 등급) 단어인가 */
  isNew: boolean;
  /** 다른 퍼즐에서 이미 쓴 단어인가 — 되도록 피해 퍼즐마다 새 단어를 만나게 한다 */
  isReused?: boolean;
  /** 같은 뜻 묶음 이름 — 같은 묶음의 단어는 한 퍼즐에 하나만 (content/synonyms.txt) */
  conflicts?: readonly string[];
}

export interface GenerateOptions {
  size: number;
  words: { min: number; max: number };
  candidates: readonly Candidate[];
  rng: Rng;
  attempts: number;
  /** 5음절 이상 단어 최대 개수 */
  maxLongWords: number;
  /** 새 등급 단어 목표 비율. 1단계는 null */
  targetNewRatio: number | null;
  /** 낮은 단계: 4음절 이상 단어 감점 */
  penalizeLong?: boolean;
}

export interface GenerateStats {
  words: number;
  themeWords: number;
  newWords: number;
  whiteRatio: number;
  crossings: number;
  longWords: number;
}

export interface GenerateResult {
  grid: string[];
  words: string[];
  score: number;
  stats: GenerateStats;
  /** 몇 번째 시도에서 나왔나 */
  attempt: number;
}

interface Cand extends Candidate {
  id: number;
  syl: string[];
  /** 함께 놓을 수 없는 열쇠: 연속 2음절 조각(종이·색종이) + 같은 뜻 묶음(검정·검은색) */
  bigrams: string[];
}

interface Move {
  c: Cand;
  r0: number;
  c0: number;
  /** 0 = 가로, 1 = 세로 */
  dir: 0 | 1;
  crossings: number;
}

const EPS = 1e-9;
const NEW_RATIO_TOLERANCE = 0.1;

export function generateGrid(opts: GenerateOptions): GenerateResult | null {
  const N = opts.size;
  const cands: Cand[] = opts.candidates
    .map((c, id) => {
      const syl = Array.from(c.word);
      const pieces = syl.slice(1).map((s, i) => syl[i] + s);
      return { ...c, id, syl, bigrams: [...pieces, ...(c.conflicts ?? []).map((g) => `묶음:${g}`)] };
    })
    .filter((c) => c.syl.length >= 2 && c.syl.length <= N);

  const index = new Map<string, { c: Cand; pos: number }[]>();
  for (const c of cands) {
    c.syl.forEach((s, pos) => {
      const list = index.get(s);
      if (list) list.push({ c, pos });
      else index.set(s, [{ c, pos }]);
    });
  }
  const starters = cands.filter((c) => c.isTheme);
  if (starters.length === 0) return null;

  let best: (GenerateResult & { tier: number }) | null = null;
  for (let attempt = 0; attempt < opts.attempts; attempt++) {
    const found = runAttempt(opts, N, index, starters, attempt);
    if (found && (!best || found.tier > best.tier || (found.tier === best.tier && found.score > best.score))) {
      best = found;
    }
  }
  if (!best) return null;
  const { tier: _tier, ...result } = best;
  void _tier;
  return result;
}

function runAttempt(
  opts: GenerateOptions,
  N: number,
  index: Map<string, { c: Cand; pos: number }[]>,
  starters: Cand[],
  attempt: number,
): (GenerateResult & { tier: number }) | null {
  const { rng, words: range, targetNewRatio, maxLongWords } = opts;
  const cells: string[] = Array(N * N).fill('');
  const ownA = new Int16Array(N * N).fill(-1);
  const ownD = new Int16Array(N * N).fill(-1);
  const rowFill = new Int16Array(N);
  const colFill = new Int16Array(N);
  const placed: Move[] = [];
  const used = new Set<number>();
  const usedBigrams = new Set<string>();
  let themeCount = 0;
  let newCount = 0;
  let longCount = 0;
  let reusedCount = 0;
  let best: (GenerateResult & { tier: number }) | null = null;

  const inside = (r: number, c: number) => r >= 0 && c >= 0 && r < N && c < N;
  const isLong = (c: Cand) => c.syl.length >= LONG_WORD.length;

  const check = (c: Cand, r0: number, c0: number, dir: 0 | 1): number => {
    const dr = dir === 1 ? 1 : 0;
    const dc = dir === 0 ? 1 : 0;
    const len = c.syl.length;
    const rEnd = r0 + dr * (len - 1);
    const cEnd = c0 + dc * (len - 1);
    if (!inside(r0, c0) || !inside(rEnd, cEnd)) return -1;
    if (inside(r0 - dr, c0 - dc) && cells[(r0 - dr) * N + (c0 - dc)] !== '') return -1;
    if (inside(rEnd + dr, cEnd + dc) && cells[(rEnd + dr) * N + (cEnd + dc)] !== '') return -1;
    let crossings = 0;
    for (let k = 0; k < len; k++) {
      const r = r0 + dr * k;
      const col = c0 + dc * k;
      const i = r * N + col;
      const ch = cells[i];
      if (ch !== '') {
        if (ch !== c.syl[k]) return -1;
        if ((dir === 0 ? ownA[i] : ownD[i]) !== -1) return -1;
        crossings++;
      } else {
        // 수직 방향 이웃은 비어 있어야 한다
        if (inside(r + dc, col + dr) && cells[(r + dc) * N + col + dr] !== '') return -1;
        if (inside(r - dc, col - dr) && cells[(r - dc) * N + col - dr] !== '') return -1;
      }
    }
    if (crossings === len) return -1;
    return crossings;
  };

  const place = (m: Move) => {
    const dr = m.dir === 1 ? 1 : 0;
    const dc = m.dir === 0 ? 1 : 0;
    m.c.syl.forEach((s, k) => {
      const r = m.r0 + dr * k;
      const col = m.c0 + dc * k;
      const i = r * N + col;
      if (cells[i] === '') {
        rowFill[r]++;
        colFill[col]++;
      }
      cells[i] = s;
      if (m.dir === 0) ownA[i] = placed.length;
      else ownD[i] = placed.length;
    });
    placed.push(m);
    used.add(m.c.id);
    for (const b of m.c.bigrams) usedBigrams.add(b);
    if (m.c.isTheme) themeCount++;
    if (m.c.isNew) newCount++;
    if (isLong(m.c)) longCount++;
    if (m.c.isReused) reusedCount++;
  };

  const snapshot = () => {
    const words = placed.length;
    const themeRatio = themeCount / words;
    if (themeRatio < THEME_RATIO.min - EPS || themeRatio > THEME_RATIO.max + EPS) return;
    for (let k = 0; k < N; k++) if (rowFill[k] === 0 || colFill[k] === 0) return;
    if (targetNewRatio !== null) {
      const ratio = newCount / words;
      if (newCount < 1 || ratio > NEW_GRADE_RATIO.perPuzzleMax + EPS) return;
      // 단계 평균이 25~40%에 들고 앞쪽이 뒤쪽보다 쉽게: 퍼즐마다 목표의 ±10%p 안
      if (Math.abs(ratio - targetNewRatio) > NEW_RATIO_TOLERANCE + EPS) return;
    }

    let white = 0;
    let crossings = 0;
    for (let i = 0; i < N * N; i++) {
      if (cells[i] === '') continue;
      white++;
      if (ownA[i] !== -1 && ownD[i] !== -1) crossings++;
    }
    const whiteRatio = white / (N * N);
    const longish = placed.filter((m) => m.c.syl.length >= 4).length;
    let score = 40 * whiteRatio + 1.5 * crossings + 0.5 * words;
    if (targetNewRatio !== null) score -= 30 * Math.abs(newCount / words - targetNewRatio);
    if (opts.penalizeLong) score -= 3 * longish;
    score -= 3 * reusedCount;
    const tier = whiteRatio >= MIN_WHITE_RATIO - EPS ? 1 : 0;
    if (best && (tier < best.tier || (tier === best.tier && score <= best.score))) return;

    const grid: string[] = [];
    for (let r = 0; r < N; r++) {
      let row = '';
      for (let c = 0; c < N; c++) row += cells[r * N + c] || '#';
      grid.push(row);
    }
    best = {
      grid,
      words: placed.map((m) => m.c.word),
      score,
      tier,
      attempt,
      stats: { words, themeWords: themeCount, newWords: newCount, whiteRatio, crossings, longWords: longCount },
    };
  };

  // 첫 단어: 주제 단어 하나를 가로로
  const first = rng.pick(starters);
  const r0 = rng.int(N);
  const c0 = rng.int(N - first.syl.length + 1);
  place({ c: first, r0, c0, dir: 0, crossings: 0 });

  while (placed.length < range.max) {
    const moves: Move[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < N * N; i++) {
      const ch = cells[i];
      if (ch === '') continue;
      const list = index.get(ch);
      if (!list) continue;
      const r = Math.floor(i / N);
      const col = i % N;
      for (const dir of [0, 1] as const) {
        if ((dir === 0 ? ownA[i] : ownD[i]) !== -1) continue;
        for (const { c, pos } of list) {
          if (used.has(c.id)) continue;
          if (isLong(c) && longCount >= maxLongWords) continue;
          if (c.bigrams.some((b) => usedBigrams.has(b))) continue;
          const mr = dir === 0 ? r : r - pos;
          const mc = dir === 0 ? col - pos : col;
          const key = `${c.id}:${dir}:${mr}:${mc}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const crossings = check(c, mr, mc, dir);
          if (crossings > 0) moves.push({ c, r0: mr, c0: mc, dir, crossings });
        }
      }
    }
    if (moves.length === 0) break;

    // 휴리스틱 + 무작위 잡음으로 하나를 고른다
    const n = placed.length;
    const themeRatio = themeCount / n;
    const newRatio = newCount / n;
    let pick = moves[0];
    let pickScore = -Infinity;
    for (const m of moves) {
      const dr = m.dir === 1 ? 1 : 0;
      const dc = m.dir === 0 ? 1 : 0;
      const rows = new Set<number>();
      const cols = new Set<number>();
      for (let k = 0; k < m.c.syl.length; k++) {
        const r = m.r0 + dr * k;
        const col = m.c0 + dc * k;
        if (rowFill[r] === 0) rows.add(r);
        if (colFill[col] === 0) cols.add(col);
      }
      let h = 3 * m.crossings + 2 * (rows.size + cols.size) + 0.5 * m.c.syl.length;
      if (m.c.isTheme) h += themeRatio < 0.5 ? 3 : -2;
      else h += themeRatio >= 0.5 ? 1.5 : 0;
      if (targetNewRatio !== null && m.c.isNew) {
        h += newRatio < targetNewRatio ? 2.5 : (newCount + 1) / (n + 1) > NEW_GRADE_RATIO.perPuzzleMax ? -6 : -1;
      }
      if (opts.penalizeLong && m.c.syl.length >= 4) h -= 2;
      if (m.c.isReused) h -= 6;
      h += rng.next() * 5;
      if (h > pickScore) {
        pickScore = h;
        pick = m;
      }
    }
    place(pick);
    if (placed.length >= range.min) snapshot();
  }
  return best;
}
