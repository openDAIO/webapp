import { NodeChatMessage, NodeEvaluationResult, RoundEvaluationHistory } from '../types';

export interface PostNodeChatResponse {
  message: NodeChatMessage;
  questionsUsed: number;
  questionsLeft: number;
}

function createMessage(role: NodeChatMessage['role'], content: string): NodeChatMessage {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

function formatEvidence(history?: RoundEvaluationHistory) {
  const evidence = history?.evidenceUsed ?? [];
  if (evidence.length === 0) return 'No specific evidence references were attached to that round.';
  return `The strongest references were ${evidence.slice(0, 3).join(', ')}.`;
}

function findRound(node: NodeEvaluationResult, round: number | 'final') {
  return node.roundHistory.find((entry) => entry.round === round);
}

export async function postNodeChatMessage(
  evaluationId: string,
  node: NodeEvaluationResult,
  message: string,
  questionsUsed: number,
  maxQuestions: number,
): Promise<PostNodeChatResponse> {
  await new Promise((resolve) => window.setTimeout(resolve, 550));

  if (!evaluationId || !node.id) {
    throw new Error('Missing evaluation context.');
  }

  if (questionsUsed >= maxQuestions) {
    throw new Error('Question limit reached.');
  }

  const content = buildMockNodeResponse(node, message);
  const nextQuestionsUsed = questionsUsed + 1;

  return {
    message: createMessage('node', content),
    questionsUsed: nextQuestionsUsed,
    questionsLeft: Math.max(0, maxQuestions - nextQuestionsUsed),
  };
}

export function createUserChatMessage(content: string) {
  return createMessage('user', content);
}

export function createSystemChatMessage(content: string) {
  return createMessage('system', content);
}

function buildMockNodeResponse(node: NodeEvaluationResult, rawQuestion: string) {
  const question = rawQuestion.toLowerCase();
  const finalRound = findRound(node, 'final');
  const round2 = findRound(node, 2);
  const round3 = findRound(node, 3);
  const tokenFlow = node.rewardAmount - node.slashAmount;
  const outcome = node.isOutlier
    ? `I landed outside the accepted range and was slashed by ${node.slashAmount.toFixed(1)} TOK.`
    : `I stayed inside the accepted range and received ${node.rewardAmount.toFixed(1)} TOK from redistribution.`;

  if (question.includes('evidence') || question.includes('mattered most')) {
    return `${formatEvidence(finalRound ?? round3)} I weighted that evidence against my final score of ${node.finalScore}. ${outcome}`;
  }

  if (question.includes('round 2') || question.includes('after round 2')) {
    return round2
      ? `After Round 2, my score moved from ${round2.scoreBefore ?? 'the prior score'} to ${round2.scoreAfter}. ${round2.discussionSummary ?? 'The cross-lab discussion changed how I read the evidence.'} ${round2.reasoning}`
      : 'I do not have a recorded Round 2 discussion for this result.';
  }

  if (question.includes('changed your mind') || question.includes('score change')) {
    const latestChange = [...node.roundHistory].reverse().find((entry) => entry.scoreChange !== undefined && entry.scoreChange !== 0);
    return latestChange
      ? `${latestChange.title} changed my view: ${latestChange.reasoning} The score change was ${latestChange.scoreChange! > 0 ? '+' : ''}${latestChange.scoreChange}.`
      : 'My score stayed steady across the recorded rounds, so there was no major revision to explain.';
  }

  if (question.includes('outside') || question.includes('score range')) {
    return node.isOutlier
      ? `My final score was ${node.finalScore}, which fell outside the accepted range for this evaluation. I was more cautious than the group because ${finalRound?.reasoning ?? 'my final reasoning stayed stricter than the consensus.'}`
      : `I was within the accepted range with a final score of ${node.finalScore}. My reasoning stayed close enough to the group consensus to avoid slashing.`;
  }

  if (question.includes('slashing') || question.includes('fair')) {
    return node.isOutlier
      ? `The slashing rule was applied mechanically from the final distribution. I can see why it happened: my score was outside the range, even though my concern came from the evidence I emphasized.`
      : `I was not slashed. The redistribution rewarded nodes like me that stayed inside the accepted range, so my net token flow was ${tokenFlow >= 0 ? '+' : ''}${tokenFlow.toFixed(1)} TOK.`;
  }

  return `${node.finalReasoning} My final score was ${node.finalScore}, reputation moved from ${node.reputationBefore} to ${node.reputationAfter}, and ${outcome}`;
}
