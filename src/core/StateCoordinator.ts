import { produce, type Draft } from 'immer';
import type { GameState, StateChange, StateSnapshot, StateCoordinator as IStateCoordinator } from './types';

/**
 * StateCoordinator - Manages immutable state updates with validation
 * Uses Immer for efficient structural sharing of immutable updates
 */
export class StateCoordinator implements IStateCoordinator {
  /**
   * Apply a list of state changes to the current state
   * Returns new state object with changes applied immutably
   */
  applyChanges(state: GameState, changes: StateChange[]): GameState {
    if (changes.length === 0) return state;

    return produce(state, (draft: Draft<GameState>) => {
      for (const change of changes) {
        this.applyChangeToPath(draft as any, change.path, change.newValue);
      }
    });
  }

  /**
   * Validate state integrity and consistency
   */
  validateState(state: GameState): boolean {
    try {
      // Basic structure validation
      if (!state.player || !state.pets || !state.world || !state.items) {
        console.warn('State validation failed: Missing required top-level properties');
        return false;
      }

      // Player validation
      if (!state.player.id || !state.player.inventory) {
        console.warn('State validation failed: Invalid player structure');
        return false;
      }

      // Inventory validation
      if (!Array.isArray(state.player.inventory.items)) {
        console.warn('State validation failed: Invalid inventory structure');
        return false;
      }

      // Pet ownership consistency
      const activePetIds = state.player.pets.active || [];
      for (const petId of activePetIds) {
        if (!state.pets[petId]) {
          console.warn(`State validation failed: Active pet ${petId} not found in pets collection`);
          return false;
        }
      }

      // Currency validation
      if (state.player.currencies.coins < 0 || state.player.currencies.gems < 0) {
        console.warn('State validation failed: Negative currency values');
        return false;
      }

      return true;
    } catch (error) {
      console.error('State validation error:', error);
      return false;
    }
  }

  /**
   * Create a snapshot of the current state
   */
  createSnapshot(state: GameState): StateSnapshot {
    return {
      state: structuredClone(state), // Deep clone for snapshot
      createdAt: Date.now(),
      description: `Snapshot at ${new Date().toISOString()}`,
    };
  }

  /**
   * Restore state from a snapshot
   */
  restoreSnapshot(snapshot: StateSnapshot): GameState {
    if (!this.validateState(snapshot.state)) {
      throw new Error('Cannot restore invalid state snapshot');
    }
    
    return structuredClone(snapshot.state);
  }

  /**
   * Apply a single change to a draft object using dot-notation path
   */
  private applyChangeToPath(draft: any, path: string, newValue: unknown): void {
    const pathSegments = path.split('.').filter(Boolean);
    let current: any = draft;

    // Navigate to parent object
    for (let i = 0; i < pathSegments.length - 1; i++) {
      const segment = pathSegments[i];
      
      if (!segment) continue;
      
      if (current[segment] === undefined) {
        // Create intermediate objects if they don't exist
        current[segment] = {};
      }
      
      current = current[segment];
    }

    // Set the final value
    const finalKey = pathSegments[pathSegments.length - 1];
    if (finalKey && current) {
      current[finalKey] = newValue;
    }
  }

  /**
   * Get a value from state using dot-notation path
   */
  getValueAtPath(state: GameState, path: string): unknown {
    const pathSegments = path.split('.');
    let current: any = state;

    for (const segment of pathSegments) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[segment];
    }

    return current;
  }

  /**
   * Compare two states and return list of differences
   */
  getDifferences(oldState: GameState, newState: GameState): string[] {
    const differences: string[] = [];
    
    // This is a simplified diff - in a full implementation,
    // you might want to use a proper deep diff library
    this.compareObjects(oldState, newState, '', differences);
    
    return differences;
  }

  private compareObjects(obj1: any, obj2: any, path: string, differences: string[]): void {
    const keys = new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})]);
    
    for (const key of keys) {
      const currentPath = path ? `${path}.${key}` : key;
      const val1 = obj1?.[key];
      const val2 = obj2?.[key];
      
      if (val1 !== val2) {
        if (typeof val1 === 'object' && typeof val2 === 'object' && val1 !== null && val2 !== null) {
          this.compareObjects(val1, val2, currentPath, differences);
        } else {
          differences.push(currentPath);
        }
      }
    }
  }
}

// Export singleton instance
export const stateCoordinator = new StateCoordinator();