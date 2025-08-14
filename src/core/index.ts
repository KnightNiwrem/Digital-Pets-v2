// Core orchestration layer exports
export * from './types';

// Orchestration components
export { EventBus, eventBus } from './EventBus';
export { StateCoordinator, stateCoordinator } from './StateCoordinator';
// export { CommandProcessor } from './CommandProcessor';

// Type guards and utilities
export const isGameEvent = (obj: unknown): obj is import('./types').GameEvent => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    'payload' in obj &&
    'timestamp' in obj &&
    'priority' in obj
  );
};

export const isStateChange = (obj: unknown): obj is import('./types').StateChange => {
  return typeof obj === 'object' && obj !== null && 'path' in obj && 'newValue' in obj;
};
