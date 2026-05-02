/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, DoorOpen, FileDown, LayoutDashboard } from 'lucide-react';
import { AICharacter, Coordinates, FinalEvaluationSummary, LogEntry, NodeEvaluationResult, RoundEvaluationHistory, RoundScore, SimulationPhase } from './types';
import { buildAICharactersForRoom } from './data/mockCharacters';
import { MOCK_FINAL_RESULT_INPUTS } from './data/mockFinalResults';
import { buildNodeResultRows, type NodeEvaluationInput } from './utils/finalResults';
import { useNodeChat } from './hooks/useNodeChat';

import Character from './components/Character';
import ReviewBountyGateOverlay, { type ConfirmedReviewBounty } from './components/ReviewBountyGateOverlay';
import LogPanel from './components/LogPanel';
import TrustScorePanel from './components/TrustScorePanel';
import Billboard from './components/Billboard';
import ConferenceHall from './components/ConferenceHall';
import ProjectRoom from './components/ProjectRoom';
import Navbar from './components/Navbar';
import DashboardPage from './components/DashboardPage';
import CommonsPage from './components/CommonsPage';
import LoadingTransition from './components/LoadingTransition';
import NodeSelectionScene from './components/NodeSelectionScene';
import NodeDetailDrawer from './components/NodeDetailDrawer';
import ConversationDrawer, { type ConversationDrawerData } from './components/ConversationDrawer';
import ThinkingDrawer from './components/ThinkingDrawer';
import { PixelFrameChrome } from './components/PixelFrame';
import { ActiveReviewRoomId, REVIEW_ROOMS } from './components/RoomSelectionPanel';
import { getRoomConfig, getCharacterTarget, type RoomConfigEntry } from './constants/roomConfig';
import { REVIEW_ROOM_SCENES } from './constants/reviewRoomScenes';
import { ASSET_PATHS } from './assets/assetPaths';
import {
  DEFAULT_SELECTED_NODE_COUNT,
  getReviewParticipants,
  getSelectedReviewNodes,
  selectReviewNodes,
} from './utils/nodeSelection';

type AppPage = 'dashboard' | 'commons' | 'loading' | 'room';

interface FinalResultState {
  summary: FinalEvaluationSummary;
  nodes: NodeEvaluationResult[];
}

interface DiscussionPlan {
  conversations: ConversationDrawerData[];
  idleNodeId?: string;
  idleNodeName?: string;
}

const roundDiscussions = {
  1: 'Initial independent review focused on methodology, evidence, and clarity.',
  2: 'Nodes compared notes in neighboring labs and challenged weak assumptions.',
  3: 'Small walking discussions resolved score gaps before final submission.',
};

const changeReasons = {
  1: 'Initial score based on local evidence extraction.',
  2: 'Revised after peer discussion and credibility checks.',
  3: 'Final adjustment after hallway discussion and outlier awareness.',
};

function resetCharacter(char: AICharacter): AICharacter {
  return {
    ...char,
    status: 'IDLE',
    position: char.idlePosition,
    lastScore: undefined,
    isOutlier: false,
    selected: false,
    selectionStatus: 'standby',
    scoreHistory: [],
    scoreReasoning: undefined,
    discussionSummary: undefined,
  };
}

function ResultEffectGif({ src, className, style }: { src: string; className: string; style: CSSProperties }) {
  const [isHidden, setIsHidden] = useState(false);

  if (isHidden) return null;

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      className={className}
      style={style}
      onError={() => setIsHidden(true)}
    />
  );
}

function ResultSparkleSequence({ src, baseStyle }: { src: string; baseStyle: CSSProperties }) {
  const [cycle, setCycle] = useState(0);
  const [showRightSparkle, setShowRightSparkle] = useState(true);
  const [showLeftSparkle, setShowLeftSparkle] = useState(false);

  useEffect(() => {
    let rightTimeout: number | undefined;
    let leftTimeout: number | undefined;
    const startCycle = () => {
      setCycle((current) => current + 1);
      setShowRightSparkle(false);
      setShowLeftSparkle(false);
      rightTimeout = window.setTimeout(() => setShowRightSparkle(true), 40);
      leftTimeout = window.setTimeout(() => setShowLeftSparkle(true), 620);
    };

    startCycle();
    const interval = window.setInterval(startCycle, 1900);
    return () => {
      window.clearInterval(interval);
      if (rightTimeout) window.clearTimeout(rightTimeout);
      if (leftTimeout) window.clearTimeout(leftTimeout);
    };
  }, []);

  const left = typeof baseStyle.left === 'string' ? baseStyle.left : '0px';
  const top = typeof baseStyle.top === 'string' ? baseStyle.top : '0px';

  return (
    <>
      {showRightSparkle && (
        <ResultEffectGif
          src={`${src}?sparkle=right-${cycle}`}
          className="result-effect-gif result-sparkle-gif result-sparkle-gif--right"
          style={{
            left: `calc(${left} + 30px)`,
            top: `calc(${top} - 56px)`,
          }}
        />
      )}
      {showLeftSparkle && (
        <ResultEffectGif
          src={`${src}?sparkle=left-${cycle}`}
          className="result-effect-gif result-sparkle-gif result-sparkle-gif--left"
          style={{
            left: `calc(${left} - 28px)`,
            top: `calc(${top} - 20px)`,
          }}
        />
      )}
    </>
  );
}

function ResultExplosionSequence({ src, baseStyle }: { src: string; baseStyle: CSSProperties }) {
  const [cycle, setCycle] = useState(0);
  const [showRightExplosion, setShowRightExplosion] = useState(true);
  const [showLeftExplosion, setShowLeftExplosion] = useState(false);

  useEffect(() => {
    let rightTimeout: number | undefined;
    let leftTimeout: number | undefined;
    const startCycle = () => {
      setCycle((current) => current + 1);
      setShowRightExplosion(false);
      setShowLeftExplosion(false);
      rightTimeout = window.setTimeout(() => setShowRightExplosion(true), 40);
      leftTimeout = window.setTimeout(() => setShowLeftExplosion(true), 620);
    };

    startCycle();
    const interval = window.setInterval(startCycle, 1900);
    return () => {
      window.clearInterval(interval);
      if (rightTimeout) window.clearTimeout(rightTimeout);
      if (leftTimeout) window.clearTimeout(leftTimeout);
    };
  }, []);

  const left = typeof baseStyle.left === 'string' ? baseStyle.left : '0px';
  const top = typeof baseStyle.top === 'string' ? baseStyle.top : '0px';

  return (
    <>
      {showRightExplosion && (
        <ResultEffectGif
          src={`${src}?explosion=right-${cycle}`}
          className="result-effect-gif result-explosion-gif result-explosion-gif--right"
          style={{
            left: `calc(${left} + 24px)`,
            top: `calc(${top} - 48px)`,
          }}
        />
      )}
      {showLeftExplosion && (
        <ResultEffectGif
          src={`${src}?explosion=left-${cycle}`}
          className="result-effect-gif result-explosion-gif result-explosion-gif--left"
          style={{
            left: `calc(${left} - 24px)`,
            top: `calc(${top} - 30px)`,
          }}
        />
      )}
    </>
  );
}

