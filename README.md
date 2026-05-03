# openDAIO — webapp

Frontend for the DAIO reviewer-consensus protocol.

Top-down pixel-art SPA built on Vite 6 + React 19 + TypeScript + Tailwind v4.
Reads on-chain state from the deployed DAIO contracts on Sepolia, talks to the
DAIO Content Service for relayed requests / agent reasons / interview Q&A,
and falls back to a deterministic client-side simulation when no chain
request is active.

---

## 1. Tech stack

| Area | Tech |
| --- | --- |
| Build | **Vite 6** (custom `virtual:reviewer-character-assets` plugin) |
| UI | **React 19**, **TypeScript ~5.8**, **Tailwind v4** (`@tailwindcss/vite`) |
| Animation | **motion** (formerly framer-motion) |
| Icons | **lucide-react** |
| Wallet | **Reown AppKit** + **wagmi** + **viem** + **@tanstack/react-query** (Sepolia) |
| Chain reads | `viem` multicall via `services/daio/useDaioData` |
| Content API | `services/daio/contentApi` (DAIO Content Service + MarkItDown) |
| PDF reports | **jsPDF** — structured report including interview transcripts |
| Asset pipeline | `gifenc` + `pngjs` for reviewer idle GIFs |

External dependencies at runtime:

- **DAIO contracts on Ethereum Sepolia** — addresses pinned in `src/contracts/addresses.json`.
- **DAIO Content Service** (`VITE_DAIO_API`) — relayed USDAIO requests, document
  storage, agent status / reasons, and the `/ask` interview endpoint.
- **MarkItDown API** (`VITE_MARKITDOWN_API`) — PDF/DOCX → Markdown conversion
  for submissions.

---

## 2. Project structure

```text
webapp/
├── index.html
├── vite.config.ts                        # virtual:reviewer-character-assets plugin
├── scripts/
│   └── generate-reviewer-idle-gifs.mjs
├── public/assets/                        # pixel-art static assets
│   ├── backgrounds/{commons,review-rooms,conference-hall}/
│   ├── characters/reviewers/{ai-01..ai-20}.png
│   ├── characters/reviewers/states/*.gif
│   ├── rooms/room-00..room-12.svg
│   ├── effects/{explosion,sparkle,talking-bubble,thought-cloud}.gif
│   ├── submission-scanner/
│   └── ui/dashboard-border/
└── src/
    ├── main.tsx                          # createRoot → <App /> + <MobileGate />
    ├── App.tsx                           # page router + SimulationPhase FSM
    │                                       + chain-driven phase pinning
    │                                       + round-result buffer/hold
    │                                       + PDF download
    ├── index.css                         # Tailwind v4 + pixel-frame / dashboard styles
    ├── types.ts                          # SimulationPhase / NodeEvaluationResult
    │                                       / NodeChatMessage / FinalEvaluationSummary
    ├── assets/assetPaths.ts              # single source of truth for asset URLs
    ├── components/                       # 50+ UI components
    │   ├── Billboard.tsx                 # scoreboard + round-result gating
    │   ├── ContractStatePanel.tsx        # honors releasedRounds prop
    │   ├── DashboardPage.tsx             # Agent Leaderboard
    │   ├── MobileGate.tsx                # < 1024px viewport overlay
    │   ├── ReputationScorePanel.tsx      # stable order; partition follows selection
    │   ├── NodeDetailDrawer.tsx          # interview chat + protocol breakdown
    │   └── ...
    ├── constants/
    │   ├── reviewFlowTiming.ts           # ROUND_REVEAL_BUFFER_MS / ROUND_RESULT_HOLD_MS
    │   │                                   + displayRoundNumber() (0-indexed labels)
    │   ├── reviewRoomScenes.ts           # per-room reviewer slot layout
    │   ├── roomConfig.ts
    │   └── uiConfig.ts
    ├── contracts/
    │   ├── abis.ts                       # DAIOCore / RoundLedger / CommitReveal / ...
    │   └── addresses.json                # Sepolia deployment snapshot
    ├── data/
    │   ├── reviewerCharacterConfig.ts    # 20-reviewer master records
    │   ├── mockCharacters.ts
    │   ├── mockFinalResults.ts
    │   └── mockLogs.ts
    ├── hooks/
    │   └── useNodeChat.ts                # chat state per (evaluationId, nodeId);
    │                                       calls /ask when chain context is set
    ├── services/
    │   ├── daio/
    │   │   ├── useDaioData.ts            # multicall reads for the active request
    │   │   ├── queries.ts                # individual chain reads
    │   │   ├── contentApi.ts             # Content API + askAgentQuestion()
    │   │   ├── usePayReviewBounty.ts     # USDAIO approve + relayed request
    │   │   └── ethSwapCalldata.ts        # ETH→USDAIO swap helper
    │   ├── nodeChatService.ts            # mock fallback when no chain context
    │   ├── reports/
    │   │   └── pdfReport.ts              # jsPDF builder (includes interview Q&A)
    │   └── wallet/
    │       ├── Web3Provider.tsx          # AppKit + wagmi provider
    │       ├── config.ts                 # chains + connectors + DEFAULT_CHAIN
    │       └── ...
    └── utils/
        ├── daioReputation.ts             # ReviewerProfile → percent helpers
        ├── reviewScoring.ts              # reviewer node builder + mock scoring
        └── finalResults.ts               # outlier (|score − consensus| ≥ 10)
                                            + slashing + bounty redistribution
```

