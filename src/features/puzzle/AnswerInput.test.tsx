// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Feedback } from '../../domain/game';
import { AnswerInput } from './AnswerInput';

function setup(props: Partial<React.ComponentProps<typeof AnswerInput>> = {}) {
  const onSubmit = vi.fn();
  const onMove = vi.fn();
  const utils = render(<AnswerInput length={3} resetKey="a1" onSubmit={onSubmit} onMove={onMove} {...props} />);
  const input = screen.getByRole('textbox') as HTMLInputElement;
  const form = input.closest('form')!;
  const rerender = (next: Partial<React.ComponentProps<typeof AnswerInput>>) =>
    utils.rerender(
      <AnswerInput length={3} resetKey="a1" onSubmit={onSubmit} onMove={onMove} {...props} {...next} />,
    );
  return { input, form, onSubmit, onMove, rerender };
}

const type = (input: HTMLInputElement, value: string) => fireEvent.input(input, { target: { value } });

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('제출 (단일 경로)', () => {
  it('조합 중이 아니면 바로 한 번 제출', () => {
    const { input, form, onSubmit } = setup();
    type(input, '무지개');
    fireEvent.submit(form);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('무지개');
  });

  it('조합 중에 제출하면 조합이 끝난 다음 태스크에서 한 번만 제출', () => {
    const { input, form, onSubmit } = setup();
    fireEvent.compositionStart(input);
    type(input, '무지개');
    fireEvent.submit(form);
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.compositionEnd(input);
    expect(onSubmit).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(0));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('무지개');
    act(() => vi.advanceTimersByTime(500));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('compositionend가 먼저 와도 한 번만 제출', () => {
    const { input, form, onSubmit } = setup();
    fireEvent.compositionStart(input);
    type(input, '무지개');
    fireEvent.compositionEnd(input);
    fireEvent.submit(form);
    act(() => vi.advanceTimersByTime(500));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('300ms 안에 compositionend가 오지 않으면 그때 값을 제출', () => {
    const { input, form, onSubmit } = setup();
    fireEvent.compositionStart(input);
    type(input, '무지개');
    fireEvent.submit(form);
    act(() => vi.advanceTimersByTime(299));
    expect(onSubmit).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onSubmit).toHaveBeenCalledWith('무지개');
  });

  it('100ms 안에 다른 글자를 내면 둘 다 제출', () => {
    const { input, form, onSubmit } = setup();
    type(input, '무지개');
    fireEvent.submit(form);
    type(input, '고양이');
    fireEvent.submit(form);
    expect(onSubmit.mock.calls).toEqual([['무지개'], ['고양이']]);
  });

  it('곧바로 이어진 같은 글자의 두 번째 제출은 무시 (조합 중 Enter 두 번)', () => {
    const { input, form, onSubmit } = setup();
    type(input, '무지개');
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(200));
    fireEvent.submit(form);
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });
});

describe('입력창 비우기', () => {
  const fb = (kind: Feedback['kind'], seq: number): Feedback => ({ kind, seq });

  it('틀리면 비운다', () => {
    const { input, rerender } = setup();
    type(input, '고구마');
    rerender({ feedback: fb('wrong', 1) });
    expect(input.value).toBe('');
  });

  it('맞으면 비운다', () => {
    const { input, rerender } = setup();
    type(input, '무지개');
    rerender({ feedback: fb('correct', 1) });
    expect(input.value).toBe('');
  });

  it('형식 안내 때는 글자를 그대로 둔다', () => {
    const { input, rerender } = setup();
    type(input, '고양');
    rerender({ feedback: fb('length', 1) });
    expect(input.value).toBe('고양');
    type(input, '고양ㅇ');
    rerender({ feedback: fb('notHangul', 2) });
    expect(input.value).toBe('고양ㅇ');
  });

  it('같은 오답을 연달아 내도 매번 비운다', () => {
    const { input, rerender } = setup();
    type(input, '고구마');
    rerender({ feedback: fb('wrong', 1) });
    type(input, '고구마');
    rerender({ feedback: fb('wrong', 2) });
    expect(input.value).toBe('');
  });

  it('조합 중에는 비우지 않고 조합이 끝난 뒤에 비운다', () => {
    const { input, rerender } = setup();
    fireEvent.compositionStart(input);
    type(input, '고구');
    rerender({ feedback: fb('wrong', 1) });
    expect(input.value).toBe('고구');
    fireEvent.compositionEnd(input);
    act(() => vi.advanceTimersByTime(0));
    expect(input.value).toBe('');
  });

  it('단어가 바뀌면 비운다', () => {
    const { input, rerender } = setup();
    type(input, '고구');
    rerender({ resetKey: 'd2' });
    expect(input.value).toBe('');
  });
});

describe('안내 문구', () => {
  it('틀리면 "틀렸어요"만, 다시 치기 시작하면 사라진다', () => {
    const { input, rerender } = setup();
    rerender({ feedback: { kind: 'wrong', seq: 1 } });
    expect(screen.getByRole('status').textContent).toBe('틀렸어요');
    type(input, '고');
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('글자 수가 다르면 몇 글자인지 알려준다', () => {
    const { rerender } = setup();
    rerender({ feedback: { kind: 'length', seq: 1 } });
    expect(screen.getByRole('status').textContent).toBe('3글자 단어예요');
  });
});

describe('키보드', () => {
  it('Tab / Shift+Tab은 다음·이전 단어', () => {
    const { input, onMove } = setup();
    fireEvent.keyDown(input, { key: 'Tab' });
    fireEvent.keyDown(input, { key: 'Tab', shiftKey: true });
    expect(onMove.mock.calls).toEqual([[1], [-1]]);
  });
});
