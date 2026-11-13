// npm run validate [-- --release] — 단어 은행과 퍼즐 전체 검증 (design.md §9.4)
import { formatIssue, hasErrors } from '../src/domain/validate';
import { parseArgs, runValidation } from './lib/content';

const args = parseArgs(process.argv.slice(2));
const release = args.release === true;
const issues = runValidation({ release });

const errors = issues.filter((i) => i.level === 'error');
const warnings = issues.filter((i) => i.level === 'warning');
for (const issue of [...errors, ...warnings]) console.log(formatIssue(issue));

console.log(`\n검증${release ? ' (release)' : ''}: 오류 ${errors.length}개 · 경고 ${warnings.length}개`);
process.exit(hasErrors(issues) ? 1 : 0);
