import { describe, it, expect, beforeEach } from 'vitest';
import { StateCoordinator } from './StateCoordinator';
import { ItemCategory } from './types';
import type { GameState, StateChange } from './types';

// Test helper to create minimal valid game state
const createTestGameState = (): GameState => ({
  player: {
    id: 'player-1',
    name: 'Test Player',
    inventory: {
      items: [
        { itemId: 'apple', quantity: 5 },
        { itemId: 'water', quantity: 3 },
      ],
      maxCapacity: 100,
    },
    currencies: {
      coins: 100,
      gems: 10,
    },
    level: 1,
    experience: 0,
    achievements: [],
    discovered: {
      pets: ['starter-pet'],
      locations: ['home'],
      items: ['apple', 'water'],
    },
    pets: {
      active: ['pet-1'],
      stored: [],
      graveyard: [],
    },
  },
  pets: {
    'pet-1': {
      id: 'pet-1',
      species: 'starter',
      name: 'Test Pet',
      stats: {
        hunger: 50,
        happiness: 75,
        energy: 80,
        hygiene: 60,
        health: 90,
      },
    },
  },
  world: {
    locations: {
      home: {
        id: 'home',
        name: 'Home',
        description: 'Starting location',
      },
    },
    currentLocation: 'home',
  },
  items: {
    apple: {
      id: 'apple',
      name: 'Apple',
      category: ItemCategory.FOOD,
    },
    water: {
      id: 'water',
      name: 'Water',
      category: ItemCategory.DRINK,
    },
  },
});

describe('StateCoordinator', () => {
  let stateCoordinator: StateCoordinator;
  let initialState: GameState;

  beforeEach(() => {
    stateCoordinator = new StateCoordinator();
    initialState = createTestGameState();
  });

  describe('applyChanges', () => {
    it('should apply simple state changes', () => {
      const changes: StateChange[] = [
        { path: 'player.currencies.coins', newValue: 150 },
        { path: 'pets.pet-1.stats.hunger', newValue: 75 },
      ];

      const newState = stateCoordinator.applyChanges(initialState, changes);

      expect(newState.player.currencies.coins).toBe(150);
      expect(newState.pets['pet-1']!.stats.hunger).toBe(75);

      // Original state should be unchanged (immutability)
      expect(initialState.player.currencies.coins).toBe(100);
      expect(initialState.pets['pet-1']!.stats.hunger).toBe(50);
    });

    it('should handle nested path creation', () => {
      const changes: StateChange[] = [{ path: 'player.settings.soundVolume', newValue: 0.8 }];

      const newState = stateCoordinator.applyChanges(initialState, changes);

      expect(newState.player.settings?.soundVolume).toBe(0.8);
    });

    it('should return same state for empty changes', () => {
      const newState = stateCoordinator.applyChanges(initialState, []);
      expect(newState).toBe(initialState);
    });

    it('should handle array modifications', () => {
      const changes: StateChange[] = [
        { path: 'player.achievements', newValue: ['first-pet', 'first-feeding'] },
      ];

      const newState = stateCoordinator.applyChanges(initialState, changes);

      expect(newState.player.achievements).toEqual(['first-pet', 'first-feeding']);
      expect(initialState.player.achievements).toEqual([]);
    });
  });

  describe('validateState', () => {
    it('should validate correct state', () => {
      expect(stateCoordinator.validateState(initialState)).toBe(true);
    });

    it('should reject state missing required properties', () => {
      const invalidState = { ...initialState };
      delete (invalidState as any).player;

      expect(stateCoordinator.validateState(invalidState as GameState)).toBe(false);
    });

    it('should reject state with invalid player structure', () => {
      const invalidState = {
        ...initialState,
        player: {
          ...initialState.player,
          inventory: null as any,
        },
      };

      expect(stateCoordinator.validateState(invalidState)).toBe(false);
    });

    it('should reject state with negative currencies', () => {
      const invalidState = {
        ...initialState,
        player: {
          ...initialState.player,
          currencies: {
            coins: -10,
            gems: 5,
          },
        },
      };

      expect(stateCoordinator.validateState(invalidState)).toBe(false);
    });

    it('should reject state with orphaned active pets', () => {
      const invalidState = {
        ...initialState,
        player: {
          ...initialState.player,
          pets: {
            active: ['pet-1', 'missing-pet'],
            stored: [],
            graveyard: [],
          },
        },
      };

      expect(stateCoordinator.validateState(invalidState)).toBe(false);
    });
  });

  describe('snapshot management', () => {
    it('should create snapshots', () => {
      const snapshot = stateCoordinator.createSnapshot(initialState);

      expect(snapshot.state).toEqual(initialState);
      expect(snapshot.createdAt).toBeTypeOf('number');
      expect(snapshot.description).toBeTruthy();
    });

    it('should restore from snapshots', () => {
      const snapshot = stateCoordinator.createSnapshot(initialState);

      // Modify state
      const changes: StateChange[] = [{ path: 'player.currencies.coins', newValue: 200 }];
      const modifiedState = stateCoordinator.applyChanges(initialState, changes);

      // Restore from snapshot
      const restoredState = stateCoordinator.restoreSnapshot(snapshot);

      expect(restoredState).toEqual(initialState);
      expect(restoredState.player.currencies.coins).toBe(100);
    });

    it('should reject invalid snapshots', () => {
      const invalidSnapshot = {
        state: { invalid: 'state' } as any,
        createdAt: Date.now(),
        description: 'Invalid snapshot',
      };

      expect(() => {
        stateCoordinator.restoreSnapshot(invalidSnapshot);
      }).toThrow('Cannot restore invalid state snapshot');
    });
  });

  describe('utility methods', () => {
    it('should get values at paths', () => {
      const coins = stateCoordinator.getValueAtPath(initialState, 'player.currencies.coins');
      const petName = stateCoordinator.getValueAtPath(initialState, 'pets.pet-1.name');

      expect(coins).toBe(100);
      expect(petName).toBe('Test Pet');
    });

    it('should handle invalid paths gracefully', () => {
      const result = stateCoordinator.getValueAtPath(initialState, 'nonexistent.path.here');
      expect(result).toBeUndefined();
    });

    it('should detect differences between states', () => {
      const changes: StateChange[] = [
        { path: 'player.currencies.coins', newValue: 200 },
        { path: 'pets.pet-1.stats.hunger', newValue: 80 },
      ];

      const newState = stateCoordinator.applyChanges(initialState, changes);
      const differences = stateCoordinator.getDifferences(initialState, newState);

      expect(differences).toContain('player.currencies.coins');
      expect(differences).toContain('pets.pet-1.stats.hunger');
      expect(differences.length).toBeGreaterThan(0);
    });
  });

  describe('immutability', () => {
    it('should maintain structural sharing', () => {
      const changes: StateChange[] = [{ path: 'player.currencies.coins', newValue: 200 }];

      const newState = stateCoordinator.applyChanges(initialState, changes);

      // Unchanged nested objects should be the same reference
      expect(newState.pets).toBe(initialState.pets);
      expect(newState.world).toBe(initialState.world);
      expect(newState.items).toBe(initialState.items);

      // Changed objects should be new references
      expect(newState.player).not.toBe(initialState.player);
    });
  });
});
