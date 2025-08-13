/**
 * State change operations and tracking for immutable state management
 */

/**
 * Types of state operations that can be performed
 */
export type StateOperation = 'SET' | 'INCREMENT' | 'DECREMENT' | 'PUSH' | 'REMOVE' | 'MERGE';

/**
 * Represents a single change to the game state
 */
export interface StateChange {
  /** Path to the property being changed (e.g., ['pets', '0', 'stats', 'hunger']) */
  path: string[];
  
  /** Type of operation being performed */
  operation: StateOperation;
  
  /** New value or delta for the operation */
  value: any;
  
  /** When this change was created */
  timestamp: number;
  
  /** System or source that created this change */
  source: string;
  
  /** Optional previous value for rollback purposes */
  previousValue?: any;
  
  /** Optional metadata about the change */
  metadata?: {
    reason?: string;
    triggeredBy?: string;
    batchId?: string;
  };
}

/**
 * Result of applying state changes
 */
export interface StateChangeResult {
  /** Whether all changes were applied successfully */
  success: boolean;
  
  /** Changes that were actually applied */
  changes: StateChange[];
  
  /** Any validation or application errors */
  error?: Error;
  
  /** New state after changes (if successful) */
  newState?: any;
  
  /** Performance metrics for the operation */
  metrics?: {
    duration: number;
    changesApplied: number;
    validationTime: number;
  };
}

/**
 * Validation result for state changes
 */
export interface ValidationResult {
  /** Whether the validation passed */
  valid: boolean;
  
  /** Validation error messages */
  errors: string[];
  
  /** Warnings that don't prevent application */
  warnings: string[];
  
  /** Which specific changes failed validation */
  failedChanges: number[];
}

/**
 * Configuration for state history tracking
 */
export interface StateHistoryConfig {
  /** Maximum number of states to keep in history */
  maxHistorySize: number;
  
  /** Whether to compress old states */
  compression: boolean;
  
  /** Interval for automatic history cleanup */
  cleanupInterval: number;
}

/**
 * State snapshot for history tracking
 */
export interface StateSnapshot {
  /** The state at this point in time */
  state: any;
  
  /** When this snapshot was taken */
  timestamp: number;
  
  /** Changes that led to this state */
  changes: StateChange[];
  
  /** Unique identifier for this snapshot */
  id: string;
  
  /** Optional label/description */
  label?: string;
}

/**
 * Batch of related state changes
 */
export interface StateChangeBatch {
  /** Unique identifier for this batch */
  id: string;
  
  /** All changes in this batch */
  changes: StateChange[];
  
  /** Source system that created this batch */
  source: string;
  
  /** When this batch was created */
  timestamp: number;
  
  /** Whether this batch should be atomic (all or nothing) */
  atomic: boolean;
  
  /** Optional description of what this batch does */
  description?: string;
}

/**
 * Helper functions for creating common state changes
 */
export interface StateChangeFactory {
  /** Set a value at a specific path */
  set(_path: string[], _value: any, _source: string): StateChange;
  
  /** Increment a numeric value */
  increment(_path: string[], _delta: number, _source: string): StateChange;
  
  /** Decrement a numeric value */
  decrement(_path: string[], _delta: number, _source: string): StateChange;
  
  /** Push an item to an array */
  push(_path: string[], _item: any, _source: string): StateChange;
  
  /** Remove an item from an array */
  remove(_path: string[], _predicate: (item: any) => boolean, _source: string): StateChange;
  
  /** Merge an object with an existing object */
  merge(_path: string[], _partial: any, _source: string): StateChange;
  
  /** Create a batch of changes */
  batch(_changes: StateChange[], _source: string, _atomic?: boolean): StateChangeBatch;
}

/**
 * State change listener function
 */
export type StateChangeListener = (_changes: StateChange[], _newState: any) => void;

/**
 * State rollback information
 */
export interface RollbackInfo {
  /** Changes that need to be undone */
  changes: StateChange[];
  
  /** State to roll back to */
  targetState: any;
  
  /** Reason for the rollback */
  reason: string;
  
  /** When the rollback was initiated */
  timestamp: number;
}