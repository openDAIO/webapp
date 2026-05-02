import { NodeEvaluationInput, buildNodeResultRows } from '../utils/finalResults';
import { REVIEWER_CHARACTER_CONFIGS } from './reviewerCharacterConfig';

const reviewerNameById = Object.fromEntries(
  REVIEWER_CHARACTER_CONFIGS.map((character) => [character.id, character.label ?? character.id]),
);

const reviewerName = (id: string) => reviewerNameById[id] ?? id;

const evidenceSets = [
  ['Methodology checklist', 'Baseline comparison table', 'Ablation study notes'],
  ['Appendix experiment table', 'Reviewer note from Peer Piper', 'Dataset split audit'],
  ['Citation coverage map', 'Reproducibility checklist', 'Error analysis section'],
  ['Market analogy memo', 'Risk scoring rubric', 'Prior review consensus'],
];

const roundTitles = {
  1: 'Round 1 — Independent Review',
  2: 'Round 2 — Cross-lab Discussion',
  3: 'Round 3 — Hallway Discussion',
};

function buildHistory(
  nodeName: string,
  scores: [number, number, number, number],
  peers: [string, string],
  evidenceOffset: number,
) {
  return [
    {
      round: 1,
      title: roundTitles[1],
      phase: 'independent_review' as const,
      scoreAfter: scores[0],
      reasoning: `${nodeName} produced an initial estimate after checking the paper structure, claims, and evidence strength.`,
      discussionSummary: 'No peer discussion yet. This score came from local review only.',
      evidenceUsed: evidenceSets[evidenceOffset % evidenceSets.length],
    },
    {
      round: 2,
      title: roundTitles[2],
      phase: 'cross_lab_discussion' as const,
      scoreBefore: scores[0],
      scoreAfter: scores[1],
      scoreChange: scores[1] - scores[0],
      reasoning: `${nodeName} revised the score after comparing notes on methodology and baseline quality.`,
      discussedWith: [peers[0]],
      discussionSummary: `${peers[0]} challenged the initial read and pointed to additional appendix evidence.`,
      evidenceUsed: evidenceSets[(evidenceOffset + 1) % evidenceSets.length],
    },
    {
      round: 3,
      title: roundTitles[3],
      phase: 'hallway_discussion' as const,
      scoreBefore: scores[1],
      scoreAfter: scores[2],
      scoreChange: scores[2] - scores[1],
      reasoning: `${nodeName} made a final pre-submission adjustment after resolving remaining score gaps.`,
      discussedWith: [peers[1]],
      discussionSummary: `${peers[1]} helped separate presentation issues from actual evidence quality.`,
      evidenceUsed: evidenceSets[(evidenceOffset + 2) % evidenceSets.length],
    },
    {
      round: 'final' as const,
      title: 'Final — Final Scoring',
      phase: 'final_scoring' as const,
      scoreBefore: scores[2],
      scoreAfter: scores[3],
      scoreChange: scores[3] - scores[2],
      reasoning: `${nodeName} submitted ${scores[3]} as the final score after discussion and evidence reconciliation.`,
      discussionSummary: 'Final score submitted to the consensus board.',
      evidenceUsed: evidenceSets[(evidenceOffset + 3) % evidenceSets.length],
    },
  ];
}

const nodeScores: Array<[string, string, number, number, [number, number, number, number]]> = [
  ['ai-01', reviewerName('ai-01'), 88, 100, [82, 84, 85, 85]],
  ['ai-02', reviewerName('ai-02'), 83, 100, [80, 82, 84, 84]],
  ['ai-03', reviewerName('ai-03'), 79, 100, [86, 85, 83, 83]],
  ['ai-04', reviewerName('ai-04'), 91, 100, [84, 86, 87, 87]],
  ['ai-05', reviewerName('ai-05'), 84, 100, [81, 83, 82, 82]],
  ['ai-06', reviewerName('ai-06'), 86, 100, [84, 85, 86, 86]],
  ['ai-07', reviewerName('ai-07'), 87, 100, [66, 69, 72, 72]],
  ['ai-08', reviewerName('ai-08'), 78, 100, [83, 81, 80, 80]],
  ['ai-09', reviewerName('ai-09'), 89, 100, [85, 86, 88, 88]],
  ['ai-10', reviewerName('ai-10'), 81, 100, [79, 81, 81, 81]],
  ['ai-11', reviewerName('ai-11'), 85, 100, [82, 83, 85, 85]],
  ['ai-12', reviewerName('ai-12'), 90, 100, [91, 93, 95, 95]],
  ['ai-13', reviewerName('ai-13'), 82, 100, [70, 69, 67, 67]],
  ['ai-14', reviewerName('ai-14'), 88, 100, [86, 87, 86, 86]],
  ['ai-15', reviewerName('ai-15'), 80, 100, [82, 84, 83, 83]],
  ['ai-16', reviewerName('ai-16'), 84, 100, [80, 82, 84, 84]],
];

const formatAiId = (index: number) => `ai-${String(index).padStart(2, '0')}`;

export const MOCK_FINAL_RESULT_INPUTS: NodeEvaluationInput[] = nodeScores.map(
  ([id, name, reputationBefore, stakeAmount, scores], index) => ({
    id,
    name,
    finalScore: scores[3],
    reputationBefore,
    stakeAmount,
    roundHistory: buildHistory(
      name,
      scores,
      [
        reviewerName(formatAiId(((index + 1) % nodeScores.length) + 1)),
        reviewerName(formatAiId(((index + 5) % nodeScores.length) + 1)),
      ],
      index,
    ),
  }),
);

export const MOCK_FINAL_RESULTS = buildNodeResultRows(MOCK_FINAL_RESULT_INPUTS, '2026-04-25T12:30:00.000Z');
