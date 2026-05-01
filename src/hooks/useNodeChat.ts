import { useCallback, useMemo, useState } from 'react';
import { NodeChatState, NodeEvaluationResult } from '../types';
import {
  createSystemChatMessage,
  createUserChatMessage,
  postNodeChatMessage,
} from '../services/nodeChatService';

const DEFAULT_CHAT_STATE: NodeChatState = {
  maxQuestions: 3,
  questionsUsed: 0,
  messages: [],
};

function chatKey(evaluationId: string, nodeId: string) {
  return `${evaluationId}:${nodeId}`;
}

export function useNodeChat(evaluationId: string) {
  const [chatStates, setChatStates] = useState<Record<string, NodeChatState>>({});
  const [sendingByKey, setSendingByKey] = useState<Record<string, boolean>>({});
  const [errorByKey, setErrorByKey] = useState<Record<string, string | null>>({});

  const getChatState = useCallback(
    (node: NodeEvaluationResult | null): NodeChatState => {
      if (!node) return DEFAULT_CHAT_STATE;
      const key = chatKey(evaluationId, node.id);
      return chatStates[key] ?? node.chat ?? DEFAULT_CHAT_STATE;
    },
    [chatStates, evaluationId],
  );

  const sendMessage = useCallback(
    async (node: NodeEvaluationResult, content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;

      const key = chatKey(evaluationId, node.id);
      const current = chatStates[key] ?? node.chat ?? DEFAULT_CHAT_STATE;

      if (current.questionsUsed >= current.maxQuestions) {
        setErrorByKey((prev) => ({ ...prev, [key]: 'Question limit reached.' }));
        return;
      }

      const userMessage = createUserChatMessage(trimmed);
      setErrorByKey((prev) => ({ ...prev, [key]: null }));
      setSendingByKey((prev) => ({ ...prev, [key]: true }));
      setChatStates((prev) => ({
        ...prev,
        [key]: {
          ...current,
          messages: [...current.messages, userMessage],
        },
      }));

      try {
        const response = await postNodeChatMessage(
          evaluationId,
          node,
          trimmed,
          current.questionsUsed,
          current.maxQuestions,
        );

        setChatStates((prev) => {
          const latest = prev[key] ?? current;
          return {
            ...prev,
            [key]: {
              ...latest,
              questionsUsed: response.questionsUsed,
              messages: [...latest.messages, response.message],
            },
          };
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'The node could not answer right now.';
        setErrorByKey((prev) => ({ ...prev, [key]: message }));
        setChatStates((prev) => {
          const latest = prev[key] ?? current;
          return {
            ...prev,
            [key]: {
              ...latest,
              messages: [
                ...latest.messages,
                createSystemChatMessage('The node could not answer. Your question count was not changed.'),
              ],
            },
          };
        });
      } finally {
        setSendingByKey((prev) => ({ ...prev, [key]: false }));
      }
    },
    [chatStates, evaluationId],
  );

  const helpers = useMemo(
    () => ({
      getIsSending(node: NodeEvaluationResult | null) {
        if (!node) return false;
        return Boolean(sendingByKey[chatKey(evaluationId, node.id)]);
      },
      getError(node: NodeEvaluationResult | null) {
        if (!node) return null;
        return errorByKey[chatKey(evaluationId, node.id)] ?? null;
      },
    }),
    [errorByKey, evaluationId, sendingByKey],
  );

  return {
    getChatState,
    sendMessage,
    ...helpers,
  };
}
