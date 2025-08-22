import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { SaveManager } from '../core/SaveManager';
import { BackupManager } from '../core/BackupManager';
import { PersistenceManager } from '../core/PersistenceManager';
import { StateManager } from '../core/StateManager';
import type { GameState } from '../types';
import { Species, Rarity, GrowthStage, AutosaveReason } from '../types';

// Mock IndexedDB for testing
const mockIndexedDB = {
  databases: new Map(),
  open(name: string, version: number) {
    const db = {
      name,
      version,
      objectStoreNames: {
        contains: (name: string) => false,
      },
      transaction: (stores: string[], mode: string) => ({
        objectStore: (name: string) => ({
          put: (data: any) => ({ 
            onsuccess: null as any,
            onerror: null as any,
            result: data.key,
          }),
          get: (key: string) => ({
            onsuccess: null as any,
            onerror: null as any,
            result: mockIndexedDB.databases.get(name)?.get(key),
          }),
          delete: (key: string) => ({
            onsuccess: null as any,
            onerror: null as any,
          }),
          clear: () => ({
            onsuccess: null as any,
            onerror: null as any,
          }),
          getAll: () => ({
            onsuccess: null as any,
            onerror: null as any,
            result: Array.from(mockIndexedDB.databases.get(name)?.values() || []),
          }),
        }),
        onerror: null as any,
      }),
      close: () => {},
    };

    if (!mockIndexedDB.databases.has(name)) {
      mockIndexedDB.databases.set(name, new Map());
    }

    return {
      onsuccess: null as any,
      onerror: null as any,
      onupgradeneeded: null as any,
      onblocked: null as any,
      result: db,
    };
  },
};

// Helper function to create a test game state
function createTestGameState(): GameState {
  const now = Date.now();
  return {
    meta: {
      version: '1.0.0',
      createdAt: now,
      lastSaveTime: now,
      playerId: 'test_player',
    },
    pet: {
      id: 'test_pet',
      species: Species.FLUFFY_PUP,
      rarity: Rarity.COMMON,
      name: 'Test Pet',
      stage: GrowthStage.HATCHLING,
      createdAt: now,
      lastInteractionTime: now,
      satiety: 80,
      hydration: 80,
      happiness: 80,
      satietyTicks: 1600,
      hydrationTicks: 1200,
      happinessTicks: 2400,
      life: 100,
      energy: 50,
      maxEnergy: 50,
      isSleeping: false,
      sleepStartTime: null,
      poopCount: 0,
      statuses: [],
      battleStats: {
        health: 50,
        maxHealth: 50,
        attack: 10,
        defense: 8,
        speed: 12,
        action: 20,
        maxAction: 20,
      },
      knownMoves: [],
      stageStartTime: now,
      canAdvanceStage: false,
    },
    world: {
      currentLocation: {
        id: 'starter_city',
        name: 'Starter City',
        type: 'city' as any,
        description: 'A peaceful starting location',
        availableActivities: [],
        shops: [],
        distanceTo: {},
      },
      currentActivity: null,
      currentTravel: null,
      currentTraining: null,
      currentBattle: null,
      currentEvent: null,
    },
    inventory: {
      items: {},
      coins: 100,
      eggs: [],
      maxSlots: 50,
    },
    settings: {
      accessibility: {
        colorBlindMode: 'none' as any,
        highContrast: false,
        fontScale: 1.0,
        reducedMotion: false,
        screenReaderEnabled: false,
      },
      notifications: {
        lowCareAlerts: true,
        highPoopAlerts: true,
        activityComplete: true,
        eventReminders: true,
        soundEnabled: true,
      },
      audio: {
        masterVolume: 0.8,
        musicVolume: 0.6,
        effectsVolume: 0.8,
        muted: false,
      },
    },
    time: {
      lastTickTime: now,
      tickCount: 0,
      offlineTime: 0,
      scheduledEvents: [],
    },
  };
}

