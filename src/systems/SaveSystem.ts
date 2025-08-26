/**
 * SaveSystem - Manages game state persistence and save operations
 * Handles localStorage operations, save rotation, import/export, and validation
 */

import { BaseSystem, type SystemInitOptions, type SystemError } from './BaseSystem';
import type { GameState, SaveState, SaveSnapshot } from '../models';

/**
 * Save system configuration
 */
export interface SaveSystemConfig {
  maxSaveSlots?: number; // Maximum number of backup saves to keep
  compressionEnabled?: boolean; // Whether to compress saves
  autoSaveEnabled?: boolean; // Whether auto-save is enabled
  savePrefix?: string; // Prefix for save keys in localStorage
  checksumAlgorithm?: 'simple' | 'crc32'; // Checksum algorithm to use
}

/**
 * Save validation result
 */
export interface SaveValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  needsMigration: boolean;
  fromVersion?: string;
  toVersion?: string;
}

/**
 * Import preview information
 */
export interface ImportPreview {
  version: string;
  timestamp: number;
  playerId: string;
  petName?: string;
  petSpecies?: string;
  petStage?: string;
  playTime: number;
  saveCount: number;
}

/**
 * Save metadata for listing saves
 */
export interface SaveMetadata {
  slot: number;
  timestamp: number;
  version: string;
  playerId: string;
  petName?: string;
  compressed: boolean;
  size: number; // Size in bytes
}

/**
 * SaveSystem class
 */
export class SaveSystem extends BaseSystem {
  private config: Required<SaveSystemConfig>;
  private currentSaveSlot: number = 0;
  private saveQueue: GameState[] = [];
  private isSaving: boolean = false;

  // Storage keys
  private readonly CURRENT_SAVE_KEY: string;
  private readonly BACKUP_PREFIX: string;
  private readonly METADATA_KEY: string;

  constructor(config?: SaveSystemConfig) {
    super('SaveSystem');

    // Set default configuration
    this.config = {
      maxSaveSlots: config?.maxSaveSlots ?? 3,
      compressionEnabled: config?.compressionEnabled ?? false,
      autoSaveEnabled: config?.autoSaveEnabled ?? true,
      savePrefix: config?.savePrefix ?? 'digitalpet',
      checksumAlgorithm: config?.checksumAlgorithm ?? 'simple',
    };

    // Initialize storage keys
    this.CURRENT_SAVE_KEY = `${this.config.savePrefix}_current`;
    this.BACKUP_PREFIX = `${this.config.savePrefix}_backup_`;
    this.METADATA_KEY = `${this.config.savePrefix}_metadata`;
  }

  /**
   * System initialization
   */
  protected async onInitialize(_options: SystemInitOptions): Promise<void> {
    // Check localStorage availability
    if (!this.isLocalStorageAvailable()) {
      throw new Error('localStorage is not available');
    }

    // Initialize metadata if not exists
    if (!this.getMetadata()) {
      this.initializeMetadata();
    }
  }

  /**
   * System shutdown
   */
  protected async onShutdown(): Promise<void> {
    // Flush any pending saves
    await this.flushSaveQueue();
  }

  /**
   * System reset
   */
  protected async onReset(): Promise<void> {
    // Clear save queue
    this.saveQueue = [];
    this.isSaving = false;
  }

  /**
   * System tick - handles auto-save
   */
  protected async onTick(_deltaTime: number, _gameState: GameState): Promise<void> {
    // Auto-save is triggered by GameEngine, not here
    // This is just for any cleanup or maintenance
    if (this.saveQueue.length > 0 && !this.isSaving) {
      await this.flushSaveQueue();
    }
  }

  /**
   * System update
   */
  protected async onUpdate(_gameState: GameState, _prevState?: GameState): Promise<void> {
    // No-op for SaveSystem
  }

  /**
   * Handle system errors
   */
  protected onError(error: SystemError): void {
    console.error(`[SaveSystem] Error:`, error);
    // Could implement error recovery strategies here
  }

