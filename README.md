# 가로세로 낱말 퍼즐

한글 단어로 된 가로세로 낱말 퍼즐 50개를 5단계로 나눠, 단계가 오를수록 조금씩 어려워지게 즐기는 모바일 우선 웹 게임입니다.

- 단계마다 퍼즐 10개 (5×5 → 9×9), 단어와 열쇠가 조금씩 어려워짐
- 단어 단위 입력창이라 휴대폰 한글 키보드로 자연스럽게 입력
- 단어마다 바로 채점: 맞으면 칸이 채워지고, 틀리면 "틀렸어요"만 알려 줌
- 퍼즐마다 힌트 3번(고른 빈 칸 한 글자), 타이머와 별점, 진행 자동 저장
- 서버 없이 정적 호스팅으로 동작

요구사항은 [docs/requirements.md](docs/requirements.md), 설계는 [docs/design.md](docs/design.md)에 있습니다.

## 실행

```bash
npm install
npm run dev        # 개발 서버
npm test           # 단위·컴포넌트 테스트 + 실제 콘텐츠 검증
npm run build      # 빌드 직전에 콘텐츠 검증(prebuild)이 돌고, 오류가 있으면 멈춤
npm run preview    # 빌드 결과 미리 보기
```

빌드 결과(`dist/`)는 상대 경로(`base: './'`)라 어느 정적 호스팅의 하위 경로에 올려도 동작합니다.

개발 서버에서 `#/p/12?reveal`로 열면 정답을 채운 채로 퍼즐을 볼 수 있습니다(검수용, 개발 빌드에서만).

## 콘텐츠 만들기

| 단계 | 파일·명령 |
|---|---|
| 단어 은행 | `content/words.csv` — 단어, 등급(1~5), 범주, 주제, 메모 |
| 같은 뜻 묶음 | `content/synonyms.txt` — 한 퍼즐에 함께 놓지 않을 단어들 |
| 격자 생성 | `npm run generate -- --number 12 --theme 음식 [--seed 123] [--force] [--dry]` |
| 열쇠 작성 | 생성된 `src/data/puzzles/pNN.json`의 빈 `text`를 채움 |
| 검증 | `npm run validate` (배포 전에는 `npm run validate -- --release`) |
| 사람 검수 | `npm run review -- --stage 2` 또는 `--all` → `content/review/stage-N.md` |

검증 규칙(격자 G·단어 W·열쇠 C·모음 S·은행 B·파일 F)은 `src/domain/validate`에 있고, 명령줄·테스트·빌드가 함께 씁니다.

## 폴더

```text
content/        단어 은행, 같은 뜻 묶음, 검수 시트 출력(git 제외)
src/domain/     순수 로직 — 파싱, 게임 리듀서, 별점, 검증 규칙 (앱과 도구 공용)
src/data/       단계 설정, 퍼즐 50개(JSON)
src/app/        해시 라우터, localStorage 래퍼
src/features/   화면 — 목록, 퍼즐, 첫 실행 안내, 설정
src/styles/     색 토큰(원고지·칠판), 전역 스타일
tools/          생성기·검증기·검수 시트 명령줄 도구
```
