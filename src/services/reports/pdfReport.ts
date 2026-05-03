import jsPDF from 'jspdf';
import type {
  FinalEvaluationSummary,
  NodeChatMessage,
  NodeEvaluationResult,
} from '../../types';
import type { ConfirmedReviewBounty } from '../../components/ReviewBountyGateOverlay';
import { displayRoundNumber } from '../../constants/reviewFlowTiming';

export interface EvaluationPdfInput {
  roomTitle: string;
  roomDescription: string;
  evaluationId: string;
  finalResult: { summary: FinalEvaluationSummary; nodes: NodeEvaluationResult[] };
  reviewBounty: ConfirmedReviewBounty | null;
  qaByNodeId: Record<string, NodeChatMessage[]>;
}

const MARGIN_X = 48;
const MARGIN_TOP = 56;
const PAGE_BOTTOM = 800;
const LINE = 14;

function fmt(value: number, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : '--';
}

function reputationDelta(delta: number) {
  const scaled = delta / 100;
  const sign = scaled > 0 ? '+' : '';
  return `${sign}${scaled.toFixed(2)}`;
}

function statusLabel(node: NodeEvaluationResult) {
  if (node.isOutlier) return 'OUTLIER';
  if (node.rewardAmount > 0) return 'REWARDED';
  return 'WITHIN RANGE';
}

class PdfBuilder {
  doc = new jsPDF({ unit: 'pt', format: 'a4' });
  y = MARGIN_TOP;
  pageWidth = this.doc.internal.pageSize.getWidth();
  contentWidth = this.pageWidth - MARGIN_X * 2;

  ensure(spaceNeeded: number) {
    if (this.y + spaceNeeded > PAGE_BOTTOM) {
      this.doc.addPage();
      this.y = MARGIN_TOP;
    }
  }

  spacer(amount = LINE) {
    this.ensure(amount);
    this.y += amount;
  }

  divider() {
    this.ensure(8);
    this.doc.setDrawColor(170);
    this.doc.setLineWidth(0.5);
    this.doc.line(MARGIN_X, this.y, MARGIN_X + this.contentWidth, this.y);
    this.y += 8;
  }

  text(text: string, opts: { font?: 'helvetica' | 'courier'; style?: 'normal' | 'bold' | 'italic'; size?: number; color?: [number, number, number]; indent?: number; rightAlignAt?: number } = {}) {
    const { font = 'helvetica', style = 'normal', size = 10, color = [40, 40, 40], indent = 0 } = opts;
    this.doc.setFont(font, style);
    this.doc.setFontSize(size);
    this.doc.setTextColor(color[0], color[1], color[2]);
    const wrapped = this.doc.splitTextToSize(text, this.contentWidth - indent) as string[];
    for (const line of wrapped) {
      this.ensure(size + 2);
      if (opts.rightAlignAt !== undefined) {
        this.doc.text(line, MARGIN_X + opts.rightAlignAt, this.y, { align: 'right' });
      } else {
        this.doc.text(line, MARGIN_X + indent, this.y);
      }
      this.y += size + 2;
    }
  }

  heading(level: 1 | 2 | 3, text: string) {
    const size = level === 1 ? 22 : level === 2 ? 14 : 11;
    this.spacer(level === 1 ? 0 : 8);
    this.text(text, { style: 'bold', size, color: [20, 20, 20] });
    if (level === 1) this.divider();
  }

  keyValueRow(rows: Array<[string, string]>, columns = 2) {
    const colWidth = this.contentWidth / columns;
    const rowsPerColumn = Math.ceil(rows.length / columns);
    const startY = this.y;
    let maxY = startY;
    rows.forEach((entry, i) => {
      const colIndex = Math.floor(i / rowsPerColumn);
      const rowIndex = i % rowsPerColumn;
      const x = MARGIN_X + colIndex * colWidth;
      const y = startY + rowIndex * (LINE * 2);
      if (y + LINE * 2 > PAGE_BOTTOM) return;
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(8);
      this.doc.setTextColor(110, 95, 75);
      this.doc.text(entry[0].toUpperCase(), x, y);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(11);
      this.doc.setTextColor(40, 40, 40);
      this.doc.text(entry[1], x, y + 12);
      maxY = Math.max(maxY, y + LINE * 2);
    });
    this.y = maxY + 4;
  }

