<div align="center">

# OpenDAIO

**Open + DAO + AI**

탑다운 픽셀 아트 감성의 **AI 리뷰어 합의(Consensus) 플랫폼** 프론트엔드

</div>

---

## 1. 서비스 한 줄 소개

AI 에이전트 리뷰어들이 **탈중앙화 노드** 형태로 참여해 안건을 평가하고, **합의 기반**으로 점수와 리포트를 제공하는 게임 느낌의 평가 플랫폼.

- 각 노드는 독립된 캐릭터 AI 에이전트 (서로 다른 프롬프트, 기준, 성향, 전문 영역)
- 사용자가 논문/안건을 제출 → 여러 노드가 동시에 심사 → 평균/중앙값/분산/합의 수준 산출
- 합의 범위(μ ± σ)를 벗어난 노드는 **슬래싱(stake 40%)** + 평판 −5
- 범위 안에 머문 노드는 **리뷰 바운티(USDT) 분배** + 평판 +1
- "왜 이렇게 점수를 줬나요?" 채팅으로 노드별 근거를 질의 가능 (노드당 최대 3 questions)

논문 리뷰뿐 아니라 **법률 초안 검토 / 투자 제안 심사 / DAO 거버넌스 안건 심의**까지 같은 구조로 확장하는 것이 목표.

---

## 2. 컨셉 & UX 톤

탑다운 픽셀 아트 게임 (포켓몬 / 스타듀밸리 / 동물의 숲 톤)을 베이스로 한 평가 길드 마을.

```
Commons (마을)
   └─ Start Evaluation
        └─ Review Room 선택  (Paper / Judgment / Investment / DAO)
             └─ Review Bounty Gate  (Wallet 연결 + USDT 바운티 + 안건 제출)
                  └─ Conference Hall  (각 방의 리뷰어 캐릭터가 라운드별 심사)
                       └─ Final Result  (합의 점수 + 슬래싱/리워드/평판 변화)
```

- 각 캐릭터는 idle / think / penalty / reward 상태 스프라이트를 갖고, 라운드 진행에 따라 thought-cloud · talking-bubble · explosion · sparkle 이펙트가 붙음.
- 결과 화면에서 노드를 클릭하면 라운드별 점수 변화, 토론 요약, 사용 근거를 보여주는 Drawer 가 열림.

---

## 3. 기술 스택

| 영역 | 사용 기술 |
| --- | --- |
| Build | **Vite 6** (커스텀 plugin: `virtual:reviewer-character-assets`) |
| UI | **React 19**, **TypeScript ~5.8**, **Tailwind v4** (`@tailwindcss/vite`) |
| 애니메이션 | **motion** (구 framer-motion) |
| 아이콘 | **lucide-react** |
| AI (예정) | **@google/genai** — 노드 응답 생성에 연결 예정 |
| 에셋 파이프라인 | `gifenc` + `pngjs` 로 reviewer idle gif 생성 (`scripts/generate-reviewer-idle-gifs.mjs`) |

> 현재는 백엔드/온체인 연동 없이 **mock 데이터 + 클라이언트 사이드 시뮬레이션**으로 동작한다. 다음 단계에서 Wallet · LLM API · 평판 저장소를 단계적으로 붙인다 (아래 로드맵 참고).

---

## 4. 프로젝트 구조

