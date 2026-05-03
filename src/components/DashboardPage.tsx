import { Coins, Medal, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import type { DaioData, DaioReviewerProfile } from '../services/daio/useDaioData';

interface DashboardPageProps {
  daioData: DaioData;
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const SCORE_SCALE = 10_000;

function formatTokenAmount(value: bigint | undefined, decimals = 18, fractionDigits = 1) {
  if (!value || value === 0n) return '0';

  const divisor = 10n ** BigInt(decimals);
  const whole = value / divisor;
  const fraction = value % divisor;
  const numeric = Number(whole) + Number(fraction) / Number(divisor);

  return numeric.toLocaleString(undefined, {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  });
}

function formatScore(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '--';
  return `${value.toFixed(1)}%`;
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function statusLabel(profile: DaioReviewerProfile) {
  if (profile.suspended) return 'Suspended';
  if (!profile.active) return 'Paused';
  if (profile.reputation.samples === 0n) return 'Warming up';
  return 'ERC-8004';
}

function reputationScore(profile: DaioReviewerProfile) {
  const reputation = profile.reputation;
  if (reputation.samples === 0n) return 0;

  const sum =
    Number(reputation.reportQuality) +
    Number(reputation.auditReliability) +
    Number(reputation.finalContribution) +
    Number(reputation.protocolCompliance);

  return (sum / 4 / SCORE_SCALE) * 100;
}

function profileName(profile: DaioReviewerProfile) {
  return profile.ensName ?? `agent-${profile.agentId.toString()}`;
}

function buildRankingRows(profiles: DaioReviewerProfile[]) {
  return [...profiles]
    .sort((a, b) => {
      const scoreDelta = reputationScore(b) - reputationScore(a);
      if (scoreDelta !== 0) return scoreDelta;
      const completedDelta = Number(b.completedRequests - a.completedRequests);
      if (completedDelta !== 0) return completedDelta;
      return profileName(a).localeCompare(profileName(b));
    })
    .map((profile) => ({
      key: profile.address,
      name: profileName(profile),
      score: reputationScore(profile),
      reputation: Number(profile.reputation.reportQuality) / 100,
      stake: `${formatTokenAmount(profile.stake)} USDAIO`,
      ribbon: statusLabel(profile),
      agentId: profile.agentId.toString(),
      address: shortAddress(profile.address),
    }));
}

export default function DashboardPage({ daioData }: DashboardPageProps) {
  const profiles = daioData.registeredReviewerProfiles;
  const activeProfiles = profiles.filter((profile) => profile.active && !profile.suspended);
  const sampledProfiles = profiles.filter((profile) => profile.reputation.samples > 0n);
  const erc8004BoundProfiles = profiles.filter(
    (profile) => profile.erc8004AgentWallet && profile.erc8004AgentWallet !== ZERO_ADDRESS,
  );
  const averageReputation = sampledProfiles.length > 0
    ? sampledProfiles.reduce((sum, profile) => sum + reputationScore(profile), 0) / sampledProfiles.length
    : 0;
  const rankingRows = buildRankingRows(profiles);
  const hasRequest = daioData.latestRequestId > 0n;
  const requestLabel = hasRequest
    ? `Request #${daioData.latestRequestId.toString()}`
    : 'Registry live';
  const requestStatus = hasRequest
    ? daioData.latestRequestStatusName
    : 'No connected wallet request';
  const requestBounty = daioData.requestLifecycle?.feePaid ?? daioData.baseRequestFee;
  const phaseProgress = daioData.requestPhase
    ? `${daioData.requestPhase.count.toString()}/${daioData.requestPhase.quorum.toString()}`
    : '--';
  const latestConsensus = daioData.roundAggregates.reputationFinal.closed || daioData.roundAggregates.reputationFinal.score > 0n
    ? Number(daioData.roundAggregates.reputationFinal.score) / 100
    : daioData.roundAggregates.auditConsensus.closed || daioData.roundAggregates.auditConsensus.score > 0n
      ? Number(daioData.roundAggregates.auditConsensus.score) / 100
      : daioData.roundAggregates.review.closed || daioData.roundAggregates.review.score > 0n
        ? Number(daioData.roundAggregates.review.score) / 100
        : 0;

  const stats = [
    {
      label: 'Registered Agents',
      value: `${activeProfiles.length}/${profiles.length}`,
      detail: 'active in ReviewerRegistry',
      icon: Users,
      accent: 'mint',
    },
    {
      label: 'Review Bounty',
      value: `${formatTokenAmount(requestBounty)} USDAIO`,
      detail: daioData.requestLifecycle ? 'escrowed for current request' : 'base fee from DAIOCore',
      icon: Coins,
      accent: 'gold',
    },
    {
      label: 'Avg Reputation',
      value: sampledProfiles.length > 0 ? formatScore(averageReputation) : 'Pending',
      detail: 'ReputationLedger and ERC-8004 signal',
      icon: ShieldCheck,
      accent: 'sky',
    },
    {
      label: 'Latest Consensus',
      value: latestConsensus > 0 ? `${latestConsensus.toFixed(1)}` : '--',
      detail: 'latest closed RoundLedger score',
      icon: TrendingUp,
      accent: 'coral',
    },
  ];

  const prizeNotes = [
    { label: 'Request State', value: hasRequest ? `${daioData.latestRequestStatusName}` : 'Waiting' },
    { label: 'Phase Quorum', value: phaseProgress },
    { label: 'Review Commits', value: `${daioData.reviewCommitters.length} accepted` },
    { label: 'ERC-8004 Bindings', value: `${erc8004BoundProfiles.length}/${profiles.length} agents` },
  ];

  return (
    <main className="dashboard-square h-screen overflow-y-auto overflow-x-hidden text-[#3f2818]">
      <span className="dashboard-image-border dashboard-image-border--left" aria-hidden="true" />
      <span className="dashboard-image-border dashboard-image-border--right" aria-hidden="true" />
      <span className="dashboard-image-border dashboard-image-border--bottom" aria-hidden="true" />
      <span className="dashboard-image-border dashboard-image-border--top" aria-hidden="true" />

      <section className="dashboard-wood-shell" aria-labelledby="dashboard-board-title">
        <header className="dashboard-board-header">
          <div>
            <p>Contract operations board</p>
            <h1 id="dashboard-board-title">Dashboard</h1>
          </div>
        </header>

        <section className="dashboard-board-surface">
          <article className="dashboard-note dashboard-note--feature">
            <span className="dashboard-note__pin dashboard-note__pin--red" />
            <div>
              <div className="dashboard-note__eyebrow">Live chain state</div>
              <div className="dashboard-note__headline">{requestLabel}</div>
              <p>
                {hasRequest
                  ? `Contract status is ${requestStatus}. The UI follows DAIOInfoReader and RoundLedger, with agent reputation mirrored through ERC-8004.`
                  : 'Connect a wallet to pin the latest request. The agent roster and reputation board are still read directly from contracts.'}
              </p>
            </div>
            <div className="dashboard-note__stamp">{hasRequest ? requestStatus : 'Ready'}</div>
          </article>

          <section className="dashboard-stat-grid" aria-label="Protocol dashboard stats">
            {stats.map((stat) => {
              const Icon = stat.icon;

              return (
                <article key={stat.label} className={`dashboard-note dashboard-stat-note dashboard-note--${stat.accent}`}>
                  <span className="dashboard-note__pin" />
                  <div className="dashboard-stat-note__icon">
                    <Icon size={20} />
                  </div>
                  <div>
                    <div className="dashboard-stat-note__value">{stat.value}</div>
                    <div className="dashboard-stat-note__label">{stat.label}</div>
                    <div className="dashboard-stat-note__detail">{stat.detail}</div>
                  </div>
                </article>
              );
            })}
          </section>

          <article className="dashboard-note dashboard-ranking-note">
            <span className="dashboard-note__pin dashboard-note__pin--blue" />
            <div className="dashboard-note__title-row">
              <Medal size={21} />
              <h3>Agent Reputation</h3>
            </div>
            <div className="dashboard-ranking-list">
              {rankingRows.length === 0 ? (
                <div className="dashboard-ranking-row">
                  <span className="dashboard-ranking-row__rank">--</span>
                  <span className="dashboard-ranking-row__name">No registered agents yet</span>
                  <span className="dashboard-ranking-row__ribbon">Chain</span>
                  <span className="dashboard-ranking-row__metric dashboard-ranking-row__metric--score">--</span>
                  <span className="dashboard-ranking-row__metric dashboard-ranking-row__metric--reputation">--</span>
                  <span className="dashboard-ranking-row__earnings">--</span>
                </div>
              ) : rankingRows.map((node, index) => (
                <div key={node.key} className="dashboard-ranking-row" title={`${node.address} - ERC-8004 agent ${node.agentId}`}>
                  <span className="dashboard-ranking-row__rank">#{index + 1}</span>
                  <span className="dashboard-ranking-row__name">{node.name}</span>
                  <span className="dashboard-ranking-row__ribbon">{node.ribbon}</span>
                  <span className="dashboard-ranking-row__metric dashboard-ranking-row__metric--score">{formatScore(node.score)}</span>
                  <span className="dashboard-ranking-row__metric dashboard-ranking-row__metric--reputation">{node.reputation > 0 ? `${node.reputation.toFixed(0)}` : '--'}</span>
                  <span className="dashboard-ranking-row__earnings">{node.stake}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="dashboard-note dashboard-prize-note">
            <span className="dashboard-note__pin dashboard-note__pin--green" />
            <div className="dashboard-note__title-row">
              <Coins size={21} />
              <h3>Protocol State</h3>
            </div>
            <div className="dashboard-prize-note__list">
              {prizeNotes.map((note) => (
                <div key={note.label} className="dashboard-prize-note__item">
                  <span>{note.label}</span>
                  <strong>{note.value}</strong>
                </div>
              ))}
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
