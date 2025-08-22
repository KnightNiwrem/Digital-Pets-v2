import type { GameState, GameSystem, StateSnapshot, ValidationResult } from '../types';
import { AutosaveReason } from '../types';
import { SaveManager } from './SaveManager';
import { BackupManager } from './BackupManager';
import { StateManager } from './StateManager';

interface SaveFile {
  version: string;
  timestamp: number;
  state: GameState;
  checksum: string;
  metadata?: {
    playTime?: number;
    saveCount?: number;
    platform?: string;
  };
}

/**
 * PersistenceManager coordinates all save/load operations.
 * This is a pure system that returns results to GameEngine.
 * It does not directly modify game state.
 */
export class PersistenceManager implements GameSystem {
  private static readonly MAIN_SAVE_KEY = 'main_save';
  private static readonly AUTOSAVE_KEY = 'autosave';
  private static readonly QUICKSAVE_KEY = 'quicksave';
  private static readonly SAVE_VERSION = '1.0.0';

  private saveManager: SaveManager;
  private backupManager: BackupManager;
  private stateManager: StateManager | null = null;

  private isInitialized = false;
  private isSaving = false;
  private lastSaveTime = 0;
  private saveCount = 0;
  private autosaveEnabled = true;
  private pendingAutosave: AutosaveReason | null = null;

  constructor() {
    this.saveManager = new SaveManager();
    this.backupManager = new BackupManager(this.saveManager);
  }

