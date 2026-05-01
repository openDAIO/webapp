import { REVIEWER_CHARACTER_CONFIGS } from '../data/reviewerCharacterConfig';
import {
  REVIEW_ROOM_SCENES,
  type ActiveReviewRoomId,
  type ColumnRoomLayoutSlot,
  type LabSlot,
  type RoomLayoutSlot,
  type ReviewRoomSceneRoom,
} from './reviewRoomScenes';
import { Coordinates } from '../types';

export type RelativePosition = 
  | 'center' | 'left' | 'right' | 'top' | 'bottom' | 'inside-left' | 'inside-right'
  | { x: number; y: number }
  | string; // Support "top-[10%] left-[-5%]" style strings

export interface RoomConfigEntry {
  label: string;
  roomAssetId: string;
  reviewerId?: string;
  position: string; // "top-[18%] right-[3%] translate-x-0"
  charRelativePos: RelativePosition;
}

const LAB_ROOM_LAYOUT: Record<LabSlot, Omit<RoomConfigEntry, 'label' | 'roomAssetId' | 'reviewerId'>> = {
  1: {
    position: "top-[265px] left-[22px] translate-x-0",
    charRelativePos: "top-[5%] right-[-36%]"
  },
  2: {
    position: "top-[265px] right-[22px] translate-x-0",
    charRelativePos: "top-[5%] left-[-36%]"
  },
  3: {
    position: "top-[621px] left-[22px] translate-x-0",
    charRelativePos: "top-[5%] right-[-36%]"
  },
  4: {
    position: "top-[443px] right-[22px] translate-x-0",
    charRelativePos: "top-[5%] left-[-36%]" 
  },
  5: {
    position: "top-[621px] right-[20px] translate-x-0",
    charRelativePos: "top-[5%] left-[-36%]"
  },
};

const JUDGMENT_LAB_ROOM_LAYOUT: Record<LabSlot, Omit<RoomConfigEntry, 'label' | 'roomAssetId' | 'reviewerId'>> = {
  1: {
    position: "top-[265px] left-[0px] translate-x-0",
    charRelativePos: "top-[5%] right-[-36%]"
  },
  2: {
    position: "top-[265px] right-[0px] translate-x-0",
    charRelativePos: "top-[5%] left-[-36%]"
  },
  3: {
    position: "top-[621px] left-[0px] translate-x-0",
    charRelativePos: "top-[5%] right-[-36%]"
  },
  4: {
    position: "top-[443px] right-[0px] translate-x-0",
    charRelativePos: "top-[5%] left-[-36%]"
  },
  5: {
    position: "top-[621px] right-[-2px] translate-x-0",
    charRelativePos: "top-[5%] left-[-36%]"
  },
};

const COLUMN_ROOM_LAYOUT: Record<ColumnRoomLayoutSlot, Omit<RoomConfigEntry, 'label' | 'roomAssetId' | 'reviewerId'>> = {
  'left-top': {
    position: "top-[265px] left-[22px] translate-x-0",
    charRelativePos: "top-[5%] right-[-36%]",
  },
  'left-middle': {
    position: "top-[443px] left-[22px] translate-x-0",
    charRelativePos: "top-[5%] right-[-36%]",
  },
  'left-bottom': {
    position: "top-[621px] left-[22px] translate-x-0",
    charRelativePos: "top-[5%] right-[-36%]",
  },
  'right-top': {
    position: "top-[265px] right-[22px] translate-x-0",
    charRelativePos: "top-[5%] left-[-36%]",
  },
  'right-middle': {
    position: "top-[443px] right-[22px] translate-x-0",
    charRelativePos: "top-[5%] left-[-36%]",
  },
  'right-bottom': {
    position: "top-[621px] right-[20px] translate-x-0",
    charRelativePos: "top-[5%] left-[-36%]",
  },
};

const JUDGMENT_COLUMN_ROOM_LAYOUT: Record<ColumnRoomLayoutSlot, Omit<RoomConfigEntry, 'label' | 'roomAssetId' | 'reviewerId'>> = {
  'left-top': {
    position: "top-[265px] left-[0px] translate-x-0",
    charRelativePos: "top-[5%] right-[-36%]",
  },
  'left-middle': {
    position: "top-[443px] left-[0px] translate-x-0",
    charRelativePos: "top-[5%] right-[-36%]",
  },
  'left-bottom': {
    position: "top-[621px] left-[0px] translate-x-0",
    charRelativePos: "top-[5%] right-[-36%]",
  },
  'right-top': {
    position: "top-[265px] right-[0px] translate-x-0",
    charRelativePos: "top-[5%] left-[-36%]",
  },
  'right-middle': {
    position: "top-[443px] right-[0px] translate-x-0",
    charRelativePos: "top-[5%] left-[-36%]",
  },
  'right-bottom': {
    position: "top-[621px] right-[-2px] translate-x-0",
    charRelativePos: "top-[5%] left-[-36%]",
  },
};

const reviewerLabelById = Object.fromEntries(
  REVIEWER_CHARACTER_CONFIGS.map((character) => [character.id, character.label ?? character.id]),
);

const getLayout = (slot: RoomLayoutSlot, reviewRoomId: ActiveReviewRoomId) => {
  if (typeof slot === 'string') {
    return reviewRoomId === 'judgment' ? JUDGMENT_COLUMN_ROOM_LAYOUT[slot] : COLUMN_ROOM_LAYOUT[slot];
  }

  if (reviewRoomId === 'judgment') {
    return JUDGMENT_LAB_ROOM_LAYOUT[slot];
  }

  return LAB_ROOM_LAYOUT[slot];
};

