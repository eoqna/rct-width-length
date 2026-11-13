// @vitest-environment jsdom
// 설계 §14 4단계 기준: 예시 퍼즐을 처음부터 완료까지
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearAll, loadPrefs, loadProgress, loadRecords, savePrefs } from '../../app/storage';
import { parsePuzzle } from '../../domain/parse';
import { PuzzleScreen } from './PuzzleScreen';

const puzzle = parsePuzzle({
  number: 2,
  theme: '동물',
  grid: ['#태###', '고양이##', '릴#야##', '라#기러기', '####차'],
  clues: {
    고양이: { type: 'definition', text: '야옹 하고 울며 쥐를 잘 잡는 동물' },
    기러기: { type: 'definition', text: '가을에 줄지어 날아오는 철새' },
    태양: { type: 'definition', text: '낮 하늘에서 빛과 열을 내리쬐는 별' },
    고릴라: { type: 'definition', text: '몸집이 크고 가슴을 쿵쿵 두드리는 동물' },
    이야기: { type: 'definition', text: "할머니가 '옛날 옛적에' 하며 들려주는 것" },
    기차: { type: 'definition', text: '철길 위를 달리는 긴 탈것' },
  },
});

function submit(text: string) {
  const input = screen.getByRole('textbox', { name: '정답 입력' }) as HTMLInputElement;
  fireEvent.input(input, { target: { value: text } });
  fireEvent.submit(input.closest('form')!);
  return input;
}

const statusText = () =>
  screen
    .getAllByRole('status')
    .map((el) => el.textContent)
    .join(' ');

beforeEach(() => {
  clearAll();
  localStorage.clear();
  savePrefs({ onboardingDone: true });
});
afterEach(cleanup);

describe('PuzzleScreen', () => {
  it('처음부터 끝까지 풀면 채점 도장과 기록이 남는다', () => {
    render(<PuzzleScreen puzzle={puzzle} />);
    expect(screen.getByText('야옹 하고 울며 쥐를 잘 잡는 동물', { selector: 'p span' })).toBeTruthy();

    // 틀리면 "틀렸어요"만, 입력창은 비워지고 격자는 그대로
    const input = submit('고구마');
    expect(statusText()).toContain('틀렸어요');
    expect(input.value).toBe('');
    expect(screen.queryByRole('button', { name: /고$/ })).toBeNull();

    // 맞으면 칸이 채워지고 다음 단어로
    submit('고양이');
    expect(statusText()).toContain('맞았어요');
    expect(screen.getByText('가을에 줄지어 날아오는 철새', { selector: 'p span' })).toBeTruthy();

    for (const word of ['기러기', '태양', '고릴라', '이야기', '기차']) submit(word);

    const dialog = screen.getByRole('dialog', { name: '2번 동물 퍼즐을 다 풀었어요' });
    expect(within(dialog).getByText('참 잘했어요')).toBeTruthy();
    expect(loadRecords()[2]?.stars).toBe(3);
    expect(loadProgress(puzzle)?.completed).toBe(true);
  });

  it('힌트는 고른 빈 칸 하나만 공개하고 남은 횟수가 준다', () => {
    render(<PuzzleScreen puzzle={puzzle} />);
    fireEvent.click(screen.getByRole('button', { name: /^힌트/ }));
    const dialog = screen.getByRole('dialog', { name: '힌트를 쓸까요?' });
    expect(within(dialog).getByText(/가로 2의 1번째 칸/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: '글자 보기' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: /^2번, 2행 1열, 고 \(힌트\)$/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^힌트/ }).textContent).toContain('2');
  });

  it('처음 들어오면 조작 안내를 한 번 보여 준다', () => {
    savePrefs({ onboardingDone: false });
    render(<PuzzleScreen puzzle={puzzle} />);
    const dialog = screen.getByRole('dialog', { name: '이렇게 풀어요' });
    fireEvent.click(within(dialog).getByRole('button', { name: '시작하기' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(loadPrefs().onboardingDone).toBe(true);
  });

  it('칸을 누르면 그 칸의 단어가 골라진다', () => {
    render(<PuzzleScreen puzzle={puzzle} />);
    fireEvent.click(screen.getByRole('button', { name: /^1번, 1행 2열/ }));
    expect(screen.getByText('낮 하늘에서 빛과 열을 내리쬐는 별', { selector: 'p span' })).toBeTruthy();
  });
});
