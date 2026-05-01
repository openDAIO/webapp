import { LogEntry } from '../types';

export const INITIAL_LOGS: LogEntry[] = [
  {
    id: 'init-1',
    timestamp: Date.now() - 10000,
    message: 'System decentralized matrix booted.'
  },
  {
    id: 'init-2',
    timestamp: Date.now() - 5000,
    message: 'All AI nodes connected and ready.'
  }
];
