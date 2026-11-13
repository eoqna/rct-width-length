// 단어 입력창 — 한글 IME와 싸우지 않는 단일 제출 경로 (design.md §7)
//
// - 비제어 input. 제출은 form의 submit 이벤트 하나로만 한다 (keydown에서 직접 제출하지 않음)
// - 조합 중에 제출하면 compositionend 다음 태스크에서 한 번 처리, 300ms 안에 안 오면 그때 처리
// - 100ms 안에 같은 글자를 다시 제출하면 무시 (조합 중 Enter가 두 번 들어오는 브라우저 대응)
// - 판정이 나면(맞음·틀림) 입력창을 비우되, 조합 중이면 조합이 끝난 뒤에 비운다
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type Ref,
} from 'react';
import type { Feedback } from '../../domain/game';
import styles from './AnswerInput.module.css';

const PENDING_TIMEOUT_MS = 300;
const DOUBLE_SUBMIT_MS = 100;

export interface AnswerInputProps {
  /** 현재 단어의 글자 수 */
  length: number;
  /** 단어가 바뀌면 입력창을 비우기 위한 키 (단어 id) */
  resetKey: string;
  feedback?: Feedback;
  disabled?: boolean;
  /** 조합이 끝난 원문 */
  onSubmit(text: string): void;
  onMove?(delta: 1 | -1): void;
  /** 부모가 포커스를 줄 수 있게 input 요소를 넘긴다 */
  inputRef?: Ref<HTMLInputElement>;
}

function feedbackMessage(feedback: Feedback | undefined, length: number): string {
  switch (feedback?.kind) {
    case 'correct':
      return '맞았어요';
    case 'wrong':
      return '틀렸어요';
    case 'notHangul':
      return '자음·모음만 있는 글자 없이 완성된 한글로 써 주세요';
    case 'length':
      return `${length}글자 단어예요`;
    default:
      return '';
  }
}

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function AnswerInput({ length, resetKey, feedback, disabled, onSubmit, onMove, inputRef }: AnswerInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const composing = useRef(false);
  const pending = useRef(false);
  const pendingTimer = useRef<number | undefined>(undefined);
  const lastSubmit = useRef({ text: '', at: -Infinity });
  const clearAfterComposition = useRef(false);
  const onSubmitRef = useRef(onSubmit);
  const [hiddenSeq, setHiddenSeq] = useState<number | null>(null);

  useLayoutEffect(() => {
    onSubmitRef.current = onSubmit;
  });

  useImperativeHandle(inputRef, () => ref.current as HTMLInputElement, []);

  const clear = useCallback(() => {
    if (composing.current) {
      clearAfterComposition.current = true;
      return;
    }
    if (ref.current) ref.current.value = '';
  }, []);

  const flush = useCallback(() => {
    pending.current = false;
    window.clearTimeout(pendingTimer.current);
    const el = ref.current;
    if (!el) return;
    const text = el.value;
    const now = Date.now();
    if (text === lastSubmit.current.text && now - lastSubmit.current.at < DOUBLE_SUBMIT_MS) return;
    lastSubmit.current = { text, at: now };
    onSubmitRef.current(text);
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (disabled) return;
    if (composing.current) {
      if (pending.current) return;
      pending.current = true;
      pendingTimer.current = window.setTimeout(() => {
        if (pending.current) flush();
      }, PENDING_TIMEOUT_MS);
      return;
    }
    flush();
  };

  const handleCompositionEnd = () => {
    composing.current = false;
    if (!pending.current && !clearAfterComposition.current) return;
    // compositionend 직후에는 값이 아직 확정되지 않은 브라우저가 있어 다음 태스크에서 처리
    window.setTimeout(() => {
      if (pending.current) flush();
      if (clearAfterComposition.current) {
        clearAfterComposition.current = false;
        clear();
      }
    }, 0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab' && onMove) {
      e.preventDefault();
      onMove(e.shiftKey ? -1 : 1);
    } else if (e.key === 'Escape') {
      e.currentTarget.blur();
    }
  };

  // 판정이 나면 비운다 (형식 안내 때는 그대로)
  useEffect(() => {
    if (feedback?.kind !== 'correct' && feedback?.kind !== 'wrong') return;
    clear();
    if (feedback.kind === 'wrong' && rowRef.current?.animate && !prefersReducedMotion()) {
      rowRef.current.animate(
        [
          { transform: 'translateX(0)' },
          { transform: 'translateX(-6px)' },
          { transform: 'translateX(5px)' },
          { transform: 'translateX(-3px)' },
          { transform: 'translateX(0)' },
        ],
        { duration: 280, easing: 'ease-out' },
      );
    }
  }, [feedback, clear]);

  // 단어가 바뀌면 비운다
  useEffect(() => {
    clear();
  }, [resetKey, clear]);

  useEffect(() => () => window.clearTimeout(pendingTimer.current), []);

  const visible = feedback && feedback.seq !== hiddenSeq ? feedback : undefined;
  const message = feedbackMessage(visible, length);

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.row} ref={rowRef}>
        <input
          ref={ref}
          className={styles.input}
          type="text"
          lang="ko"
          enterKeyHint="next"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label="정답 입력"
          placeholder={`${length}글자`}
          disabled={disabled}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={handleCompositionEnd}
          onInput={() => setHiddenSeq(feedback?.seq ?? null)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="submit"
          className={styles.submit}
          disabled={disabled}
          // 누르는 순간 포커스가 빠져 휴대폰 키보드가 닫히지 않게 한다
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => {
            // 조합 중이면 blur로 조합을 확정시키고 다시 포커스
            if (composing.current && ref.current) {
              ref.current.blur();
              ref.current.focus({ preventScroll: true });
            }
          }}
        >
          확인
        </button>
      </div>
      <p className={styles.message} data-kind={visible?.kind} role="status" aria-live="polite">
        {message}
      </p>
    </form>
  );
}
