import { X } from 'lucide-react';
import { motion } from 'motion/react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { NodeChatState, NodeEvaluationResult } from '../types';
import NodeChatPanel from './NodeChatPanel';
import NodeDetailTabs, { NodeDetailTab } from './NodeDetailTabs';
import RoundHistoryList from './RoundHistoryList';
import TokenFlowBadge from './TokenFlowBadge';
import { ASSET_PATHS } from '../assets/assetPaths';
import { PixelFrameChrome } from './PixelFrame';
import { getAgentReasons, type AgentReasons } from '../services/daio/contentApi';

interface NodeDetailDrawerProps {
  node: NodeEvaluationResult | null;
  open: boolean;
  chat: NodeChatState;
  isChatSending?: boolean;
  chatError?: string | null;
  onClose: () => void;
  onSendChatMessage: (message: string) => void;
  /** On-chain requestId — used to fetch agent reasons from the Content API. */
  requestId?: bigint;
}

const statusLabels = {
  within_range: 'Within Range',
  outlier: 'Outlier',
  rewarded: 'Rewarded',
  slashed: 'Slashed',
};

const statusTone = {
  within_range: 'node-report-stamp--yellow',
  outlier: 'node-report-stamp--red',
  rewarded: 'node-report-stamp--yellow',
  slashed: 'node-report-stamp--red',
};

