export type ActiveReviewRoomId = 'paper' | 'judgment';
export type LabSlot = 1 | 2 | 3 | 4 | 5;
export type ColumnRoomLayoutSlot =
  | 'left-top'
  | 'left-middle'
  | 'left-bottom'
  | 'right-top'
  | 'right-middle'
  | 'right-bottom';
export type RoomLayoutSlot = LabSlot | ColumnRoomLayoutSlot;

export interface ReviewRoomReviewerAssignment {
  id: string;
  labSlot: RoomLayoutSlot;
  roomAssetId: string;
}

export interface ReviewRoomSceneRoom {
  id: string;
  reviewerId?: string;
  label?: string;
  roomAssetId: string;
  layoutSlot: RoomLayoutSlot;
}

export interface ConferenceHallTiles {
  floor: string;
  wall: string;
  divider: string;
  dividerColumns?: number;
  floorColor: string;
  depthTint: string;
  edgeTint: string;
}

export interface ReviewRoomScene {
  reviewers: ReviewRoomReviewerAssignment[];
  rooms: ReviewRoomSceneRoom[];
  tiles: ConferenceHallTiles;
}

export const REVIEW_ROOM_SCENES: Record<ActiveReviewRoomId, ReviewRoomScene> = {
  paper: {
    reviewers: [
      { id: 'ai-01', labSlot: 1, roomAssetId: 'room-01' },
      { id: 'ai-02', labSlot: 2, roomAssetId: 'room-02' },
      { id: 'ai-03', labSlot: 3, roomAssetId: 'room-03' },
      { id: 'ai-04', labSlot: 4, roomAssetId: 'room-04' },
      { id: 'ai-05', labSlot: 5, roomAssetId: 'room-05' },
    ],
    rooms: [
      { id: 'ai-01', reviewerId: 'ai-01', roomAssetId: 'room-01', layoutSlot: 1 },
      { id: 'room-00', label: '', roomAssetId: 'room-00', layoutSlot: 'left-middle' },
      { id: 'ai-02', reviewerId: 'ai-02', roomAssetId: 'room-02', layoutSlot: 2 },
      { id: 'ai-03', reviewerId: 'ai-03', roomAssetId: 'room-03', layoutSlot: 3 },
      { id: 'ai-04', reviewerId: 'ai-04', roomAssetId: 'room-04', layoutSlot: 4 },
      { id: 'ai-05', reviewerId: 'ai-05', roomAssetId: 'room-05', layoutSlot: 5 },
    ],
    tiles: {
      floor: '/assets/block-03.svg',
      wall: '/assets/block-01.svg',
      divider: '/assets/block-02.svg',
      floorColor: '#ead9b1',
      depthTint: '#8fbf7a',
      edgeTint: '#7b5835',
    },
  },
  judgment: {
    reviewers: [
      { id: 'ai-06', labSlot: 'left-top', roomAssetId: 'room-07' },
      { id: 'ai-07', labSlot: 'left-middle', roomAssetId: 'room-08' },
      { id: 'ai-08', labSlot: 'left-bottom', roomAssetId: 'room-09' },
      { id: 'ai-09', labSlot: 'right-top', roomAssetId: 'room-10' },
      { id: 'ai-10', labSlot: 'right-middle', roomAssetId: 'room-11' },
    ],
    rooms: [
      { id: 'ai-06', reviewerId: 'ai-06', roomAssetId: 'room-07', layoutSlot: 'left-top' },
      { id: 'ai-07', reviewerId: 'ai-07', roomAssetId: 'room-08', layoutSlot: 'left-middle' },
      { id: 'ai-08', reviewerId: 'ai-08', roomAssetId: 'room-09', layoutSlot: 'left-bottom' },
      { id: 'ai-09', reviewerId: 'ai-09', roomAssetId: 'room-10', layoutSlot: 'right-top' },
      { id: 'ai-10', reviewerId: 'ai-10', roomAssetId: 'room-11', layoutSlot: 'right-middle' },
      { id: 'room-12', label: '', roomAssetId: 'room-12', layoutSlot: 'right-bottom' },
    ],
    tiles: {
      floor: '/assets/block-06.svg',
      wall: '/assets/block-04.svg',
      divider: '/assets/block-05.svg',
      dividerColumns: 9,
      floorColor: '#d4c5ad',
      depthTint: '#80624f',
      edgeTint: '#10031f',
    },
  },
};

export function getReviewRoomScene(roomId: ActiveReviewRoomId) {
  return REVIEW_ROOM_SCENES[roomId];
}

export function getReviewerAssignment(roomId: ActiveReviewRoomId, reviewerId: string) {
  return REVIEW_ROOM_SCENES[roomId].reviewers.find((reviewer) => reviewer.id === reviewerId);
}