---

## 3. Data flow

### 3-1. Chain-driven mode

When the active wallet has an in-flight on-chain request:

1. `useDaioData` multicalls `DAIOCore`, `DAIORoundLedger`,
   `DAIOCommitRevealManager`, `ReviewerRegistry`, etc. and returns a
   normalized snapshot to `App.tsx`.
2. `App.tsx`'s contract effect derives a `SimulationPhase` from
   `requestStatus` + closed flags. Phase advancement is pinned to the
   current round until that round's results have been applied **and** held
   for `ROUND_RESULT_HOLD_MS` — so a fast finalize can no longer skip a
   round visually.
3. `roundApplyTimerRefs` schedule per-round `applyRoundScores(N)` only when
   the data is ready *and* the UI is ready (Round 1: phase = `ROUND_1`;
   Round 2: phase = `ROUND_2` **and** the audit-quorum tracker has filled;
   Round 3: phase = `ROUND_3`). A `ROUND_REVEAL_BUFFER_MS` keeps the
   `Round NN...` state visible even when the chain reveals instantly.
4. After the buffer fires, `setRoundResultHoldRound(N)` triggers the score
   popup over each character; the existing hold timer then calls
   `continueAfterRoundResult(N)` to advance to the next phase.
5. Final reward / slash numbers come from `Settlement` accounting through
   `useDaioData`; the UI reuses the same outlier visualization that the
   mock pipeline produces.

### 3-2. Mock simulation mode

When no chain request is active the same `SimulationPhase` FSM runs but is
driven by deterministic timers from `roundProcessDurationMs()` and scores are
generated by `utils/reviewScoring.ts`. Outlier detection and slashing run
through `utils/finalResults.ts` exactly the same way.

### 3-3. Outlier rule

```ts
// utils/finalResults.ts
OUTLIER_FINAL_SCORE_DIFF   = 10   // |reviewer.finalScore − consensus| ≥ 10 → outlier
SLASH_RATE                 = 0.4  // outlier loses 40% of stake
OUTLIER_REPUTATION_PENALTY = 5    // outlier reputation −0.05 (display scale)
ELIGIBLE_REPUTATION_REWARD = 1    // in-range reputation +0.01 (display scale)
```

`isOutlier` is the single switch behind every penalty visual: explosion sprite,
red `OUTLIER` / `SLASHED` badge, slash amount label, reputation badge,
`Outliers detected` banner, exclusion from the bounty pool, and the
`Accepted Range` tooltip (`final − 10` to `final + 10`).

### 3-4. Round numbering convention

| Layer | Identifier |
| --- | --- |
| State machine | `ROUND_1` / `ROUND_2` / `ROUND_3` (positive integers) |
| Internal data structures | `1` / `2` / `3` |
| Contract round IDs | `0` / `1` / `2` (Review / AuditConsensus / ReputationFinal) |
| **All user-facing labels** | **`Round 00` / `Round 01` / `Round 02`** via `displayRoundNumber(internal)` |

Always render labels through `displayRoundNumber()` from
`constants/reviewFlowTiming.ts` so internal indexing stays consistent and the
UI matches the contract.

### 3-5. Interview chat