```text
openDAIO/
├── index.html                            # title: "PixelReview Commons"
├── vite.config.ts                        # virtual:reviewer-character-assets 플러그인 정의
├── scripts/
│   └── generate-reviewer-idle-gifs.mjs   # PNG → 리뷰어 idle GIF 자동 생성
├── public/assets/                        # 픽셀 아트 정적 에셋
│   ├── backgrounds/{commons,review-rooms,conference-hall}/
│   ├── characters/
│   │   ├── reviewers/{ai-01..ai-20}.png  # 20명의 리뷰어 캐릭터
│   │   └── reviewers/states/*.gif        # penalty / reward 연출
│   ├── rooms/room-00..room-12.svg
│   ├── effects/{explosion,sparkle,talking-bubble,thought-cloud}.gif
│   ├── submission-scanner/               # 안건 제출 연출
│   └── ui/dashboard-border/              # 코르크보드 우드 보더
└── src/
    ├── main.tsx                          # createRoot → <App />
    ├── App.tsx                           # 페이지 전환 + SimulationPhase 상태머신 + 리포트 빌더
    ├── index.css                         # Tailwind v4 + 픽셀 프레임/대시보드/리포트 스타일
    ├── types.ts                          # SimulationPhase / NodeStatus / NodeEvaluationResult / FinalEvaluationSummary 등
    ├── assets/assetPaths.ts              # 모든 에셋 경로 단일 진입점 + 리뷰어 자동 로딩
    ├── components/                       # 40+ UI 컴포넌트 (페이지 셸, 게임 화면, Drawer, 리포트 등)
    ├── constants/
    │   ├── reviewRoomScenes.ts           # paper/judgment 룸의 리뷰어 배치 + 타일 색상
    │   ├── roomConfig.ts                 # Tailwind position 문자열 ↔ 좌표 변환
    │   └── uiConfig.ts                   # 중앙 테이블 위치, 캐릭터 idle offset
    ├── data/                             # mock 데이터
    │   ├── reviewerCharacterConfig.ts    # 리뷰어 20명 마스터 (Paper/Legal/Investment/DAO)
    │   ├── mockCharacters.ts             # 시뮬레이션용 AICharacter[] 빌더
    │   ├── mockFinalResults.ts           # 16개 노드의 4라운드 점수 mock
    │   └── mockLogs.ts
    ├── hooks/useNodeChat.ts              # "왜 이렇게 점수?" 채팅 상태 관리 (evaluation × node 키)
    ├── services/nodeChatService.ts       # 채팅 요청 mock — 추후 LLM 호출로 교체될 자리
    └── utils/finalResults.ts             # 평균/표준편차/이상치/슬래싱·리워드 계산
```

### 4-1. 컨셉 ↔ 코드 매핑

| 서비스 컨셉 | 구현 위치 |
| --- | --- |
| 마을 / 광장 진입 | `components/CommonsPage.tsx` |
| 리뷰 룸 선택 | `components/RoomSelectionPanel.tsx` (`paper`, `judgment` 활성 / `investment`, `dao` Coming soon) |
| 접수처에서 안건 제출 | `components/ReviewBountyGateOverlay.tsx` (지갑 연결 → 바운티 입력 → 논문 제출) |
| 방마다 배치된 리뷰어 | `components/{ConferenceHall, ProjectRoom, Character}.tsx` + `constants/roomConfig.ts` |
| 라운드별 심사 진행 | `App.tsx` 의 `SimulationPhase` FSM + `components/{Billboard, RoundBoard, StandardDeviationChart}.tsx` |
| 합의/분포/슬래싱 계산 | `utils/finalResults.ts` (μ ± σ outlier, 40% slash, USDT bounty 분배) |
| 결과 홀 / 최종 공개 | `components/{FinalResultScreen, FinalResultSummaryCard, NodeResultsTable}.tsx` |
| "왜 이렇게 점수?" 질의 | `components/NodeDetailDrawer.tsx` + `hooks/useNodeChat.ts` + `services/nodeChatService.ts` |
| 평판/보상 표시 | `components/{TrustScorePanel, RewardLedger, TrustChangeBadge, TokenFlowBadge}.tsx` |

### 4-2. 도메인 모델 (`src/types.ts`)

- `SimulationPhase` — `IDLE → MOVING_TO_ROOMS → ROUND_1 → ROUND_2_STARTING → ROUND_2 → ROUND_3_STARTING → ROUND_3 → FINALIZING → EVALUATED`
- `NodeStatus` — `IDLE | MOVING | THINKING | DISCUSSING | RETURNING | REWARDED | SLASHED`
- `RoundEvaluationHistory` — 라운드별 점수 변화 + 토론 요약 + 사용 근거(`evidenceUsed`)
- `NodeEvaluationResult` — 최종 점수 / trust before·after / stake / outlier 여부 / slash·reward / bounty / 채팅 상태
- `FinalEvaluationSummary` — finalAverage / standardDeviation / outlier 임계값 / 슬래시 풀 / bounty 분배 정보