describe('SaveManager', () => {
  let saveManager: SaveManager;

  beforeEach(async () => {
    // Mock IndexedDB
    (global as any).indexedDB = mockIndexedDB;
    mockIndexedDB.databases.clear();
    
    saveManager = new SaveManager();
    // Don't actually initialize IndexedDB in tests
    // await saveManager.initialize();
  });

  afterEach(() => {
    delete (global as any).indexedDB;
  });

  it('should generate consistent checksums for the same data', () => {
    const data = { test: 'data', value: 123 };
    const checksum1 = saveManager.generateChecksum(data);
    const checksum2 = saveManager.generateChecksum(data);
    
    expect(checksum1).toBe(checksum2);
  });

  it('should generate different checksums for different data', () => {
    const data1 = { test: 'data', value: 123 };
    const data2 = { test: 'data', value: 456 };
    
    const checksum1 = saveManager.generateChecksum(data1);
    const checksum2 = saveManager.generateChecksum(data2);
    
    expect(checksum1).not.toBe(checksum2);
  });

  it('should verify checksums correctly', () => {
    const data = { test: 'data', value: 123 };
    const checksum = saveManager.generateChecksum(data);
    
    expect(saveManager.verifyChecksum(data, checksum)).toBe(true);
    expect(saveManager.verifyChecksum(data, 'invalid_checksum')).toBe(false);
  });
});

describe('BackupManager', () => {
  let saveManager: SaveManager;
  let backupManager: BackupManager;

  beforeEach(async () => {
    // Mock IndexedDB
    (global as any).indexedDB = mockIndexedDB;
    mockIndexedDB.databases.clear();
    
    saveManager = new SaveManager();
    backupManager = new BackupManager(saveManager);
    // Don't actually initialize in tests
    // await backupManager.initialize();
  });

  afterEach(() => {
    delete (global as any).indexedDB;
  });

  it('should validate backup structure correctly', () => {
    const validBackup = {
      id: 'backup_test',
      state: createTestGameState(),
      timestamp: Date.now(),
      checksum: 'test_checksum',
      type: 'manual' as const,
    };

    const invalidBackup = {
      id: 'backup_test',
      // missing state
      timestamp: Date.now(),
      checksum: 'test_checksum',
      type: 'manual' as const,
    };

    // Note: validateBackup will fail checksum validation in real scenario
    // But we're testing structure validation here
    expect(backupManager['isValidBackup'](validBackup)).toBe(true);
    expect(backupManager['isValidBackup'](invalidBackup)).toBe(false);
  });

  it('should generate unique backup IDs', () => {
    const id1 = backupManager['generateBackupId']('manual');
    const id2 = backupManager['generateBackupId']('manual');
    
    expect(id1).not.toBe(id2);
    expect(id1).toContain('backup_manual_');
    expect(id2).toContain('backup_manual_');
  });

  it('should repair corrupted state', () => {
    const corruptedState = {
      meta: null,
      pet: { name: 'Test' },
      // missing other properties
    };

    const repaired = backupManager['repairState'](corruptedState);
    
    expect(repaired).toBeDefined();
    expect(repaired.meta).toBeDefined();
    expect(repaired.meta.version).toBe('1.0.0');
    expect(repaired.inventory).toBeDefined();
    expect(repaired.world).toBeDefined();
    expect(repaired.settings).toBeDefined();
    expect(repaired.time).toBeDefined();
  });
});