function RoundScorePopup({ character, round, style }: { character: AICharacter; round: 1 | 2 | 3; style: CSSProperties }) {
  const [showDelta, setShowDelta] = useState(true);
  const entry = character.scoreHistory.find((score) => score.round === round);
  const previousScore = character.scoreHistory.find((score) => score.round === round - 1)?.score;
  const delta = previousScore === undefined || !entry ? undefined : entry.score - previousScore;

  useEffect(() => {
    setShowDelta(true);
    const timer = window.setTimeout(() => setShowDelta(false), 1050);
    return () => window.clearTimeout(timer);
  }, [character.id, round]);

  if (!entry) return null;

  return (
    <motion.div
      className="round-score-pop pointer-events-none absolute z-[65] -translate-x-1/2 text-center"
      style={style}
      initial={{ opacity: 0, scale: 0.88, y: 10 }}
      animate={{ opacity: [0, 1, 1, 0], scale: [0.88, 1.04, 1, 0.94], y: [10, -2, -2, -12] }}
      exit={{ opacity: 0, scale: 0.92, y: -14 }}
      transition={{ duration: 2.45, times: [0, 0.16, 0.78, 1], ease: 'easeOut' }}
    >
      <div className="round-score-value">{entry.score}</div>
      <AnimatePresence>
        {showDelta && typeof delta === 'number' && delta !== 0 && (
          <motion.div
            key={`${character.id}-${round}-delta`}
            className={`round-score-delta ${delta > 0 ? 'round-score-delta--gain' : 'round-score-delta--loss'}`}
            initial={{ opacity: 0, y: 6, scale: 0.85 }}
            animate={{ opacity: 1, y: -6, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.9 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
          >
            {delta > 0 ? '+' : ''}
            {delta}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function formatReportAmount(value: number, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : '0.00';
}

function reportTimestamp(value: number) {
  return new Date(value).toLocaleString();
}

function slugifyReportName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'review';
}

function buildEvaluationReport({
  roomTitle,
  roomDescription,
  evaluationId,
  finalResult,
  logs,
  reviewBounty,
}: {
  roomTitle: string;
  roomDescription: string;
  evaluationId: string;
  finalResult: FinalResultState;
  logs: LogEntry[];
  reviewBounty: ConfirmedReviewBounty | null;
}) {
  const { summary, nodes } = finalResult;
  const lines: string[] = [
    '# PixelReview Evaluation Report',
    '',
    `Generated: ${new Date().toLocaleString()}`,
    `Evaluation ID: ${evaluationId}`,
    `Review Room: ${roomTitle}`,
    `Room Description: ${roomDescription}`,
    '',
    '## Final Result',
    '',
    `- Final Score: ${formatReportAmount(summary.finalAverage, 1)}`,
    `- Standard Deviation: ${formatReportAmount(summary.standardDeviation, 2)}`,
    `- Accepted Range: ${formatReportAmount(summary.outlierThresholdLow, 1)} - ${formatReportAmount(summary.outlierThresholdHigh, 1)}`,
    `- Bounty Winners: ${summary.eligibleNodeCount} / ${nodes.length}`,
    `- Bounty Per Winner: ${formatReportAmount(summary.bountyPerEligibleNode, 2)} ${summary.bountyAsset}`,
    `- Review Bounty Pool: ${formatReportAmount(summary.reviewBountyAmount, 2)} ${summary.bountyAsset}`,
    `- Slashed Stake Pool: ${formatReportAmount(summary.totalSlashedPool, 2)} TOK`,
  ];

  if (reviewBounty) {
    lines.push(
      '',
      '## Bounty Payment',
      '',
      `- Amount: ${formatReportAmount(reviewBounty.amount, 2)} ${reviewBounty.asset}`,
      `- Network: ${reviewBounty.network}`,
      `- Transaction Hash: ${reviewBounty.txHash}`,
    );
  }

  lines.push(
    '',
    '## Node Results',
    '',
    '| Node | Final Score | Status | Trust | Stake | Bounty | Stake Change |',
    '| --- | ---: | --- | ---: | ---: | ---: | ---: |',
    ...nodes.map((node) => {
      const stakeChange = node.rewardAmount - node.slashAmount;
      return `| ${node.name} | ${node.finalScore} | ${node.status} | ${node.trustBefore} -> ${node.trustAfter} | ${formatReportAmount(node.stakeAmount, 1)} TOK | ${formatReportAmount(node.bountyRewardAmount, 2)} ${summary.bountyAsset} | ${formatReportAmount(stakeChange, 1)} TOK |`;
    }),
    '',
    '## Node Review History',
  );

  nodes.forEach((node) => {
    lines.push(
      '',
      `### ${node.name}`,
      '',
      `Final Reasoning: ${node.finalReasoning}`,
      '',
    );

    node.roundHistory.forEach((history) => {
      lines.push(
        `- ${history.title}`,
        `  - Phase: ${history.phase}`,
        `  - Score: ${history.scoreBefore !== undefined ? `${history.scoreBefore} -> ` : ''}${history.scoreAfter}`,
        `  - Reasoning: ${history.reasoning}`,
      );

      if (history.discussedWith?.length) {
        lines.push(`  - Discussed With: ${history.discussedWith.join(', ')}`);
      }
      if (history.discussionSummary) {
        lines.push(`  - Discussion Summary: ${history.discussionSummary}`);
      }
      if (history.evidenceUsed?.length) {
        lines.push(`  - Evidence Used: ${history.evidenceUsed.join(', ')}`);
      }
    });
  });

  lines.push(
    '',
    '## Event Log',
    '',
    ...logs.map((log) => `- [${reportTimestamp(log.timestamp)}] ${log.message}`),
    '',
  );

  return lines.join('\n');
}

function buildRoundScore(char: AICharacter, round: number, conversation?: ConversationDrawerData): RoundScore {
  const previousScore = char.scoreHistory.at(-1)?.score;
  const target = 72 + char.quality * 18;
  const spread = (1 - char.quality) * 28;
  const rawScore =
    previousScore === undefined
      ? target + (Math.random() * spread * 2 - spread)
      : previousScore + (target - previousScore) * 0.35 + (Math.random() * 10 - 5);
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  const peerNames = conversation?.participantNames.filter((name) => name !== char.name);
  const discussion = conversation
    ? conversation.summary
    : round === 1
      ? roundDiscussions[1]
      : `${char.name} had no direct peer conversation this round and kept reviewing locally for the next rotation.`;

  return {
    round,
    score,
    reasoning: `${char.name} weighted evidence quality, novelty, and reviewer confidence. The current estimate is ${score}/100.`,
    discussion,
    changeReason: changeReasons[round as 1 | 2 | 3],
    discussedWith: peerNames,
  };
}

function buildRoomRoundHistory(char: AICharacter, finalScore: number): RoundEvaluationHistory[] {
  const roundHistory: RoundEvaluationHistory[] = char.scoreHistory.map((entry) => ({
    round: entry.round,
    title: `Round ${entry.round} — ${entry.round === 1 ? 'Independent Review' : entry.round === 2 ? 'Cross-lab Discussion' : 'Hallway Discussion'}`,
    phase: entry.round === 1 ? 'independent_review' : entry.round === 2 ? 'cross_lab_discussion' : 'hallway_discussion',
    scoreBefore: char.scoreHistory.find((score) => score.round === entry.round - 1)?.score,
    scoreAfter: entry.score,
    scoreChange: entry.round > 1 ? entry.score - (char.scoreHistory.find((score) => score.round === entry.round - 1)?.score ?? entry.score) : undefined,
    reasoning: entry.reasoning,
    discussedWith: entry.discussedWith,
    discussionSummary: entry.discussion,
    evidenceUsed: [entry.changeReason],
  }));

  const finalPreviousScore = char.scoreHistory.at(-1)?.score ?? finalScore;

  return [
    ...roundHistory,
    {
      round: 'final',
      title: 'Final — Final Scoring',
      phase: 'final_scoring',
      scoreBefore: finalPreviousScore,
      scoreAfter: finalScore,
      scoreChange: finalScore - finalPreviousScore,
      reasoning: `${char.name} submitted ${finalScore} as the final score after this room's discussion cycle.`,
      discussionSummary: 'Final score submitted to the consensus board.',
      evidenceUsed: ['Room-local review history', 'Peer discussion notes', 'Final score reconciliation'],
    },
  ];
}

function buildRoomFinalInputs(characters: AICharacter[]): NodeEvaluationInput[] {
  const mockInputById = new Map(MOCK_FINAL_RESULT_INPUTS.map((node) => [node.id, node]));

  return characters.map((character) => {
    const mockInput = mockInputById.get(character.id);
    const finalScore =
      character.scoreHistory.at(-1)?.score ??
      character.lastScore ??
      mockInput?.finalScore ??
      Math.round(72 + character.quality * 18);

    return {
      id: character.id,
      name: character.name,
      avatar: character.avatar ?? ASSET_PATHS.characters.reviewers[character.id]?.portrait,
      finalScore,
      trustBefore: character.trustScore,
      stakeAmount: character.stakeAmount,
      roundHistory: character.scoreHistory.length > 0
        ? buildRoomRoundHistory(character, finalScore)
        : mockInput?.roundHistory,
    };
  });
}

function withPositionOffset(base: ReturnType<typeof getCharacterTarget>, offsetX = 0, offsetY = 0) {
  return {
    ...base,
    offsetX: (base.offsetX || 0) + offsetX,
    offsetY: (base.offsetY || 0) + offsetY,
  };
}

function buildTranscript(first: AICharacter, second: AICharacter, round: number): ConversationDrawerData['transcript'] {
  return [
    {
      speakerId: first.id,
      speakerName: first.name,
      message: `I am checking whether the current score is supported by concrete evidence anchors before we move it in round ${round}.`,
    },
    {
      speakerId: second.id,
      speakerName: second.name,
      message: 'I would separate novelty, reproducibility, and confidence. A strong claim should not raise every component unless the methods are also clear.',
    },
    {
      speakerId: first.id,
      speakerName: first.name,
      message: 'Agreed. I will move only the confidence portion and keep the core quality estimate stable unless the evidence boundary changes.',
    },
    {
      speakerId: second.id,
      speakerName: second.name,
      message: 'Then the next score update should cite the shared evidence rule and avoid reacting to the loudest objection alone.',
    },
  ];
}

function buildDiscussionPlan(characters: AICharacter[], round: number): DiscussionPlan {
  const ordered = characters;
  const idleIndex = ordered.length % 2 === 1
    ? (ordered.length - 1 - ((round - 2) % ordered.length) + ordered.length) % ordered.length
    : -1;
  const idleCharacter = idleIndex >= 0 ? ordered[idleIndex] : undefined;
  const activeCharacters = ordered.filter((_, index) => index !== idleIndex);
  const rotation = activeCharacters.length > 0 ? (round - 2) % activeCharacters.length : 0;
  const rotatedCharacters = [
    ...activeCharacters.slice(rotation),
    ...activeCharacters.slice(0, rotation),
  ];

  const conversations: ConversationDrawerData[] = [];
  for (let index = 0; index < rotatedCharacters.length; index += 2) {
    const first = rotatedCharacters[index];
    const second = rotatedCharacters[index + 1];
    if (!first || !second) continue;

    const locationLabel = round === 2 ? `${first.name} Lab` : `Hallway cluster ${Math.floor(index / 2) + 1}`;
    conversations.push({
      id: `round-${round}-${first.id}-${second.id}`,
      round,
      participantIds: [first.id, second.id],
      participantNames: [first.name, second.name],
      locationLabel,
      summary: `${first.name} and ${second.name} compared evidence and calibrated their next score update.`,
      transcript: buildTranscript(first, second, round),
    });
  }

  return {
    conversations,
    idleNodeId: idleCharacter?.id,
    idleNodeName: idleCharacter?.name,
  };
}

function findConversationForNode(conversations: ConversationDrawerData[], nodeId: string) {
  return conversations.find((conversation) => conversation.participantIds.includes(nodeId));
}

function roomDiscussionPosition(
  character: AICharacter,
  conversation: ConversationDrawerData | undefined,
  participantIndex: number,
  reviewRoomId: ActiveReviewRoomId,
) {
  if (!conversation) return getCharacterTarget(character.id, reviewRoomId);

  const hostTarget = getCharacterTarget(conversation.participantIds[0], reviewRoomId);
  if (participantIndex === 0) return hostTarget;

  const guestOffsetX = hostTarget.x > 50 ? -54 : 54;
  return withPositionOffset(hostTarget, guestOffsetX, 4);
}

function hallwayDiscussionPosition(pairIndex: number, participantIndex: number) {
  const clusters = [
    { x: 44, y: 48, offsetX: -28, offsetY: 0 },
    { x: 44, y: 48, offsetX: 28, offsetY: 0 },
    { x: 56, y: 58, offsetX: -24, offsetY: 0 },
    { x: 56, y: 58, offsetX: 24, offsetY: 0 },
  ];
  return clusters[(pairIndex * 2 + participantIndex) % clusters.length];
}

function positionsMatch(first: Coordinates, second: Coordinates) {
  return first.x === second.x
    && first.y === second.y
    && (first.offsetX || 0) === (second.offsetX || 0)
    && (first.offsetY || 0) === (second.offsetY || 0);
}

function movementDurationMs(character: AICharacter, nextPosition: Coordinates) {
  return positionsMatch(character.position, nextPosition) ? 0 : (1.5 / character.speed) * 1000;
}

export default function App() {
  const [page, setPage] = useState<AppPage>('commons');
  const [selectedRoom, setSelectedRoom] = useState<ActiveReviewRoomId>('paper');
  const [loadingRoom, setLoadingRoom] = useState<ActiveReviewRoomId>('paper');
  const [characters, setCharacters] = useState<AICharacter[]>(() => buildAICharactersForRoom('paper').map(resetCharacter));
  const [phase, setPhase] = useState<SimulationPhase>('IDLE');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeConversations, setActiveConversations] = useState<ConversationDrawerData[]>([]);
  const [metConversationIds, setMetConversationIds] = useState<string[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedThinkingNodeId, setSelectedThinkingNodeId] = useState<string | null>(null);
  const [pendingDiscussionAdvanceRound, setPendingDiscussionAdvanceRound] = useState<1 | 2 | 3 | null>(null);
  const [currentRound, setCurrentRound] = useState(1);
  const [showChart, setShowChart] = useState(false);
  const [finalResult, setFinalResult] = useState<FinalResultState | null>(null);
  const [roomReviewBounty, setRoomReviewBounty] = useState<ConfirmedReviewBounty | null>(null);
  const [openRoomSelectionSignal, setOpenRoomSelectionSignal] = useState(0);
  const [evaluationId, setEvaluationId] = useState(() => `eval_${Date.now()}`);
  const [confirmArmed, setConfirmArmed] = useState(false);
  const [roundIntro, setRoundIntro] = useState<{ round: 1 | 2 | 3; id: number } | null>(null);
  const [roundResultHoldRound, setRoundResultHoldRound] = useState<1 | 2 | 3 | null>(null);
  const [isNodeSelectionReady, setIsNodeSelectionReady] = useState(false);
  const nodeChat = useNodeChat(evaluationId);
  const charactersRef = useRef(characters);
  const activeConversationsRef = useRef(activeConversations);
  const selectedConversationIdRef = useRef(selectedConversationId);
  const selectedThinkingNodeIdRef = useRef(selectedThinkingNodeId);
  const meetingTimersRef = useRef<number[]>([]);
  const sideboardActivityRef = useRef<HTMLDivElement | null>(null);
  const selectionCompletionLoggedRef = useRef(false);

  const selectedNodeResult = useMemo(
    () => finalResult?.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [finalResult, selectedNodeId],
  );
  const selectedConversation = useMemo(
    () => activeConversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [activeConversations, selectedConversationId],
  );
  const activeRoomConfig = useMemo(() => getRoomConfig(selectedRoom), [selectedRoom]);
  const activeRoomScene = REVIEW_ROOM_SCENES[selectedRoom];
  const loadingReviewers = useMemo(
    () => buildAICharactersForRoom(loadingRoom).map(resetCharacter),
    [loadingRoom],
  );
  const reviewParticipants = useMemo(() => getReviewParticipants(characters), [characters]);
  const sceneCharacters = phase === 'IDLE' || phase === 'SELECTION' ? characters : reviewParticipants;
  const sideboardCharacters = phase === 'IDLE' || phase === 'SELECTION' ? characters : reviewParticipants;
  const selectedThinkingNode = useMemo(
    () => reviewParticipants.find((character) => character.id === selectedThinkingNodeId && character.status === 'THINKING') ?? null,
    [reviewParticipants, selectedThinkingNodeId],
  );
  const isEvaluationInProgress = phase !== 'IDLE' || Boolean(roomReviewBounty) || Boolean(finalResult);

  useEffect(() => {
    charactersRef.current = characters;
  }, [characters]);

  useEffect(() => {
    activeConversationsRef.current = activeConversations;
  }, [activeConversations]);

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  useEffect(() => {
    selectedThinkingNodeIdRef.current = selectedThinkingNodeId;
  }, [selectedThinkingNodeId]);

  useEffect(() => {
    if (selectedThinkingNodeId && !selectedThinkingNode) {
      setSelectedThinkingNodeId(null);
    }
  }, [selectedThinkingNode, selectedThinkingNodeId]);

  useEffect(() => {
    if (!selectedConversation && !selectedThinkingNode) return undefined;

    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (sideboardActivityRef.current?.contains(target)) return;

      setSelectedConversationId(null);
      setSelectedThinkingNodeId(null);
    };

    document.addEventListener('pointerdown', handleOutsidePointerDown);
    return () => document.removeEventListener('pointerdown', handleOutsidePointerDown);
  }, [selectedConversation, selectedThinkingNode]);

  useEffect(() => {
    if (phase !== 'EVALUATED') {
      setConfirmArmed(false);
    }
  }, [phase]);

  const clearMeetingTimers = useCallback(() => {
    meetingTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    meetingTimersRef.current = [];
  }, []);

  const clearRoundResultHoldTimer = useCallback(() => {
    setRoundResultHoldRound(null);
  }, []);

  useEffect(() => () => {
    clearMeetingTimers();
  }, [clearMeetingTimers]);

  const addLog = useCallback((message: string) => {
    setLogs((prev) => [
      { id: Math.random().toString(), timestamp: Date.now(), message },
      ...prev,
    ].slice(0, 50));
  }, [clearMeetingTimers]);

  const resetCycle = useCallback((roomId: ActiveReviewRoomId = selectedRoom) => {
    setPhase('IDLE');
    setCurrentRound(1);
    setSelectedNodeId(null);
    setSelectedConversationId(null);
    setSelectedThinkingNodeId(null);
    setPendingDiscussionAdvanceRound(null);
    clearMeetingTimers();
    clearRoundResultHoldTimer();
    setActiveConversations([]);
    setMetConversationIds([]);
    setShowChart(false);
    setFinalResult(null);
    setConfirmArmed(false);
    setRoundIntro(null);
    setRoundResultHoldRound(null);
    setIsNodeSelectionReady(false);
    selectionCompletionLoggedRef.current = false;
    setCharacters(buildAICharactersForRoom(roomId).map(resetCharacter));
  }, [clearMeetingTimers, clearRoundResultHoldTimer, selectedRoom]);

  const startRoomSelection = (roomId: ActiveReviewRoomId) => {
    if (isEvaluationInProgress) {
      if (roomId === selectedRoom) {
        setSelectedNodeId(null);
        setSelectedConversationId(null);
        setSelectedThinkingNodeId(null);
        setPendingDiscussionAdvanceRound(null);
        setPage('room');
      }
      return;
    }

    setLoadingRoom(roomId);
    setPage('loading');
  };

  const enterRoom = useCallback(() => {
    setSelectedRoom(loadingRoom);
    resetCycle(loadingRoom);
    setRoomReviewBounty(null);
    setLogs([]);
    setActiveConversations([]);
    setMetConversationIds([]);
    setSelectedConversationId(null);
    setSelectedThinkingNodeId(null);
    setPendingDiscussionAdvanceRound(null);
    setPage('room');
    addLog(`${REVIEW_ROOMS[loadingRoom].title} is ready.`);
  }, [addLog, loadingRoom, resetCycle]);

  const leaveRoom = () => {
    setSelectedNodeId(null);
    setSelectedConversationId(null);
    setSelectedThinkingNodeId(null);
    setPendingDiscussionAdvanceRound(null);
    setConfirmArmed(false);
    clearMeetingTimers();
    clearRoundResultHoldTimer();
    setMetConversationIds([]);
    setPage('commons');
  };

  const returnToRoomSelection = () => {
    setSelectedNodeId(null);
    setSelectedConversationId(null);
    setSelectedThinkingNodeId(null);
    setPendingDiscussionAdvanceRound(null);
    setConfirmArmed(false);
    clearMeetingTimers();
    clearRoundResultHoldTimer();
    setMetConversationIds([]);
    setPage('commons');
    setOpenRoomSelectionSignal((signal) => signal + 1);
  };

  const handleNavigate = (target: 'dashboard' | 'commons') => {
    setSelectedNodeId(null);
    setSelectedConversationId(null);
    setSelectedThinkingNodeId(null);
    setPendingDiscussionAdvanceRound(null);
    setConfirmArmed(false);
    clearMeetingTimers();
    clearRoundResultHoldTimer();
    setMetConversationIds([]);
    setPage(target);
  };

  const confirmReviewResults = () => {
    setConfirmArmed(false);
    resetCycle();
    setRoomReviewBounty(null);
    setSelectedNodeId(null);
    setSelectedConversationId(null);
    setSelectedThinkingNodeId(null);
    setPendingDiscussionAdvanceRound(null);
    setPage('commons');
    addLog('Review results confirmed. Evaluation closed.');
  };

  const requestConfirmReviewResults = () => {
    if (phase !== 'EVALUATED' || !finalResult) return;

    if (!confirmArmed) {
      setConfirmArmed(true);
      addLog('Final confirmation requested. Click Confirm again to close the room.');
      return;
    }

    confirmReviewResults();
  };

  const downloadEvaluationReport = () => {
    if (!finalResult) return;

    const room = REVIEW_ROOMS[selectedRoom];
    const report = buildEvaluationReport({
      roomTitle: room.title,
      roomDescription: room.description,
      evaluationId,
      finalResult,
      logs,
      reviewBounty: roomReviewBounty,
    });
    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const dateStamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');

    anchor.href = url;
    anchor.download = `pixelreview-${slugifyReportName(room.title)}-${dateStamp}.md`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    addLog('Evaluation report downloaded.');
  };

  const completeNodeSelection = useCallback(() => {
    setIsNodeSelectionReady(true);

    if (selectionCompletionLoggedRef.current) return;
    selectionCompletionLoggedRef.current = true;

    const selectedNames = getSelectedReviewNodes(charactersRef.current)
      .map((character) => character.name)
      .join(', ');

    addLog(`${DEFAULT_SELECTED_NODE_COUNT} review nodes selected${selectedNames ? `: ${selectedNames}` : ''}.`);
  }, [addLog]);

  useEffect(() => {
    if (phase !== 'SELECTION' || isNodeSelectionReady) return undefined;

    const timer = window.setTimeout(completeNodeSelection, 1800);
    return () => window.clearTimeout(timer);
  }, [completeNodeSelection, isNodeSelectionReady, phase]);

  const startSelectedReview = useCallback(() => {
    if (phase !== 'SELECTION' || !isNodeSelectionReady) return;

    const participants = getReviewParticipants(charactersRef.current);
    setPhase('MOVING_TO_ROOMS');
    setCurrentRound(1);
    setRoundIntro({ round: 1, id: Date.now() });
    setRoundResultHoldRound(null);
    addLog(`Round 1 queued for ${participants.length} selected review nodes.`);
  }, [addLog, isNodeSelectionReady, phase]);

  const handleSubmit = (title: string, link = '') => {
    const nextCharacters = selectReviewNodes(
      charactersRef.current.map(resetCharacter),
      DEFAULT_SELECTED_NODE_COUNT,
    );

    setEvaluationId(`eval_${Date.now()}`);
    setPhase('SELECTION');
    setCurrentRound(1);
    setIsNodeSelectionReady(false);
    selectionCompletionLoggedRef.current = false;
    setRoundIntro(null);
    setRoundResultHoldRound(null);
    setShowChart(false);
    setFinalResult(null);
    setConfirmArmed(false);
    setSelectedNodeId(null);
    setSelectedConversationId(null);
    setSelectedThinkingNodeId(null);
    setPendingDiscussionAdvanceRound(null);
    clearMeetingTimers();
    clearRoundResultHoldTimer();
    setMetConversationIds([]);
    setActiveConversations([]);
    addLog(`Protocol initialized for "${title}".`);
    if (link) {
      addLog(`Submission source attached: ${link}.`);
    }
    if (roomReviewBounty) {
      addLog(`Review bounty funded: ${roomReviewBounty.amount.toFixed(2)} ${roomReviewBounty.asset} on ${roomReviewBounty.network}.`);
    }
    addLog(`Selecting ${DEFAULT_SELECTED_NODE_COUNT} review nodes from ${nextCharacters.length} candidates.`);

    charactersRef.current = nextCharacters;
    setCharacters(nextCharacters);
  };

  const applyRoundScores = useCallback((round: number) => {
    const roundConversations = activeConversationsRef.current.filter((conversation) => conversation.round === round);
    setCharacters((prev) => {
      const participantIds = new Set(getReviewParticipants(prev).map((character) => character.id));

      return prev.map((character) => {
        if (!participantIds.has(character.id)) {
          return {
            ...character,
            status: 'IDLE',
            position: character.idlePosition,
          };
        }

        const conversation = findConversationForNode(roundConversations, character.id);
        const entry = buildRoundScore(character, round, conversation);

        return {
          ...character,
          status: 'IDLE',
          lastScore: entry.score,
          scoreHistory: [...character.scoreHistory, entry],
          scoreReasoning: entry.reasoning,
          discussionSummary: entry.discussion,
        };
      });
    });
    addLog(`Round ${round} scores submitted to the board.`);
  }, [addLog]);

  const finalizeScores = useCallback(() => {
    const activeCharacters = getReviewParticipants(charactersRef.current);
    const activeCharacterIds = new Set(activeCharacters.map((character) => character.id));
    const roomFinalInputs = buildRoomFinalInputs(activeCharacters);
    const calculated = buildNodeResultRows(roomFinalInputs, undefined, roomReviewBounty?.amount ?? 0);
    setFinalResult(calculated);

    setCharacters((prev) =>
      prev.map((character) => {
        const result = calculated.nodes.find((node) => node.id === character.id);
        if (!activeCharacterIds.has(character.id)) {
          return {
            ...character,
            status: 'IDLE',
            position: character.idlePosition,
            isOutlier: false,
            lastScore: undefined,
          };
        }

        if (!result) {
          return {
            ...character,
            status: 'IDLE',
            position: character.idlePosition,
          };
        }

        return {
          ...character,
          status: result.isOutlier ? 'SLASHED' : 'REWARDED',
          position: character.idlePosition,
          isOutlier: result.isOutlier,
          lastScore: result.finalScore,
          stakeAmount: result.stakeAmount + result.rewardAmount - result.slashAmount,
          trustScore: result.trustAfter,
        };
      }),
    );

    setPhase('EVALUATED');
    setShowChart(true);
    addLog(`Final scores computed for ${roomFinalInputs.length} room nodes. Review bounty, slashing, and node rewards updated.`);
  }, [addLog, roomReviewBounty]);

  const inspectNode = (node: NodeEvaluationResult) => {
    setSelectedNodeId(node.id);
    setSelectedConversationId(null);
    setSelectedThinkingNodeId(null);
  };

  const inspectSceneNode = (nodeId: string) => {
    if (finalResult) {
      const node = finalResult.nodes.find((result) => result.id === nodeId);
      setSelectedNodeId(node?.id ?? null);
      setSelectedConversationId(null);
      setSelectedThinkingNodeId(null);
      return;
    }

    const clickedCharacter = charactersRef.current.find((character) => character.id === nodeId);
    const metConversations = activeConversationsRef.current.filter((conversation) => metConversationIds.includes(conversation.id));
    const conversation = findConversationForNode(metConversations, nodeId);
    if (conversation) {
      setSelectedConversationId(conversation.id);
      setSelectedThinkingNodeId(null);
      setSelectedNodeId(null);
      return;
    }

    if (clickedCharacter?.status === 'THINKING') {
      setSelectedThinkingNodeId(nodeId);
      setSelectedConversationId(null);
      setSelectedNodeId(null);
      return;
    }

    setSelectedConversationId(null);
    setSelectedThinkingNodeId(null);
    setSelectedNodeId(null);
  };

  const startDiscussionRound = useCallback((round: 2 | 3) => {
    const activeCharacters = getReviewParticipants(charactersRef.current);
    const activeCharacterIds = new Set(activeCharacters.map((character) => character.id));
    const plan = buildDiscussionPlan(activeCharacters, round);
    const currentCharactersById = new Map<string, AICharacter>(activeCharacters.map((character) => [character.id, character]));
    const nextPositionsById = new Map<string, Coordinates>();

    activeCharacters.forEach((character) => {
      const pairIndex = plan.conversations.findIndex((conversation) => conversation.participantIds.includes(character.id));
      const conversation = pairIndex >= 0 ? plan.conversations[pairIndex] : undefined;
      const participantIndex = conversation?.participantIds.indexOf(character.id) ?? -1;

      nextPositionsById.set(
        character.id,
        conversation && participantIndex >= 0
          ? round === 2
            ? roomDiscussionPosition(character, conversation, participantIndex, selectedRoom)
            : hallwayDiscussionPosition(pairIndex, participantIndex)
          : getCharacterTarget(character.id, selectedRoom),
      );
    });

    clearMeetingTimers();
    setSelectedConversationId(null);
    setSelectedThinkingNodeId(null);
    setActiveConversations(plan.conversations);
    setMetConversationIds([]);
    addLog(`Round ${round} discussion plan started: ${plan.conversations.length} paired conversations${plan.idleNodeName ? `, ${plan.idleNodeName} reviews locally this round` : ''}.`);
    plan.conversations.forEach((conversation) => {
      addLog(`Round ${round}: ${conversation.participantNames[0]} talked with ${conversation.participantNames[1]} at ${conversation.locationLabel}.`);
    });
    if (plan.idleNodeName) {
      addLog(`Round ${round}: ${plan.idleNodeName} had no partner because of the odd node count and is prioritized for the next rotation.`);
    }

    plan.conversations.forEach((conversation) => {
      const meetingDelay = Math.max(
        ...conversation.participantIds.map((nodeId) => {
          const character = currentCharactersById.get(nodeId);
          const nextPosition = nextPositionsById.get(nodeId);
          return character && nextPosition ? movementDurationMs(character, nextPosition) : 0;
        }),
      );

      const timer = window.setTimeout(() => {
        setMetConversationIds((prev) => prev.includes(conversation.id) ? prev : [...prev, conversation.id]);
      }, meetingDelay + 80);
      meetingTimersRef.current.push(timer);
    });

    setCharacters((prev) =>
      prev.map((character) => {
        if (!activeCharacterIds.has(character.id)) {
          return {
            ...character,
            status: 'IDLE',
            position: character.idlePosition,
          };
        }

        const pairIndex = plan.conversations.findIndex((conversation) => conversation.participantIds.includes(character.id));
        const conversation = pairIndex >= 0 ? plan.conversations[pairIndex] : undefined;
        const participantIndex = conversation?.participantIds.indexOf(character.id) ?? -1;

        if (!conversation || participantIndex < 0) {
          return {
            ...character,
            status: 'THINKING',
            position: getCharacterTarget(character.id, selectedRoom),
          };
        }

        return {
          ...character,
          status: 'DISCUSSING',
          position: nextPositionsById.get(character.id) ?? character.position,
        };
      }),
    );
  }, [addLog, clearMeetingTimers, selectedRoom]);

  const advanceFromRound2 = useCallback(() => {
    setPendingDiscussionAdvanceRound(null);
    applyRoundScores(2);
    clearMeetingTimers();
    clearRoundResultHoldTimer();
    setMetConversationIds([]);
    setActiveConversations([]);
    setSelectedConversationId(null);
    setSelectedThinkingNodeId(null);
    setRoundResultHoldRound(2);
  }, [applyRoundScores, clearMeetingTimers, clearRoundResultHoldTimer]);

  const advanceFromRound3 = useCallback(() => {
    setPendingDiscussionAdvanceRound(null);
    applyRoundScores(3);
    clearMeetingTimers();
    clearRoundResultHoldTimer();
    setMetConversationIds([]);
    setActiveConversations([]);
    setSelectedConversationId(null);
    setSelectedThinkingNodeId(null);
    setRoundResultHoldRound(3);
  }, [applyRoundScores, clearMeetingTimers, clearRoundResultHoldTimer]);

  useEffect(() => {
    if (selectedConversationId || selectedThinkingNodeId || pendingDiscussionAdvanceRound === null) return;
    if (pendingDiscussionAdvanceRound === 1 && phase === 'ROUND_1') {
      setPendingDiscussionAdvanceRound(null);
      applyRoundScores(1);
      setRoundResultHoldRound(1);
      return;
    }
    if (pendingDiscussionAdvanceRound === 2 && phase === 'ROUND_2') advanceFromRound2();
    if (pendingDiscussionAdvanceRound === 3 && phase === 'ROUND_3') advanceFromRound3();
  }, [advanceFromRound2, advanceFromRound3, applyRoundScores, pendingDiscussionAdvanceRound, phase, selectedConversationId, selectedThinkingNodeId]);

  useEffect(() => {
    if (roundResultHoldRound === null) return undefined;

    const holdRound = roundResultHoldRound;
    const timer = window.setTimeout(() => {
      setRoundResultHoldRound((current) => current === holdRound ? null : current);

      if (holdRound === 1) {
        setCurrentRound(2);
        setRoundIntro({ round: 2, id: Date.now() });
        setPhase('ROUND_2_STARTING');
        return;
      }

      if (holdRound === 2) {
        setCurrentRound(3);
        setRoundIntro({ round: 3, id: Date.now() });
        setPhase('ROUND_3_STARTING');
        return;
      }

      setPhase('FINALIZING');
      addLog('Final round complete. Nodes are returning to their original seats.');
      setCharacters((prev) =>
        prev.map((character) => ({
          ...character,
          status: 'RETURNING',
          position: character.idlePosition,
        })),
      );
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [addLog, roundResultHoldRound]);

  useEffect(() => {
    if (!roundIntro) return undefined;

    const intro = roundIntro;
    const timer = window.setTimeout(() => {
      setRoundIntro((current) => current?.id === intro.id ? null : current);
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [roundIntro]);

  useEffect(() => {
    if (roundIntro) return undefined;
    if (roundResultHoldRound !== null) return undefined;

    if (phase === 'MOVING_TO_ROOMS') {
      addLog('Round 1 started. Nodes are moving to their labs.');
      const activeCharacters = getReviewParticipants(charactersRef.current);
      const activeCharacterIds = new Set(activeCharacters.map((character) => character.id));
      const moveDuration = Math.max(
        0,
        ...activeCharacters.map((character) => movementDurationMs(character, getCharacterTarget(character.id, selectedRoom))),
      );

      setCharacters((prev) =>
        prev.map((character) => activeCharacterIds.has(character.id)
          ? {
              ...character,
              status: 'MOVING',
              position: getCharacterTarget(character.id, selectedRoom),
            }
          : {
              ...character,
              status: 'IDLE',
              position: character.idlePosition,
            }),
      );

      const timer = window.setTimeout(() => {
        setPhase('ROUND_1');
        setCharacters((prev) => {
          const participantIds = new Set(getReviewParticipants(prev).map((character) => character.id));

          return prev.map((character) => participantIds.has(character.id)
            ? { ...character, status: 'THINKING' }
            : character);
        });
        addLog('Round 1 started. Nodes are reviewing independently.');
      }, moveDuration + 120);
      return () => window.clearTimeout(timer);
    }

    if (phase === 'ROUND_1') {
      const timer = window.setTimeout(() => {
        if (selectedThinkingNodeIdRef.current) {
          setPendingDiscussionAdvanceRound(1);
          return;
        }
        applyRoundScores(1);
        setRoundResultHoldRound(1);
      }, 3000);
      return () => window.clearTimeout(timer);
    }

    if (phase === 'ROUND_2_STARTING') {
      const timer = window.setTimeout(() => {
        setCurrentRound(2);
        setPhase('ROUND_2');
        startDiscussionRound(2);
      }, 150);
      return () => window.clearTimeout(timer);
    }

    if (phase === 'ROUND_2') {
      const timer = window.setTimeout(() => {
        if (selectedConversationIdRef.current || selectedThinkingNodeIdRef.current) {
          setPendingDiscussionAdvanceRound(2);
          return;
        }
        advanceFromRound2();
      }, 5000);
      return () => window.clearTimeout(timer);
    }

    if (phase === 'ROUND_3_STARTING') {
      const timer = window.setTimeout(() => {
        setCurrentRound(3);
        setPhase('ROUND_3');
        startDiscussionRound(3);
      }, 150);
      return () => window.clearTimeout(timer);
    }

    if (phase === 'ROUND_3') {
      const timer = window.setTimeout(() => {
        if (selectedConversationIdRef.current || selectedThinkingNodeIdRef.current) {
          setPendingDiscussionAdvanceRound(3);
          return;
        }
        advanceFromRound3();
      }, 5000);
      return () => window.clearTimeout(timer);
    }

    if (phase === 'FINALIZING') {
      const timer = window.setTimeout(finalizeScores, 2200);
      return () => window.clearTimeout(timer);
    }

    return undefined;
  }, [addLog, advanceFromRound2, advanceFromRound3, applyRoundScores, clearMeetingTimers, finalizeScores, phase, roundIntro, roundResultHoldRound, selectedRoom, startDiscussionRound]);

  const isFinalResultVisible = phase === 'EVALUATED' && Boolean(finalResult);
  const hasReviewScores = reviewParticipants.some((character) => typeof character.lastScore === 'number');
  const isRoundBillboardPhase = (
    phase === 'ROUND_1' ||
    phase === 'ROUND_2_STARTING' ||
    phase === 'ROUND_2' ||
    phase === 'ROUND_3_STARTING' ||
    phase === 'ROUND_3' ||
    phase === 'FINALIZING'
  );
  const showReviewBillboard = isFinalResultVisible || hasReviewScores || isRoundBillboardPhase;
  const confirmButtonFrame = !isFinalResultVisible
    ? {
        border: '#6f8d9d',
        fill: '#c6d9e3',
        highlight: 'rgba(255, 255, 255, 0.38)',
        shadow: 'rgba(54, 80, 94, 0.2)',
        text: 'text-[#4c6673]',
      }
    : confirmArmed
      ? {
          border: '#9c342d',
          fill: '#ffd5c7',
          highlight: 'rgba(255, 255, 255, 0.55)',
          shadow: 'rgba(95, 33, 28, 0.3)',
          text: 'text-[#7e241f]',
        }
      : {
          border: '#315d75',
          fill: '#9ed4e8',
          highlight: 'rgba(255, 255, 255, 0.62)',
          shadow: 'rgba(38, 59, 72, 0.3)',
          text: 'text-[#17384b]',
        };

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#f2e7c9] font-pixel text-[#503521]">
      {page !== 'room' && page !== 'loading' && <Navbar activePage={page} onNavigate={handleNavigate} />}

      {page === 'dashboard' && <DashboardPage />}
      {page === 'commons' && (
        <CommonsPage
          onRoomSelected={startRoomSelection}
          activeRoomId={selectedRoom}
          isEvaluationInProgress={isEvaluationInProgress}
          openRoomSelectionSignal={openRoomSelectionSignal}
        />
      )}
      {page === 'loading' && <LoadingTransition roomId={loadingRoom} reviewers={loadingReviewers} onComplete={enterRoom} />}
      {page === 'room' && (
        <div className="evaluation-room-cool relative flex h-screen overflow-hidden">
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <div className="relative min-h-0 flex-1 overflow-hidden border-b-4 border-[#7b5835]">
              <ConferenceHall tiles={activeRoomScene.tiles} />

              <section className="absolute bottom-6 left-16 z-40 max-w-xl">
                <p className="pixel-text-shadow text-sm uppercase tracking-widest text-white">Active review room</p>
                <h1 className="pixel-text-shadow text-5xl font-bold leading-none text-white">
                  {REVIEW_ROOMS[selectedRoom].title}
                </h1>
                <p className="pixel-text-shadow mt-3 max-w-md text-lg leading-snug text-white">
                  {REVIEW_ROOMS[selectedRoom].description}
                </p>
              </section>

              {(Object.entries(activeRoomConfig) as [string, RoomConfigEntry][]).map(([id, config]) => (
                <ProjectRoom
                  key={id}
                  label={config.label}
                  position={config.position}
                  imageUrl={ASSET_PATHS.rooms[config.roomAssetId]}
                />
              ))}

              <Billboard
                characters={reviewParticipants}
                visible={showReviewBillboard}
                showDetails={showReviewBillboard || showChart}
                finalSummary={finalResult?.summary}
                finalNodeCount={finalResult?.nodes.length}
                finalNodes={finalResult?.nodes ?? []}
                selectedNodeId={selectedNodeId}
                onInspectNode={inspectNode}
                phase={phase}
                currentRound={currentRound}
              />

              <AnimatePresence>
                {phase === 'SELECTION' && (
                  <NodeSelectionScene
                    nodes={characters}
                    isComplete={isNodeSelectionReady}
                    onSkip={completeNodeSelection}
                    onStartReview={startSelectedReview}
                  />
                )}
              </AnimatePresence>

              <AnimatePresence>
                {roundIntro && (
                  <motion.div
                    key={roundIntro.id}
                    className="pointer-events-none absolute inset-0 z-[80] flex items-center justify-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                  >
                    <motion.div
                      className="scoreboard-round-intro px-8 py-5 text-5xl font-bold uppercase tracking-widest"
                      initial={{ opacity: 0, scale: 0.86, y: 16 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 1.08, y: -18 }}
                      transition={{ type: 'spring', damping: 20, stiffness: 260 }}
                    >
                      Round {String(roundIntro.round).padStart(2, '0')} Start
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {phase !== 'SELECTION' && (
                <div className="absolute inset-0 pointer-events-none">
                  {sceneCharacters.map((character) => (
                    <div key={character.id} className="pointer-events-auto">
                      {(() => {
                        const result = finalResult?.nodes.find((node) => node.id === character.id);
                        const tokenFlow = result ? result.rewardAmount - result.slashAmount : 0;
                        const activeConversation = findConversationForNode(activeConversations, character.id);
                        const hasMetPartner = Boolean(activeConversation && metConversationIds.includes(activeConversation.id));
                        const characterAnchorStyle = {
                          left: `calc(${character.position.x}% + ${character.position.offsetX || 0}px)`,
                          top: `calc(${character.position.y}% + ${character.position.offsetY || 0}px)`,
                        };

                        return (
                          <div className={result?.isOutlier ? 'node--slashed' : result ? 'node--rewarded' : undefined}>
                            <Character
                              data={character}
                              onClick={() => inspectSceneNode(character.id)}
                              isSelected={
                                selectedNodeId === character.id ||
                                selectedThinkingNodeId === character.id ||
                                Boolean(selectedConversation?.participantIds.includes(character.id))
                              }
                              showTalkingBubble={hasMetPartner}
                              showThoughtCloud={character.status === 'THINKING'}
                            />
                            <AnimatePresence>
                              {roundResultHoldRound && (
                                <RoundScorePopup
                                  character={character}
                                  round={roundResultHoldRound}
                                  style={{
                                    left: characterAnchorStyle.left,
                                    top: `calc(${characterAnchorStyle.top} - 82px)`,
                                  }}
                                />
                              )}
                            </AnimatePresence>
                            {isFinalResultVisible && result && result.isOutlier && (
                              <ResultExplosionSequence
                                src={ASSET_PATHS.effects.explosion}
                                baseStyle={characterAnchorStyle}
                              />
                            )}
                            {isFinalResultVisible && result && !result.isOutlier && (
                              <ResultSparkleSequence
                                src={ASSET_PATHS.effects.sparkle}
                                baseStyle={characterAnchorStyle}
                              />
                            )}
                            {isFinalResultVisible && result && tokenFlow !== 0 && (
                              <div className={`absolute z-50 -translate-x-1/2 text-xs font-bold ${tokenFlow > 0 ? 'token-float--gain' : 'token-float--loss'}`}
                                style={{
                                  left: characterAnchorStyle.left,
                                  top: `calc(${characterAnchorStyle.top} - 54px)`,
                                }}
                              >
                                {tokenFlow > 0 ? '+' : ''}
                                {tokenFlow.toFixed(1)} TOK
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              )}

              <div className="pointer-events-none absolute bottom-6 right-6 z-[75] flex flex-col items-end gap-2">
                {isFinalResultVisible && confirmArmed && (
                  <div className="pointer-events-none relative isolate max-w-[190px] select-none bg-transparent px-3 py-2 text-center text-[10px] font-bold uppercase leading-tight tracking-wider text-[#9c342d]">
                    <PixelFrameChrome
                      round={2}
                      thickness={3}
                      color="#d87965"
                      fillColor="#fff0ea"
                      innerHighlightColor="rgba(255, 255, 255, 0.52)"
                      outerShadowColor="rgba(80, 53, 33, 0.16)"
                      outerShadowOffsetX={3}
                      outerShadowOffsetY={3}
                    />
                    <span className="relative z-40">Confirm final results? Click once more to close this room.</span>
                  </div>
                )}
                <div className="flex items-end gap-2">
                  {isFinalResultVisible && (
                    <button
                      type="button"
                      onClick={downloadEvaluationReport}
                      className={`pointer-events-auto relative isolate flex h-24 w-32 appearance-none flex-col items-center justify-center gap-1 border-0 bg-transparent px-2 text-center text-[10px] font-bold uppercase leading-tight tracking-wider shadow-none transition-transform hover:-translate-y-0.5 active:translate-y-0.5 ${confirmButtonFrame.text}`}
                      aria-label="Download evaluation report"
                    >
                      <PixelFrameChrome
                        round={2}
                        thickness={4}
                        color={confirmButtonFrame.border}
                        fillColor={confirmButtonFrame.fill}
                        innerHighlightColor={confirmButtonFrame.highlight}
                        outerShadowColor={confirmButtonFrame.shadow}
                        outerShadowOffsetX={5}
                        outerShadowOffsetY={5}
                      />
                      <span className="relative z-40 flex flex-col items-center justify-center gap-1">
                        <FileDown size={20} />
                        <span>Download Report</span>
                        <span className="text-[8px] opacity-80">Markdown file</span>
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={!isFinalResultVisible}
                    onClick={requestConfirmReviewResults}
                    className={`pointer-events-auto relative isolate flex h-24 w-32 appearance-none flex-col items-center justify-center gap-1 border-0 bg-transparent px-2 text-center text-[10px] font-bold uppercase leading-tight tracking-wider shadow-none ${
                      confirmButtonFrame.text
                    } ${isFinalResultVisible ? 'transition-transform hover:-translate-y-0.5 active:translate-y-0.5' : 'cursor-not-allowed opacity-95'}`}
                    aria-label={isFinalResultVisible ? 'Confirm review results' : 'Review in progress'}
                  >
                    <PixelFrameChrome
                      round={2}
                      thickness={4}
                      color={confirmButtonFrame.border}
                      fillColor={confirmButtonFrame.fill}
                      innerHighlightColor={confirmButtonFrame.highlight}
                      outerShadowColor={confirmButtonFrame.shadow}
                      outerShadowOffsetX={5}
                      outerShadowOffsetY={5}
                    />
                    <span className="relative z-40 flex flex-col items-center justify-center gap-1">
                      <CheckCircle2 size={20} />
                      <span>{isFinalResultVisible ? (confirmArmed ? 'Confirm?' : 'Confirm Review') : 'Reviewing'}</span>
                      <span className="text-[8px] opacity-80">
                        {isFinalResultVisible ? (confirmArmed ? 'Click again' : 'Final ready') : 'Locked'}
                      </span>
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <aside className="review-room-sideboard z-30 flex w-84 flex-col gap-4 overflow-hidden border-l-4 border-[#7b5835] bg-[#fff8e6] p-4 shadow-[-4px_0_0_rgba(80,53,33,0.12)]">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleNavigate('dashboard')}
                className="scoreboard-button flex items-center justify-center gap-2 px-3 py-2 text-sm font-bold transition-transform hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0.5"
              >
                <LayoutDashboard size={16} />
                Dashboard
              </button>
              <button
                type="button"
                onClick={leaveRoom}
                className="scoreboard-button flex items-center justify-center gap-2 px-3 py-2 text-sm font-bold transition-transform hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0.5"
              >
                <DoorOpen size={16} />
                Leave Room
              </button>
            </div>
            <div ref={sideboardActivityRef} className="min-h-0 flex flex-1 flex-col">
              <AnimatePresence mode="wait" initial={false}>
                {selectedConversation ? (
                  <ConversationDrawer
                    conversation={selectedConversation}
                    onClose={() => setSelectedConversationId(null)}
                  />
                ) : selectedThinkingNode ? (
                  <ThinkingDrawer
                    character={selectedThinkingNode}
                    phase={phase}
                    currentRound={currentRound}
                    onClose={() => setSelectedThinkingNodeId(null)}
                  />
                ) : (
                  <motion.div
                    key="sideboard-default"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="flex min-h-0 flex-1 flex-col gap-4"
                  >
                    <TrustScorePanel characters={sideboardCharacters} />
                    <div className="min-h-0 flex-1">
                      <LogPanel logs={logs} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </aside>

          <AnimatePresence>
            {selectedNodeResult && (
              <NodeDetailDrawer
                node={selectedNodeResult}
                open={Boolean(selectedNodeResult)}
                chat={nodeChat.getChatState(selectedNodeResult)}
                isChatSending={nodeChat.getIsSending(selectedNodeResult)}
                chatError={nodeChat.getError(selectedNodeResult)}
                onClose={() => setSelectedNodeId(null)}
                onSendChatMessage={(message) => nodeChat.sendMessage(selectedNodeResult, message)}
              />
            )}
          </AnimatePresence>

          {!isFinalResultVisible && phase === 'IDLE' && (
            <ReviewBountyGateOverlay
              roomId={selectedRoom}
              reviewBounty={roomReviewBounty}
              onBack={returnToRoomSelection}
              onConfirmed={(reviewBounty) => {
                setRoomReviewBounty(reviewBounty);
                addLog(`${reviewBounty.amount.toFixed(2)} ${reviewBounty.asset} review bounty paid.`);
              }}
              onSubmitPaper={handleSubmit}
            />
          )}
        </div>
      )}
    </div>
  );
}
