/**
 * UISystem - Bridge between UI components and game engine via GameUpdates
 * Handles user interactions, state rendering, and UI notifications
 *
 * IMPORTANT: Implements pessimistic saving approach where state updates
 * are only rendered after successful saves through SaveSystem
 */

import { BaseSystem, type SystemInitOptions, type SystemError } from './BaseSystem';
import type { GameUpdateWriter } from '../engine/GameUpdatesQueue';
import type { GameState, GameUpdate } from '../models';
import { UPDATE_TYPES } from '../models/constants';

/**
 * UI action types that can be performed by the user
 */
export const UI_ACTIONS = {
  // Pet care actions
  FEED_PET: 'FEED_PET',
  GIVE_DRINK: 'GIVE_DRINK',
  PLAY_WITH_PET: 'PLAY_WITH_PET',
  CLEAN_POOP: 'CLEAN_POOP',
  PET_SLEEP: 'PET_SLEEP',
  WAKE_PET: 'WAKE_PET',

  // Inventory actions
  USE_ITEM: 'USE_ITEM',
  DISCARD_ITEM: 'DISCARD_ITEM',
  SORT_INVENTORY: 'SORT_INVENTORY',

  // Location & travel actions
  TRAVEL_TO: 'TRAVEL_TO',
  CANCEL_TRAVEL: 'CANCEL_TRAVEL',
  ENTER_LOCATION: 'ENTER_LOCATION',

  // Activity actions
  START_ACTIVITY: 'START_ACTIVITY',
  CANCEL_ACTIVITY: 'CANCEL_ACTIVITY',

  // Battle actions
  BATTLE_MOVE: 'BATTLE_MOVE',
  USE_BATTLE_ITEM: 'USE_BATTLE_ITEM',
  FLEE_BATTLE: 'FLEE_BATTLE',

  // Shop actions
  PURCHASE_ITEM: 'PURCHASE_ITEM',
  SELL_ITEM: 'SELL_ITEM',

  // Egg actions
  START_INCUBATION: 'START_INCUBATION',
  HATCH_EGG: 'HATCH_EGG',
  SELECT_STARTER: 'SELECT_STARTER',

  // Training actions
  START_TRAINING: 'START_TRAINING',
  CANCEL_TRAINING: 'CANCEL_TRAINING',

  // Event actions
  JOIN_EVENT: 'JOIN_EVENT',
  LEAVE_EVENT: 'LEAVE_EVENT',

  // System actions
  SAVE_GAME: 'SAVE_GAME',
  EXPORT_SAVE: 'EXPORT_SAVE',
  IMPORT_SAVE: 'IMPORT_SAVE',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
} as const;

export type UIActionType = (typeof UI_ACTIONS)[keyof typeof UI_ACTIONS];

/**
 * UI action payload
 */
export interface UIAction {
  action: UIActionType;
  data?: any;
  timestamp?: number;
}

/**
 * UI notification types
 */
export const UI_NOTIFICATIONS = {
  LOW_CARE_VALUE: 'LOW_CARE_VALUE',
  HIGH_POOP_COUNT: 'HIGH_POOP_COUNT',
  PET_SICK: 'PET_SICK',
  PET_INJURED: 'PET_INJURED',
  ACTIVITY_COMPLETE: 'ACTIVITY_COMPLETE',
  TRAVEL_COMPLETE: 'TRAVEL_COMPLETE',
  BATTLE_START: 'BATTLE_START',
  BATTLE_END: 'BATTLE_END',
  EGG_READY: 'EGG_READY',
  EVENT_STARTING: 'EVENT_STARTING',
  EVENT_ENDING: 'EVENT_ENDING',
  SAVE_SUCCESS: 'SAVE_SUCCESS',
  SAVE_FAILURE: 'SAVE_FAILURE',
  ERROR: 'ERROR',
} as const;

export type UINotificationType = (typeof UI_NOTIFICATIONS)[keyof typeof UI_NOTIFICATIONS];

/**
 * UI notification
 */
export interface UINotification {
  type: UINotificationType;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  timestamp: number;
  data?: any;
}

/**
 * UI render callback
 */
export type UIRenderCallback = (state: GameState) => void;

/**
 * UI notification callback
 */
export type UINotificationCallback = (notification: UINotification) => void;

/**
 * UI modal types
 */
export const UI_MODALS = {
  CONFIRM_ACTION: 'CONFIRM_ACTION',
  ITEM_SELECTION: 'ITEM_SELECTION',
  BATTLE_MOVE_SELECTION: 'BATTLE_MOVE_SELECTION',
  SHOP_INTERFACE: 'SHOP_INTERFACE',
  STARTER_SELECTION: 'STARTER_SELECTION',
  SETTINGS: 'SETTINGS',
  SAVE_MANAGEMENT: 'SAVE_MANAGEMENT',
  EVENT_INFO: 'EVENT_INFO',
  TUTORIAL: 'TUTORIAL',
} as const;