  /**
   * Save the game state
   */
  public async save(state: GameState): Promise<void> {
    if (this.isSaving) {
      // Queue the save if already saving
      this.saveQueue.push(state);
      return;
    }

    this.isSaving = true;

    try {
      // Create save state
      const saveState: SaveState = {
        version: state.version,
        timestamp: Date.now(),
        checksum: this.generateChecksum(state),
        data: state,
      };

      // Serialize the save state
      const serialized = this.serialize(saveState);

      // Store in localStorage
      this.setStorageItem(this.CURRENT_SAVE_KEY, serialized);

      // Update metadata
      this.updateMetadata(saveState);

      // Rotate saves if needed
      await this.rotateSaves(saveState);

      // Update state's save data
      state.saveData.lastSaveTime = saveState.timestamp;
      state.saveData.saveCount++;
    } catch (error) {
      this.handleError(error as Error);
      throw new Error(`Failed to save game: ${(error as Error).message}`);
    } finally {
      this.isSaving = false;

      // Process any queued saves
      if (this.saveQueue.length > 0) {
        const nextSave = this.saveQueue.shift();
        if (nextSave) {
          await this.save(nextSave);
        }
      }
    }
  }

  /**
   * Load the game state
   */
  public async load(slot?: number): Promise<GameState | null> {
    try {
      const key = slot !== undefined ? `${this.BACKUP_PREFIX}${slot}` : this.CURRENT_SAVE_KEY;

      const serialized = this.getStorageItem(key);

      if (!serialized) {
        return null;
      }

      let saveState: SaveState;

      // Handle different formats for backup slots vs current save
      if (slot !== undefined) {
        // Backup slots store SaveSnapshot format
        try {
          const snapshot = JSON.parse(serialized) as SaveSnapshot;
          saveState = {
            version: snapshot.version,
            timestamp: snapshot.timestamp,
            checksum: snapshot.checksum,
            data: JSON.parse(snapshot.data),
          };
        } catch (error) {
          console.error(`Failed to parse backup slot ${slot}:`, error);
          return null;
        }
      } else {
        // Current save stores SaveState format
        try {
          saveState = this.deserialize(serialized);
        } catch (error) {
          console.error('Failed to parse current save:', error);
          // Try to recover from backup
          return await this.recoverFromBackup();
        }
      }

      // Validate the save
      const validation = await this.validateSave(saveState);

      if (!validation.valid) {
        console.error('Save validation failed:', validation.errors);

        // Try to recover from backup
        if (slot === undefined) {
          return await this.recoverFromBackup();
        }

        return null;
      }

      // Apply migrations if needed
      if (validation.needsMigration) {
        saveState.data = await this.migrateSave(
          saveState.data,
          validation.fromVersion!,
          validation.toVersion!,
        );
      }

      return saveState.data;
    } catch (error) {
      this.handleError(error as Error);

      // Try to recover from backup if loading current save failed
      if (slot === undefined) {
        return await this.recoverFromBackup();
      }

      return null;
    }
  }

