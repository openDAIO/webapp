import type { DaioReviewerProfile } from '../services/daio/useDaioData';

const SCORE_SCALE = 10_000;

export function daioProfileReputationPercent(profile: DaioReviewerProfile | undefined) {
  if (!profile || profile.reputation.samples === 0n) return 0;

  const reputation = profile.reputation;
  const sum =
    Number(reputation.reportQuality) +
    Number(reputation.auditReliability) +
    Number(reputation.finalContribution) +
    Number(reputation.protocolCompliance);

  return (sum / 4 / SCORE_SCALE) * 100;
}

export function daioProfileReportQualityPercent(profile: DaioReviewerProfile | undefined) {
  if (!profile || profile.reputation.samples === 0n) return 0;
  return Number(profile.reputation.reportQuality) / 100;
}