export type UIModalType = (typeof UI_MODALS)[keyof typeof UI_MODALS];

/**
 * UI modal data
 */
export interface UIModal {
  type: UIModalType;
  title: string;
  data: any;
  onConfirm?: (result: any) => void;
  onCancel?: () => void;
}

/**
 * UI modal callback
 */
export type UIModalCallback = (modal: UIModal | undefined) => void;

/**
 * UI system configuration
 */
export interface UISystemConfig {
  enableNotifications?: boolean;
  enableSoundEffects?: boolean;
  enableAnimations?: boolean;
  enableAccessibility?: boolean;
  debugMode?: boolean;
}

/**
 * UISystem class - manages all UI interactions and state rendering
 */
export class UISystem extends BaseSystem {
  private config: Required<UISystemConfig>;
  private renderCallback: UIRenderCallback | undefined = undefined;
  private notificationCallback: UINotificationCallback | undefined = undefined;
  private modalCallback: UIModalCallback | undefined = undefined;
  private currentModal: UIModal | undefined = undefined;
  private notificationQueue: UINotification[] = [];
  private lastRenderedState: GameState | undefined = undefined;
  private pendingActions: UIAction[] = [];
  private isProcessingAction: boolean = false;

  constructor(gameUpdateWriter: GameUpdateWriter, config?: UISystemConfig) {
    super('UISystem', gameUpdateWriter);

    this.config = {
      enableNotifications: config?.enableNotifications ?? true,
      enableSoundEffects: config?.enableSoundEffects ?? true,
      enableAnimations: config?.enableAnimations ?? true,
      enableAccessibility: config?.enableAccessibility ?? false,
      debugMode: config?.debugMode ?? false,
    };
  }

  /**
   * System initialization
   */
  protected async onInitialize(_options: SystemInitOptions): Promise<void> {
    if (this.config.debugMode) {
      console.log('[UISystem] Initializing...');
    }

    // Initialize any UI-specific resources
    this.notificationQueue = [];
    this.pendingActions = [];
    this.isProcessingAction = false;
  }

  /**
   * System shutdown
   */
  protected async onShutdown(): Promise<void> {
    // Clear all callbacks
    this.renderCallback = undefined;
    this.notificationCallback = undefined;
    this.modalCallback = undefined;

    // Clear queues
    this.notificationQueue = [];
    this.pendingActions = [];

    // Clear modal
    this.currentModal = undefined;
  }

  /**
   * System reset
   */
  protected async onReset(): Promise<void> {
    this.notificationQueue = [];
    this.pendingActions = [];
    this.currentModal = undefined;
    this.lastRenderedState = undefined;
    this.isProcessingAction = false;
  }

  /**
   * System tick
   */
  protected async onTick(_deltaTime: number, _gameState: GameState): Promise<void> {
    // Process any pending notifications
    this.processNotificationQueue();
  }

  /**
   * System update
   */
  protected async onUpdate(_gameState: GameState, _prevState?: GameState): Promise<void> {
    // UISystem doesn't directly handle state updates
    // It receives state through the render method
  }

  /**
   * Handle system errors
   */
  protected onError(error: SystemError): void {
    console.error(`[UISystem] Error:`, error);

    // Show error notification to user
    this.showNotification({
      type: UI_NOTIFICATIONS.ERROR,
      title: 'System Error',
      message: error.error.message || 'An unexpected error occurred',
      severity: 'error',
      timestamp: Date.now(),
    });
  }

  /**
   * Register render callback
   * Called by UI layer to register state rendering function
   */
  public registerRenderCallback(callback: UIRenderCallback): void {
    this.renderCallback = callback;
  }

  /**
   * Register notification callback
   * Called by UI layer to register notification handler
   */
  public registerNotificationCallback(callback: UINotificationCallback): void {
    this.notificationCallback = callback;
  }

  /**
   * Register modal callback
   * Called by UI layer to register modal handler
   */
  public registerModalCallback(callback: UIModalCallback): void {
    this.modalCallback = callback;
  }

  /**
   * Render game state to UI
   * This is called by GameEngine AFTER successful save (pessimistic saving)
   * @param state The game state to render
   * @param forceRender Force render even if state hasn't changed
   */
  public renderState(state: GameState, forceRender: boolean = false): void {
    // Check if state has actually changed or force render is requested
    if (!forceRender && this.lastRenderedState) {
      // Simple timestamp check for now
      // In production, would do deeper comparison
      if (state.timestamp === this.lastRenderedState.timestamp) {
        return; // No changes to render
      }
    }

    // Store the rendered state
    this.lastRenderedState = { ...state };

    // Call render callback if registered
    if (this.renderCallback) {
      try {
        this.renderCallback(state);

        if (this.config.debugMode) {
          console.log('[UISystem] State rendered successfully');
        }
      } catch (error) {
        console.error('[UISystem] Render error:', error);
        this.handleError(error as Error);
      }
    }

    // Check for conditions that need notifications
    this.checkNotificationTriggers(state);
  }