  /**
   * Export save as JSON string
   */
  public async exportSave(): Promise<string> {
    try {
      const state = await this.load();

      if (!state) {
        throw new Error('No save data to export');
      }

      const exportData = {
        version: state.version,
        timestamp: Date.now(),
        checksum: this.generateChecksum(state),
        game: 'Digital Pet Game',
        data: state,
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      this.handleError(error as Error);
      throw new Error(`Failed to export save: ${(error as Error).message}`);
    }
  }

  /**
   * Import save from JSON string
   */
  public async importSave(data: string): Promise<boolean> {
    try {
      const importData = JSON.parse(data);

      // Validate import structure
      if (!importData.data || !importData.version || !importData.checksum) {
        throw new Error('Invalid import data structure');
      }

      // Verify checksum
      const calculatedChecksum = this.generateChecksum(importData.data);
      if (calculatedChecksum !== importData.checksum) {
        throw new Error('Import data checksum mismatch');
      }

      // Create save state
      const saveState: SaveState = {
        version: importData.version,
        timestamp: importData.timestamp || Date.now(),
        checksum: importData.checksum,
        data: importData.data,
      };

      // Validate the imported save
      const validation = await this.validateSave(saveState);

      if (!validation.valid) {
        console.error('Import validation failed:', validation.errors);
        return false;
      }

      // Apply migrations if needed
      if (validation.needsMigration) {
        saveState.data = await this.migrateSave(
          saveState.data,
          validation.fromVersion!,
          validation.toVersion!,
        );
      }

      // Save the imported data
      await this.save(saveState.data);

      return true;
    } catch (error) {
      this.handleError(error as Error);
      return false;
    }
  }

  /**
   * Get import preview without actually importing
   */
  public async getImportPreview(data: string): Promise<ImportPreview | null> {
    try {
      const importData = JSON.parse(data);

      if (!importData.data) {
        return null;
      }

      const gameState = importData.data as GameState;

      return {
        version: gameState.version,
        timestamp: gameState.timestamp,
        playerId: gameState.playerId,
        petName: gameState.pet?.name,
        petSpecies: gameState.pet?.species,
        petStage: gameState.pet?.stage,
        playTime: gameState.meta.statistics.totalPlayTime,
        saveCount: gameState.saveData.saveCount,
      };
    } catch (error) {
      this.handleError(error as Error);
      return null;
    }
  }

  /**
   * Rotate saves to maintain backup history
   */
  public async rotateSaves(currentSave?: SaveState): Promise<void> {
    try {
      // If we have a current save to add to backups
      if (currentSave) {
        // First get existing backups before adding new one
        const existingBackups = this.getBackupSaves();

        // Clean up old saves if we're at max capacity
        if (existingBackups.length >= this.config.maxSaveSlots) {
          const oldestSlot = this.findOldestBackupSlot(existingBackups);
          if (oldestSlot !== -1) {
            this.removeStorageItem(`${this.BACKUP_PREFIX}${oldestSlot}`);
          }
        }

        // Create a snapshot
        const snapshot: SaveSnapshot = {
          timestamp: currentSave.timestamp,
          version: currentSave.version,
          checksum: currentSave.checksum,
          compressed: this.config.compressionEnabled,
          data: JSON.stringify(currentSave.data),
        };

        // Add to backup slots
        const backupKey = `${this.BACKUP_PREFIX}${this.currentSaveSlot}`;
        this.setStorageItem(backupKey, JSON.stringify(snapshot));

        // Rotate slot counter
        this.currentSaveSlot = (this.currentSaveSlot + 1) % this.config.maxSaveSlots;
      }
    } catch (error) {
      this.handleError(error as Error);
      // Don't throw - rotation failure shouldn't break saving
    }
  }

  /**
   * Get all backup saves
   */
  public getBackupSaves(): SaveMetadata[] {
    const saves: SaveMetadata[] = [];

    for (let i = 0; i < this.config.maxSaveSlots; i++) {
      const key = `${this.BACKUP_PREFIX}${i}`;
      const data = this.getStorageItem(key);

      if (data) {
        try {
          const snapshot = JSON.parse(data) as SaveSnapshot;
          saves.push({
            slot: i,
            timestamp: snapshot.timestamp,
            version: snapshot.version,
            playerId: '', // Would need to parse to get this
            compressed: snapshot.compressed,
            size: data.length,
          });
        } catch {
          // Skip invalid backup
        }
      }
    }

    return saves.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Delete a save
   */
  public async deleteSave(slot?: number): Promise<void> {
    try {
      if (slot !== undefined) {
        // Delete specific backup
        this.removeStorageItem(`${this.BACKUP_PREFIX}${slot}`);
      } else {
        // Delete current save
        this.removeStorageItem(this.CURRENT_SAVE_KEY);
      }
    } catch (error) {
      this.handleError(error as Error);
      throw new Error(`Failed to delete save: ${(error as Error).message}`);
    }
  }

  /**
   * Clear all saves
   */
  public async clearAllSaves(): Promise<void> {
    try {
      // Remove current save
      this.removeStorageItem(this.CURRENT_SAVE_KEY);

      // Remove all backups
      for (let i = 0; i < this.config.maxSaveSlots; i++) {
        this.removeStorageItem(`${this.BACKUP_PREFIX}${i}`);
      }

      // Clear metadata
      this.removeStorageItem(this.METADATA_KEY);
      this.initializeMetadata();
    } catch (error) {
      this.handleError(error as Error);
      throw new Error(`Failed to clear saves: ${(error as Error).message}`);
    }
  }

  /**
   * Validate a save state
   */
  private async validateSave(saveState: SaveState): Promise<SaveValidationResult> {
    const result: SaveValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      needsMigration: false,
    };

    // Check version
    const currentVersion = '1.0.0'; // This should come from config
    if (saveState.version !== currentVersion) {
      result.needsMigration = true;
      result.fromVersion = saveState.version;
      result.toVersion = currentVersion;

      // Check if migration is supported
      if (!this.canMigrate(saveState.version, currentVersion)) {
        result.valid = false;
        result.errors.push(`Cannot migrate from version ${saveState.version} to ${currentVersion}`);
      }
    }

    // Verify checksum
    const calculatedChecksum = this.generateChecksum(saveState.data);
    if (calculatedChecksum !== saveState.checksum) {
      result.warnings.push('Checksum mismatch - save may be corrupted');
      // Don't invalidate for checksum mismatch, just warn
    }

    // Validate data structure
    if (!saveState.data) {
      result.valid = false;
      result.errors.push('Save data is missing');
    } else {
      // Check required fields
      if (!saveState.data.version) {
        result.errors.push('Version field is missing');
        result.valid = false;
      }
      if (!saveState.data.playerId) {
        result.errors.push('Player ID is missing');
        result.valid = false;
      }
      if (!saveState.data.inventory) {
        result.errors.push('Inventory data is missing');
        result.valid = false;
      }
      if (!saveState.data.world) {
        result.errors.push('World data is missing');
        result.valid = false;
      }
      if (!saveState.data.meta) {
        result.errors.push('Meta data is missing');
        result.valid = false;
      }
    }

    return result;
  }

  /**
   * Check if migration is possible between versions
   */
  private canMigrate(fromVersion: string, toVersion: string): boolean {
    // Simple version comparison for now
    // In a real implementation, this would check migration paths
    const fromParts = fromVersion.split('.').map(Number);
    const toParts = toVersion.split('.').map(Number);

    // Ensure we have valid version parts
    if (fromParts.length < 2 || toParts.length < 2) return false;

    const fromMajor = fromParts[0] ?? 0;
    const fromMinor = fromParts[1] ?? 0;
    const toMajor = toParts[0] ?? 0;
    const toMinor = toParts[1] ?? 0;

    // Can only migrate forward
    if (fromMajor > toMajor) return false;
    if (fromMajor === toMajor && fromMinor > toMinor) return false;

    // Major version changes need special handling
    if (Math.abs(fromMajor - toMajor) > 1) return false;

    return true;
  }

  /**
   * Migrate save data between versions
   */
  private async migrateSave(
    data: GameState,
    fromVersion: string,
    toVersion: string,
  ): Promise<GameState> {
    console.log(`Migrating save from ${fromVersion} to ${toVersion}`);

    // Clone the data to avoid mutations
    let migrated = JSON.parse(JSON.stringify(data)) as GameState;

    // Apply migrations based on version differences
    // This is where version-specific migrations would be implemented

    // Example migration logic:
    if (fromVersion === '0.9.0' && toVersion === '1.0.0') {
      // Add new fields that didn't exist in 0.9.0
      if (!migrated.collections) {
        migrated.collections = {
          eggs: [],
          species: {},
          memorials: [],
        };
      }
    }

    // Update version
    migrated.version = toVersion;

    return migrated;
  }

  /**
   * Recover from backup saves
   */
  private async recoverFromBackup(): Promise<GameState | null> {
    const backups = this.getBackupSaves();

    // Try each backup in order (newest first)
    for (const backup of backups) {
      try {
        const key = `${this.BACKUP_PREFIX}${backup.slot}`;
        const data = this.getStorageItem(key);

        if (data) {
          const snapshot = JSON.parse(data) as SaveSnapshot;
          const saveState: SaveState = {
            version: snapshot.version,
            timestamp: snapshot.timestamp,
            checksum: snapshot.checksum,
            data: JSON.parse(snapshot.data),
          };

          // Validate the recovered save
          const validation = await this.validateSave(saveState);
          if (validation.valid || validation.needsMigration) {
            console.log(`Recovered from backup slot ${backup.slot}`);

            // Apply migrations if needed
            if (validation.needsMigration) {
              saveState.data = await this.migrateSave(
                saveState.data,
                validation.fromVersion!,
                validation.toVersion!,
              );
            }

            return saveState.data;
          }
        }
      } catch (error) {
        console.error(`Failed to recover from backup ${backup.slot}:`, error);
        // Continue to next backup
      }
    }

    return null;
  }

  /**
   * Generate checksum for data validation
   */
  private generateChecksum(data: any): string {
    if (this.config.checksumAlgorithm === 'crc32') {
      return this.crc32(JSON.stringify(data));
    } else {
      // Simple checksum
      return this.simpleChecksum(JSON.stringify(data));
    }
  }

  /**
   * Simple checksum algorithm
   */
  private simpleChecksum(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * CRC32 checksum algorithm
   */
  private crc32(str: string): string {
    const table = this.getCRC32Table();
    let crc = 0 ^ -1;

    for (let i = 0; i < str.length; i++) {
      const tableIndex = (crc ^ str.charCodeAt(i)) & 0xff;
      const tableValue = table[tableIndex] ?? 0;
      crc = (crc >>> 8) ^ tableValue;
    }

    return ((crc ^ -1) >>> 0).toString(16);
  }

  /**
   * Get CRC32 lookup table
   */
  private getCRC32Table(): Uint32Array {
    const table = new Uint32Array(256);

    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[i] = c;
    }

    return table;
  }

  /**
   * Serialize save state
   */
  private serialize(saveState: SaveState): string {
    if (this.config.compressionEnabled) {
      // In a real implementation, we'd use a compression library
      // For now, just stringify
      return JSON.stringify(saveState);
    }
    return JSON.stringify(saveState);
  }

  /**
   * Deserialize save state
   */
  private deserialize(data: string): SaveState {
    if (this.config.compressionEnabled) {
      // In a real implementation, we'd decompress first
      return JSON.parse(data);
    }
    return JSON.parse(data);
  }

  /**
   * Check if localStorage is available
   */
  private isLocalStorageAvailable(): boolean {
    try {
      const test = '__localStorage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get item from localStorage with error handling
   */
  private getStorageItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error(`Failed to get item ${key}:`, error);
      return null;
    }
  }

  /**
   * Set item in localStorage with error handling
   */
  private setStorageItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        // Try to free up space
        this.handleStorageQuotaExceeded();
        // Retry once
        try {
          localStorage.setItem(key, value);
        } catch {
          throw new Error('Storage quota exceeded and cleanup failed');
        }
      } else {
        throw error;
      }
    }
  }

  /**
   * Remove item from localStorage
   */
  private removeStorageItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Failed to remove item ${key}:`, error);
    }
  }

  /**
   * Handle storage quota exceeded error
   */
  private handleStorageQuotaExceeded(): void {
    console.warn('Storage quota exceeded, attempting cleanup...');

    // Find and remove the oldest backup
    const backups = this.getBackupSaves();
    if (backups.length > 0) {
      const oldest = backups[backups.length - 1];
      if (oldest) {
        this.removeStorageItem(`${this.BACKUP_PREFIX}${oldest.slot}`);
        console.log(`Removed oldest backup from slot ${oldest.slot}`);
      }
    }
  }

  /**
   * Initialize metadata
   */
  private initializeMetadata(): void {
    const metadata = {
      version: '1.0.0',
      created: Date.now(),
      lastModified: Date.now(),
      saveCount: 0,
    };

    this.setStorageItem(this.METADATA_KEY, JSON.stringify(metadata));
  }

  /**
   * Get metadata
   */
  private getMetadata(): any {
    const data = this.getStorageItem(this.METADATA_KEY);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Update metadata
   */
  private updateMetadata(saveState: SaveState): void {
    const metadata = this.getMetadata() || this.initializeMetadata();

    metadata.lastModified = saveState.timestamp;
    metadata.saveCount++;
    metadata.lastVersion = saveState.version;

    this.setStorageItem(this.METADATA_KEY, JSON.stringify(metadata));
  }

  /**
   * Find the oldest backup slot
   */
  private findOldestBackupSlot(saves: SaveMetadata[]): number {
    if (saves.length === 0) return -1;

    let oldest = saves[0];
    if (!oldest) return -1;

    for (const save of saves) {
      if (oldest && save.timestamp < oldest.timestamp) {
        oldest = save;
      }
    }

    return oldest.slot;
  }

  /**
   * Flush the save queue
   */
  private async flushSaveQueue(): Promise<void> {
    while (this.saveQueue.length > 0) {
      const state = this.saveQueue.shift();
      if (state) {
        await this.save(state);
      }
    }
  }

  /**
   * Download save as file
   */
  public async downloadSaveAsFile(): Promise<void> {
    try {
      const saveData = await this.exportSave();
      const blob = new Blob([saveData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `digitalpet-save-${timestamp}.json`;

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      URL.revokeObjectURL(url);
    } catch (error) {
      this.handleError(error as Error);
      throw new Error(`Failed to download save: ${(error as Error).message}`);
    }
  }

  /**
   * Load save from file
   */
  public async loadSaveFromFile(file: File): Promise<boolean> {
    try {
      const text = await file.text();
      return await this.importSave(text);
    } catch (error) {
      this.handleError(error as Error);
      return false;
    }
  }
}