### 4-3. 합의 / 슬래싱 파라미터 (`src/utils/finalResults.ts`)

```ts
OUTLIER_STDDEV_MULTIPLIER = 1   // μ ± σ 범위를 벗어나면 outlier
SLASH_RATE                = 0.4 // outlier 의 stake 40% 슬래싱
OUTLIER_TRUST_PENALTY     = 5   // outlier 의 trust −5
ELIGIBLE_TRUST_REWARD     = 1   // 범위 내 노드의 trust +1
```

리뷰 바운티(USDT)는 outlier 가 아닌 노드 수로 균등 분배한다.

---

## 5. 실행 방법

### 5-1. 요구 사항

- **Node.js 20+** 권장
- npm (또는 pnpm/yarn)

### 5-2. 설치 & 개발 서버

```bash
npm install
npm run dev          # http://localhost:3000  (host 0.0.0.0)
```

### 5-3. 그 외 스크립트

```bash
npm run build              # vite build → dist/
npm run preview            # 빌드 결과물 로컬 프리뷰
npm run clean              # dist/ 제거
npm run lint               # tsc --noEmit (타입 체크)
npm run generate:idle-gifs # public/assets/characters/reviewers PNG → idle GIF 일괄 생성
```

### 5-4. 환경 변수

`.env` 또는 `.env.local` 에 정의한다 (`.env.example` 참조).

| 변수 | 설명 |
| --- | --- |
| `GEMINI_API_KEY` | Gemini API 키. 추후 `services/nodeChatService.ts` 의 LLM 응답에 사용 (현재는 mock). |
| `APP_URL` | 자기 자신을 가리키는 URL. OAuth 콜백/공유 링크 등에 사용 예정. |
| `DISABLE_HMR` | `"true"` 로 두면 Vite HMR 비활성화 (AI Studio 환경 호환용). |

> `process.env.GEMINI_API_KEY` 는 `vite.config.ts` 에서 `define` 으로 주입된다.

---

## 6. 리뷰어 캐릭터 추가하기

리뷰어는 **파일을 떨어뜨리는 것만으로 자동 로드**되도록 설계돼 있다.

1. `public/assets/characters/reviewers/` 에 `ai-XX.png` 추가 (idle 스프라이트).
2. 선택적으로 `public/assets/characters/reviewers/states/ai-XX-{think,penalty,reward,portrait}.gif` 추가.
3. `src/data/reviewerCharacterConfig.ts` 의 `REVIEWER_CHARACTER_CONFIGS` 에 메타데이터(`label`, `specialty`, `labRoom`) 추가.
4. (필요 시) `src/constants/reviewRoomScenes.ts` 에 새 룸 또는 룸 내 슬롯 배치 추가.

`vite.config.ts` 의 `reviewerCharacterAssetsPlugin` 이 위 폴더를 watch 해 `virtual:reviewer-character-assets` 모듈로 노출하므로, dev 서버에서 hot reload 도 자동으로 동작한다.

현재 정의된 20명: `ai-01..05` Paper review · `ai-06..10` Legal counsel · `ai-11..15` Investment · `ai-16..20` DAO governance.

---

## 7. 로드맵 (다음 작업)

현 시점에서 프론트엔드는 **mock 시뮬레이터** 단계이고, 아래 순서로 실연동을 붙일 예정.

### 7-1. Wallet 연결 (작업 예정)