const sceneRoomEntry = (room: ReviewRoomSceneRoom, reviewRoomId: ActiveReviewRoomId): [string, RoomConfigEntry] => {
  const reviewerLabel = room.reviewerId ? reviewerLabelById[room.reviewerId] : undefined;

  return [
    room.id,
    {
      label: room.label ?? (reviewerLabel ? `${reviewerLabel} Lab` : ''),
      roomAssetId: room.roomAssetId,
      reviewerId: room.reviewerId,
      ...getLayout(room.layoutSlot, reviewRoomId),
    },
  ];
};

export const ROOM_CONFIG_BY_REVIEW_ROOM: Record<ActiveReviewRoomId, Record<string, RoomConfigEntry>> = {
  paper: Object.fromEntries(REVIEW_ROOM_SCENES.paper.rooms.map((room) => sceneRoomEntry(room, 'paper'))),
  judgment: Object.fromEntries(REVIEW_ROOM_SCENES.judgment.rooms.map((room) => sceneRoomEntry(room, 'judgment'))),
};

export const ROOM_CONFIG = ROOM_CONFIG_BY_REVIEW_ROOM.paper;

export function getRoomConfig(roomId: ActiveReviewRoomId): Record<string, RoomConfigEntry> {
  return ROOM_CONFIG_BY_REVIEW_ROOM[roomId];
}

const ROOM_SIZE = 240; // 60 * 4 (Tailwind w-60)

/**
 * Calculates absolute coordinates (percentage + pixel offset) for a rooms anchor point.
 */
export function getCharacterTarget(roomId: string, reviewRoomId: ActiveReviewRoomId = 'paper'): Coordinates {
  const config = ROOM_CONFIG_BY_REVIEW_ROOM[reviewRoomId][roomId];
  if (!config) return { x: 50, y: 50, offsetX: 0, offsetY: 0 };

  const { position, charRelativePos } = config;

  // 1. BASE CONTAINER PIXEL/PERCENTAGE POSITION
  // Support both "top-[20%]" and "top-[100px]"
  const topMatch = position.match(/top-\[?(-?\d+)(%|px)?/);
  const leftMatch = position.match(/left-\[?(-?\d+)(%|px)?/);
  const rightMatch = position.match(/right-\[?(-?\d+)(%|px)?/);

  let yPct = 50;
  let xPct = 50;
  let yOffset = 0;
  let xOffset = 0;

  if (topMatch) {
    const val = parseInt(topMatch[1]);
    const unit = topMatch[2] || '%';
    if (unit === 'px') {
      yPct = 0;
      yOffset = val;
    } else {
      yPct = val;
    }
  }

  if (leftMatch) {
    const val = parseInt(leftMatch[1]);
    const unit = leftMatch[2] || '%';
    if (unit === 'px') {
      xPct = 0;
      xOffset = val;
    } else {
      xPct = val;
    }
  } else if (rightMatch) {
    const val = parseInt(rightMatch[1]);
    const unit = rightMatch[2] || '%';
    if (unit === 'px') {
      xPct = 100;
      xOffset = -val;
    } else {
      xPct = 100 - val;
    }
  }

  // 2. ROOM TRANSLATION OFFSET (relative to room size)
  // The component has base -translate-x-1/2 -translate-y-1/2
  // We handle this by setting base roomOff to 0 and calculating from center
  let roomOffX = 0;
  let roomOffY = 0;

  // 3. CHARACTER RELATIVE OFFSET
  let charOffX = 0;
  let charOffY = 0;

  if (typeof charRelativePos === 'object') {
    charOffX = (charRelativePos.x / 100) * ROOM_SIZE;
    charOffY = (charRelativePos.y / 100) * ROOM_SIZE;
  } else {
    const offTopMatch = charRelativePos.match(/top-\[?(-?\d+)/);
    const offLeftMatch = charRelativePos.match(/left-\[?(-?\d+)/);
    const offRightMatch = charRelativePos.match(/right-\[?(-?\d+)/);
    const offBottomMatch = charRelativePos.match(/bottom-\[?(-?\d+)/);

    if (offTopMatch || offLeftMatch || offRightMatch || offBottomMatch) {
      if (offTopMatch) charOffY = (parseInt(offTopMatch[1]) / 100) * ROOM_SIZE;
      if (offBottomMatch) charOffY = -(parseInt(offBottomMatch[1]) / 100) * ROOM_SIZE;
      if (offLeftMatch) charOffX = (parseInt(offLeftMatch[1]) / 100) * ROOM_SIZE;
      if (offRightMatch) charOffX = -(parseInt(offRightMatch[1]) / 100) * ROOM_SIZE;
    } else {
      const presetOffsets: Record<string, { xPct: number, yPct: number }> = {
        'center': { xPct: 0, yPct: 0 },
        'left': { xPct: -15, yPct: 0 },
        'right': { xPct: 15, yPct: 0 },
        'top': { xPct: 0, yPct: -15 },
        'bottom': { xPct: 0, yPct: 15 },
        'inside-left': { xPct: 10, yPct: 0 },
        'inside-right': { xPct: -10, yPct: 0 },
      };
      const preset = presetOffsets[charRelativePos] || { xPct: 0, yPct: 0 };
      charOffX = (preset.xPct / 100) * ROOM_SIZE;
      charOffY = (preset.yPct / 100) * ROOM_SIZE;
    }
  }

  return {
    x: xPct,
    y: yPct,
    offsetX: xOffset + charOffX,
    offsetY: yOffset + charOffY
  };
}

export type RoomId = keyof typeof ROOM_CONFIG;
