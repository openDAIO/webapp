
/**
 * Central map of all pixel-art assets.
 * Assets in /public/assets/ are directly accessible via /assets/ URLs.
 */

import { reviewerImageFiles, reviewerStateFiles } from 'virtual:reviewer-character-assets';
import { REVIEWER_CONFIG_BY_FILE } from '../data/reviewerCharacterConfig';
import { REVIEW_ROOM_SCENES, type ActiveReviewRoomId } from '../constants/reviewRoomScenes';

export interface ReviewerAssetSet {
  idle: string;
  think: string;
  penalty: string;
  reward: string;
  portrait: string;
}

export interface ReviewerCharacterAsset {
  id: string;
  fileName: string;
  label: string;
  specialty?: string;
  labRoom?: 1 | 2 | 3 | 4 | 5;
  sharedAcrossLabs?: boolean;
  assets: ReviewerAssetSet;
}

const reviewerImagePath = (fileName: string) => `/assets/characters/reviewers/${fileName}`;
const reviewerStatePath = (fileName: string) => `/assets/characters/reviewers/${fileName}`;
const stemFromFileName = (fileName: string) => fileName.replace(/\.[^.]+$/, '');
const reviewerStateByLowerName = new Map(reviewerStateFiles.map((fileName) => [fileName.toLowerCase(), fileName]));

function findReviewerStateFile(fileName: string, state: 'think' | 'penalty' | 'reward' | 'portrait') {
  const config = REVIEWER_CONFIG_BY_FILE[fileName];
  const configuredFile = config?.stateFiles?.[state];
  if (configuredFile) {
    const configuredStem = configuredFile.replace(/^states\//, '');
    const exactConfiguredFile = reviewerStateByLowerName.get(configuredStem.toLowerCase()) ?? configuredStem;
    return `states/${exactConfiguredFile}`;
  }

  const conventionalFile = `${stemFromFileName(fileName)}-${state}.gif`;
  const exactConventionalFile = reviewerStateByLowerName.get(conventionalFile.toLowerCase());
  return exactConventionalFile ? `states/${exactConventionalFile}` : undefined;
}

function buildReviewerAssets(fileName: string): ReviewerAssetSet {
  const idle = reviewerImagePath(fileName);
  const think = findReviewerStateFile(fileName, 'think');
  const penalty = findReviewerStateFile(fileName, 'penalty');
  const reward = findReviewerStateFile(fileName, 'reward');
  const portrait = findReviewerStateFile(fileName, 'portrait');

  return {
    idle,
    think: think ? reviewerStatePath(think) : idle,
    penalty: penalty ? reviewerStatePath(penalty) : idle,
    reward: reward ? reviewerStatePath(reward) : idle,
    portrait: portrait ? reviewerStatePath(portrait) : idle,
  };
}

export const REVIEWER_CHARACTERS: ReviewerCharacterAsset[] = reviewerImageFiles.map((fileName) => {
  const config = REVIEWER_CONFIG_BY_FILE[fileName];
  const fallbackId = stemFromFileName(fileName);

  return {
    id: config?.id ?? fallbackId,
    fileName,
    label: config?.label ?? config?.id ?? fallbackId,
    specialty: config?.specialty,
    labRoom: config?.labRoom,
    sharedAcrossLabs: config?.sharedAcrossLabs,
    assets: buildReviewerAssets(fileName),
  };
});

export const LAB_REVIEWER_CHARACTERS = REVIEWER_CHARACTERS
  .filter((character) => character.labRoom)
  .sort((a, b) => (a.labRoom ?? 0) - (b.labRoom ?? 0));

const reviewerCharactersById = new Map(REVIEWER_CHARACTERS.map((character) => [character.id, character]));

export const REVIEW_ROOM_REVIEWER_CHARACTERS: Record<ActiveReviewRoomId, ReviewerCharacterAsset[]> = {
  paper: REVIEW_ROOM_SCENES.paper.reviewers
    .map((assignment) => reviewerCharactersById.get(assignment.id))
    .filter((character): character is ReviewerCharacterAsset => Boolean(character)),
  judgment: REVIEW_ROOM_SCENES.judgment.reviewers
    .map((assignment) => reviewerCharactersById.get(assignment.id))
    .filter((character): character is ReviewerCharacterAsset => Boolean(character)),
};

const reviewerAssets: Record<string, ReviewerAssetSet> = Object.fromEntries(
  REVIEWER_CHARACTERS.map((character) => [character.id, character.assets]),
);

const roomAssetIds = [
  'room-00',
  'room-01',
  'room-02',
  'room-03',
  'room-04',
  'room-05',
  'room-06',
  'room-07',
  'room-08',
  'room-09',
  'room-10',
  'room-11',
  'room-12',
];

const roomAssets: Record<string, string> = Object.fromEntries(
  roomAssetIds.map((roomId) => [roomId, `/assets/rooms/${roomId}.svg`]),
);

export const ASSET_PATHS = {
  backgrounds: {
    commons: {
      villageSquare: '/assets/backgrounds/commons/commons-village-square-background.jpg'
    },
    reviewRooms: {
      paper: '/assets/backgrounds/review-rooms/paper-review.png',
      judgment: '/assets/backgrounds/review-rooms/judgment-review.png'
    },
    hall: {
      full: '/assets/backgrounds/conference-hall/hall-full.png'
    }
  },
  billboard: {
    main: '/assets/billboard/main-board.png',
    chart: '/assets/billboard/stddev-graph-board.png'
  },
  characters: {
    user: {
      withPaper: '/assets/characters/user-with-paper/user-with-paper.png'
    },
    reviewers: reviewerAssets
  },
  rooms: {
    ...roomAssets,
  },
  ui: {
    panels: {
      submission: '/assets/ui/panels/submission-frame.png',
      log: '/assets/ui/panels/log-frame.png',
      trust: '/assets/ui/panels/trust-frame.png',
      dialogue: '/assets/ui/panels/dialogue-frame.png'
    },
    buttons: {
      submit: '/assets/ui/buttons/submit-button.png',
      accept: '/assets/ui/buttons/accept-button.png'
    },
    submission: {
      slot: '/assets/ui/submission/종이를 제출하는 창구.svg',
      submitting: '/assets/ui/submission/submitting.gif'
    }
  },
  icons: {
    upload: '/assets/icons/icon-upload.png',
    link: '/assets/icons/icon-link.png',
    thinking: '/assets/icons/status-thinking.png',
    reviewing: '/assets/icons/status-reviewing.png',
    finished: '/assets/icons/status-finished.png',
    trustDown: '/assets/icons/trust-down.png',
    trustUp: '/assets/icons/trust-up.png'
  },
  effects: {
    explosion: '/assets/effects/explosion.gif',
    penalty: '/assets/effects/explosion.gif',
    reward: '/assets/effects/sparkle.gif',
    sparkle: '/assets/effects/sparkle.gif',
    talkingBubble: '/assets/effects/talking-bubble.gif',
    thoughtCloud: '/assets/effects/thought-cloud.gif'
  }
};
