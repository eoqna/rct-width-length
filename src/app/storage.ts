// localStorage 래퍼 (design.md §4.4)
// - 키 접두사 wl:v1:
// - 읽기 실패(손상·형식·지문 불일치) → 그 키만 지우고 새로 시작
// - 쓰기 실패(사생활 보호 모드·용량 초과) → 메모리에 두고 계속, 목록 화면에 안내
import { sanitizeProgress } from '../domain/game';
import type { BestRecord, Progress, Puzzle } from '../domain/types';

export const PREFIX = 'wl:v1:';

export interface Prefs {
  onboardingDone: boolean;
}

const memory = new Map<string, string>();
let writeFailed = false;

function backend(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readRaw(key: string): string | null {
  if (memory.has(key)) return memory.get(key) ?? null;
  try {
    return backend()?.getItem(PREFIX + key) ?? null;
  } catch {
    return null;
  }
}

function remove(key: string) {
  memory.delete(key);
  try {
    backend()?.removeItem(PREFIX + key);
  } catch {
    // 지울 수 없어도 메모리에서는 지웠다
  }
}

function read(key: string): unknown {
  const raw = readRaw(key);
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    remove(key);
    return undefined;
  }
}

function write(key: string, value: unknown) {
  const raw = JSON.stringify(value);
  try {
    const store = backend();
    if (!store) throw new Error('localStorage 없음');
    store.setItem(PREFIX + key, raw);
    memory.delete(key);
  } catch {
    writeFailed = true;
    memory.set(key, raw);
  }
}

/** 이번 실행에서 저장에 실패한 적이 있는가 */
export function storageFailed(): boolean {
  if (!backend()) return true;
  return writeFailed;
}

// ── 진행 ──

export function loadProgress(puzzle: Puzzle): Progress | null {
  const key = `progress:${puzzle.number}`;
  const raw = read(key);
  if (raw === undefined) return null;
  const progress = sanitizeProgress(puzzle, raw);
  if (!progress) remove(key);
  return progress;
}

export function saveProgress(puzzle: Puzzle, progress: Progress) {
  write(`progress:${puzzle.number}`, progress);
}

// ── 기록 ──

function isRecord(x: unknown): x is BestRecord {
  if (!x || typeof x !== 'object') return false;
  const r = x as Record<string, unknown>;
  return (
    (r.stars === 1 || r.stars === 2 || r.stars === 3) &&
    typeof r.bestTimeMs === 'number' &&
    Number.isFinite(r.bestTimeMs) &&
    r.bestTimeMs >= 0 &&
    typeof r.clearedAt === 'string'
  );
}

export function loadRecords(): Record<number, BestRecord> {
  const raw = read('records');
  if (raw === undefined) return {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    remove('records');
    return {};
  }
  const out: Record<number, BestRecord> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(k);
    if (Number.isInteger(n) && isRecord(v)) out[n] = v;
  }
  return out;
}

export function saveRecord(number: number, record: BestRecord) {
  write('records', { ...loadRecords(), [number]: record });
}

// ── 설정 ──

export function loadPrefs(): Prefs {
  const raw = read('prefs') as Partial<Prefs> | undefined;
  return { onboardingDone: raw?.onboardingDone === true };
}

export function savePrefs(prefs: Prefs) {
  write('prefs', prefs);
}

/** 기록 초기화 (FR-12): wl:v1: 접두사 키를 모두 지운다 */
export function clearAll() {
  memory.clear();
  const store = backend();
  if (!store) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => store.removeItem(k));
  } catch {
    // 접근할 수 없으면 메모리만 비운다
  }
}
