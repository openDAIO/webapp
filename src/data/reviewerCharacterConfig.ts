export interface ReviewerCharacterConfig {
  id: string;
  fileName: string;
  label?: string;
  specialty?: string;
  labRoom?: 1 | 2 | 3 | 4 | 5;
  sharedAcrossLabs?: boolean;
  stateFiles?: {
    think?: string;
    penalty?: string;
    reward?: string;
    portrait?: string;
  };
}

export const REVIEWER_CHARACTER_CONFIGS: ReviewerCharacterConfig[] = [
  {
    id: 'ai-01',
    fileName: 'ai-01.png',
    label: 'Dr. Footnote',
    specialty: 'Paper review',
    labRoom: 1,
    stateFiles: {
      penalty: 'states/ai-01-penalty.gif',
      reward: 'states/ai-01-reward.gif',
    },
  },
  { id: 'ai-02', fileName: 'ai-02.png', label: 'Peer Piper', specialty: 'Paper review', labRoom: 2 },
  {
    id: 'ai-03',
    fileName: 'ai-03.png',
    label: 'Method Max',
    specialty: 'Paper review',
    labRoom: 3,
    stateFiles: {
      reward: 'states/ai-03-reward.gif',
    },
  },
  { id: 'ai-04', fileName: 'ai-04.png', label: 'Citation Cy', specialty: 'Paper review', labRoom: 4 },
  { id: 'ai-05', fileName: 'ai-05.png', label: 'Repro Ruby', specialty: 'Paper review', labRoom: 5 },
  { id: 'ai-06', fileName: 'ai-06.png', label: 'Clause Quinn', specialty: 'Legal counsel', sharedAcrossLabs: true },
  { id: 'ai-07', fileName: 'ai-07.png', label: 'Brief Bea', specialty: 'Legal counsel', sharedAcrossLabs: true },
  { id: 'ai-08', fileName: 'ai-08.png', label: 'Precedent Pax', specialty: 'Legal counsel', sharedAcrossLabs: true },
  { id: 'ai-09', fileName: 'ai-09.png', label: 'Redline Rex', specialty: 'Legal counsel', sharedAcrossLabs: true },
  { id: 'ai-10', fileName: 'ai-10.png', label: 'Due Della', specialty: 'Legal counsel' },
  { id: 'ai-11', fileName: 'ai-11.png', label: 'Alpha June', specialty: 'Investment' },
  { id: 'ai-12', fileName: 'ai-12.png', label: 'Moat Miles', specialty: 'Investment' },
  { id: 'ai-13', fileName: 'ai-13.png', label: 'Runway Rae', specialty: 'Investment' },
  { id: 'ai-14', fileName: 'ai-14.png', label: 'Cap Finn', specialty: 'Investment' },
  { id: 'ai-15', fileName: 'ai-15.png', label: 'Signal Sera', specialty: 'Investment' },
  { id: 'ai-16', fileName: 'ai-16.png', label: 'Quorum Nova', specialty: 'DAO governance' },
  { id: 'ai-17', fileName: 'ai-17.png', label: 'Delegate Dex', specialty: 'DAO governance' },
  { id: 'ai-18', fileName: 'ai-18.png', label: 'Multisig Mira', specialty: 'DAO governance' },
  { id: 'ai-19', fileName: 'ai-19.png', label: 'Treasury Tess', specialty: 'DAO governance' },
  { id: 'ai-20', fileName: 'ai-20.png', label: 'Proposal Poe', specialty: 'DAO governance' },
];

export const REVIEWER_CONFIG_BY_FILE = Object.fromEntries(
  REVIEWER_CHARACTER_CONFIGS.map((character) => [character.fileName, character]),
);