export default function NodeDetailDrawer({
  node,
  open,
  chat,
  isChatSending,
  chatError,
  onClose,
  onSendChatMessage,
  requestId,
}: NodeDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<NodeDetailTab>('summary');
  const [agentReasons, setAgentReasons] = useState<AgentReasons | null>(null);

  useEffect(() => {
    setActiveTab('summary');
    setAgentReasons(null);
  }, [node?.id]);

  // Fetch agent reasons from Content API when requestId and node are available
  useEffect(() => {
    const agentAddress = node?.reviewNode?.agentAddress;
    if (!requestId || requestId === 0n || !agentAddress) return;
    let cancelled = false;
    void getAgentReasons(requestId.toString(), agentAddress).then((reasons) => {
      if (!cancelled) setAgentReasons(reasons);
    });
    return () => { cancelled = true; };
  }, [requestId, node?.reviewNode?.agentAddress]);

  if (!open || !node) return null;

  const usesChainAccounting = node.rewardSource === 'chain';
  const tokenFlow = usesChainAccounting ? -node.slashAmount : node.rewardAmount - node.slashAmount;
  const finalHistory = node.roundHistory.find((item) => item.round === 'final') ?? node.roundHistory.at(-1);
  const reviewerAssets = ASSET_PATHS.characters.reviewers[node.id];
  const profileImage = reviewerAssets?.idle ?? node.avatar ?? reviewerAssets?.portrait;
  const fallbackAvatar = node.avatar ?? reviewerAssets?.portrait ?? reviewerAssets?.idle;
  const reputationDelta = node.reputationAfter - node.reputationBefore;
  const reputationDeltaScaled = (reputationDelta / 100).toFixed(2);
  const reputationDeltaLabel = reputationDelta > 0 ? `+${reputationDeltaScaled}` : reputationDeltaScaled;

  return (
    <>
      <motion.button
        type="button"
        className="node-report-backdrop fixed inset-0 z-[89] cursor-default bg-transparent"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={onClose}
        aria-label="Close node details"
        tabIndex={-1}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.aside
        initial={{ x: 420, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 420, opacity: 0 }}
        className="node-report-drawer fixed bottom-0 right-0 top-0 z-[90] w-full max-w-[31rem] overflow-hidden"
        aria-label={`${node.name} node evaluation report`}
      >
        <div className="node-report-binder">
          <NodeDetailTabs activeTab={activeTab} onChange={setActiveTab} />

          <span className="node-report-side-tab node-report-side-tab--red" aria-hidden="true" />
          <span className="node-report-side-tab node-report-side-tab--cyan" aria-hidden="true" />
          <span className="node-report-side-tab node-report-side-tab--gold" aria-hidden="true" />
          <span className="node-report-paperclip node-report-paperclip--top" aria-hidden="true" />
          <button
            type="button"
            className="node-report-close pixel-frame flex h-8 w-8 items-center justify-center text-[#5f211c] transition-transform hover:-translate-y-0.5 hover:brightness-105"
            onClick={onClose}
            aria-label="Close node details"
            title="Close node details"
          >
            <PixelFrameChrome
              round={2}
              thickness={3}
              color="#9c342d"
              fillColor="#d87965"
              innerHighlightColor="rgba(255, 255, 255, 0.24)"
              outerShadowColor="rgba(95, 33, 28, 0.22)"
              outerShadowOffsetX={2}
              outerShadowOffsetY={2}
            />
            <X className="relative z-40" size={18} />
          </button>
          <span className="node-report-paperclip node-report-paperclip--bottom" aria-hidden="true" />

          <div className="node-report-page">
            <header className="node-report-header">
              <div className="node-report-header-main">
                <div className="node-report-profile-card">
                  <div className="node-report-profile-photo">
                    <img
                      src={profileImage}
                      alt={node.name}
                      onError={(event) => {
                        if (!fallbackAvatar || event.currentTarget.src.endsWith(fallbackAvatar)) return;
                        event.currentTarget.src = fallbackAvatar;
                      }}
                    />
                  </div>
                  <span className={`node-report-profile-stamp ${statusTone[node.status]}`}>
                    {statusLabels[node.status]}
                  </span>
                </div>
                <div className="node-report-heading">
                  <p className="node-report-kicker">Node Evaluation Report</p>
                  <h2>{node.name}</h2>
                  <div className="node-report-scoreline">
                    <span>Final Score {node.finalScore}</span>
                    <span className={reputationDelta > 0 ? 'node-report-reputation-up' : reputationDelta < 0 ? 'node-report-reputation-down' : ''}>
                      Reputation {reputationDeltaLabel}
                    </span>
                  </div>
                </div>
              </div>
            </header>

            <div className="node-report-content">
              {activeTab === 'summary' && (
                <>
                  {agentReasons?.review?.summary && (
                    <div className="mb-3">
                      <p className="node-report-kicker mb-0.5">Review Summary (on-chain)</p>
                      <p className="node-report-narrative node-report-narrative--plain">
                        {agentReasons.review.summary}
                      </p>
                      {agentReasons.review.rationale && (
                        <p className="node-report-narrative node-report-narrative--plain mt-1 opacity-80">
                          {agentReasons.review.rationale}
                        </p>
                      )}
                    </div>
                  )}
                  <p className="node-report-narrative node-report-narrative--plain">
                    {node.finalReasoning || finalHistory?.reasoning || 'No final reasoning is available for this node yet.'}
                  </p>

                  <NodeSummaryCard node={node} tokenFlow={tokenFlow} agentReasons={agentReasons} />
                </>
              )}

              {activeTab === 'history' && (
                <section className="node-report-section node-report-history">
                  <div className="node-report-section-heading">
                    <h3>Round History</h3>
                  </div>
                  <RoundHistoryScrollPanel>
                    <RoundHistoryList history={node.roundHistory} />
                  </RoundHistoryScrollPanel>
                </section>
              )}

              {activeTab === 'chat' && (
                <section className="node-report-section node-report-chat">
                  <NodeChatPanel
                    node={node}
                    chat={chat}
                    isSending={isChatSending}
                    error={chatError}
                    onSend={onSendChatMessage}
                  />
                </section>
              )}
            </div>
          </div>
        </div>
      </motion.aside>
    </>
  );
}