`hooks/useNodeChat(evaluationId, requestId?)` per-(eval × node) chat state.
When `requestId` and the node's `agentAddress` are both set, `sendMessage`
posts to `POST /requests/:requestId/agents/:agent/ask` via
`services/daio/contentApi.askAgentQuestion`. Otherwise it falls back to the
keyword-matched mock in `services/nodeChatService.ts`.

The current request/response contract is assumed to be
`{ question }` → `{ answer | message | reply }` — adjust the body and return
mapping in `contentApi.askAgentQuestion` once the agents-side endpoint is
finalized.

---

## 4. Round-flow gating reference

| Phase | Scoreboard title | Per-agent scores | Trigger to advance |
| --- | --- | --- | --- |
| `SELECTION` | `Selection` | hidden | drawing animation completes (`isNodeSelectionReady`) |
| `MOVING_TO_ROOMS` | `Round 00...` | hidden | character motion settles |
| `ROUND_1` (in progress) | `Round 00...` | hidden | `review.closed` + `ROUND_REVEAL_BUFFER_MS` |
| Round 0 result hold (~1.8s) | `Round 00` | revealed | `ROUND_RESULT_HOLD_MS` elapses |
| `ROUND_2_STARTING` → `ROUND_2` | `Round 01...` | hidden | `auditConsensus.closed` + `auditQuorumDisplayReady` + buffer |
| Round 1 result hold (~1.8s) | `Round 01` | revealed | hold elapses |
| `ROUND_3_STARTING` → `ROUND_3` | `Round 02...` | hidden | `reputationFinal.closed` + buffer |
| Round 2 result hold (~2.7s) | `Round 02` | revealed | `ROUND_THREE_RESULT_HOLD_MS` elapses |
| `FINALIZING` → `EVALUATED` | `Final Result` | revealed + bounty redistribution | — |

Implementation knobs (`constants/reviewFlowTiming.ts`):

- `ROUND_REVEAL_BUFFER_MS = 2500` — minimum time the `Round NN...` state stays
  on screen before the score reveal fires.
- `ROUND_RESULT_HOLD_MS = 1800`, `ROUND_THREE_RESULT_HOLD_MS = 2700` — how long
  the closed round's scores stay before phase advances.

---

## 5. Running

### 5-1. Requirements

- Node.js 20+ recommended
- npm (or pnpm/yarn)

### 5-2. Install & dev server

```bash
npm install
npm run dev          # http://localhost:3000  (host 0.0.0.0)
```

### 5-3. Other scripts

```bash
npm run build              # vite build → dist/
npm run preview            # serve the build locally
npm run clean              # remove dist/
npm run lint               # tsc --noEmit (type check only)
npm run generate:idle-gifs # rebuild reviewer idle GIFs from PNG sources
```

### 5-4. Environment variables

Defined in `.env` or `.env.local` (see `.env.example`).

| Variable | Purpose |
| --- | --- |
| `VITE_DAIO_API` | Content Service base URL (production: `http://api.opendaio.com`, reverse-proxied to `localhost:18002`). Drives request creation, document storage, agent status / reasons, and the `/ask` interview endpoint. |
| `VITE_MARKITDOWN_API` | MarkItDown API base URL (production: `http://markitdown.opendaio.com`, reverse-proxied to `localhost:18003`). Used by the submission gate to convert PDF/DOCX uploads to Markdown. |
| `VITE_REOWN_PROJECT_ID` | Reown AppKit project ID for WalletConnect. |
| `GEMINI_API_KEY` | Optional Gemini key. The live interview path uses the Content Service `/ask`; this is reserved as a fallback inside `services/nodeChatService.ts`. |
| `APP_URL` | Self-URL for OAuth callbacks / share links. |
| `DISABLE_HMR` | Set to `"true"` to disable Vite HMR (AI Studio compatibility). |

The chain side is wired against `src/contracts/addresses.json` (Sepolia
snapshot). Point `VITE_DAIO_API` at a Content Service running against the
same deployment.

---

## 6. Adding a reviewer character

Reviewers are drop-in: add the asset and metadata, no manual registration.

1. Drop `ai-XX.png` into `public/assets/characters/reviewers/` (idle sprite).
2. Optionally add `public/assets/characters/reviewers/states/ai-XX-{think,penalty,reward,portrait}.gif`.
3. Add a `{ label, specialty, labRoom }` entry to
   `src/data/reviewerCharacterConfig.ts` `REVIEWER_CHARACTER_CONFIGS`.
