
import {
  REVIEW_ROOM_SCENES,
  getReviewerAssignment,
  type ActiveReviewRoomId,
  type RoomLayoutSlot,
} from './reviewRoomScenes';

export const TABLE_CONFIG = {
  x: 50, // center x percentage
  y: 60, // center y percentage (adjusted from 2/3 slightly up to have room below)
  width: 320, // px (w-80)
  height: 192, // px (h-48)
};

const LAB_IDLE_POSITION_OFFSETS: Record<RoomLayoutSlot, { x: number, y: number }> = {
  1: { x: -8, y: -10 },
  2: { x: 8, y: -10 },
  3: { x: -8, y: 10 },
  4: { x: 8, y: 0 },
  5: { x: 8, y: 10 },
  'left-top': { x: -8, y: -10 },
  'left-middle': { x: -8, y: 0 },
  'left-bottom': { x: -8, y: 10 },
  'right-top': { x: 8, y: -10 },
  'right-middle': { x: 8, y: 0 },
  'right-bottom': { x: 8, y: 10 },
};

export const CHARACTER_IDLE_POSITIONS: Record<string, { x: number, y: number }> = Object.fromEntries(
  Object.values(REVIEW_ROOM_SCENES).flatMap((scene) =>
    scene.reviewers.map((reviewer) => [
      reviewer.id,
      LAB_IDLE_POSITION_OFFSETS[reviewer.labSlot],
    ]),
  ),
);

export function getCharacterIdlePositionOffset(roomId: ActiveReviewRoomId, reviewerId: string) {
  const assignment = getReviewerAssignment(roomId, reviewerId);
  return assignment ? LAB_IDLE_POSITION_OFFSETS[assignment.labSlot] : { x: 0, y: 0 };
}