function RoundHistoryScrollPanel({ children }: { children: ReactNode }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<{ offsetY: number } | null>(null);
  const [thumb, setThumb] = useState({ top: 0, height: 28, canScroll: false });

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return undefined;

    const updateThumb = () => {
      const railHeight = railRef.current?.clientHeight ?? 0;
      const maxScroll = scroller.scrollHeight - scroller.clientHeight;
      const canScroll = railHeight > 0 && maxScroll > 1;
      const height = canScroll
        ? Math.max(24, Math.min(44, (scroller.clientHeight / scroller.scrollHeight) * railHeight))
        : 28;
      const maxTop = Math.max(0, railHeight - height);
      const top = canScroll ? (scroller.scrollTop / maxScroll) * maxTop : 0;
      setThumb({ top, height, canScroll });
    };

    const resizeObserver = new ResizeObserver(updateThumb);
    resizeObserver.observe(scroller);
    if (scroller.firstElementChild) resizeObserver.observe(scroller.firstElementChild);
    scroller.addEventListener('scroll', updateThumb, { passive: true });
    window.addEventListener('resize', updateThumb);
    updateThumb();

    return () => {
      resizeObserver.disconnect();
      scroller.removeEventListener('scroll', updateThumb);
      window.removeEventListener('resize', updateThumb);
    };
  }, [children]);

  const moveThumbTo = (clientY: number, offsetY = thumb.height / 2) => {
    const scroller = scrollerRef.current;
    const rail = railRef.current;
    if (!scroller || !rail) return;

    const railRect = rail.getBoundingClientRect();
    const maxTop = Math.max(0, railRect.height - thumb.height);
    const nextTop = Math.max(0, Math.min(maxTop, clientY - railRect.top - offsetY));
    const scrollRatio = maxTop === 0 ? 0 : nextTop / maxTop;
    scroller.scrollTop = scrollRatio * (scroller.scrollHeight - scroller.clientHeight);
  };

  return (
    <div className="node-report-history-scroll-wrap">
      <div className="node-report-scroll" ref={scrollerRef}>
        {children}
      </div>
      <div
        className={`node-report-scroll-rail ${thumb.canScroll ? 'node-report-scroll-rail--active' : ''}`}
        ref={railRef}
        onPointerDown={(event) => moveThumbTo(event.clientY)}
        aria-hidden={!thumb.canScroll}
      >
        <button
          type="button"
          className="node-report-scroll-thumb"
          style={{ height: thumb.height, transform: `translate(-50%, ${thumb.top}px)` }}
          tabIndex={thumb.canScroll ? 0 : -1}
          aria-label="Scroll round history"
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            draggingRef.current = { offsetY: event.clientY - event.currentTarget.getBoundingClientRect().top };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!draggingRef.current) return;
            moveThumbTo(event.clientY, draggingRef.current.offsetY);
          }}
          onPointerUp={(event) => {
            draggingRef.current = null;
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
          }}
          onPointerCancel={() => {
            draggingRef.current = null;
          }}
        />
      </div>
    </div>
  );
}