4. If introducing a new room or layout slot, edit `src/constants/reviewRoomScenes.ts`.

`reviewerCharacterAssetsPlugin` in `vite.config.ts` watches the directory
and re-exposes the assets through `virtual:reviewer-character-assets`, so
HMR picks up new characters without restart.

Current roster (20): `ai-01..05` Paper review · `ai-06..10` Legal counsel ·
`ai-11..15` Investment · `ai-16..20` DAO governance.

---

## 7. PDF report

`Download Report` on the Final Result screen calls
`services/reports/pdfReport.generateEvaluationPdf` and saves
`opendaio-<room>-<timestamp>.pdf`. The PDF includes:

- Header (eval ID, room, generated timestamp)
- Final summary (consensus, accepted range, bounty pool, reward / slash totals)
- Bounty payment block (if a chain payment was confirmed)
- Node Results table
- Per-node breakdown — final reasoning, per-round score deltas / reasoning /
  discussion, and the **Interview Transcript** collected during the session
  (You / Node / System turns). Nodes with no chat history are omitted from
  the transcript section.

PDF generation is structured (text + tables, not a DOM screenshot), so the
result is searchable and small.

---

## 8. Mobile gate

`<MobileGate />` (mounted in `main.tsx`) is a CSS-gated full-screen overlay
that appears on viewports narrower than `lg` (1024px) and asks the user to
open the app on a desktop browser. Pure media-query, no JS branching.

---

## 9. Roadmap

- **`investment` and `dao` rooms** — character + room assets are ready; only
  scene definitions in `constants/reviewRoomScenes.ts` are missing.
- **`/ask` request/response contract** — current implementation assumes
  `{ question }` → `{ answer }` (with `message` / `reply` fallbacks). Lock the
  shape once the agents-side endpoint is finalized.
- **`OUTLIER_FINAL_SCORE_DIFF`** — currently hardcoded to `10`. Consider
  reading the protocol-side threshold from the deployment config when the
  protocol-level rule diverges.
- **`App.tsx` size** — ~3,000 lines. Split into a router shell, the
  chain-driven contract effect, the mock simulation effect, and a dedicated
  reports module.
- **PDF style polish** — `pdfReport.ts` is structured but does not yet embed
  the pixel-art branding. A custom font + small SVG insets would make it
  feel like the in-app scoreboard.

---

## 10. Things worth knowing

- **Single-page** — no router library; `AppPage = 'dashboard' | 'commons' | 'loading' | 'room'`
  is plain state inside `App.tsx`. Add `react-router` / `@tanstack/router` when
  URL state matters.
- **Pixel frame** — `components/PixelFrame.tsx` (`PixelFrameChrome`) draws the
  chunky pixel border with `clip-path` instead of SVG. Almost every panel
  layers it.
- **Tailwind v4** — zero-config (no `tailwind.config.*`). Design tokens live in
  `src/index.css`.
- **Asset path single source** — components must not use raw `/assets/...`
  strings; always go through `src/assets/assetPaths.ts` `ASSET_PATHS`.
- **Dead asset paths** — some `ASSET_PATHS.ui.panels.*`, `ASSET_PATHS.ui.buttons.*`,
  `ASSET_PATHS.icons.*`, `ASSET_PATHS.billboard.*` entries fall back through
  `onError` because the file is not on disk. Either add the file or trim the
  reference when adding new UI.
- **Reputation scaling** — contract reputation values are on a `0..10000`
  scale. The dashboard / Final Result UI divides by 100 and displays `xx.xx`
  via `daioProfileReputationPercent()` (in `utils/daioReputation.ts`) and
  `ReputationChangeBadge`.
- **Reputation panel order** — `ReputationScorePanel` keeps a stable rank
  order (computed only when the character set, the partition flag, or the
  selected-id set changes). Live `reputationScore` updates do not reorder
  the rows, so the panel stays calm during the selection animation.
- **Agent reward popup token** — the token label on the floating
  `+X.X` reward popup is `USDAIO` when `result.rewardSource === 'chain'`,
  `TOK` otherwise.

---

## 11. License

Each source file carries an `Apache-2.0` SPDX identifier at the top. Unless
otherwise stated, the same license applies to the rest of the project.
