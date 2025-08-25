/**
 * SaveSystem test suite
 */

import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { SaveSystem } from './SaveSystem';
import type { SaveState } from '../models';
import { createMockGameState, createMockPet } from '../testing';

// Mock localStorage
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

describe('SaveSystem', () => {
  let saveSystem: SaveSystem;
  let mockLocalStorage: LocalStorageMock;

  beforeEach(() => {
    // Setup mock localStorage
    mockLocalStorage = new LocalStorageMock();
    global.localStorage = mockLocalStorage as any;

    // Create new SaveSystem instance for each test
    saveSystem = new SaveSystem({
      maxSaveSlots: 3,
      compressionEnabled: false,
      autoSaveEnabled: true,
      savePrefix: 'test',
      checksumAlgorithm: 'simple',
    });
  });

  afterEach(() => {
    // Clean up
    mockLocalStorage.clear();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await saveSystem.initialize({
        });

      expect(saveSystem.isInitialized()).toBe(true);
      expect(saveSystem.isActive()).toBe(true);
    });

    it('should throw error if localStorage is not available', async () => {
      // Mock localStorage to be unavailable
      global.localStorage = undefined as any;

      try {
        await saveSystem.initialize({
          });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect((error as Error).message).toBe('localStorage is not available');
      }

      // Restore localStorage
      global.localStorage = mockLocalStorage as any;
    });
  });

  describe('Save Operations', () => {
    beforeEach(async () => {
      await saveSystem.initialize({
        });
    });

    it('should save game state successfully', async () => {
      const gameState = createMockGameState({
        playerId: 'test-player-123',
        maxSlots: 50,
        unlockedSlots: 50,
        includeTestItems: true,
        pet: createMockPet({
          id: 'pet-1',
          name: 'Fluffy',
          species: 'cat',
          rarity: 'COMMON',
          stage: 'ADULT',
          health: 100,
          energy: 80,
          satiety: 75,
          hydration: 60,
          happiness: 80,
        }),
      });

      await saveSystem.save(gameState);

      const savedData = mockLocalStorage.getItem('test_current');
      expect(savedData).not.toBeNull();

      const saveState = JSON.parse(savedData!) as SaveState;
      expect(saveState.version).toBe('1.0.0');
      expect(saveState.data.playerId).toBe('test-player-123');
      expect(saveState.data.pet?.name).toBe('Fluffy');
    });

    it('should update save count and timestamp', async () => {
      const gameState = createMockGameState({
        playerId: 'test-player-123',
        maxSlots: 50,
        unlockedSlots: 50,
        includeTestItems: true,
        pet: createMockPet({
          id: 'pet-1',
          name: 'Fluffy',
          species: 'cat',
          rarity: 'COMMON',
          stage: 'ADULT',
          health: 100,
          energy: 80,
          satiety: 75,
          hydration: 60,
          happiness: 80,
        }),
      });
      const originalSaveCount = gameState.saveData.saveCount;

      await saveSystem.save(gameState);

      expect(gameState.saveData.saveCount).toBe(originalSaveCount + 1);
      expect(gameState.saveData.lastSaveTime).toBeGreaterThan(0);
    });

    it('should queue saves when already saving', async () => {
      const gameState1 = createMockGameState({
        playerId: 'test-player-123',
        maxSlots: 50,
        unlockedSlots: 50,
        includeTestItems: true,
        pet: createMockPet({
          id: 'pet-1',
          name: 'Fluffy',
          species: 'cat',
          rarity: 'COMMON',
          stage: 'ADULT',
          health: 100,
          energy: 80,
          satiety: 75,
          hydration: 60,
          happiness: 80,
        }),
      });
      const gameState2 = createMockGameState({
        playerId: 'test-player-123',
        maxSlots: 50,
        unlockedSlots: 50,
        includeTestItems: true,
        pet: createMockPet({
          id: 'pet-1',
          name: 'Fluffy',
          species: 'cat',
          rarity: 'COMMON',
          stage: 'ADULT',
          health: 100,
          energy: 80,
          satiety: 75,
          hydration: 60,
          happiness: 80,
        }),
      });
      gameState2.pet!.name = 'Spot';

      // Start first save
      const save1Promise = saveSystem.save(gameState1);

      // Try to save again immediately (should be queued)
      const save2Promise = saveSystem.save(gameState2);

      await Promise.all([save1Promise, save2Promise]);

      // Last save should be the one that's stored
      const savedData = mockLocalStorage.getItem('test_current');
      const saveState = JSON.parse(savedData!) as SaveState;

      // The queue processes saves in order, so gameState2 should be saved last
      expect(saveState.data.pet?.name).toBe('Spot');
    });
  });

  describe('Load Operations', () => {
    beforeEach(async () => {
      await saveSystem.initialize({
        });
    });

    it('should load saved game state', async () => {
      const gameState = createMockGameState({
        playerId: 'test-player-123',
        maxSlots: 50,
        unlockedSlots: 50,
        includeTestItems: true,
        pet: createMockPet({
          id: 'pet-1',
          name: 'Fluffy',
          species: 'cat',
          rarity: 'COMMON',
          stage: 'ADULT',
          health: 100,
          energy: 80,
          satiety: 75,
          hydration: 60,
          happiness: 80,
        }),
      });
      await saveSystem.save(gameState);

      const loadedState = await saveSystem.load();

      expect(loadedState).not.toBeNull();
      expect(loadedState?.playerId).toBe('test-player-123');
      expect(loadedState?.pet?.name).toBe('Fluffy');
    });

    it('should return null when no save exists', async () => {
      const loadedState = await saveSystem.load();
      expect(loadedState).toBeNull();
    });

    it('should validate checksum on load', async () => {
      const gameState = createMockGameState({
        playerId: 'test-player-123',
        maxSlots: 50,
        unlockedSlots: 50,
        includeTestItems: true,
        pet: createMockPet({
          id: 'pet-1',
          name: 'Fluffy',
          species: 'cat',
          rarity: 'COMMON',
          stage: 'ADULT',
          health: 100,
          energy: 80,
          satiety: 75,
          hydration: 60,
          happiness: 80,
        }),
      });
      await saveSystem.save(gameState);

      // Corrupt the save by modifying it directly
      const savedData = mockLocalStorage.getItem('test_current');
      const saveState = JSON.parse(savedData!) as SaveState;
      saveState.data.pet!.name = 'Corrupted';
      // Keep old checksum to trigger mismatch
      mockLocalStorage.setItem('test_current', JSON.stringify(saveState));

      // Load should still work but with warning
      const loadedState = await saveSystem.load();
      expect(loadedState).not.toBeNull();
      expect(loadedState?.pet?.name).toBe('Corrupted'); // Data loads despite checksum mismatch
    });

    it('should load from backup slot', async () => {
      const gameState = createMockGameState({
        playerId: 'test-player-123',
        maxSlots: 50,
        unlockedSlots: 50,
        includeTestItems: true,
        pet: createMockPet({
          id: 'pet-1',
          name: 'Fluffy',
          species: 'cat',
          rarity: 'COMMON',
          stage: 'ADULT',
          health: 100,
          energy: 80,
          satiety: 75,
          hydration: 60,
          happiness: 80,
        }),
      });

      // Save to trigger backup rotation
      await saveSystem.save(gameState);

      // Modify and save again
      gameState.pet!.name = 'Updated';
      await saveSystem.save(gameState);

      // Load from backup slot 0
      const backupState = await saveSystem.load(0);

      // Should get the first save
      expect(backupState).not.toBeNull();
      expect(backupState?.pet?.name).toBe('Fluffy');
    });
  });

  describe('Save Rotation', () => {
    beforeEach(async () => {
      await saveSystem.initialize({
        });
    });

    it('should rotate saves correctly', async () => {
      const gameState = createMockGameState({
        playerId: 'test-player-123',
        maxSlots: 50,
        unlockedSlots: 50,
        includeTestItems: true,
        pet: createMockPet({
          id: 'pet-1',
          name: 'Fluffy',
          species: 'cat',
          rarity: 'COMMON',
          stage: 'ADULT',
          health: 100,
          energy: 80,
          satiety: 75,
          hydration: 60,
          happiness: 80,
        }),
      });

      // Save multiple times to trigger rotation
      for (let i = 0; i < 5; i++) {
        gameState.pet!.name = `Pet${i}`;
        await saveSystem.save(gameState);
        await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay
      }

      // Check backups
      const backups = saveSystem.getBackupSaves();
      expect(backups.length).toBeLessThanOrEqual(3); // Max 3 backups
    });

    it('should maintain chronological order in backups', async () => {
      const gameState = createMockGameState({
        playerId: 'test-player-123',
        maxSlots: 50,
        unlockedSlots: 50,
        includeTestItems: true,
        pet: createMockPet({
          id: 'pet-1',
          name: 'Fluffy',
          species: 'cat',
          rarity: 'COMMON',
          stage: 'ADULT',
          health: 100,
          energy: 80,
          satiety: 75,
          hydration: 60,
          happiness: 80,
        }),
      });

      // Save multiple times
      for (let i = 0; i < 4; i++) {
        gameState.timestamp = Date.now() + i * 1000;
        await saveSystem.save(gameState);
      }

      const backups = saveSystem.getBackupSaves();

      // Check that backups are sorted by timestamp (newest first)
      for (let i = 1; i < backups.length; i++) {
        const prev = backups[i - 1];
        const curr = backups[i];
        if (prev && curr) {
          expect(prev.timestamp).toBeGreaterThanOrEqual(curr.timestamp);
        }
      }
    });
  });

  describe('Import/Export', () => {
    beforeEach(async () => {
      await saveSystem.initialize({
        });
    });

    it('should export save as JSON', async () => {
      const gameState = createMockGameState({
        playerId: 'test-player-123',
        maxSlots: 50,
        unlockedSlots: 50,
        includeTestItems: true,
        pet: createMockPet({
          id: 'pet-1',
          name: 'Fluffy',
          species: 'cat',
          rarity: 'COMMON',
          stage: 'ADULT',
          health: 100,
          energy: 80,
          satiety: 75,
          hydration: 60,
          happiness: 80,
        }),
      });
      await saveSystem.save(gameState);

      const exportedData = await saveSystem.exportSave();

      expect(exportedData).toBeTruthy();

      const parsed = JSON.parse(exportedData);
      expect(parsed.version).toBe('1.0.0');
      expect(parsed.game).toBe('Digital Pet Game');
      expect(parsed.data.playerId).toBe('test-player-123');
    });

    it('should import valid save data', async () => {
      const gameState = createMockGameState({
        playerId: 'test-player-123',
        maxSlots: 50,
        unlockedSlots: 50,
        includeTestItems: true,
        pet: createMockPet({
          id: 'pet-1',
          name: 'Fluffy',
          species: 'cat',
          rarity: 'COMMON',
          stage: 'ADULT',
          health: 100,
          energy: 80,
          satiety: 75,
          hydration: 60,
          happiness: 80,
        }),
      });

      // Create export data manually
      const exportData = {
        version: '1.0.0',
        timestamp: Date.now(),
        checksum: '',
        game: 'Digital Pet Game',
        data: gameState,
      };

      // Generate checksum
      const saveSystem2 = new SaveSystem();
      await saveSystem2.initialize({});
      exportData.checksum = (saveSystem2 as any).generateChecksum(exportData.data);

      const success = await saveSystem.importSave(JSON.stringify(exportData));

      expect(success).toBe(true);

      // Verify imported data
      const loadedState = await saveSystem.load();
      expect(loadedState?.playerId).toBe('test-player-123');
      expect(loadedState?.pet?.name).toBe('Fluffy');
    });

    it('should reject import with invalid checksum', async () => {
      const gameState = createMockGameState({
        playerId: 'test-player-123',
        maxSlots: 50,
        unlockedSlots: 50,
        includeTestItems: true,
        pet: createMockPet({
          id: 'pet-1',
          name: 'Fluffy',
          species: 'cat',
          rarity: 'COMMON',
          stage: 'ADULT',
          health: 100,
          energy: 80,
          satiety: 75,
          hydration: 60,
          happiness: 80,
        }),
      });

      const exportData = {
        version: '1.0.0',
        timestamp: Date.now(),
        checksum: 'invalid-checksum',
        game: 'Digital Pet Game',
        data: gameState,
      };

      const success = await saveSystem.importSave(JSON.stringify(exportData));

      expect(success).toBe(false);
    });

    it('should reject import with missing data', async () => {
      const invalidData = {
        version: '1.0.0',
        timestamp: Date.now(),
        checksum: 'some-checksum',
        // Missing data field
      };

      const success = await saveSystem.importSave(JSON.stringify(invalidData));

      expect(success).toBe(false);
    });

    it('should provide import preview', async () => {
      const gameState = createMockGameState({
        playerId: 'test-player-123',
        maxSlots: 50,
        unlockedSlots: 50,
        includeTestItems: true,
        pet: createMockPet({
          id: 'pet-1',
          name: 'Fluffy',
          species: 'cat',
          rarity: 'COMMON',
          stage: 'ADULT',
          health: 100,
          energy: 80,
          satiety: 75,
          hydration: 60,
          happiness: 80,
        }),
      });

      const exportData = {
        version: '1.0.0',
        timestamp: Date.now(),
        checksum: 'some-checksum',
        data: gameState,
      };

      const preview = await saveSystem.getImportPreview(JSON.stringify(exportData));

      expect(preview).not.toBeNull();
      expect(preview?.playerId).toBe('test-player-123');
      expect(preview?.petName).toBe('Fluffy');
      expect(preview?.petSpecies).toBe('cat');
      expect(preview?.playTime).toBe(3600);
    });
  });

  describe('Save Validation', () => {
    beforeEach(async () => {
      await saveSystem.initialize({
        });
    });

    it('should validate save structure', async () => {
      const validState = createMockGameState({
        playerId: 'test-player-123',
        maxSlots: 50,
        unlockedSlots: 50,
        includeTestItems: true,
        pet: createMockPet({
          id: 'pet-1',
          name: 'Fluffy',
          species: 'cat',
          rarity: 'COMMON',
          stage: 'ADULT',
          health: 100,
          energy: 80,
          satiety: 75,
          hydration: 60,
          happiness: 80,
        }),
      });
      await saveSystem.save(validState);

      const loadedState = await saveSystem.load();
      expect(loadedState).not.toBeNull();
    });

    it('should detect missing required fields', async () => {
      const invalidState = createMockGameState({
        playerId: 'test-player-123',
        maxSlots: 50,
        unlockedSlots: 50,
        includeTestItems: true,
        pet: createMockPet({
          id: 'pet-1',
          name: 'Fluffy',
          species: 'cat',
          rarity: 'COMMON',
          stage: 'ADULT',
          health: 100,
          energy: 80,
          satiety: 75,
          hydration: 60,
          happiness: 80,
        }),
      });

      // Remove required field
      delete (invalidState as any).inventory;

      const saveState: SaveState = {
        version: '1.0.0',
        timestamp: Date.now(),
        checksum: 'test',
        data: invalidState,
      };

      mockLocalStorage.setItem('test_current', JSON.stringify(saveState));

      // Should fail to load due to validation
      const loadedState = await saveSystem.load();
      expect(loadedState).toBeNull();
    });

    it('should handle version migration', async () => {
      const oldVersionState = createMockGameState({
        playerId: 'test-player-123',
        maxSlots: 50,
        unlockedSlots: 50,
        includeTestItems: true,
        pet: createMockPet({
          id: 'pet-1',
          name: 'Fluffy',
          species: 'cat',
          rarity: 'COMMON',
          stage: 'ADULT',
          health: 100,
          energy: 80,
          satiety: 75,
          hydration: 60,
          happiness: 80,
        }),
      });
      oldVersionState.version = '0.9.0';

      // Remove collections to simulate old version
      delete (oldVersionState as any).collections;

      const saveState: SaveState = {
        version: '0.9.0',
        timestamp: Date.now(),
        checksum: (saveSystem as any).generateChecksum(oldVersionState),
        data: oldVersionState,
      };

      mockLocalStorage.setItem('test_current', JSON.stringify(saveState));

      const loadedState = await saveSystem.load();

      // Should have migrated and added missing fields
      expect(loadedState).not.toBeNull();
      expect(loadedState?.version).toBe('1.0.0');
      expect(loadedState?.collections.eggs).toEqual([]);
    });
  });

  describe('Delete Operations', () => {
    beforeEach(async () => {
      await saveSystem.initialize({
        });
    });

    it('should delete current save', async () => {
      const gameState = createMockGameState({
        playerId: 'test-player-123',
        maxSlots: 50,
        unlockedSlots: 50,
        includeTestItems: true,
        pet: createMockPet({
          id: 'pet-1',
          name: 'Fluffy',
          species: 'cat',
          rarity: 'COMMON',
          stage: 'ADULT',
          health: 100,
          energy: 80,
          satiety: 75,
          hydration: 60,
          happiness: 80,
        }),
      });
      await saveSystem.save(gameState);

      await saveSystem.deleteSave();

      const loadedState = await saveSystem.load();
      expect(loadedState).toBeNull();
    });

    it('should delete specific backup slot', async () => {
      const gameState = createMockGameState({
        playerId: 'test-player-123',
        maxSlots: 50,
        unlockedSlots: 50,
        includeTestItems: true,
        pet: createMockPet({
          id: 'pet-1',
          name: 'Fluffy',
          species: 'cat',
          rarity: 'COMMON',
          stage: 'ADULT',
          health: 100,
          energy: 80,
          satiety: 75,
          hydration: 60,
          happiness: 80,
        }),
      });

      // Create multiple saves
      for (let i = 0; i < 3; i++) {
        gameState.pet!.name = `Pet${i}`;
        await saveSystem.save(gameState);
      }

      // Delete backup slot 0
      await saveSystem.deleteSave(0);

      // Try to load from slot 0
      const loadedState = await saveSystem.load(0);
      expect(loadedState).toBeNull();
    });

    it('should clear all saves', async () => {
      const gameState = createMockGameState({
        playerId: 'test-player-123',
        maxSlots: 50,
        unlockedSlots: 50,
        includeTestItems: true,
        pet: createMockPet({
          id: 'pet-1',
          name: 'Fluffy',
          species: 'cat',
          rarity: 'COMMON',
          stage: 'ADULT',
          health: 100,
          energy: 80,
          satiety: 75,
          hydration: 60,
          happiness: 80,
        }),
      });

      // Create multiple saves
      for (let i = 0; i < 3; i++) {
        await saveSystem.save(gameState);
      }

      await saveSystem.clearAllSaves();

      // Check that all saves are gone
      expect(await saveSystem.load()).toBeNull();
      expect(saveSystem.getBackupSaves()).toEqual([]);
      expect(mockLocalStorage.length).toBe(1); // Only metadata remains
    });
  });

  describe('Storage Quota Handling', () => {
    beforeEach(async () => {
      await saveSystem.initialize({
        });
    });

    it('should handle storage quota exceeded', async () => {
      const gameState = createMockGameState({
        playerId: 'test-player-123',
        maxSlots: 50,
        unlockedSlots: 50,
        includeTestItems: true,
        pet: createMockPet({
          id: 'pet-1',
          name: 'Fluffy',
          species: 'cat',
          rarity: 'COMMON',
          stage: 'ADULT',
          health: 100,
          energy: 80,
          satiety: 75,
          hydration: 60,
          happiness: 80,
        }),
      });

      // Create some backups first
      for (let i = 0; i < 3; i++) {
        await saveSystem.save(gameState);
      }

      // Mock setItem to throw QuotaExceededError
      const originalSetItem = mockLocalStorage.setItem.bind(mockLocalStorage);
      let throwOnce = true;
      mockLocalStorage.setItem = function (key: string, value: string) {
        if (throwOnce && key === 'test_current') {
          throwOnce = false;
          // Create a proper DOMException with the name property set in constructor
          const error = new DOMException('Storage quota exceeded', 'QuotaExceededError');
          throw error;
        }
        return originalSetItem(key, value);
      };

      // Should handle the error and retry after cleanup
      await saveSystem.save(gameState);

      // Should have saved successfully after cleanup
      const loadedState = await saveSystem.load();
      expect(loadedState).not.toBeNull();
    });
  });

  describe('Checksum Algorithms', () => {
    it('should generate consistent simple checksums', async () => {
      const system1 = new SaveSystem({ checksumAlgorithm: 'simple' });
      const system2 = new SaveSystem({ checksumAlgorithm: 'simple' });

      await system1.initialize({});
      await system2.initialize({});

      const gameState = createMockGameState({
        playerId: 'test-player-123',
        maxSlots: 50,
        unlockedSlots: 50,
        includeTestItems: true,
        pet: createMockPet({
          id: 'pet-1',
          name: 'Fluffy',
          species: 'cat',
          rarity: 'COMMON',
          stage: 'ADULT',
          health: 100,
          energy: 80,
          satiety: 75,
          hydration: 60,
          happiness: 80,
        }),
      });

      const checksum1 = (system1 as any).generateChecksum(gameState);
      const checksum2 = (system2 as any).generateChecksum(gameState);

      expect(checksum1).toBe(checksum2);
    });

    it('should generate consistent CRC32 checksums', async () => {
      const system1 = new SaveSystem({ checksumAlgorithm: 'crc32' });
      const system2 = new SaveSystem({ checksumAlgorithm: 'crc32' });

      await system1.initialize({});
      await system2.initialize({});

      const gameState = createMockGameState({
        playerId: 'test-player-123',
        maxSlots: 50,
        unlockedSlots: 50,
        includeTestItems: true,
        pet: createMockPet({
          id: 'pet-1',
          name: 'Fluffy',
          species: 'cat',
          rarity: 'COMMON',
          stage: 'ADULT',
          health: 100,
          energy: 80,
          satiety: 75,
          hydration: 60,
          happiness: 80,
        }),
      });

      const checksum1 = (system1 as any).generateChecksum(gameState);
      const checksum2 = (system2 as any).generateChecksum(gameState);

      expect(checksum1).toBe(checksum2);
    });

    it('should detect data changes with checksums', async () => {
      const system = new SaveSystem();
      await system.initialize({});

      const gameState1 = createMockGameState({
        playerId: 'test-player-123',
        maxSlots: 50,
        unlockedSlots: 50,
        includeTestItems: true,
        pet: createMockPet({
          id: 'pet-1',
          name: 'Fluffy',
          species: 'cat',
          rarity: 'COMMON',
          stage: 'ADULT',
          health: 100,
          energy: 80,
          satiety: 75,
          hydration: 60,
          happiness: 80,
        }),
      });
      const gameState2 = createMockGameState({
        playerId: 'test-player-123',
        maxSlots: 50,
        unlockedSlots: 50,
        includeTestItems: true,
        pet: createMockPet({
          id: 'pet-1',
          name: 'Fluffy',
          species: 'cat',
          rarity: 'COMMON',
          stage: 'ADULT',
          health: 100,
          energy: 80,
          satiety: 75,
          hydration: 60,
          happiness: 80,
        }),
      });
      gameState2.pet!.name = 'Different';

      const checksum1 = (system as any).generateChecksum(gameState1);
      const checksum2 = (system as any).generateChecksum(gameState2);

      expect(checksum1).not.toBe(checksum2);
    });
  });

  describe('Error Recovery', () => {
    beforeEach(async () => {
      await saveSystem.initialize({
        });
    });

    it('should recover from corrupted current save', async () => {
      const gameState = createMockGameState({
        playerId: 'test-player-123',
        maxSlots: 50,
        unlockedSlots: 50,
        includeTestItems: true,
        pet: createMockPet({
          id: 'pet-1',
          name: 'Fluffy',
          species: 'cat',
          rarity: 'COMMON',
          stage: 'ADULT',
          health: 100,
          energy: 80,
          satiety: 75,
          hydration: 60,
          happiness: 80,
        }),
      });

      // Save a valid backup first
      gameState.pet!.name = 'Backup';
      await saveSystem.save(gameState);

      // Save current
      gameState.pet!.name = 'Current';
      await saveSystem.save(gameState);

      // Corrupt the current save
      mockLocalStorage.setItem('test_current', 'invalid json {]');

      // Should recover from backup
      const loadedState = await saveSystem.load();
      expect(loadedState).not.toBeNull();
    });

    it('should handle JSON parse errors gracefully', async () => {
      mockLocalStorage.setItem('test_current', 'not valid json');

      const loadedState = await saveSystem.load();
      expect(loadedState).toBeNull();
    });
  });

  describe('File Operations', () => {
    beforeEach(async () => {
      await saveSystem.initialize({
        });
    });

    it('should prepare save for file download', async () => {
      const gameState = createMockGameState({
        playerId: 'test-player-123',
        maxSlots: 50,
        unlockedSlots: 50,
        includeTestItems: true,
        pet: createMockPet({
          id: 'pet-1',
          name: 'Fluffy',
          species: 'cat',
          rarity: 'COMMON',
          stage: 'ADULT',
          health: 100,
          energy: 80,
          satiety: 75,
          hydration: 60,
          happiness: 80,
        }),
      });
      await saveSystem.save(gameState);

      // Mock document methods for download
      const createElement = mock(() => {
        const a = {
          href: '',
          download: '',
          click: mock(() => {}),
        };
        return a;
      });

      const appendChild = mock(() => {});
      const removeChild = mock(() => {});

      global.document = {
        createElement,
        body: {
          appendChild,
          removeChild,
        },
      } as any;

      global.URL = {
        createObjectURL: mock(() => 'blob:test'),
        revokeObjectURL: mock(() => {}),
      } as any;

      await saveSystem.downloadSaveAsFile();

      expect(createElement).toHaveBeenCalledWith('a');
      expect(appendChild).toHaveBeenCalled();
      expect(removeChild).toHaveBeenCalled();
    });

    it('should load save from file', async () => {
      const gameState = createMockGameState({
        playerId: 'test-player-123',
        maxSlots: 50,
        unlockedSlots: 50,
        includeTestItems: true,
        pet: createMockPet({
          id: 'pet-1',
          name: 'Fluffy',
          species: 'cat',
          rarity: 'COMMON',
          stage: 'ADULT',
          health: 100,
          energy: 80,
          satiety: 75,
          hydration: 60,
          happiness: 80,
        }),
      });

      const exportData = {
        version: '1.0.0',
        timestamp: Date.now(),
        checksum: (saveSystem as any).generateChecksum(gameState),
        game: 'Digital Pet Game',
        data: gameState,
      };

      const file = new File([JSON.stringify(exportData)], 'save.json', {
        type: 'application/json',
      });

      const success = await saveSystem.loadSaveFromFile(file);

      expect(success).toBe(true);

      const loadedState = await saveSystem.load();
      expect(loadedState?.playerId).toBe('test-player-123');
    });
  });
});
