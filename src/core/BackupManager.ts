import type { GameState, GameSystem } from '../types';
import { SaveManager } from './SaveManager';

interface Backup {
  id: string;
  state: GameState;
  timestamp: number;
  checksum: string;
  type: 'auto' | 'manual' | 'rolling';
  description?: string;
}

/**
 * BackupManager manages automatic backups and recovery operations.
 * This is a pure system that works with SaveManager for persistence.
 */
export class BackupManager implements GameSystem {
  private static readonly BACKUP_PREFIX = 'backup_';
  private static readonly MAX_ROLLING_BACKUPS = 3;
  private static readonly MAX_AUTO_BACKUPS = 10;
  private static readonly AUTO_BACKUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

  private saveManager: SaveManager;
  private autoBackupTimer: number | null = null;
  private lastBackupTime = 0;
  private isInitialized = false;

  constructor(saveManager: SaveManager) {
    this.saveManager = saveManager;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Ensure SaveManager is initialized
    await this.saveManager.initialize();

    // Clean up old backups on startup
    await this.cleanupOldBackups();

    this.isInitialized = true;
    console.log('BackupManager initialized');
  }

  /**
   * Create a backup of the current game state
   */
  async createBackup(
    state: GameState,
    type: 'auto' | 'manual' | 'rolling' = 'manual',
    description?: string
  ): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('BackupManager not initialized');
    }

    const backupId = this.generateBackupId(type);
    const timestamp = Date.now();
    const checksum = this.saveManager.generateChecksum(state);

    const backup: Backup = {
      id: backupId,
      state,
      timestamp,
      checksum,
      type,
      ...(description !== undefined && { description }),
    };

    // Save the backup
    await this.saveManager.writeSave(backupId, backup);

    // Update metadata
    await this.saveManager.writeMetadata('last_backup', {
      id: backupId,
      timestamp,
      type,
    });

    this.lastBackupTime = timestamp;

    console.log(`Backup created: ${backupId} (${type})`);
    return backupId;
  }

  /**
   * Create a rolling backup (keeps only the last N backups)
   */
  async createRollingBackup(state: GameState): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('BackupManager not initialized');
    }

    // Create new rolling backup
    await this.createBackup(state, 'rolling', 'Rolling backup');

    // Rotate old rolling backups
    await this.rotateBackups('rolling', BackupManager.MAX_ROLLING_BACKUPS);
  }

  /**
   * Schedule automatic backups
   */
  scheduleAutoBackup(getState: () => GameState): void {
    if (this.autoBackupTimer !== null) {
      clearInterval(this.autoBackupTimer);
    }

    this.autoBackupTimer = setInterval(async () => {
      try {
        const state = getState();
        await this.createBackup(state, 'auto', 'Automatic backup');
        await this.rotateBackups('auto', BackupManager.MAX_AUTO_BACKUPS);
      } catch (error) {
        console.error('Auto backup failed:', error);
      }
    }, BackupManager.AUTO_BACKUP_INTERVAL) as any;

    console.log('Auto backup scheduled');
  }

  /**
   * Stop automatic backups
   */
  stopAutoBackup(): void {
    if (this.autoBackupTimer !== null) {
      clearInterval(this.autoBackupTimer);
      this.autoBackupTimer = null;
      console.log('Auto backup stopped');
    }
  }

  /**
   * List all available backups
   */
  async listBackups(): Promise<Backup[]> {
    if (!this.isInitialized) {
      throw new Error('BackupManager not initialized');
    }

    const allSaves = await this.saveManager.getAllSaves();
    const backups: Backup[] = [];

    for (const save of allSaves) {
      if (save.key.startsWith(BackupManager.BACKUP_PREFIX)) {
        try {
          const backup = save.data as Backup;
          if (this.isValidBackup(backup)) {
            backups.push(backup);
          }
        } catch (error) {
          console.warn(`Invalid backup ${save.key}:`, error);
        }
      }
    }

    // Sort by timestamp, newest first
    backups.sort((a, b) => b.timestamp - a.timestamp);
    return backups;
  }

  /**
   * Get a specific backup
   */
  async getBackup(backupId: string): Promise<Backup | null> {
    if (!this.isInitialized) {
      throw new Error('BackupManager not initialized');
    }

    try {
      const backup = await this.saveManager.readSave(backupId);
      if (backup && this.isValidBackup(backup)) {
        return backup as Backup;
      }
    } catch (error) {
      console.error(`Failed to get backup ${backupId}:`, error);
    }

    return null;
  }

  /**
   * Delete a specific backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('BackupManager not initialized');
    }

    await this.saveManager.deleteSave(backupId);
    console.log(`Backup deleted: ${backupId}`);
  }

  /**
   * Rotate backups to keep only the specified number
   */
  async rotateBackups(type: 'auto' | 'manual' | 'rolling', maxBackups: number): Promise<void> {
    const backups = await this.listBackups();
    const typeBackups = backups.filter(b => b.type === type);

    if (typeBackups.length > maxBackups) {
      // Sort by timestamp, oldest first
      typeBackups.sort((a, b) => a.timestamp - b.timestamp);

      // Delete excess backups
      const toDelete = typeBackups.length - maxBackups;
      for (let i = 0; i < toDelete; i++) {
        const backup = typeBackups[i];
        if (backup) {
          await this.deleteBackup(backup.id);
        }
      }

      console.log(`Rotated ${toDelete} ${type} backups`);
    }
  }

  /**
   * Get the oldest backup
   */
  async getOldestBackup(): Promise<Backup | null> {
    const backups = await this.listBackups();
    if (backups.length === 0) {
      return null;
    }

    // Sort by timestamp, oldest first
    backups.sort((a, b) => a.timestamp - b.timestamp);
    return backups[0] || null;
  }

  /**
   * Get the newest backup
   */
  async getNewestBackup(): Promise<Backup | null> {
    const backups = await this.listBackups();
    if (backups.length === 0) {
      return null;
    }

    // Sort by timestamp, newest first
    backups.sort((a, b) => b.timestamp - a.timestamp);
    return backups[0] || null;
  }

  /**
   * Restore game state from a backup
   */
  async restoreFromBackup(backupId: string): Promise<GameState> {
    if (!this.isInitialized) {
      throw new Error('BackupManager not initialized');
    }

    const backup = await this.getBackup(backupId);
    if (!backup) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    // Verify checksum
    const expectedChecksum = this.saveManager.generateChecksum(backup.state);
    if (expectedChecksum !== backup.checksum) {
      throw new Error('Backup checksum mismatch - data may be corrupted');
    }

    console.log(`Restored from backup: ${backupId}`);
    return backup.state;
  }

  /**
   * Find the last valid backup
   */
  async findLastValidBackup(): Promise<Backup | null> {
    const backups = await this.listBackups();

    for (const backup of backups) {
      if (this.validateBackup(backup)) {
        return backup;
      }
    }

    return null;
  }

  /**
   * Validate a backup
   */
  validateBackup(backup: Backup): boolean {
    try {
      // Check structure
      if (!backup.id || !backup.state || !backup.timestamp || !backup.checksum) {
        return false;
      }

      // Verify checksum
      const expectedChecksum = this.saveManager.generateChecksum(backup.state);
      if (expectedChecksum !== backup.checksum) {
        console.warn(`Backup ${backup.id} has invalid checksum`);
        return false;
      }

      // Check state structure
      if (!backup.state.meta || !backup.state.time || !backup.state.inventory) {
        return false;
      }

      return true;
    } catch (error) {
      console.error(`Backup validation failed for ${backup.id}:`, error);
      return false;
    }
  }

  /**
   * Attempt to repair a corrupted backup
   */
  repairCorruptedBackup(backup: Backup): Backup | null {
    try {
      // Create a new backup with repaired data
      const repaired: Backup = {
        ...backup,
        state: this.repairState(backup.state),
        checksum: '', // Will be recalculated
      };

      // Recalculate checksum
      repaired.checksum = this.saveManager.generateChecksum(repaired.state);

      if (this.validateBackup(repaired)) {
        console.log(`Backup ${backup.id} repaired successfully`);
        return repaired;
      }
    } catch (error) {
      console.error(`Failed to repair backup ${backup.id}:`, error);
    }

    return null;
  }

  /**
   * Attempt to repair corrupted state
   */
  private repairState(state: any): GameState {
    // Try to salvage what we can from the corrupted state
    const now = Date.now();

    const repairedState: GameState = {
      meta: state?.meta || {
        version: '1.0.0',
        createdAt: now,
        lastSaveTime: now,
        playerId: `player_${now}_recovered`,
      },
      pet: state?.pet || null,
      world: state?.world || {
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
      inventory: state?.inventory || {
        items: {},
        coins: 100,
        eggs: [],
        maxSlots: 50,
      },
      settings: state?.settings || {
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
      time: state?.time || {
        lastTickTime: now,
        tickCount: 0,
        offlineTime: 0,
        scheduledEvents: [],
      },
    };

    return repairedState;
  }

  /**
   * Clean up old backups beyond retention limits
   */
  private async cleanupOldBackups(): Promise<void> {
    try {
      // Clean up excess rolling backups
      await this.rotateBackups('rolling', BackupManager.MAX_ROLLING_BACKUPS);

      // Clean up excess auto backups
      await this.rotateBackups('auto', BackupManager.MAX_AUTO_BACKUPS);

      // Remove backups older than 30 days for manual backups
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const backups = await this.listBackups();
      
      for (const backup of backups) {
        if (backup.type === 'manual' && backup.timestamp < thirtyDaysAgo) {
          await this.deleteBackup(backup.id);
          console.log(`Deleted old manual backup: ${backup.id}`);
        }
      }
    } catch (error) {
      console.error('Backup cleanup failed:', error);
    }
  }

  /**
   * Generate a unique backup ID
   */
  private generateBackupId(type: 'auto' | 'manual' | 'rolling'): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${BackupManager.BACKUP_PREFIX}${type}_${timestamp}_${random}`;
  }

  /**
   * Check if data is a valid backup
   */
  private isValidBackup(data: any): boolean {
    return (
      data &&
      typeof data === 'object' &&
      'id' in data &&
      'state' in data &&
      'timestamp' in data &&
      'checksum' in data &&
      'type' in data
    );
  }

  /**
   * Get information about backup storage
   */
  async getBackupInfo(): Promise<{
    totalBackups: number;
    autoBackups: number;
    manualBackups: number;
    rollingBackups: number;
    oldestBackup: Date | null;
    newestBackup: Date | null;
    totalSize: number;
  }> {
    const backups = await this.listBackups();
    const oldest = await this.getOldestBackup();
    const newest = await this.getNewestBackup();

    const info = {
      totalBackups: backups.length,
      autoBackups: backups.filter(b => b.type === 'auto').length,
      manualBackups: backups.filter(b => b.type === 'manual').length,
      rollingBackups: backups.filter(b => b.type === 'rolling').length,
      oldestBackup: oldest ? new Date(oldest.timestamp) : null,
      newestBackup: newest ? new Date(newest.timestamp) : null,
      totalSize: 0, // Will be calculated from storage estimate
    };

    // Get storage estimate
    const storageInfo = await this.saveManager.getDatabaseSize();
    info.totalSize = storageInfo.usage;

    return info;
  }

  async shutdown(): Promise<void> {
    this.stopAutoBackup();
    this.isInitialized = false;
    console.log('BackupManager shutdown complete');
  }
}