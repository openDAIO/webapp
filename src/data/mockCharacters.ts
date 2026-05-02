import { AICharacter } from '../types';
import { REVIEW_ROOM_REVIEWER_CHARACTERS } from '../assets/assetPaths';
import { REVIEW_ROOM_SCENES, type ActiveReviewRoomId, type RoomLayoutSlot } from '../constants/reviewRoomScenes';
import { TABLE_CONFIG, getCharacterIdlePositionOffset } from '../constants/uiConfig';

const getInitialPos = (roomId: ActiveReviewRoomId, id: string) => {
  const offset = getCharacterIdlePositionOffset(roomId, id);
  return {
    x: TABLE_CONFIG.x + offset.x,
    y: TABLE_CONFIG.y + offset.y
  };
};

const LAB_CHARACTER_PROFILES = [
  {
    color: 'bg-emerald-500',
    emoji: '',
    speed: 0.8,
    quality: 0.9,
    trustScore: 85,
    stakeAmount: 120,
    roomPosition: { x: 10, y: 20 },
  },
  {
    color: 'bg-blue-500',
    emoji: '',
    speed: 1.2,
    quality: 0.75,
    trustScore: 80,
    stakeAmount: 105,
    roomPosition: { x: 90, y: 20 },
  },
  {
    color: 'bg-purple-500',
    emoji: '',
    speed: 0.5,
    quality: 0.4,
    trustScore: 70,
    stakeAmount: 92,
    roomPosition: { x: 10, y: 80 },
  },
  {
    color: 'bg-amber-500',
    emoji: '',
    speed: 1.0,
    quality: 0.85,
    trustScore: 90,
    stakeAmount: 130,
    roomPosition: { x: 90, y: 50 },
  },
  {
    color: 'bg-rose-500',
    emoji: '',
    speed: 0.9,
    quality: 0.8,
    trustScore: 88,
    stakeAmount: 116,
    roomPosition: { x: 90, y: 80 },
  },
];

const getRoomPositionForSlot = (slot: RoomLayoutSlot) => {
  if (slot === 'left-top') return { x: 10, y: 20 };
  if (slot === 'left-middle') return { x: 10, y: 50 };
  if (slot === 'left-bottom') return { x: 10, y: 80 };
  if (slot === 'right-top') return { x: 90, y: 20 };
  if (slot === 'right-middle') return { x: 90, y: 50 };
  if (slot === 'right-bottom') return { x: 90, y: 80 };

  return {
    x: slot % 2 === 1 ? 10 : 90,
    y: slot === 1 || slot === 2 ? 20 : slot === 4 ? 50 : 80,
  };
};

export function buildAICharactersForRoom(roomId: ActiveReviewRoomId): AICharacter[] {
  const scene = REVIEW_ROOM_SCENES[roomId];
  const charactersById = new Map(REVIEW_ROOM_REVIEWER_CHARACTERS[roomId].map((character) => [character.id, character]));

  return scene.reviewers.flatMap((assignment, index) => {
    const character = charactersById.get(assignment.id);
    if (!character) return [];

    const profile = LAB_CHARACTER_PROFILES[index % LAB_CHARACTER_PROFILES.length];
    const idlePosition = getInitialPos(roomId, character.id);

    return {
      id: character.id,
      name: character.label,
      avatar: character.assets.portrait,
      sprite: character.assets.idle,
      ...profile,
      roomPosition: {
        ...getRoomPositionForSlot(assignment.labSlot),
      },
      scoreHistory: [],
      selected: false,
      selectionStatus: 'standby',
      status: 'IDLE',
      position: idlePosition,
      idlePosition,
    };
  });
}

export const AI_CHARACTERS: AICharacter[] = buildAICharactersForRoom('paper');

export const MOCK_RESPONSES = {
  high: [
    "The methodology is sound but requires more empirical evidence on the edge cases.",
    "Excellent contribution to the field of AI scalability. I highly recommend acceptance.",
    "A well-structured paper with clear objectives and a thorough bibliography."
  ],
  medium: [
    "It's decent, but I've seen similar work before. Needs more novelty.",
    "The language is a bit flowery. Could be more concise.",
    "The results are interesting but the sample size is too small."
  ],
  low: [
    "I don't really get it. What's the point?",
    "Reviewing... uh... looks okay I guess? 4/10.",
    "Needs more blockchain somehow. Not sure why."
  ]
};