- 현재: `components/Navbar.tsx` 의 "Connect Wallet" 버튼은 시각적 placeholder, `App.tsx` 안 `MOCK_WALLET_ADDRESS` / `MOCK_WALLET_BALANCE` 사용.
- 적용 대상: `Navbar`, `ReviewBountyGateOverlay`(USDT 바운티 결제), 결과 리포트의 tx hash 영역.
- 후보 스택: **wagmi v2 + viem + RainbowKit** (또는 ConnectKit). 네트워크는 현재 mock 에서 사용 중인 **Polygon Amoy** 를 시작점으로.
- 작업 항목:
  - `src/services/wallet/` 디렉터리에 provider/hook 분리 (`useWallet`, `useReviewBountyPayment`)
  - `ReviewBountyGateOverlay` 의 `paymentStep` (`signing → confirming → confirmed`) 을 실제 트랜잭션 라이프사이클에 매핑
  - `MOCK_WALLET_*` 상수 제거, `Navbar` 에 잔액/주소 표시 컴포넌트 분리

### 7-2. AI API (LLM) 연결 (작업 예정)

- 현재: `services/nodeChatService.ts` 가 키워드 매칭으로 mock 응답 (`'evidence'`, `'round 2'`, `'changed your mind'`, `'outside'`, `'slashing'`).
- 인터페이스(`postNodeChatMessage`, `useNodeChat`)는 그대로 유지하면서 내부만 `@google/genai` 호출로 교체.
- 작업 항목:
  - 노드별 시스템 프롬프트 = `reviewerCharacterConfig` 의 `specialty` + 라운드 history 요약 + 합의 결과
  - 토큰/요청 한도 가드 (이미 `maxQuestions = 3` 으로 frontend 단 제한 존재)
  - 라운드별 점수 산정도 LLM 으로 (`mockFinalResults` → 실제 점수 도출 파이프라인)
  - 보안: 키 노출 방지 위해 추후 백엔드/Edge Function 경유 호출

### 7-3. 그 다음 단계 (백엔드 / 온체인)

- **Evaluation API** 백엔드 도입 (`services/evaluations/`): 안건 제출, 라운드 진행, 합의 결과 영속화.
- **평판 / 슬래싱 컨트랙트** 또는 off-chain ledger: 현재 클라이언트에서 계산되는 trust/stake 변경을 권위 있는 저장소로 이동.
- `RoomSelectionPanel` 의 `investment`, `dao` 룸 활성화 (캐릭터·룸 에셋은 이미 준비, scene 정의만 필요).
- `App.tsx` 가 1500 줄에 달하므로 페이지 라우터 + simulation FSM + 리포트 빌더로 분리하는 리팩토링.

---

## 8. 알아두면 좋은 것들

- **단일 페이지**: 라우팅 라이브러리 없이 `App.tsx` 의 `AppPage = 'dashboard' | 'commons' | 'loading' | 'room'` 으로 전환한다. URL 보존이 필요해지면 `react-router` 또는 `@tanstack/router` 도입 고려.
- **픽셀 프레임**: `components/PixelFrame.tsx` 의 `PixelFrameChrome` 가 SVG 없이 `clip-path` 로 픽셀 둥근 모서리를 그린다. 모든 박스/버튼/패널이 이걸 깔고 있음.
- **Tailwind v4**: `tailwind.config.*` 가 없는 v4 zero-config 모드. 토큰은 `src/index.css` 안에 정의돼 있다.
- **에셋 경로 단일 진입점**: 컴포넌트에서 직접 `/assets/...` 를 쓰지 말고 `src/assets/assetPaths.ts` 의 `ASSET_PATHS` 를 import 해서 쓸 것.
- **Dead path 주의**: `ASSET_PATHS.ui.panels.*`, `ASSET_PATHS.ui.buttons.*`, `ASSET_PATHS.icons.*`, `ASSET_PATHS.billboard.*` 일부는 실제 파일이 아직 없어 `onError` 폴백으로 가려져 있다 — 새 UI 추가 시 실제 파일을 채우거나 참조를 정리할 것.

---

## 9. 라이선스

각 소스 파일 상단에 `Apache-2.0` SPDX 식별자가 붙어 있다. 별도 명시가 없는 한 동일 라이선스를 따른다.
