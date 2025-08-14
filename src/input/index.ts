// Input layer exports
// Input layer captures all external inputs and converts them to domain events

// User Input Handler (to be implemented)
// export * from './UserInputHandler';

// Timer System (to be implemented)
// export * from './TimerSystem';

// System Event Handler (to be implemented)
// export * from './SystemEventHandler';

// Input layer base types
export interface UserInput {
  type: 'click' | 'keypress' | 'touch' | 'drag';
  target?: string;
  coordinates?: { x: number; y: number };
  key?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface SystemEvent {
  type: 'visibility' | 'online' | 'offline' | 'beforeunload' | 'focus' | 'blur';
  timestamp: number;
  data?: unknown;
}

export const isUserInput = (obj: unknown): obj is UserInput => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    'timestamp' in obj
  );
};

export const isSystemEvent = (obj: unknown): obj is SystemEvent => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    'timestamp' in obj
  );
};