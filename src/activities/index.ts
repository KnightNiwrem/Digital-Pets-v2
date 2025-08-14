// Activity systems layer exports
// Activity systems orchestrate interactions between domains

// Care System (to be implemented)
// export * from './CareSystem';

// Battle System (to be implemented)
// export * from './BattleSystem';

// Trade System (to be implemented)
// export * from './TradeSystem';

// Craft System (to be implemented)
// export * from './CraftSystem';

// Explore System (to be implemented)
// export * from './ExploreSystem';

// Activity system base types and utilities
export interface ActivitySession {
  id: string;
  type: string;
  startedAt: number;
  participantIds: string[];
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  metadata?: Record<string, unknown>;
}

export const isActivitySession = (obj: unknown): obj is ActivitySession => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'type' in obj &&
    'startedAt' in obj &&
    'participantIds' in obj &&
    'status' in obj
  );
};
