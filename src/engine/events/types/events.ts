/**
 * Event priority levels for the event queue system
 * Lower numbers = higher priority
 */
export enum EventPriority {
  IMMEDIATE = 0,  // User actions - process immediately
  HIGH = 1,       // Battle actions - process soon
  NORMAL = 2,     // Tick events - regular priority
  LOW = 3,        // Background tasks - can defer
}

/**
 * Base interface for all game events
 */
export interface BaseGameEvent {
  id: string;
  type: string;
  priority: EventPriority;
  timestamp: number;
  source: string;
  data: any;
}

/**
 * User input events (clicks, keyboard, touch)
 */
export interface UserInputEvent extends BaseGameEvent {
  type: 'user_input';
  data: {
    inputType: 'click' | 'key' | 'touch';
    target?: string;
    coordinates?: { x: number; y: number };
    key?: string;
    [key: string]: any;
  };
}

/**
 * Game tick events (15-second intervals by default)
 */
export interface TickEvent extends BaseGameEvent {
  type: 'tick';
  data: {
    tickNumber: number;
    deltaTime: number;
    gameTime: number;
  };
}

/**
 * System events (browser, PWA lifecycle)
 */
export interface SystemEvent extends BaseGameEvent {
  type: 'system';
  data: {
    systemType: 'visibility_change' | 'online' | 'offline' | 'before_unload' | 'focus' | 'blur';
    visible?: boolean;
    online?: boolean;
    [key: string]: any;
  };
}

/**
 * Activity events (timed activities, completion)
 */
export interface ActivityEvent extends BaseGameEvent {
  type: 'activity';
  data: {
    activityType: 'start' | 'update' | 'complete' | 'cancel';
    activityId: string;
    progress?: number;
    result?: any;
    [key: string]: any;
  };
}

/**
 * Union type for all possible game events
 */
export type GameEvent = UserInputEvent | TickEvent | SystemEvent | ActivityEvent;

/**
 * Event handler function type
 */
export type EventHandler<T extends BaseGameEvent = BaseGameEvent> = (_event: T) => void;

/**
 * Event subscription interface
 */
export interface EventSubscription {
  id: string;
  eventType: string;
  handler: EventHandler;
  unsubscribe: () => void;
}