// Support systems layer exports  
// Support systems provide infrastructure services

// Time System (to be implemented)
// export * from './TimeSystem';

// Save System (to be implemented)
// export * from './SaveSystem';

// Notification System (to be implemented)
// export * from './NotificationSystem';

// Support system base types
export interface TickHandler {
  (tickCount: number, deltaTime: number): void;
}

export interface SaveSlot {
  id: number;
  name: string;
  lastSaved: number;
  gameVersion: string;
  metadata?: Record<string, unknown>;
}

export interface Notification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: number;
  persistent?: boolean;
  actions?: Array<{
    label: string;
    action: () => void;
  }>;
}