function NodeSummaryCard({ node, tokenFlow, agentReasons }: { node: NodeEvaluationResult; tokenFlow: number; agentReasons?: AgentReasons | null }) {
  const reputationDelta = node.reputationAfter - node.reputationBefore;
  const reputationDeltaScaled = (reputationDelta / 100).toFixed(2);
  const reputationDeltaLabel = reputationDelta > 0 ? `+${reputationDeltaScaled}` : reputationDeltaScaled;
  const reviewNode = node.reviewNode;
  const usesChainAccounting = node.rewardSource === 'chain';
  const stakeAsset = usesChainAccounting ? 'USDAIO' : 'TOK';
  const displayedReward = usesChainAccounting ? node.rewardAmount : node.bountyRewardAmount;

  return (
    <>
      <section className="node-report-section">
        <div className="node-report-section-heading">
          <h3>Score Sheet</h3>
        </div>
        <div className="node-report-metric-grid">
          <Info label="Status" value={node.status.replace('_', ' ')} />
          <Info label="Final Score" value={`${node.finalScore}/100`} />
          <Info label="Reputation Change" value={reputationDeltaLabel} tone={reputationDelta > 0 ? 'positive' : reputationDelta < 0 ? 'negative' : undefined} />
          <Info label="Stake" value={`${node.stakeAmount.toFixed(1)} ${stakeAsset}`} />
          <Info label={usesChainAccounting ? 'Reward Paid' : 'Bounty'} value={`${displayedReward.toFixed(2)} USDAIO`} />
          {usesChainAccounting && <Info label="Slash Count" value={node.slashCount ?? 0} tone={node.slashAmount > 0 ? 'negative' : undefined} />}
        </div>
        <div className="node-report-ledger-line">
          <span>{usesChainAccounting ? 'Slash Flow' : 'Stake Flow'}</span>
          <div>
            <TokenFlowBadge amount={tokenFlow} asset={stakeAsset} />
          </div>
        </div>
        {usesChainAccounting && (node.protocolFault || node.semanticFault) && (
          <p className="node-report-narrative node-report-narrative--plain mt-3">
            Contract flags: {node.protocolFault ? 'protocolFault ' : ''}{node.semanticFault ? 'semanticFault' : ''}. Rewards are zeroed for protocol faults, and slashes are recorded by the contract policy.
          </p>
        )}
      </section>

      {reviewNode && (
        <section className="node-report-section">
          <div className="node-report-section-heading">
            <h3>Protocol Score Breakdown</h3>
            <span>0-10000 scale</span>
          </div>
          <div className="node-report-metric-grid">
            <Info label="proposalScore" value={formatProtocolScore(reviewNode.proposalScore)} />
            <Info label="Round 0 weight" value={formatProtocolScore(reviewNode.round0?.reviewerWeight)} />
            <Info label="Audit median" value={formatProtocolScore(reviewNode.round1?.auditScore)} />
            <Info label="Audit reliability" value={formatProtocolScore(reviewNode.round1?.reliability)} />
            <Info label="Round 1 weight" value={formatProtocolScore(reviewNode.round1?.reviewerWeight)} />
            <Info label="Reputation" value={formatProtocolScore(reviewNode.round2?.reputationScore)} />
            <Info label="Final weight" value={formatProtocolScore(reviewNode.round2?.finalWeight)} />
            <Info label="Weighted score" value={formatProtocolScore(reviewNode.round2?.weightedScore)} />
          </div>
          {reviewNode.reputation?.sampleCount === 0 && (
            <p className="node-report-narrative node-report-narrative--plain mt-3">
              No prior samples. The current node reputation baseline was applied before final weighting.
            </p>
          )}
        </section>
      )}

      {reviewNode && (
        <section className="node-report-section">
          <div className="node-report-section-heading">
            <h3>Round Thought Flow</h3>
            <span>Summary only</span>
          </div>
          <div className="node-report-metric-grid">
            <Info label="Round 0" value={`Individual Review · ${formatProtocolScore(reviewNode.proposalScore)}`} />
            <Info label="Round 1" value={`Peer Audit · ${formatProtocolScore(reviewNode.round1?.reviewerWeight)}`} />
            <Info label="Round 2" value={`Reputation Weighted · ${formatProtocolScore(reviewNode.round2?.finalWeight)}`} />
          </div>
          <p className="node-report-narrative node-report-narrative--plain mt-3">
            The reviewer moved from an independent proposal score, to peer-audit weighting, then to reputation-adjusted final contribution.
          </p>
        </section>
      )}

      {agentReasons?.audit && (
        <section className="node-report-section">
          <div className="node-report-section-heading">
            <h3>Audit Reasoning (on-chain)</h3>
          </div>
          {agentReasons.audit.summary && (
            <p className="node-report-narrative node-report-narrative--plain">
              {agentReasons.audit.summary}
            </p>
          )}
          {agentReasons.audit.rationale && (
            <p className="node-report-narrative node-report-narrative--plain mt-1 opacity-80">
              {agentReasons.audit.rationale}
            </p>
          )}
        </section>
      )}
    </>
  );
}

function formatProtocolScore(value?: number) {
  return typeof value === 'number' ? value.toLocaleString() : '--';
}

function Info({ label, value, tone }: { label: string; value: string | number; tone?: 'positive' | 'negative' }) {
  return (
    <div className={`node-report-metric ${tone ? `node-report-metric--${tone}` : ''}`}>
      <div>{label}</div>
      <strong>{value}</strong>
    </div>
  );
}
