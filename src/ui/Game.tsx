import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameEngine } from '../engine/GameEngine';
import type { GameState } from '../models';
import { UISystem } from '../systems/UISystem';
import { LoadingScreen } from './LoadingScreen';
import { StarterSelectionScreen } from './StarterSelectionScreen';
import { PetHomePage } from './PetHomePage';
import type { Species } from '../models/Species';
import { UI_ACTIONS } from '../systems/UISystem';

type GameUIState = 'loading' | 'starter-selection' | 'pet-home' | 'error';

interface GameError {
  message: string;
  details?: unknown;
}

export const Game: React.FC = () => {
  const [uiState, setUiState] = useState<GameUIState>('loading');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState<GameError | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('Initializing game...');

  const gameEngineRef = useRef<GameEngine | null>(null);
  const uiSystemRef = useRef<UISystem | null>(null);

  // Initialize the game engine
  useEffect(() => {
    const initializeGame = async () => {
      try {
        setLoadingMessage('Creating game engine...');

        // Create game engine with debug mode for development
        const engine = new GameEngine({
          tickInterval: 60000, // 60 seconds
          autoStart: false,
          debugMode: process.env.NODE_ENV === 'development',
        });
        gameEngineRef.current = engine;

        setLoadingMessage('Initializing systems...');

        // Initialize the engine and all systems
        await engine.initialize();

        // Get the UISystem from the engine
        const uiSystem = engine.getSystem<UISystem>('UISystem');
        if (!uiSystem) {
          throw new Error('UISystem not found');
        }
        uiSystemRef.current = uiSystem;

        // Register render callback to update React state
        uiSystem.registerRenderCallback((state: GameState) => {
          console.log('[Game] Rendering state:', state);
          setGameState(state);

          // Determine which UI to show based on game state
          if (!state.pet) {
            setUiState('starter-selection');
          } else {
            setUiState('pet-home');
          }
        });

        // Register notification callback
        uiSystem.registerNotificationCallback((notification) => {
          console.log('[Game] Notification:', notification);
          // Handle notifications (could show toasts, etc.)
        });

        setLoadingMessage('Loading save data...');

        // Start the game engine
        await engine.start();

        // Manually trigger an initial render with the current game state
        // This ensures we show the correct UI even if the initial render was missed
        const currentState = engine.getGameState();
        if (currentState) {
          uiSystem.renderState(currentState, true);
        }
      } catch (err) {
        console.error('[Game] Initialization error:', err);
        setError({
          message: 'Failed to initialize game',
          details: err,
        });
        setUiState('error');
      }
    };

    initializeGame();

    // Cleanup on unmount
    return () => {
      if (gameEngineRef.current) {
        gameEngineRef.current.stop().catch(console.error);
      }
    };
  }, []);

  // Handle starter selection
  const handleStarterSelect = useCallback((species: Species) => {
    if (!uiSystemRef.current) {
      console.error('[Game] UISystem not available');
      return;
    }

    // Send starter selection action through UISystem
    uiSystemRef.current.handleUserAction({
      action: UI_ACTIONS.SELECT_STARTER,
      data: {
        species: species.id,
        name: species.name,
      },
    });
  }, []);

  // Handle user actions from PetHomePage
  const handleUserAction = useCallback((action: string, data?: any) => {
    if (!uiSystemRef.current) {
      console.error('[Game] UISystem not available');
      return;
    }

    // Map string action to UI_ACTIONS constant
    const uiAction = UI_ACTIONS[action as keyof typeof UI_ACTIONS];
    if (!uiAction) {
      console.error('[Game] Unknown action:', action);
      return;
    }

    uiSystemRef.current.handleUserAction({
      action: uiAction,
      data,
    });
  }, []);

  // Render based on current UI state
  switch (uiState) {
    case 'loading':
      return <LoadingScreen message={loadingMessage} />;

    case 'starter-selection':
      return <StarterSelectionScreen onSelectStarter={handleStarterSelect} gameState={gameState} />;

    case 'pet-home':
      return gameState ? (
        <PetHomePage gameState={gameState} onUserAction={handleUserAction} />
      ) : (
        <LoadingScreen message="Loading pet data..." />
      );

    case 'error':
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100">
          <div className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full mx-4">
            <div className="text-center">
              <div className="text-6xl mb-4">❌</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Oops! Something went wrong</h1>
              <p className="text-gray-600 mb-6">{error?.message}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      );

    default:
      return null;
  }
};