  table(headers: string[], rows: string[][], colWidths: number[]) {
    const headerY = this.y;
    this.ensure(LINE * 2);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(8);
    this.doc.setTextColor(110, 95, 75);
    let x = MARGIN_X;
    headers.forEach((header, i) => {
      this.doc.text(header.toUpperCase(), x, headerY);
      x += colWidths[i];
    });
    this.y = headerY + 6;
    this.divider();

    rows.forEach((row) => {
      const lineHeights = row.map((cell, i) => {
        const wrapped = this.doc.splitTextToSize(cell, colWidths[i] - 6) as string[];
        return wrapped.length * 11;
      });
      const rowHeight = Math.max(LINE, ...lineHeights) + 4;
      this.ensure(rowHeight);

      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(9);
      this.doc.setTextColor(40, 40, 40);
      let cx = MARGIN_X;
      row.forEach((cell, i) => {
        const wrapped = this.doc.splitTextToSize(cell, colWidths[i] - 6) as string[];
        wrapped.forEach((line, lineIdx) => {
          this.doc.text(line, cx, this.y + 9 + lineIdx * 11);
        });
        cx += colWidths[i];
      });
      this.y += rowHeight;
    });
  }

  qaBlock(role: 'user' | 'node' | 'system', content: string) {
    const isUser = role === 'user';
    const isSystem = role === 'system';
    const label = isUser ? 'YOU' : isSystem ? 'SYSTEM' : 'NODE';
    const labelColor: [number, number, number] = isUser ? [47, 93, 126] : isSystem ? [156, 106, 46] : [47, 111, 53];
    this.text(label, { style: 'bold', size: 8, color: labelColor });
    this.text(content, { size: 10, color: [40, 40, 40], indent: 0 });
    this.spacer(4);
  }
}

