import type { NodeSelectionStatus } from '../types';

interface SelectableNode {
  id: string;
}

export const DEFAULT_SELECTED_NODE_COUNT = 3;

export function selectRandomReviewNodeIds<T extends SelectableNode>(
  nodes: T[],
  count = DEFAULT_SELECTED_NODE_COUNT,
  random = Math.random,
) {
  const shuffled = [...nodes];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled.slice(0, Math.min(count, shuffled.length)).map((node) => node.id);
}

export function applyNodeSelection<T extends SelectableNode>(
  nodes: T[],
  selectedIds: Iterable<string>,
): Array<T & { selected: boolean; selectionStatus: NodeSelectionStatus }> {
  const selectedIdSet = new Set(selectedIds);

  return nodes.map((node) => {
    const selected = selectedIdSet.has(node.id);

    return {
      ...node,
      selected,
      selectionStatus: selected ? 'selected' : 'standby',
    };
  });
}

export function selectReviewNodes<T extends SelectableNode>(
  nodes: T[],
  count = DEFAULT_SELECTED_NODE_COUNT,
  random = Math.random,
) {
  const selectedIds = selectRandomReviewNodeIds(nodes, count, random);

  return applyNodeSelection(nodes, selectedIds);
}

export function getSelectedReviewNodes<T extends SelectableNode & { selected?: boolean }>(nodes: T[]) {
  return nodes.filter((node) => node.selected);
}

export function getReviewParticipants<T extends SelectableNode & { selected?: boolean }>(nodes: T[]) {
  const selectedNodes = getSelectedReviewNodes(nodes);

  if (selectedNodes.length >= DEFAULT_SELECTED_NODE_COUNT) {
    return selectedNodes.slice(0, DEFAULT_SELECTED_NODE_COUNT);
  }

  return nodes.slice(0, DEFAULT_SELECTED_NODE_COUNT);
}
