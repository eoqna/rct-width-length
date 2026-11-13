// 설정 (FR-11 다시 보기, FR-12 기록 초기화)
import { useEffect, useState } from 'react';
import { hrefFor } from '../../app/router';
import { clearAll, loadPrefs, savePrefs, storageFailed } from '../../app/storage';
import dialog from '../../components/Dialog.module.css';
import styles from './SettingsScreen.module.css';

export function SettingsScreen() {
  const [guideReset, setGuideReset] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    document.title = '설정 | 가로세로 낱말 퍼즐';
  }, []);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <a className={styles.back} href={hrefFor({ name: 'home' })}>
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
          퍼즐 목록
        </a>
        <h1 className={styles.title}>설정</h1>
      </header>

      {storageFailed() ? (
        <p className={styles.notice} role="alert">
          이 브라우저에서는 기록이 저장되지 않아요. 사생활 보호 모드라면 일반 창에서 열어 주세요.
        </p>
      ) : null}

      <section className={styles.section}>
        <h2 className={styles.heading}>조작 안내</h2>
        <p>퍼즐을 처음 열 때 나오는 안내를 다음에 다시 보여 줘요.</p>
        <button
          type="button"
          className={styles.button}
          disabled={guideReset}
          onClick={() => {
            savePrefs({ ...loadPrefs(), onboardingDone: false });
            setGuideReset(true);
          }}
        >
          안내 다시 보기
        </button>
        {guideReset ? (
          <p className={styles.done} role="status">
            다음에 퍼즐을 열면 안내가 나와요.
          </p>
        ) : null}
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>기록 지우기</h2>
        <p>별점, 최고 기록, 푸는 중인 퍼즐이 모두 지워져요. 지운 기록은 되돌릴 수 없어요.</p>
        {confirming ? (
          <div className={styles.confirm} role="group" aria-label="기록 지우기 확인">
            <p className={styles.ask}>정말 모든 기록을 지울까요?</p>
            <div className={dialog.actions}>
              <button type="button" className={dialog.secondary} onClick={() => setConfirming(false)}>
                그만두기
              </button>
              <button
                type="button"
                className={`${dialog.primary} ${dialog.danger}`}
                onClick={() => {
                  clearAll();
                  setConfirming(false);
                  setCleared(true);
                  setGuideReset(false);
                }}
              >
                모두 지우기
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className={styles.button}
            onClick={() => {
              setCleared(false);
              setConfirming(true);
            }}
          >
            기록 지우기
          </button>
        )}
        {cleared ? (
          <p className={styles.done} role="status">
            기록을 모두 지웠어요.
          </p>
        ) : null}
      </section>
    </div>
  );
}
