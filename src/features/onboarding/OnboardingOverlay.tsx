// 첫 실행 안내 (FR-11, US-1): 30초 안에 읽을 분량, 바로 닫을 수 있다
import { Dialog } from '../../components/Dialog';
import dialog from '../../components/Dialog.module.css';
import styles from './OnboardingOverlay.module.css';

export function OnboardingOverlay({ onClose }: { onClose(): void }) {
  return (
    <Dialog title="이렇게 풀어요" onClose={onClose}>
      <ol className={styles.steps}>
        <li>
          <strong>칸이나 열쇠를 누르면</strong> 그 단어가 골라져요. 같은 칸을 한 번 더 누르면 가로와 세로가 바뀌어요.
        </li>
        <li>
          <strong>단어를 입력하고 확인</strong>을 누르면 바로 채점해요. 맞으면 칸이 채워지고, 틀리면 "틀렸어요"라고만
          알려 줘요.
        </li>
        <li>
          <strong>막히면 힌트</strong>로 빈 칸 하나의 글자를 볼 수 있어요. 퍼즐마다 3번까지 쓸 수 있어요.
        </li>
      </ol>
      <div className={dialog.actions}>
        <button type="button" className={dialog.primary} onClick={onClose} data-autofocus>
          시작하기
        </button>
      </div>
    </Dialog>
  );
}
