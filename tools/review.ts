// npm run review -- --stage 2   (또는 --all) — 사람 검수 시트 content/review/stage-N.md (design.md §9.5)
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { STAGES, targetNewGradeRatio } from '../src/data/stages';
import type { ClueType, Puzzle, Stage } from '../src/domain/types';
import { analyzePuzzle, formatIssue, tryParse, validatePuzzle } from '../src/domain/validate';
import { REVIEW_DIR, loadBank, loadPuzzleFiles, parseArgs } from './lib/content';

const pct = (x: number) => `${Math.round(x * 100)}%`;
const TYPE_NAME: Record<ClueType, string> = {
  definition: '뜻풀이',
  association: '연상',
  blank: '빈칸',
  trivia: '상식',
};
const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = (n: number) => String(n).replace(/\d/g, (d) => SUPERSCRIPT[Number(d)]);

const args = parseArgs(process.argv.slice(2));
const stages: Stage[] =
  args.all === true ? [1, 2, 3, 4, 5] : [Number(args.stage) as Stage].filter((s) => s >= 1 && s <= 5);
if (stages.length === 0) {
  console.error('사용법: npm run review -- --stage 2  (또는 --all)');
  process.exit(1);
}

const bank = loadBank();
const bankMap = new Map(bank.words.map((w) => [w.word, w]));
const loaded = loadPuzzleFiles().puzzles;
const raw = new Map<number, unknown>();
const puzzles: Puzzle[] = [];
for (const p of loaded) {
  const parsed = tryParse(p.data);
  if (parsed) {
    puzzles.push(parsed);
    raw.set(parsed.number, p.data);
  }
}

function gridTable(p: Puzzle): string[] {
  const n = p.size;
  const head = `| | ${Array.from({ length: n }, (_, c) => c + 1).join(' | ')} |`;
  const sep = `|---|${'---|'.repeat(n)}`;
  const rows = Array.from({ length: n }, (_, r) => {
    const cells = p.cells.slice(r * n, r * n + n).map((c) => (c.solution === null ? '■' : `${c.number ? sup(c.number) : ''}${c.solution}`));
    return `| **${r + 1}** | ${cells.join(' | ')} |`;
  });
  return [head, sep, ...rows];
}

mkdirSync(REVIEW_DIR, { recursive: true });
for (const stage of stages) {
  const cfg = STAGES[stage];
  const members = puzzles.filter((p) => p.stage === stage).sort((a, b) => a.number - b.number);
  const out: string[] = [];
  const words = members.reduce((a, p) => a + p.entries.length, 0);
  out.push(`# ${stage}단계 검수 시트 (${cfg.name})`, '');
  out.push(`퍼즐 ${members.length}개 · 단어 ${words}개 · 격자 ${cfg.size}×${cfg.size} · 단어 수 ${cfg.words.min}~${cfg.words.max}`, '');
  out.push('## 체크리스트 (requirements.md CR-04)', '');
  out.push('- [ ] 너무 어려운 단어가 없다 (§4.3 제외 기준)');
  out.push('- [ ] 모두 명사다 (D14)');
  out.push(`- [ ] 열쇠로 답이 하나로 좁혀진다${stage <= 2 ? ' — 이 단계는 열쇠만으로도 하나여야 함' : ''}`);
  out.push('- [ ] 사실 오류가 없다 (상식형은 특히)');
  out.push('- [ ] 사전 뜻풀이를 그대로 옮기지 않았다', '');

  let defs = 0;
  const ratios: string[] = [];
  for (const p of members) {
    const stats = analyzePuzzle(p, bankMap);
    defs += stats.definitionClues;
    ratios.push(pct(stats.newGradeRatio));
    out.push(`## ${p.number} · ${p.theme}`, '');
    out.push(...gridTable(p), '');
    out.push('| 번호 | 정답 | 등급 | 범주 | 주제 | 유형 | 열쇠 |');
    out.push('|---|---|---|---|---|---|---|');
    for (const e of p.entries) {
      const w = bankMap.get(e.answer);
      out.push(
        `| ${e.direction === 'across' ? '가로' : '세로'} ${e.number} | ${e.answer} | ${w?.grade ?? '?'} | ${w?.category ?? '?'} | ${w?.themes.includes(p.theme) ? '●' : ''} | ${TYPE_NAME[e.clueType]} | ${e.clue || '**(비어 있음)**'} |`,
      );
    }
    out.push('');
    out.push(
      `단어 ${stats.words} · 주제 ${pct(stats.themeRatio)}` +
        (stage >= 2 ? ` · ${stage}등급 ${pct(stats.newGradeRatio)} (목표 ${pct(targetNewGradeRatio(p.number))})` : '') +
        ` · 흰 칸 ${pct(stats.whiteRatio)} · 교차 ${stats.crossings} · 뜻풀이 ${stats.definitionClues}/${stats.words}`,
      '',
    );
    const issues = validatePuzzle(raw.get(p.number), bankMap);
    out.push(issues.length ? issues.map((i) => `- ${formatIssue(i)}`).join('\n') : '검증: 문제 없음', '');
  }

  out.push('## 단계 요약', '');
  out.push(`- 뜻풀이 비율: ${words ? pct(defs / words) : '-'} (기준 ${pct(cfg.definitionRatio)} ±10%p)`);
  if (stage >= 2) out.push(`- ${stage}등급 비율 (순번 순): ${ratios.join(' → ')}`);
  const missing = Array.from({ length: 10 }, (_, k) => (stage - 1) * 10 + k + 1).filter(
    (n) => !members.some((p) => p.number === n),
  );
  if (missing.length) out.push(`- 아직 없는 퍼즐: ${missing.join(', ')}`);

  const path = join(REVIEW_DIR, `stage-${stage}.md`);
  writeFileSync(path, out.join('\n') + '\n');
  console.log(`검수 시트: ${path}`);
}
