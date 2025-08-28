import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { GameEngine } from '../engine/GameEngine';
import { UISystem, UI_ACTIONS } from '../systems/UISystem';
import type { GameState } from '../models';

// Mock localStorage for tests
class LocalStorageMock {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = value;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] || null;
  }

  get length(): number {
    return Object.keys(this.store).length;
  }
}

describe('Starter Selection Flow', () => {
  let gameEngine: GameEngine;
  let uiSystem: UISystem | undefined;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let gameState: GameState | undefined;
  let mockLocalStorage: LocalStorageMock;

  beforeEach(async () => {
    // Setup mock localStorage
    mockLocalStorage = new LocalStorageMock();
    global.localStorage = mockLocalStorage as any;

    // Create a new game engine
    gameEngine = new GameEngine({
      tickInterval: 60000,
      autoStart: false,
      debugMode: true,
    });

    // Initialize the engine
    await gameEngine.initialize();

    // Get the UISystem
    uiSystem = gameEngine.getSystem<UISystem>('UISystem');

    // Register a render callback to capture state changes
    if (uiSystem) {
      uiSystem.registerRenderCallback((state: GameState) => {
        gameState = state;
        console.log('[Test] State rendered:', {
          hasPet: !!state.pet,
          petName: state.pet?.name,
          petSpecies: state.pet?.species,
        });
      });
    }

    // Start the engine
    await gameEngine.start();
  });

  afterEach(async () => {
    // Clean up
    await gameEngine.stop();
    mockLocalStorage.clear();
  });

  it('should create a pet when starter is selected', async () => {
    // Initial state should have no pet
    const initialState = gameEngine.getGameState();
    expect(initialState.pet).toBeUndefined();

    // Simulate selecting a starter
    if (uiSystem) {
      uiSystem.handleUserAction({
        action: UI_ACTIONS.SELECT_STARTER,
        data: {
          species: 'starter_fire',
          name: 'Flame',
        },
      });
    }

    // Wait for the update to process
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Process a tick to ensure updates are handled
    await gameEngine.tick();

    // Wait a bit more for rendering
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check that a pet was created
    const updatedState = gameEngine.getGameState();
    expect(updatedState.pet).not.toBeUndefined();
    expect(updatedState.pet?.species).toBe('starter_fire');
    expect(updatedState.pet?.name).toBe('Flame');

    // Check that statistics were updated
    expect(updatedState.meta?.statistics?.totalPetsOwned).toBeGreaterThan(0);

    console.log('[Test] Pet created successfully:', {
      name: updatedState.pet?.name,
      species: updatedState.pet?.species,
      stage: updatedState.pet?.stage,
      energy: updatedState.pet?.energy,
      careValues: updatedState.pet?.careValues,
    });
  });

  it('should transition from starter selection to pet home page', async () => {
    // Start with no pet (starter selection screen)
    const initialState = gameEngine.getGameState();
    expect(initialState.pet).toBeUndefined();

    let uiStateChanges: string[] = [];

    // Track UI state changes
    if (uiSystem) {
      uiSystem.registerRenderCallback((state: GameState) => {
        if (!state.pet) {
          uiStateChanges.push('starter-selection');
        } else {
          uiStateChanges.push('pet-home');
        }
      });

      // Force initial render
      uiSystem.renderState(initialState, true);
    }

    // Simulate starter selection
    if (uiSystem) {
      uiSystem.handleUserAction({
        action: UI_ACTIONS.SELECT_STARTER,
        data: {
          species: 'starter_water',
          name: 'Aqua',
        },
      });
    }

    // Process updates
    await new Promise((resolve) => setTimeout(resolve, 100));
    await gameEngine.tick();
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check UI state transitions
    expect(uiStateChanges).toContain('starter-selection');
    expect(uiStateChanges[uiStateChanges.length - 1]).toBe('pet-home');

    // Verify pet exists in final state
    const finalState = gameEngine.getGameState();
    expect(finalState.pet).not.toBeUndefined();
    expect(finalState.pet?.species).toBe('starter_water');

    console.log('[Test] UI transition complete:', uiStateChanges);
  });
});