describe('PersistenceManager', () => {
  let persistenceManager: PersistenceManager;
  let stateManager: StateManager;

  beforeEach(async () => {
    // Mock IndexedDB
    (global as any).indexedDB = mockIndexedDB;
    mockIndexedDB.databases.clear();
    
    persistenceManager = new PersistenceManager();
    stateManager = new StateManager();
    persistenceManager.setStateManager(stateManager);
    
    // Don't actually initialize IndexedDB in tests
    // await persistenceManager.initialize();
  });

  afterEach(() => {
    delete (global as any).indexedDB;
  });

  it('should validate save file structure', () => {
    const validSaveFile = {
      version: '1.0.0',
      timestamp: Date.now(),
      state: createTestGameState(),
      checksum: 'test_checksum',
      metadata: {
        playTime: 1000,
        saveCount: 1,
        platform: 'test',
      },
    };

    const invalidSaveFile = {
      version: '1.0.0',
      // missing timestamp
      state: createTestGameState(),
      checksum: 'test_checksum',
    };

    const validation1 = persistenceManager.validateSaveFile(validSaveFile);
    expect(validation1.isValid).toBe(true);
    expect(validation1.errors.length).toBe(0);

    const validation2 = persistenceManager.validateSaveFile(invalidSaveFile as any);
    expect(validation2.isValid).toBe(false);
    expect(validation2.errors).toContain('Invalid timestamp');
  });

  it('should compress and decompress save data', () => {
    const state = createTestGameState();
    
    const compressed = persistenceManager.compressSave(state);
    expect(typeof compressed).toBe('string');
    
    const decompressed = persistenceManager.decompressSave(compressed);
    expect(decompressed).toEqual(state);
  });

  it('should get current save version', () => {
    const version = persistenceManager.getCurrentSaveVersion();
    expect(version).toBe('1.0.0');
  });

  it('should enable and disable autosave', () => {
    persistenceManager.setAutosaveEnabled(false);
    expect(persistenceManager['autosaveEnabled']).toBe(false);
    
    persistenceManager.setAutosaveEnabled(true);
    expect(persistenceManager['autosaveEnabled']).toBe(true);
  });
});

describe('Persistence Integration', () => {
  let persistenceManager: PersistenceManager;
  let stateManager: StateManager;
  let testState: GameState;

  beforeEach(async () => {
    // Mock IndexedDB
    (global as any).indexedDB = mockIndexedDB;
    mockIndexedDB.databases.clear();
    
    persistenceManager = new PersistenceManager();
    stateManager = new StateManager();
    persistenceManager.setStateManager(stateManager);
    testState = createTestGameState();
    
    // Mark as initialized for testing (since we're mocking IndexedDB)
    persistenceManager['isInitialized'] = true;
    
    // Set the test state
    stateManager.dispatch({
      type: 'set_state' as any,
      payload: testState,
    });
  });

  afterEach(() => {
    delete (global as any).indexedDB;
  });

  it('should export save file with correct structure', async () => {
    const saveFile = await persistenceManager.exportSave();
    
    expect(saveFile).toBeDefined();
    expect(saveFile.version).toBe('1.0.0');
    expect(saveFile.timestamp).toBeGreaterThan(0);
    expect(saveFile.state).toBeDefined();
    expect(saveFile.checksum).toBeDefined();
    expect(saveFile.metadata).toBeDefined();
  });

  it('should validate state through state manager', () => {
    const state = createTestGameState();
    const validation = stateManager.validateState(state);
    
    expect(validation.isValid).toBe(true);
    expect(validation.errors.length).toBe(0);
  });

  it('should detect invalid care values', () => {
    const state = createTestGameState();
    state.pet!.satiety = 150; // Invalid: > 100
    state.pet!.hydration = -10; // Invalid: < 0
    
    const validation = stateManager.validateState(state);
    
    expect(validation.isValid).toBe(false);
    expect(validation.errors).toContain('Pet satiety must be between 0 and 100');
    expect(validation.errors).toContain('Pet hydration must be between 0 and 100');
  });

  it('should generate warnings for low care values', () => {
    const state = createTestGameState();
    state.pet!.satiety = 15;
    state.pet!.hydration = 10;
    state.pet!.life = 5;
    
    const validation = stateManager.validateState(state);
    
    expect(validation.isValid).toBe(true); // Still valid, just with warnings
    expect(validation.warnings).toContain('Pet satiety is critically low');
    expect(validation.warnings).toContain('Pet hydration is critically low');
    expect(validation.warnings).toContain('Pet life is critically low');
  });

  it('should sanitize invalid state values', () => {
    const state = createTestGameState();
    state.pet!.satiety = 150;
    state.pet!.hydration = -10;
    state.pet!.energy = 100; // Above max
    state.pet!.poopCount = -5;
    
    const sanitized = stateManager.sanitizeState(state);
    
    expect(sanitized.pet!.satiety).toBe(100);
    expect(sanitized.pet!.hydration).toBe(0);
    expect(sanitized.pet!.energy).toBe(50); // Clamped to maxEnergy
    expect(sanitized.pet!.poopCount).toBe(0);
  });
});