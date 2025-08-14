// Presentation layer exports
// UI layer handles all rendering and user feedback

// Screen components (to be implemented)
// export * from './screens';

// Reusable components (to be implemented)
// export * from './components';

// React hooks for game state (to be implemented)
// export * from './hooks';

// Context providers (to be implemented)
// export * from './contexts';

// UI utilities and types
export interface UIState {
  currentScreen: string;
  isLoading: boolean;
  notifications: Array<{
    id: string;
    type: 'info' | 'warning' | 'error' | 'success';
    message: string;
  }>;
  modals: Array<{
    id: string;
    type: string;
    props?: Record<string, unknown>;
  }>;
}

export interface ScreenProps {
  gameState?: import('../core/types').GameState;
  onUserAction?: (action: string, payload?: unknown) => void;
}

// Common UI component props
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
}