  /**
   * Handle user action
   * Translates UI actions into game updates
   */
  public handleUserAction(action: UIAction): void {
    if (this.isProcessingAction) {
      // Queue the action if already processing
      this.pendingActions.push(action);
      return;
    }

    this.isProcessingAction = true;

    try {
      // Validate the action
      if (!this.validateAction(action)) {
        throw new Error(`Invalid action: ${action.action}`);
      }

      // Add timestamp if not provided
      if (!action.timestamp) {
        action.timestamp = Date.now();
      }

      // Translate to game update and queue it
      const update = this.translateActionToUpdate(action);

      if (update && this.gameUpdateWriter) {
        this.gameUpdateWriter.enqueue(update);

        if (this.config.debugMode) {
          console.log('[UISystem] Queued user action:', action.action);
        }
      }
    } catch (error) {
      console.error('[UISystem] Failed to handle user action:', error);
      this.handleError(error as Error);
    } finally {
      this.isProcessingAction = false;

      // Process next pending action if any
      if (this.pendingActions.length > 0) {
        const nextAction = this.pendingActions.shift();
        if (nextAction) {
          this.handleUserAction(nextAction);
        }
      }
    }
  }

  /**
   * Show modal
   */
  public showModal(modal: UIModal): void {
    this.currentModal = modal;

    if (this.modalCallback) {
      try {
        this.modalCallback(modal);
      } catch (error) {
        console.error('[UISystem] Modal error:', error);
        this.handleError(error as Error);
      }
    }
  }

  /**
   * Hide modal
   */
  public hideModal(): void {
    this.currentModal = undefined;

    if (this.modalCallback) {
      try {
        this.modalCallback(undefined);
      } catch (error) {
        console.error('[UISystem] Modal error:', error);
        this.handleError(error as Error);
      }
    }
  }

  /**
   * Show notification
   */
  public showNotification(notification: UINotification): void {
    if (!this.config.enableNotifications) {
      return;
    }

    // Add to queue
    this.notificationQueue.push(notification);

    // Process immediately if callback is available
    if (this.notificationCallback) {
      this.processNotificationQueue();
    }
  }

  /**
   * Get current modal
   */
  public getCurrentModal(): UIModal | undefined {
    return this.currentModal;
  }

  /**
   * Get last rendered state
   */
  public getLastRenderedState(): GameState | undefined {
    return this.lastRenderedState;
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<UISystemConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };

    // Apply accessibility settings if changed
    if (config.enableAccessibility !== undefined) {
      this.applyAccessibilitySettings(config.enableAccessibility);
    }
  }

  /**
   * Validate user action
   */
  private validateAction(action: UIAction): boolean {
    // Check if action type is valid
    if (!Object.values(UI_ACTIONS).includes(action.action)) {
      return false;
    }

    // Additional validation based on action type
    switch (action.action) {
      case UI_ACTIONS.USE_ITEM:
      case UI_ACTIONS.DISCARD_ITEM:
        return action.data?.itemId !== undefined;

      case UI_ACTIONS.TRAVEL_TO:
        return action.data?.locationId !== undefined;

      case UI_ACTIONS.START_ACTIVITY:
        return action.data?.activityType !== undefined;

      case UI_ACTIONS.BATTLE_MOVE:
        return action.data?.moveId !== undefined;

      case UI_ACTIONS.PURCHASE_ITEM:
      case UI_ACTIONS.SELL_ITEM:
        return action.data?.itemId !== undefined && action.data?.quantity > 0;

      case UI_ACTIONS.SELECT_STARTER:
        return action.data?.species !== undefined;

      case UI_ACTIONS.START_TRAINING:
        return action.data?.stat !== undefined;

      default:
        return true;
    }
  }

  /**
   * Translate UI action to game update
   */
  private translateActionToUpdate(
    action: UIAction,
  ): Omit<GameUpdate, 'id' | 'timestamp'> | undefined {
    const baseUpdate = {
      type: UPDATE_TYPES.USER_ACTION,
      payload: {
        action: action.action,
        data: action.data,
      },
    };

    // Map specific actions to appropriate update types if needed
    switch (action.action) {
      case UI_ACTIONS.BATTLE_MOVE:
      case UI_ACTIONS.USE_BATTLE_ITEM:
      case UI_ACTIONS.FLEE_BATTLE:
        return {
          ...baseUpdate,
          type: UPDATE_TYPES.BATTLE_ACTION,
        };

      case UI_ACTIONS.JOIN_EVENT:
      case UI_ACTIONS.LEAVE_EVENT:
        return {
          ...baseUpdate,
          type: UPDATE_TYPES.EVENT_TRIGGER,
        };

      case UI_ACTIONS.SAVE_GAME:
      case UI_ACTIONS.EXPORT_SAVE:
      case UI_ACTIONS.IMPORT_SAVE:
        return {
          ...baseUpdate,
          type: UPDATE_TYPES.STATE_TRANSITION,
          payload: {
            action: action.action,
            data: {
              ...action.data,
              operation: 'save_operation',
            },
          },
        };

      default:
        return baseUpdate;
    }
  }

  /**
   * Check for notification triggers based on game state
   */
  private checkNotificationTriggers(state: GameState): void {
    if (!state.pet || !this.config.enableNotifications) {
      return;
    }

    // Check care values
    const careValues = state.pet.careValues || { satiety: 100, hydration: 100, happiness: 100 };

    if (careValues.satiety < 30) {
      this.showNotification({
        type: UI_NOTIFICATIONS.LOW_CARE_VALUE,
        title: 'Pet is Hungry!',
        message: `${state.pet.name || 'Your pet'} needs food!`,
        severity: 'warning',
        timestamp: Date.now(),
        data: { careType: 'satiety', value: careValues.satiety },
      });
    }

    if (careValues.hydration < 30) {
      this.showNotification({
        type: UI_NOTIFICATIONS.LOW_CARE_VALUE,
        title: 'Pet is Thirsty!',
        message: `${state.pet.name || 'Your pet'} needs water!`,
        severity: 'warning',
        timestamp: Date.now(),
        data: { careType: 'hydration', value: careValues.hydration },
      });
    }

    if (careValues.happiness < 30) {
      this.showNotification({
        type: UI_NOTIFICATIONS.LOW_CARE_VALUE,
        title: 'Pet is Sad!',
        message: `${state.pet.name || 'Your pet'} needs attention!`,
        severity: 'warning',
        timestamp: Date.now(),
        data: { careType: 'happiness', value: careValues.happiness },
      });
    }

    // Check poop count
    if (state.pet.poopCount > 3) {
      this.showNotification({
        type: UI_NOTIFICATIONS.HIGH_POOP_COUNT,
        title: 'Clean Up Needed!',
        message: 'The area needs cleaning!',
        severity: 'warning',
        timestamp: Date.now(),
        data: { poopCount: state.pet.poopCount },
      });
    }

    // Check for sickness
    if (state.pet.sicknesses && state.pet.sicknesses.length > 0) {
      this.showNotification({
        type: UI_NOTIFICATIONS.PET_SICK,
        title: 'Pet is Sick!',
        message: `${state.pet.name || 'Your pet'} needs medicine!`,
        severity: 'warning',
        timestamp: Date.now(),
        data: { sicknesses: state.pet.sicknesses },
      });
    }

    // Check for injuries
    if (state.pet.injuries && state.pet.injuries.length > 0) {
      this.showNotification({
        type: UI_NOTIFICATIONS.PET_INJURED,
        title: 'Pet is Injured!',
        message: `${state.pet.name || 'Your pet'} needs treatment!`,
        severity: 'warning',
        timestamp: Date.now(),
        data: { injuries: state.pet.injuries },
      });
    }
  }

  /**
   * Process notification queue
   */
  private processNotificationQueue(): void {
    if (!this.notificationCallback || this.notificationQueue.length === 0) {
      return;
    }

    // Process notifications in batches to avoid overwhelming the UI
    const batchSize = 3;
    const batch = this.notificationQueue.splice(0, batchSize);

    for (const notification of batch) {
      try {
        this.notificationCallback(notification);
      } catch (error) {
        console.error('[UISystem] Notification callback error:', error);
      }
    }
  }

  /**
   * Apply accessibility settings
   */
  private applyAccessibilitySettings(enabled: boolean): void {
    if (enabled) {
      // Enable accessibility features
      console.log('[UISystem] Accessibility features enabled');

      // This would typically:
      // - Enable screen reader announcements
      // - Increase contrast
      // - Enable keyboard navigation hints
      // - Add ARIA labels
      // - Enable focus indicators
    } else {
      console.log('[UISystem] Accessibility features disabled');
    }
  }

  /**
   * Handle input validation error
   */
  public handleInputError(field: string, error: string): void {
    this.showNotification({
      type: UI_NOTIFICATIONS.ERROR,
      title: 'Input Error',
      message: `${field}: ${error}`,
      severity: 'error',
      timestamp: Date.now(),
      data: { field, error },
    });
  }

  /**
   * Get action history for debugging
   */
  public getActionHistory(): UIAction[] {
    return [...this.pendingActions];
  }

  /**
   * Clear action queue
   */
  public clearActionQueue(): void {
    this.pendingActions = [];
  }
}
