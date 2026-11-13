// 실제 콘텐츠(단어 은행 + 퍼즐 50개)가 검증을 통과하는지 (design.md §11)
import { describe, expect, it } from 'vitest';
import { formatIssue } from '../src/domain/validate';
import { runValidation } from './lib/content';

describe('콘텐츠', () => {
  it('단어 은행과 퍼즐에 검증 오류가 없다', () => {
    const errors = runValidation().filter((i) => i.level === 'error');
    expect(errors.map(formatIssue)).toEqual([]);
  });
});