  /**
   * Set the state manager reference (called by GameEngine)
   */
  setStateManager(stateManager: StateManager): void {
    this.stateManager = stateManager;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize subsystems
      await this.saveManager.initialize();
      await this.backupManager.initialize();

      // Check for existing saves
      const hasSave = await this.hasSaveData();
      if (hasSave) {
        console.log('Existing save data found');
      } else {
        console.log('No existing save data');
      }

      this.isInitialized = true;
      console.log('PersistenceManager initialized');
    } catch (error) {
      console.error('Failed to initialize PersistenceManager:', error);
      throw error;
    }
  }

  /**
   * Save the current game state
   */
  async save(state: GameState): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('PersistenceManager not initialized');
    }

    if (this.isSaving) {
      console.warn('Save already in progress');
      return;
    }

    this.isSaving = true;

    try {
      // Validate state before saving
      const validation = this.validateState(state);
      if (!validation.isValid) {
        console.error('State validation failed:', validation.errors);
        throw new Error('Invalid game state: ' + validation.errors.join(', '));
      }

      // Create save data
      const saveData: SaveFile = {
        version: PersistenceManager.SAVE_VERSION,
        timestamp: Date.now(),
        state,
        checksum: this.saveManager.generateChecksum(state),
        metadata: {
          playTime: this.calculatePlayTime(state),
          saveCount: ++this.saveCount,
          platform: this.getPlatform(),
        },
      };

      // Write main save
      await this.saveManager.writeSave(PersistenceManager.MAIN_SAVE_KEY, saveData);

      // Update metadata
      await this.saveManager.writeMetadata('save_info', {
        lastSaveTime: saveData.timestamp,
        saveCount: this.saveCount,
        version: PersistenceManager.SAVE_VERSION,
      });

      this.lastSaveTime = saveData.timestamp;

      console.log(`Game saved successfully (save #${this.saveCount})`);
    } catch (error) {
      console.error('Save failed:', error);

      // Try to handle quota exceeded
      if (error instanceof Error && error.message.includes('quota')) {
        await this.handleStorageQuotaExceeded();
        // Retry save
        try {
          await this.save(state);
        } catch (retryError) {
          throw new Error('Save failed even after cleanup: ' + retryError);
        }
      } else {
        throw error;
      }
    } finally {
      this.isSaving = false;
    }
  }

  /**
   * Trigger an autosave
   */
  async autosave(reason: AutosaveReason): Promise<void> {
    if (!this.isInitialized || !this.autosaveEnabled) {
      return;
    }

    if (!this.stateManager) {
      console.error('StateManager not set - cannot autosave');
      return;
    }

    // Debounce autosaves (except for critical ones)
    const now = Date.now();
    const timeSinceLastSave = now - this.lastSaveTime;

    if (reason === AutosaveReason.USER_ACTION && timeSinceLastSave < 1000) {
      // Defer user action autosaves if saved recently
      this.pendingAutosave = reason;
      return;
    }

    try {
      const state = this.stateManager.getState();

      // Create autosave
      const saveData: SaveFile = {
        version: PersistenceManager.SAVE_VERSION,
        timestamp: now,
        state,
        checksum: this.saveManager.generateChecksum(state),
        metadata: {
          playTime: this.calculatePlayTime(state),
          saveCount: this.saveCount,
          platform: this.getPlatform(),
        },
      };

      // Write autosave
      await this.saveManager.writeSave(PersistenceManager.AUTOSAVE_KEY, saveData);

      // Create rolling backup for important saves
      if (reason === AutosaveReason.TICK || reason === AutosaveReason.SHUTDOWN) {
        await this.backupManager.createRollingBackup(state);
      }

      this.lastSaveTime = now;
      this.pendingAutosave = null;

      console.log(`Autosave completed (${reason})`);
    } catch (error) {
      console.error('Autosave failed:', error);
    }
  }

  /**
   * Quick save the game
   */
  async quicksave(): Promise<void> {
    if (!this.isInitialized || !this.stateManager) {
      throw new Error('Cannot quicksave - system not ready');
    }

    const state = this.stateManager.getState();

    const saveData: SaveFile = {
      version: PersistenceManager.SAVE_VERSION,
      timestamp: Date.now(),
      state,
      checksum: this.saveManager.generateChecksum(state),
      metadata: {
        playTime: this.calculatePlayTime(state),
        saveCount: this.saveCount,
        platform: this.getPlatform(),
      },
    };

    await this.saveManager.writeSave(PersistenceManager.QUICKSAVE_KEY, saveData);
    console.log('Quicksave completed');
  }

  /**
   * Load the game state
   */
  async load(): Promise<GameState> {
    if (!this.isInitialized) {
      throw new Error('PersistenceManager not initialized');
    }

    try {
      // Try to load main save first
      let saveData = await this.loadSaveFile(PersistenceManager.MAIN_SAVE_KEY);

      // Fall back to autosave if main save doesn't exist
      if (!saveData) {
        console.log('No main save found, trying autosave');
        saveData = await this.loadSaveFile(PersistenceManager.AUTOSAVE_KEY);
      }

      // Fall back to quicksave
      if (!saveData) {
        console.log('No autosave found, trying quicksave');
        saveData = await this.loadSaveFile(PersistenceManager.QUICKSAVE_KEY);
      }

      // Try to restore from backup
      if (!saveData) {
        console.log('No saves found, trying backup');
        const backup = await this.backupManager.findLastValidBackup();
        if (backup) {
          console.log('Restoring from backup');
          return backup.state;
        }
      }

      if (!saveData) {
        throw new Error('No save data found');
      }

      // Validate loaded state
      const validation = this.validateState(saveData.state);
      if (!validation.isValid) {
        console.warn('Loaded state has issues:', validation.errors);
        // Try to sanitize the state
        if (this.stateManager) {
          saveData.state = this.stateManager.sanitizeState(saveData.state);
        }
      }

      // Migrate if needed
      if (saveData.version !== PersistenceManager.SAVE_VERSION) {
        saveData.state = await this.migrateOldSave(saveData);
      }

      console.log(
        `Game loaded successfully (save from ${new Date(saveData.timestamp).toLocaleString()})`,
      );
      return saveData.state;
    } catch (error) {
      console.error('Load failed:', error);
      throw error;
    }
  }

  /**
   * Load a backup by ID
   */
  async loadBackup(backupId: string): Promise<GameState> {
    if (!this.isInitialized) {
      throw new Error('PersistenceManager not initialized');
    }

    return await this.backupManager.restoreFromBackup(backupId);
  }

  /**
   * Export save as JSON file
   */
  async exportSave(): Promise<SaveFile> {
    if (!this.isInitialized || !this.stateManager) {
      throw new Error('Cannot export - system not ready');
    }

    const state = this.stateManager.getState();

    const saveFile: SaveFile = {
      version: PersistenceManager.SAVE_VERSION,
      timestamp: Date.now(),
      state,
      checksum: this.saveManager.generateChecksum(state),
      metadata: {
        playTime: this.calculatePlayTime(state),
        saveCount: this.saveCount,
        platform: this.getPlatform(),
      },
    };

    return saveFile;
  }

  /**
   * Import save from JSON file
   */
  async importSave(file: SaveFile): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('PersistenceManager not initialized');
    }

    // Validate the save file
    const validation = this.validateSaveFile(file);
    if (!validation.isValid) {
      throw new Error('Invalid save file: ' + validation.errors.join(', '));
    }

    // Verify checksum
    const expectedChecksum = this.saveManager.generateChecksum(file.state);
    if (expectedChecksum !== file.checksum) {
      throw new Error('Save file checksum mismatch - file may be corrupted');
    }

    // Create backup of current state before importing
    if (this.stateManager) {
      const currentState = this.stateManager.getState();
      await this.backupManager.createBackup(currentState, 'manual', 'Before import');
    }

    // Migrate if needed
    if (file.version !== PersistenceManager.SAVE_VERSION) {
      file.state = await this.migrateOldSave(file);
    }

    // Save the imported state
    await this.saveManager.writeSave(PersistenceManager.MAIN_SAVE_KEY, file);

    console.log('Save file imported successfully');
  }

  /**
   * Validate a save file structure
   */
  validateSaveFile(file: SaveFile): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    // Check basic structure
    if (!file || typeof file !== 'object') {
      result.errors.push('Invalid save file format');
      result.isValid = false;
      return result;
    }

    if (!file.version) {
      result.errors.push('Missing version');
      result.isValid = false;
    }

    if (!file.timestamp || typeof file.timestamp !== 'number') {
      result.errors.push('Invalid timestamp');
      result.isValid = false;
    }

    if (!file.state) {
      result.errors.push('Missing game state');
      result.isValid = false;
    }

    if (!file.checksum) {
      result.errors.push('Missing checksum');
      result.isValid = false;
    }

    // Validate the state if present
    if (file.state) {
      const stateValidation = this.validateState(file.state);
      result.errors.push(...stateValidation.errors);
      result.warnings.push(...stateValidation.warnings);
      result.isValid = result.isValid && stateValidation.isValid;
    }

    return result;
  }

  /**
   * Validate game state
   */
  private validateState(state: GameState): ValidationResult {
    if (this.stateManager) {
      return this.stateManager.validateState(state);
    }

    // Basic validation if no state manager
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    if (!state.meta || !state.time || !state.inventory || !state.world || !state.settings) {
      result.errors.push('Missing required state properties');
      result.isValid = false;
    }

    return result;
  }

  /**
   * Get storage usage information
   */
  async getStorageUsage(): Promise<number> {
    const info = await this.saveManager.getDatabaseSize();
    return info.usage;
  }

  /**
   * Clear old saves to free up space
   */
  async clearOldSaves(): Promise<void> {
    // Get all saves
    const saves = await this.saveManager.getAllSaves();

    // Keep only the most recent saves
    const sortedSaves = saves.sort((a, b) => b.timestamp - a.timestamp);
    const toKeep = 5; // Keep 5 most recent saves

    for (let i = toKeep; i < sortedSaves.length; i++) {
      const save = sortedSaves[i];
      if (
        save &&
        save.key !== PersistenceManager.MAIN_SAVE_KEY &&
        save.key !== PersistenceManager.AUTOSAVE_KEY
      ) {
        await this.saveManager.deleteSave(save.key);
      }
    }

    console.log(`Cleared ${Math.max(0, sortedSaves.length - toKeep)} old saves`);
  }

  /**
   * Compress save data
   */
  compressSave(state: GameState): string {
    // Simple JSON stringification for now
    // Could implement actual compression in the future
    return JSON.stringify(state);
  }

  /**
   * Decompress save data
   */
  decompressSave(data: string): GameState {
    return JSON.parse(data);
  }

  /**
   * Migrate old save format to current version
   */
  async migrateOldSave(oldSave: any): Promise<GameState> {
    console.log(
      `Migrating save from version ${oldSave.version} to ${PersistenceManager.SAVE_VERSION}`,
    );

    // For now, just return the state as-is
    // Add migration logic here as the game evolves

    return oldSave.state;
  }

  /**
   * Get current save version
   */
  getCurrentSaveVersion(): string {
    return PersistenceManager.SAVE_VERSION;
  }

  /**
   * Check if save data exists
   */
  private async hasSaveData(): Promise<boolean> {
    try {
      const mainSave = await this.saveManager.readSave(PersistenceManager.MAIN_SAVE_KEY);
      const autoSave = await this.saveManager.readSave(PersistenceManager.AUTOSAVE_KEY);
      return !!(mainSave || autoSave);
    } catch {
      return false;
    }
  }

  /**
   * Load a save file by key
   */
  private async loadSaveFile(key: string): Promise<SaveFile | null> {
    try {
      const data = await this.saveManager.readSave(key);
      if (data && this.isValidSaveFile(data)) {
        return data as SaveFile;
      }
    } catch (error) {
      console.error(`Failed to load save ${key}:`, error);
    }
    return null;
  }

  /**
   * Check if data is a valid save file
   */
  private isValidSaveFile(data: any): boolean {
    return (
      data &&
      typeof data === 'object' &&
      'version' in data &&
      'timestamp' in data &&
      'state' in data &&
      'checksum' in data
    );
  }

  /**
   * Calculate total play time
   */
  private calculatePlayTime(state: GameState): number {
    if (state.meta && state.meta.createdAt) {
      return Date.now() - state.meta.createdAt;
    }
    return 0;
  }

  /**
   * Get platform identifier
   */
  private getPlatform(): string {
    if (typeof navigator !== 'undefined') {
      return navigator.platform || 'unknown';
    }
    return 'unknown';
  }

  /**
   * Handle storage quota exceeded
   */
  private async handleStorageQuotaExceeded(): Promise<void> {
    console.warn('Storage quota exceeded - attempting cleanup');

    // Clear old saves
    await this.clearOldSaves();

    // Clear old backups
    await this.backupManager.rotateBackups('auto', 5);
    await this.backupManager.rotateBackups('rolling', 2);

    // Try SaveManager's cleanup
    await this.saveManager.handleQuotaExceeded();
  }

  /**
   * Enable or disable autosave
   */
  setAutosaveEnabled(enabled: boolean): void {
    this.autosaveEnabled = enabled;
    console.log(`Autosave ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Schedule automatic backups
   */
  scheduleAutoBackups(getState: () => GameState): void {
    this.backupManager.scheduleAutoBackup(getState);
  }

  /**
   * Get backup information
   */
  async getBackupInfo() {
    return await this.backupManager.getBackupInfo();
  }

  /**
   * List all backups
   */
  async listBackups() {
    return await this.backupManager.listBackups();
  }

  /**
   * Create a manual backup
   */
  async createBackup(state: GameState, description?: string) {
    return await this.backupManager.createBackup(state, 'manual', description);
  }

  async shutdown(): Promise<void> {
    // Perform final autosave if state manager is available
    if (this.stateManager && this.autosaveEnabled) {
      try {
        await this.autosave(AutosaveReason.SHUTDOWN);
      } catch (error) {
        console.error('Final autosave failed:', error);
      }
    }

    // Shutdown subsystems
    await this.backupManager.shutdown();
    await this.saveManager.shutdown();

    this.isInitialized = false;
    console.log('PersistenceManager shutdown complete');
  }
}