export function generateEvaluationPdf(input: EvaluationPdfInput): jsPDF {
  const { roomTitle, roomDescription, evaluationId, finalResult, reviewBounty, qaByNodeId } = input;
  const { summary, nodes } = finalResult;
  const stakeAsset = summary.rewardSource === 'chain' ? summary.bountyAsset : 'TOK';

  const pdf = new PdfBuilder();

  pdf.heading(1, 'openDAIO Evaluation Report');
  pdf.text(`Generated ${new Date().toLocaleString()}`, { size: 9, color: [110, 95, 75] });
  pdf.text(`Evaluation ID  ${evaluationId}`, { size: 9, color: [110, 95, 75] });
  pdf.text(`Review Room    ${roomTitle}`, { size: 9, color: [110, 95, 75] });
  if (roomDescription) {
    pdf.text(roomDescription, { size: 9, style: 'italic', color: [110, 95, 75] });
  }
  pdf.spacer(8);

  pdf.heading(2, 'Final Result');
  pdf.keyValueRow([
    ['Final Score', fmt(summary.finalAverage, 1)],
    ['Standard Deviation', fmt(summary.standardDeviation, 2)],
    ['Accepted Range', `${fmt(summary.outlierThresholdLow, 1)} – ${fmt(summary.outlierThresholdHigh, 1)}`],
    ['Bounty Winners', `${summary.eligibleNodeCount} / ${nodes.length}`],
    ['Reward Source', summary.rewardSource === 'chain' ? 'Contract accounting' : 'Frontend simulation'],
    ['Reward Pool', `${fmt(summary.rewardPoolAmount ?? summary.reviewBountyAmount, 2)} ${summary.bountyAsset}`],
    ['Protocol Fee', `${fmt(summary.protocolFeeAmount ?? 0, 2)} ${summary.bountyAsset}`],
    ['Rewards Paid', `${fmt(summary.totalRewardPaidAmount ?? nodes.reduce((s, n) => s + n.rewardAmount, 0), 2)} ${summary.bountyAsset}`],
    ['Slashed Stake Pool', `${fmt(summary.totalSlashedPool, 2)} ${stakeAsset}`],
    ['Treasury Accrual', `${fmt(summary.treasuryAccrualAmount ?? 0, 2)} ${summary.bountyAsset}`],
  ], 2);

  if (reviewBounty) {
    pdf.heading(2, 'Bounty Payment');
    pdf.keyValueRow([
      ['Amount', `${fmt(reviewBounty.amount, 2)} ${reviewBounty.asset}`],
      ['Network', reviewBounty.network],
      ['Tx Hash', reviewBounty.txHash || '—'],
    ], 2);
  }

  pdf.heading(2, 'Node Results');
  pdf.table(
    ['Node', 'Score', 'Status', 'Reputation', 'Reward', 'Slash'],
    nodes.map((node) => {
      const displayedReward = summary.rewardSource === 'chain' ? node.rewardAmount : node.bountyRewardAmount;
      return [
        node.name,
        String(node.finalScore),
        statusLabel(node),
        reputationDelta(node.reputationAfter - node.reputationBefore),
        `${fmt(displayedReward, 2)} ${summary.bountyAsset}`,
        node.slashAmount > 0 ? `${fmt(node.slashAmount, 2)} ${stakeAsset}` : '—',
      ];
    }),
    [140, 50, 88, 78, 100, 80],
  );

  pdf.heading(2, 'Per-Node Breakdown');
  nodes.forEach((node, idx) => {
    if (idx > 0) pdf.spacer(8);
    pdf.heading(3, node.name);
    if (node.finalReasoning) {
      pdf.text(node.finalReasoning, { size: 10, color: [60, 60, 60], style: 'italic' });
      pdf.spacer(4);
    }

    if (node.roundHistory.length > 0) {
      node.roundHistory.forEach((round) => {
        const internalRound =
          typeof round.round === 'number' ? round.round : null;
        const roundLabel =
          internalRound !== null
            ? `Round ${displayRoundNumber(internalRound, false)}`
            : 'Final';
        pdf.text(`${roundLabel} — ${round.title.replace(/^Round \d+ — /, '')}`, {
          style: 'bold',
          size: 10,
          color: [47, 93, 126],
        });
        const scoreLine = round.scoreBefore !== undefined
          ? `Score ${round.scoreBefore} → ${round.scoreAfter}`
          : `Score ${round.scoreAfter}`;
        pdf.text(scoreLine, { size: 9, color: [80, 80, 80] });
        if (round.reasoning) pdf.text(round.reasoning, { size: 9, color: [60, 60, 60] });
        if (round.discussionSummary) {
          pdf.text(`Discussion: ${round.discussionSummary}`, { size: 9, color: [80, 80, 80], style: 'italic' });
        }
        if (round.evidenceUsed?.length) {
          pdf.text(`Evidence: ${round.evidenceUsed.join(', ')}`, { size: 9, color: [80, 80, 80] });
        }
        pdf.spacer(4);
      });
    }

    const transcript = qaByNodeId[node.id] ?? [];
    if (transcript.length > 0) {
      pdf.spacer(4);
      pdf.text('Interview Transcript', { style: 'bold', size: 10, color: [156, 106, 46] });
      pdf.spacer(2);
      transcript.forEach((message) => {
        pdf.qaBlock(message.role, message.content);
      });
    }
  });

  return pdf.doc;
}

export function downloadEvaluationPdf(input: EvaluationPdfInput, filename: string) {
  const pdf = generateEvaluationPdf(input);
  pdf.save(filename);
}
