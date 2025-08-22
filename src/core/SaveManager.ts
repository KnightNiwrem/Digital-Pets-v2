import type { GameState, GameSystem } from '../types';

/**
 * SaveManager handles low-level save operations using IndexedDB.
 * This is a pure system that returns results to GameEngine.
 */
export class SaveManager implements GameSystem {
  private static readonly DB_NAME = 'digital_pets_db';
  private static readonly DB_VERSION = 1;
  private static readonly STORE_NAME = 'saves';
  private static readonly META_STORE_NAME = 'save_metadata';

  private db: IDBDatabase | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Check if we're in a browser environment with IndexedDB
      if (typeof indexedDB === 'undefined') {
        console.warn('IndexedDB not available - SaveManager running in mock mode');
        this.isInitialized = true;
        return;
      }

      this.db = await this.openDatabase();
      this.isInitialized = true;
      console.log('SaveManager initialized with IndexedDB');
    } catch (error) {
      console.error('Failed to initialize SaveManager:', error);
      throw error;
    }
  }

  /**
   * Open or create the IndexedDB database
   */
  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(SaveManager.DB_NAME, SaveManager.DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB: ' + request.error));
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create saves store if it doesn't exist
        if (!db.objectStoreNames.contains(SaveManager.STORE_NAME)) {
          const saveStore = db.createObjectStore(SaveManager.STORE_NAME, { keyPath: 'key' });
          saveStore.createIndex('timestamp', 'timestamp', { unique: false });
          saveStore.createIndex('type', 'type', { unique: false });
        }

        // Create metadata store if it doesn't exist
        if (!db.objectStoreNames.contains(SaveManager.META_STORE_NAME)) {
          const metaStore = db.createObjectStore(SaveManager.META_STORE_NAME, { keyPath: 'key' });
          metaStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      request.onblocked = () => {
        console.warn('IndexedDB blocked - please close other tabs');
      };
    });
  }

  /**
   * Create a transaction for database operations
   */
  private createTransaction(
    storeNames: string | string[],
    mode: IDBTransactionMode = 'readonly'
  ): IDBTransaction {
    if (!this.db) {
      throw new Error('Database not initialized or IndexedDB not available');
    }

    const stores = Array.isArray(storeNames) ? storeNames : [storeNames];
    return this.db.transaction(stores, mode);
  }

  /**
   * Write save data to IndexedDB
   */
  async writeSave(key: string, data: any): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('SaveManager not initialized');
    }

    // If no database (test mode), just resolve
    if (!this.db) {
      console.log('SaveManager in mock mode - save skipped');
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.createTransaction(SaveManager.STORE_NAME, 'readwrite');
      const store = transaction.objectStore(SaveManager.STORE_NAME);

      const saveData = {
        key,
        data,
        timestamp: Date.now(),
        type: 'save',
        checksum: this.generateChecksum(data),
      };

      const request = store.put(saveData);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to write save: ' + request.error));
      };

      transaction.onerror = () => {
        reject(new Error('Transaction failed: ' + transaction.error));
      };
    });
  }

  /**
   * Read save data from IndexedDB
   */
  async readSave(key: string): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('SaveManager not initialized');
    }

    // If no database (test mode), return null
    if (!this.db) {
      console.log('SaveManager in mock mode - returning null');
      return null;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.createTransaction(SaveManager.STORE_NAME, 'readonly');
      const store = transaction.objectStore(SaveManager.STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          // Verify checksum
          if (this.verifyChecksum(result.data, result.checksum)) {
            resolve(result.data);
          } else {
            reject(new Error('Save data checksum mismatch - data may be corrupted'));
          }
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        reject(new Error('Failed to read save: ' + request.error));
      };
    });
  }

  /**
   * Delete save data from IndexedDB
   */
  async deleteSave(key: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('SaveManager not initialized');
    }

    // If no database (test mode), just resolve
    if (!this.db) {
      console.log('SaveManager in mock mode - delete skipped');
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.createTransaction(SaveManager.STORE_NAME, 'readwrite');
      const store = transaction.objectStore(SaveManager.STORE_NAME);
      const request = store.delete(key);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to delete save: ' + request.error));
      };
    });
  }

  /**
   * Get all saves from IndexedDB
   */
  async getAllSaves(): Promise<Array<{ key: string; data: any; timestamp: number }>> {
    if (!this.isInitialized) {
      throw new Error('SaveManager not initialized');
    }

    // If no database (test mode), return empty array
    if (!this.db) {
      console.log('SaveManager in mock mode - returning empty array');
      return [];
    }

    return new Promise((resolve, reject) => {
      const transaction = this.createTransaction(SaveManager.STORE_NAME, 'readonly');
      const store = transaction.objectStore(SaveManager.STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const saves = request.result.map(save => ({
          key: save.key,
          data: save.data,
          timestamp: save.timestamp,
        }));
        resolve(saves);
      };

      request.onerror = () => {
        reject(new Error('Failed to get all saves: ' + request.error));
      };
    });
  }

  /**
   * Batch write multiple saves
   */
  async batchWrite(saves: Array<{ key: string; data: any }>): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('SaveManager not initialized');
    }

    // If no database (test mode), just resolve
    if (!this.db) {
      console.log('SaveManager in mock mode - batch write skipped');
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.createTransaction(SaveManager.STORE_NAME, 'readwrite');
      const store = transaction.objectStore(SaveManager.STORE_NAME);

      let completed = 0;
      const total = saves.length;

      saves.forEach(save => {
        const saveData = {
          key: save.key,
          data: save.data,
          timestamp: Date.now(),
          type: 'save',
          checksum: this.generateChecksum(save.data),
        };

        const request = store.put(saveData);

        request.onsuccess = () => {
          completed++;
          if (completed === total) {
            resolve();
          }
        };

        request.onerror = () => {
          reject(new Error('Batch write failed: ' + request.error));
        };
      });

      transaction.onerror = () => {
        reject(new Error('Transaction failed: ' + transaction.error));
      };
    });
  }

  /**
   * Get database size information
   */
  async getDatabaseSize(): Promise<{ usage: number; quota: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        return {
          usage: estimate.usage || 0,
          quota: estimate.quota || 0,
        };
      } catch (error) {
        console.warn('Could not estimate storage:', error);
        return { usage: 0, quota: 0 };
      }
    }
    return { usage: 0, quota: 0 };
  }

  /**
   * Handle quota exceeded errors
   */
  async handleQuotaExceeded(): Promise<void> {
    console.warn('Storage quota exceeded - attempting cleanup');
    
    // Get all saves and delete oldest ones
    const saves = await this.getAllSaves();
    saves.sort((a, b) => a.timestamp - b.timestamp);

    // Delete oldest 20% of saves
    const toDelete = Math.floor(saves.length * 0.2);
    for (let i = 0; i < toDelete && i < saves.length; i++) {
      const save = saves[i];
      if (save) {
        await this.deleteSave(save.key);
      }
    }
  }

  /**
   * Clear all save data
   */
  async clearAllSaves(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('SaveManager not initialized');
    }

    // If no database (test mode), just resolve
    if (!this.db) {
      console.log('SaveManager in mock mode - clear skipped');
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.createTransaction(SaveManager.STORE_NAME, 'readwrite');
      const store = transaction.objectStore(SaveManager.STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to clear saves: ' + request.error));
      };
    });
  }

  /**
   * Generate checksum for data integrity
   */
  generateChecksum(data: any): string {
    const jsonString = JSON.stringify(data, Object.keys(data).sort());
    let hash = 0;

    for (let i = 0; i < jsonString.length; i++) {
      const char = jsonString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return hash.toString(36);
  }

  /**
   * Verify checksum matches data
   */
  verifyChecksum(data: any, checksum: string): boolean {
    return this.generateChecksum(data) === checksum;
  }

  /**
   * Upgrade database schema if needed
   */
  private async upgradeDatabase(oldVersion: number, newVersion: number): Promise<void> {
    console.log(`Upgrading database from version ${oldVersion} to ${newVersion}`);
    
    // Handle migrations based on version differences
    // This will be expanded as the game evolves
    
    if (oldVersion < 1) {
      // Initial schema is created in onupgradeneeded
    }
    
    // Future migrations will be added here
  }

  /**
   * Write metadata about saves
   */
  async writeMetadata(key: string, metadata: any): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('SaveManager not initialized');
    }

    // If no database (test mode), just resolve
    if (!this.db) {
      console.log('SaveManager in mock mode - metadata write skipped');
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.createTransaction(SaveManager.META_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(SaveManager.META_STORE_NAME);

      const metaData = {
        key,
        ...metadata,
        timestamp: Date.now(),
      };

      const request = store.put(metaData);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to write metadata: ' + request.error));
      };
    });
  }

  /**
   * Read metadata
   */
  async readMetadata(key: string): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('SaveManager not initialized');
    }

    // If no database (test mode), return null
    if (!this.db) {
      console.log('SaveManager in mock mode - returning null metadata');
      return null;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.createTransaction(SaveManager.META_STORE_NAME, 'readonly');
      const store = transaction.objectStore(SaveManager.META_STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new Error('Failed to read metadata: ' + request.error));
      };
    });
  }

  async shutdown(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.isInitialized = false;
    console.log('SaveManager shutdown complete');
  }
}