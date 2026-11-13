// 힌트 확인 창 (D12): 사용자가 고른 빈 칸 하나만 공개
import { Dialog } from '../../components/Dialog';
import dialog from '../../components/Dialog.module.css';
import { HINTS_PER_PUZZLE } from '../../data/stages';
import type { Entry } from '../../domain/types';

interface HintConfirmDialogProps {
  entry: Entry;
  cellIndex: number;
  cellFilled: boolean;
  hintsLeft: number;
  onConfirm(): void;
  onClose(): void;
}

export function HintConfirmDialog({ entry, cellIndex, cellFilled, hintsLeft, onConfirm, onClose }: HintConfirmDialogProps) {
  const word = `${entry.direction === 'across' ? '가로' : '세로'} ${entry.number}`;
  const position = entry.cells.indexOf(cellIndex) + 1;

  if (cellFilled) {
    return (
      <Dialog title="빈 칸을 골라 주세요" onClose={onClose}>
        <p>이미 채워진 칸이에요. 열고 싶은 빈 칸을 격자나 입력창 위 칸에서 고른 뒤 힌트를 눌러 주세요.</p>
        <div className={dialog.actions}>
          <button type="button" className={dialog.primary} onClick={onClose} data-autofocus>
            알겠어요
          </button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog title="힌트를 쓸까요?" onClose={onClose}>
      <p>
        {word}의 {position}번째 칸에 들어갈 글자를 보여 줘요.
      </p>
      <p>
        이 퍼즐에서 힌트는 {hintsLeft}번 남았어요.
        {hintsLeft === HINTS_PER_PUZZLE ? ' 힌트를 한 번이라도 쓰면 별을 하나 덜 받아요.' : ''}
      </p>
      <div className={dialog.actions}>
        <button type="button" className={dialog.secondary} onClick={onClose}>
          그만두기
        </button>
        <button type="button" className={dialog.primary} onClick={onConfirm} data-autofocus>
          글자 보기
        </button>
      </div>
    </Dialog>
  );
}
