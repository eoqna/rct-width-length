// 검증 결과 한 건 (design.md §9.4)

export type IssueLevel = 'error' | 'warning';

export interface Issue {
  code: string;
  level: IssueLevel;
  /** 퍼즐 번호 (퍼즐 단위 문제일 때) */
  puzzle?: number;
  message: string;
}

export const error = (code: string, message: string, puzzle?: number): Issue => ({
  code,
  level: 'error',
  message,
  ...(puzzle === undefined ? {} : { puzzle }),
});

export const warning = (code: string, message: string, puzzle?: number): Issue => ({
  code,
  level: 'warning',
  message,
  ...(puzzle === undefined ? {} : { puzzle }),
});

export const hasErrors = (issues: readonly Issue[]) => issues.some((i) => i.level === 'error');

export const pct = (ratio: number) => `${Math.round(ratio * 100)}%`;

export function formatIssue(issue: Issue): string {
  const where = issue.puzzle === undefined ? '' : `[p${String(issue.puzzle).padStart(2, '0')}] `;
  const level = issue.level === 'error' ? '오류' : '경고';
  return `${level} ${issue.code} ${where}${issue.message}`;
}
