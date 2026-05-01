import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import ActivityTrace, { type ActivityTraceItem, useElapsedActivity } from './ActivityTrace';

export interface ConversationTurn {
  speakerId: string;
  speakerName: string;
  message: string;
}

export interface ConversationDrawerData {
  id: string;
  round: number;
  participantIds: [string, string];
  participantNames: [string, string];
  locationLabel: string;
  summary: string;
  transcript: ConversationTurn[];
}

interface ConversationDrawerProps {
  conversation: ConversationDrawerData | null;
  onClose: () => void;
}

export default function ConversationDrawer({ conversation, onClose }: ConversationDrawerProps) {
  const [visibleStepCount, setVisibleStepCount] = useState(1);
  const elapsedSeconds = useElapsedActivity(conversation?.id ?? 'none');

  const steps = useMemo(() => {
    if (!conversation) return [];

    const [firstName, secondName] = conversation.participantNames;
    const [firstTurn, secondTurn, thirdTurn, fourthTurn] = conversation.transcript;

    return [
      {
        title: 'Opening peer calibration',
        body: `${firstName} and ${secondName} align on the Round ${conversation.round} scoring objective at ${conversation.locationLabel}: reduce private bias before the next score update.`,
        meta: `Round ${conversation.round} discussion`,
      },
      {
        title: 'Comparing evidence anchors',
        body: firstTurn
          ? `${firstTurn.speakerName} surfaces the main uncertainty: ${firstTurn.message}`
          : 'The nodes identify which claims have direct support and which claims rely on weaker interpretation.',
      },
      {
        title: 'Testing disagreement',
        body: secondTurn
          ? `${secondTurn.speakerName} challenges the scoring basis: ${secondTurn.message}`
          : 'The second reviewer checks whether novelty, reproducibility, and confidence should move independently.',
      },
      {
        title: 'Resolving score movement',
        body: thirdTurn
          ? `${thirdTurn.speakerName} narrows the revision target: ${thirdTurn.message}`
          : 'The pair decides which score component can move without overreacting to a single objection.',
      },
      {
        title: 'Writing consensus note',
        body: fourthTurn
          ? `${fourthTurn.speakerName} records the shared update rule: ${fourthTurn.message}`
          : conversation.summary,
      },
    ] satisfies ActivityTraceItem[];
  }, [conversation]);

  useEffect(() => {
    setVisibleStepCount(1);
  }, [conversation?.id]);

  useEffect(() => {
    if (!conversation || steps.length <= 1) return undefined;

    const timer = window.setInterval(() => {
      setVisibleStepCount((count) => Math.min(steps.length, count + 1));
    }, 850);

    return () => window.clearInterval(timer);
  }, [conversation, steps.length]);

  if (!conversation) return null;

  const visibleSteps = steps.slice(0, visibleStepCount);
  const activeStep = Math.min(visibleStepCount, steps.length) - 1;

  return (
    <motion.div
      key={conversation.id}
      initial={{ x: 18, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 18, opacity: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="review-room-activity-panel pixel-box warm-panel h-full min-h-0 w-full overflow-y-auto p-4 text-[#202528]"
      aria-label={`Round ${conversation.round} conversation`}
    >
      <ActivityTrace
        title="Peer review calibration"
        subtitle={`${conversation.participantNames.join(' and ')} are turning their dialogue into a traceable score adjustment, not a casual chat.`}
        elapsedSeconds={elapsedSeconds}
        items={visibleSteps}
        activeIndex={activeStep}
        closeLabel="Close conversation"
        onClose={onClose}
      />
    </motion.div>
  );
}
