# Digital Pet Game Architecture

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Components](#core-components)
3. [Component Details](#component-details)
4. [Data Flow and Interactions](#data-flow-and-interactions)
5. [Implementation Notes](#implementation-notes)

## Architecture Overview

The Digital Pet game is built around a central GameEngine that acts as the ultimate orchestrator for all game systems. The architecture follows a pure system design pattern where Systems are isolated entities that cannot communicate directly with each other. All communication flows through the GameEngine using a sequential event processing model, ensuring deterministic behavior and eliminating race conditions.

### Key Architectural Principles

1. **GameEngine as Central Orchestrator**: All control flow and system coordination goes through GameEngine
2. **Pure System Design**: Systems are stateless transformers that only own data from their domain
3. **Sequential Event Processing**: Events are processed one at a time in order, preventing race conditions
4. **Write-Only Event Interface**: Systems that need to emit events receive a write-only interface from GameEngine
5. **State Injection**: GameEngine provides state or partial state to systems when invoking them
6. **No Direct System Communication**: Systems cannot reference or call each other directly

### High-Level Architecture Diagram

```mermaid
graph TB
    subgraph Core
        GE[GameEngine<br/>Central Orchestrator]
        EM[EventManager<br/>Event Queue]
        SM[StateManager<br/>State Store]
        TM[TimeManager<br/>Time System]
    end

    subgraph Pet Systems
        PS[PetSystem]
        CS[CareSystem]
        GS[GrowthSystem]
        SS[StatusSystem]
    end

    subgraph Activity Systems
        AS[ActivitySystem]
        TS[TravelSystem]
        TRS[TrainingSystem]
        BS[BattleSystem]
    end

    subgraph World Systems
        LS[LocationSystem]
        ES[EventSystem]
        IS[ItemSystem]
        SH[ShopSystem]
    end

    subgraph UI Systems
        UI[UIManager]
        HUD[HUDController]
        NS[NotificationSystem]
        AC[AccessibilityController]
    end

    subgraph Persistence
        PM[PersistenceManager]
        SM2[SaveManager]
        BM[BackupManager]
    end

    %% GameEngine owns and controls all systems
    GE -.->|owns| EM
    GE -.->|owns| SM
    GE -.->|owns| TM
    
    %% GameEngine invokes systems with state
    GE ==>|invokes with state| PS
    GE ==>|invokes with state| AS
    GE ==>|invokes with state| LS
    GE ==>|invokes with state| UI
    GE ==>|invokes with state| PM
    
    %% Systems return results to GameEngine
    PS -.->|returns result| GE
    AS -.->|returns result| GE
    LS -.->|returns result| GE
    UI -.->|returns result| GE
    PM -.->|returns result| GE
    
    %% Event flow through write-only interface
    PS -->|write event| EM
    AS -->|write event| EM
    UI -->|write event| EM
    
    %% GameEngine processes events from queue
    EM -->|event queue| GE
    
    %% Subsystem organization (no direct communication)
    PS -.-> CS
    PS -.-> GS
    PS -.-> SS
    
    AS -.-> TS
    AS -.-> TRS
    AS -.-> BS
    
    LS -.-> ES
    LS -.-> IS
    LS -.-> SH
    
    UI -.-> HUD
    UI -.-> NS
    UI -.-> AC
    
    PM -.-> SM2
    PM -.-> BM
    
    style GE fill:#f9f,stroke:#333,stroke-width:4px
    style EM fill:#bbf,stroke:#333,stroke-width:2px
```

## Core Components

### 1. GameEngine

**Role**: Central coordinator that manages the game loop, orchestrates all subsystems, and ensures proper initialization and shutdown sequences.

**Key Responsibilities**:

- Initialize all game systems in correct order
- Manage the main game loop and tick system
- Process events sequentially from the event queue
- Invoke systems with appropriate state context
- Handle all cross-system coordination
- Validate and orchestrate user actions
- Trigger autosaves on ticks and user actions
- Provide write-only event interfaces to systems

**Functions**:

```typescript
class GameEngine {
  // Initialization
  initialize(): Promise<void>;
  loadGameState(): Promise<GameState>;
  setupSystems(): void;

  // Game Loop
  startGameLoop(): void;
  stopGameLoop(): void;
  tick(): void; // Called every 60 seconds
  
  // Event Processing (Sequential)
  processEventQueue(): void;
  processEvent(event: GameEvent): void;
  
  // System Invocation
  invokePetSystem(action: string, state: PetState): SystemResult;
  invokeActivitySystem(action: string, state: GameState): SystemResult;
  invokeUISystem(action: string, state: Partial<GameState>): void;
  
  // Event Write Interface Provider
  getEventWriter(): EventWriter; // Write-only interface for systems
  
  // User Action Processing
  processUserAction(action: GameAction): Promise<ActionResult>;
  validateAction(action: GameAction): ValidationResult;
  
  // State Management
  getState(): GameState;
  updateState(changes: StateChanges): void;
  triggerAutosave(reason: AutosaveReason): Promise<void>;

  // Lifecycle
  pause(): void;
  resume(): void;
  shutdown(): Promise<void>;
}

// Write-only event interface provided to systems
interface EventWriter {
  writeEvent(event: GameEvent): void;
  // No read methods - systems cannot query or process events
}
```

### 2. TimeManager

**Role**: Manages all time-related operations including real-time tracking, offline catch-up, and tick scheduling. Owned and controlled exclusively by GameEngine.

**Key Responsibilities**:

- Track real-time using device clock
- Calculate offline time on resume
- Manage game ticks (60-second intervals)
- Calculate time deltas for GameEngine
- Process offline catch-up calculations
- No direct communication with other systems

**Functions**:

```typescript
class TimeManager {
  // Time Tracking
  getCurrentTime(): Date;
  getLastSaveTime(): Date;
  getElapsedTime(): number;
  getOfflineTime(): number;

  // Tick Management
  startTicking(): void;
  stopTicking(): void;
  registerTickHandler(handler: TickHandler): void;
  processTick(): void;

  // Offline Processing
  calculateOfflineTicks(offlineSeconds: number): number;
  processOfflineTime(offlineSeconds: number): OfflineUpdate;

  // Scheduling
  scheduleEvent(time: Date, callback: Function): EventHandle;
  cancelScheduledEvent(handle: EventHandle): void;

  // Time Utilities
  formatTimeRemaining(seconds: number): string;
  getLocalTimezone(): string;
  convertToLocalTime(utcTime: Date): Date;
}
```

### 3. StateManager

**Role**: Centralized state store that maintains the entire game state. Only GameEngine can directly modify state.

**Key Responsibilities**:

- Maintain single source of truth for game state
- Process state mutations from GameEngine only
- Provide state snapshots for saves
- Handle state validation
- No event emission - state changes are handled by GameEngine
- No direct system access - only GameEngine can read/write

**Functions**:

```typescript
class StateManager {
  // State Access
  getState(): GameState;
  getPetState(): PetState;
  getInventoryState(): InventoryState;
  getWorldState(): WorldState;

  // State Mutations
  dispatch(action: GameAction): void;
  batchDispatch(actions: GameAction[]): void;

  // State Validation
  validateState(state: Partial<GameState>): ValidationResult;
  sanitizeState(state: GameState): GameState;

  // Subscriptions
  subscribe(listener: StateListener): Unsubscribe;
  subscribeToPath(path: string, listener: StateListener): Unsubscribe;

  // Snapshots
  createSnapshot(): StateSnapshot;
  restoreSnapshot(snapshot: StateSnapshot): void;

  // Transactions
  beginTransaction(): void;
  commitTransaction(): void;
  rollbackTransaction(): void;
}
```

### 4. EventManager

**Role**: Maintains the event queue for sequential processing by GameEngine. Systems write events, GameEngine processes them.

**Key Responsibilities**:

- Maintain FIFO event queue
- Accept events from write-only interfaces
- Provide events to GameEngine for processing
- Log event history for debugging
- No direct event dispatching - GameEngine handles all processing
- Ensure sequential processing (no concurrent event handling)

**Functions**:

```typescript
class EventManager {
  // Event Queue Management (used by GameEngine only)
  enqueueEvent(event: GameEvent): void;
  dequeueEvent(): GameEvent | null;
  peekEvent(): GameEvent | null;
  hasEvents(): boolean;
  getQueueLength(): number;
  clearQueue(): void;

  // Write-Only Interface (provided to systems)
  createEventWriter(): EventWriter;
  
  // Event History (for debugging)
  getEventHistory(limit: number): GameEvent[];
  clearEventHistory(): void;
  
  // Processing State
  isProcessing(): boolean;
  setProcessing(processing: boolean): void;
}

// The EventWriter interface that systems receive
class EventWriter {
  constructor(private eventManager: EventManager);
  
  // Only write method available to systems
  writeEvent(event: GameEvent): void {
    this.eventManager.enqueueEvent(event);
  }
}
```

## Component Details

### Pet Systems

#### PetSystem

**Role**: Pure system managing pet-related transformations. Receives state from GameEngine and returns results.

**Functions**:

```typescript
class PetSystem {
  // Pure transformations - no side effects
  createPet(species: Species, fromEgg?: Egg): PetCreationResult;
  
  // State transformations (receives state, returns changes)
  processFeed(petState: PetState, foodItem: Item): StateChanges;
  processDrink(petState: PetState, drinkItem: Item): StateChanges;
  processPlay(petState: PetState, toy: Item): StateChanges;
  processSleep(petState: PetState): StateChanges;
  processWake(petState: PetState, sleepDuration: number): StateChanges;
  
  // Care calculations
  calculateCareDecay(petState: PetState, ticks: number): CareDecayResult;
  calculateLifeStatus(petState: PetState): LifeStatus;
  
  // Validation
  validatePetAction(petState: PetState, action: PetAction): ValidationResult;
  
  // Offline Processing
  processOfflineUpdates(petState: PetState, ticks: number): StateChanges;
  
  // Event generation (returns events to write)
  generatePetEvents(petState: PetState, changes: StateChanges): GameEvent[];
}
```

#### CareSystem

**Role**: Manages pet care values including satiety, hydration, happiness, and hidden life stat.

**Functions**:

```typescript
class CareSystem {
  // Care Values
  getSatiety(): number;
  getHydration(): number;
  getHappiness(): number;
  getLife(): number; // Hidden value

  // Care Ticks (Hidden)
  getSatietyTicks(): number;
  getHydrationTicks(): number;
  getHappinessTicks(): number;

  // Care Updates
  feed(foodItem: FoodItem): void;
  drink(drinkItem: DrinkItem): void;
  play(toy: ToyItem): void;

  // Tick Processing
  processCareDecay(ticks: number): void;
  calculateDisplayValue(ticks: number, multiplier: number): number;

  // Life Management
  updateLife(delta: number): void;
  checkLifeStatus(): LifeStatus;

  // Poop System
  spawnPoop(): void;
  cleanPoop(amount?: number): void;
  getPoopCount(): number;
  calculatePoopSpawnChance(hours: number): boolean;
}
```

#### GrowthSystem

**Role**: Manages pet growth stages and stage advancement mechanics.

**Functions**:

```typescript
class GrowthSystem {
  // Stage Management
  getCurrentStage(): GrowthStage;
  getStageProgress(): StageProgress;
  checkAdvancementEligibility(): boolean;
  advanceStage(): void;

  // Stage Effects
  getMaxEnergy(): number;
  getSleepRegenRate(): number;
  getActivityAccess(): ActivityType[];

  // Stage Timers
  getTimeInStage(): number;
  getMinimumStageTime(): number;
  isStageTimeRequirementMet(): boolean;

  // Stat Bonuses
  applyStageAdvancementBonuses(): void;
}
```

#### StatusSystem

**Role**: Manages pet status conditions including sickness and injuries.

**Functions**:

```typescript
class StatusSystem {
  // Status Checks
  isSick(): boolean;
  isInjured(): boolean;
  getActiveStatuses(): Status[];

  // Status Application
  applySickness(severity: SicknessSeverity): void;
  applyInjury(type: InjuryType): void;

  // Status Treatment
  treatSickness(medicine: MedicineItem): void;
  treatInjury(bandage: BandageItem): void;

  // Status Effects
  getStatusEffects(): StatusEffect[];
  processStatusTick(): void;

  // Status Chances
  calculateSicknessChance(poopCount: number): number;
  calculateInjuryChance(activity: Activity): number;
}
```

### Activity Systems

#### ActivitySystem

**Role**: Coordinates all pet activities including travel, training, and resource gathering.

**Functions**:

```typescript
class ActivitySystem {
  // Activity Management
  startActivity(activity: Activity): void;
  cancelActivity(): void;
  getCurrentActivity(): Activity | null;
  isActivityInProgress(): boolean;

  // Activity Validation
  canStartActivity(activity: Activity): ValidationResult;
  checkEnergyCost(activity: Activity): boolean;
  checkConcurrencyRules(activity: Activity): boolean;

  // Activity Processing
  processActivityTick(): void;
  completeActivity(): void;

  // Activity Outcomes
  calculateRewards(activity: Activity): Reward[];
  calculateRisks(activity: Activity): Risk[];

  // Offline Processing
  processOfflineActivity(seconds: number): ActivityResult;
}
```

#### TravelSystem

**Role**: Manages location-based travel including instant intra-city and timed inter-city movement.

**Functions**:

```typescript
class TravelSystem {
  // Travel Management
  startTravel(destination: Location): void;
  cancelTravel(): void;
  getCurrentTravel(): Travel | null;

  // Travel Types
  performIntraCityMove(area: CityArea): void;
  startInterCityTravel(city: City, energyCost: number): void;
  startWildTravel(biome: Biome, energyCost: number): void;

  // Travel Calculations
  calculateTravelTime(from: Location, to: Location): number;
  calculateEnergyCost(distance: DistanceTier): number;
  applyTravelModifiers(baseTime: number): number;

  // Travel Progress
  getTravelProgress(): number;
  getRemainingTime(): number;
  completeTravel(): void;

  // Concurrent Actions
  canPerformWhileTraveling(action: ActionType): boolean;
}
```

#### TrainingSystem

**Role**: Manages stat training sessions and move learning mechanics.

**Functions**:

```typescript
class TrainingSystem {
  // Training Sessions
  startTraining(stat: BattleStat): void;
  cancelTraining(): void;
  getCurrentTraining(): Training | null;

  // Stat Training
  trainHealth(): void;
  trainAttack(): void;
  trainDefense(): void;
  trainSpeed(): void;
  trainAction(): void;

  // Training Progress
  calculateStatGain(stat: BattleStat): number;
  applyStatIncrease(stat: BattleStat, amount: number): void;

  // Move Learning
  checkMoveLearnChance(): boolean;
  generateNewMove(trainingStat: BattleStat): Move;
  learnMove(move: Move): void;
  replaceMove(oldMove: Move, newMove: Move): void;

  // Training Validation
  canTrain(): boolean;
  getTrainingEnergyCost(): number;
}
```

#### BattleSystem

**Role**: Manages turn-based battles including wild encounters and arena events.

**Functions**:

```typescript
class BattleSystem {
  // Battle Management
  startBattle(opponent: BattleOpponent): void;
  endBattle(outcome: BattleOutcome): void;
  getCurrentBattle(): Battle | null;

  // Turn Management
  processTurn(): void;
  determineTurnOrder(): Combatant[];
  executeTurn(combatant: Combatant): void;

  // Player Actions
  useMove(move: Move): void;
  useItem(item: BattleItem): void;
  attemptFlee(): boolean;
  skipTurn(): void; // Restores Action

  // Move Execution
  calculateDamage(move: Move, attacker: Combatant, defender: Combatant): number;
  applyStatusEffect(effect: StatusEffect, target: Combatant): void;
  checkAccuracy(move: Move): boolean;
  consumeAction(cost: number): boolean;
  restoreAction(amount: number): void;

  // Battle State
  checkFaintCondition(combatant: Combatant): boolean;
  processVictory(): void;
  processDefeat(): void;

  // Battle Interruption
  pauseBattle(): void;
  resumeBattle(): void;
}
```

### World Systems

#### LocationSystem

**Role**: Manages game world locations including cities, wild biomes, and areas within locations.

**Functions**:

```typescript
class LocationSystem {
  // Location Management
  getCurrentLocation(): Location;
  setLocation(location: Location): void;
  getAvailableLocations(): Location[];

  // Location Types
  getCities(): City[];
  getWildBiomes(): Biome[];
  getCityAreas(city: City): CityArea[];

  // Location Features
  getLocationActivities(location: Location): Activity[];
  getLocationShops(location: Location): Shop[];
  getLocationEvents(location: Location): Event[];

  // Distance Calculations
  calculateDistance(from: Location, to: Location): DistanceTier;
  getNeighboringLocations(location: Location): Location[];

  // Location Validation
  canAccessLocation(location: Location): boolean;
  checkLocationRequirements(location: Location): Requirement[];
}
```

#### EventSystem

**Role**: Manages calendar-based events and special time-limited activities.

**Functions**:

```typescript
class EventSystem {
  // Event Management
  getActiveEvents(): CalendarEvent[];
  getUpcomingEvents(): CalendarEvent[];
  checkEventAvailability(): void;

  // Event Participation
  joinEvent(event: CalendarEvent): void;
  leaveEvent(): void;
  getCurrentEvent(): CalendarEvent | null;

  // Event Scheduling
  scheduleEvent(event: CalendarEvent): void;
  isEventOpen(event: CalendarEvent): boolean;
  getEventTimeWindow(event: CalendarEvent): TimeWindow;

  // Event Closure
  handleEventClosure(): void;
  distributePartialRewards(): void;
  convertEventTokens(): number;

  // Event Types
  processArenaEvent(): void;
  processTournamentEvent(): void;
  processSeasonalEvent(): void;
}
```

#### ItemSystem

**Role**: Manages inventory, item usage, and item effects.

**Functions**:

```typescript
class ItemSystem {
  // Inventory Management
  getInventory(): Inventory;
  addItem(item: Item, quantity: number): void;
  removeItem(item: Item, quantity: number): void;
  getItemCount(item: Item): number;

  // Item Usage
  useItem(item: Item): void;
  canUseItem(item: Item): boolean;
  applyItemEffect(item: Item, target: any): void;

  // Item Categories
  getFoodItems(): FoodItem[];
  getDrinkItems(): DrinkItem[];
  getToyItems(): ToyItem[];
  getMedicineItems(): MedicineItem[];
  getToolItems(): ToolItem[];

  // Item Properties
  isStackable(item: Item): boolean;
  getStackLimit(item: Item): number;
  getItemDurability(item: Item): number;
  reduceDurability(item: Item, amount: number): void;

  // Inventory Operations
  sortInventory(sortType: SortType): void;
  filterInventory(category: ItemCategory): Item[];
}
```

#### ShopSystem

**Role**: Manages shop inventories, purchases, and daily rotations.

**Functions**:

```typescript
class ShopSystem {
  // Shop Management
  getShopInventory(shop: Shop): ShopInventory;
  refreshShopInventory(shop: Shop): void;
  getNextRotationTime(): Date;

  // Purchasing
  purchaseItem(item: Item, quantity: number): PurchaseResult;
  canAffordItem(item: Item, quantity: number): boolean;
  calculatePrice(item: Item, quantity: number): number;

  // Currency
  getCoins(): number;
  spendCoins(amount: number): void;
  addCoins(amount: number): void;

  // Shop Features
  applyDiscount(price: number, discount: Discount): number;
  getActiveDiscounts(): Discount[];
  checkSpecialOffers(): SpecialOffer[];

  // Egg Shop
  getAvailableEggs(): Egg[];
  purchaseEgg(egg: Egg): void;
}
```

### UI Systems

#### UIManager

**Role**: Coordinates all UI components and manages UI state updates.

**Functions**:

```typescript
class UIManager {
  // UI Initialization
  initialize(): void;
  setupEventListeners(): void;
  loadUIAssets(): Promise<void>;

  // Screen Management
  showScreen(screen: Screen): void;
  hideScreen(screen: Screen): void;
  getCurrentScreen(): Screen;

  // UI Updates
  update(deltaTime: number): void;
  render(): void;

  // Modal Management
  showModal(modal: Modal): void;
  hideModal(modal: Modal): void;

  // UI State
  setUIState(state: UIState): void;
  getUIState(): UIState;

  // Responsive Design
  handleResize(): void;
  getViewportSize(): ViewportSize;
  adjustForMobile(): void;
}
```

#### HUDController

**Role**: Manages the heads-up display showing pet status and current activities.

**Functions**:

```typescript
class HUDController {
  // HUD Elements
  updatePetPortrait(pet: Pet): void;
  updateEnergyBar(current: number, max: number): void;
  updateCareBar(type: CareType, value: number): void;
  updateHealthBar(current: number, max: number): void; // Battle only

  // Status Icons
  showStatusIcon(status: Status): void;
  hideStatusIcon(status: Status): void;
  updatePoopCount(count: number): void;

  // Location Display
  updateLocationBreadcrumbs(location: Location): void;
  showTravelETA(remainingTime: number): void;

  // Activity Display
  showActivityProgress(activity: Activity, progress: number): void;
  showCancelButton(canCancel: boolean): void;

  // Context Actions
  updateActionPanel(actions: Action[]): void;
  enableAction(action: Action): void;
  disableAction(action: Action): void;
}
```

#### NotificationSystem

**Role**: Manages in-game notifications including toasts, alerts, and modals.

**Functions**:

```typescript
class NotificationSystem {
  // Toast Notifications
  showToast(message: string, type: ToastType): void;
  hideToast(id: string): void;
  queueToast(toast: Toast): void;

  // Alert Management
  showAlert(alert: Alert): void;
  showLowCareAlert(careType: CareType): void;
  showHighPoopAlert(): void;

  // Modal Notifications
  showBattleSummary(result: BattleResult): void;
  showEventClosure(event: CalendarEvent): void;
  showRewardModal(rewards: Reward[]): void;

  // Notification Settings
  setNotificationPreferences(prefs: NotificationPrefs): void;
  isNotificationEnabled(type: NotificationType): boolean;

  // Notification Queue
  processNotificationQueue(): void;
  clearNotificationQueue(): void;
}
```

#### AccessibilityController

**Role**: Manages accessibility features and settings.

**Functions**:

```typescript
class AccessibilityController {
  // Visual Accessibility
  setColorBlindMode(mode: ColorBlindMode): void;
  enableHighContrast(): void;
  setFontScale(scale: number): void;
  toggleReducedMotion(): void;

  // Input Accessibility
  setupKeyboardShortcuts(): void;
  handleKeyboardNavigation(key: KeyCode): void;
  setFocusOutlines(visible: boolean): void;

  // Screen Reader Support
  updateAriaLabels(): void;
  announceScreenChange(screen: Screen): void;
  setLiveRegion(message: string): void;

  // Settings Management
  loadAccessibilitySettings(): void;
  saveAccessibilitySettings(): void;
  resetToDefaults(): void;
}
```

### Persistence Systems

#### PersistenceManager

**Role**: Coordinates all save/load operations and manages data persistence.

**Functions**:

```typescript
class PersistenceManager {
  // Save Operations
  save(state: GameState): Promise<void>;
  autosave(reason: AutosaveReason): Promise<void>;
  quicksave(): Promise<void>;

  // Load Operations
  load(): Promise<GameState>;
  loadBackup(backupId: string): Promise<GameState>;

  // Export/Import
  exportSave(): Promise<SaveFile>;
  importSave(file: SaveFile): Promise<void>;
  validateSaveFile(file: SaveFile): ValidationResult;

  // Storage Management
  getStorageUsage(): number;
  clearOldSaves(): void;
  compressSave(state: GameState): CompressedSave;

  // Migration
  migrateOldSave(oldSave: any): GameState;
  getCurrentSaveVersion(): string;
}
```

#### SaveManager

**Role**: Handles low-level save operations using IndexedDB.

**Functions**:

```typescript
class SaveManager {
  // Database Operations
  openDatabase(): Promise<IDBDatabase>;
  createTransaction(mode: IDBTransactionMode): IDBTransaction;

  // Save Operations
  writeSave(key: string, data: any): Promise<void>;
  readSave(key: string): Promise<any>;
  deleteSave(key: string): Promise<void>;

  // Batch Operations
  batchWrite(saves: SaveData[]): Promise<void>;
  getAllSaves(): Promise<SaveData[]>;

  // IndexedDB Management
  upgradeDatabase(oldVersion: number, newVersion: number): void;
  handleQuotaExceeded(): void;

  // Checksums
  generateChecksum(data: any): string;
  verifyChecksum(data: any, checksum: string): boolean;
}
```

#### BackupManager

**Role**: Manages automatic backups and recovery operations.

**Functions**:

```typescript
class BackupManager {
  // Backup Creation
  createBackup(state: GameState): Promise<string>;
  createRollingBackup(): void;
  scheduleAutoBackup(): void;

  // Backup Management
  listBackups(): Promise<Backup[]>;
  getBackup(backupId: string): Promise<Backup>;
  deleteBackup(backupId: string): Promise<void>;

  // Backup Rotation
  rotateBackups(maxBackups: number): void;
  getOldestBackup(): Promise<Backup>;

  // Recovery
  restoreFromBackup(backupId: string): Promise<GameState>;
  findLastValidBackup(): Promise<Backup>;

  // Backup Validation
  validateBackup(backup: Backup): boolean;
  repairCorruptedBackup(backup: Backup): Backup | null;
}
```

## Data Flow and Interactions

### Game Initialization Flow

```mermaid
sequenceDiagram
    participant M as Main
    participant GE as GameEngine
    participant EM as EventManager
    participant SM as StateManager
    participant TM as TimeManager
    participant PS as PetSystem
    participant UI as UIManager

    M->>GE: initialize()
    GE->>SM: createInitialState()
    GE->>EM: initialize()
    GE->>TM: initialize()
    
    Note over GE: Load saved state
    GE->>SM: loadState()
    SM-->>GE: GameState
    
    Note over GE: Process offline time
    GE->>TM: getOfflineTime()
    TM-->>GE: offlineSeconds
    GE->>PS: processOfflineUpdates(state, offlineSeconds)
    PS-->>GE: StateChanges
    GE->>SM: applyChanges(StateChanges)
    
    Note over GE: Initialize UI with state
    GE->>UI: initialize(state)
    
    Note over GE: Start game loop
    GE->>GE: startEventProcessing()
    GE->>TM: startTicking()
```

### Game Tick Flow

```mermaid
sequenceDiagram
    participant TM as TimeManager
    participant GE as GameEngine
    participant EM as EventManager
    participant PS as PetSystem
    participant AS as ActivitySystem
    participant SM as StateManager

    TM->>EM: writeEvent(TICK_EVENT)
    
    Note over GE: Process event queue
    GE->>EM: dequeueEvent()
    EM-->>GE: TICK_EVENT
    
    Note over GE: Get current state
    GE->>SM: getState()
    SM-->>GE: GameState
    
    Note over GE: Process care decay
    GE->>PS: calculateCareDecay(petState, 1)
    PS-->>GE: CareDecayResult
    
    Note over GE: Process activities
    GE->>AS: processActivityTick(activityState)
    AS-->>GE: ActivityResult
    
    Note over GE: Update state
    GE->>SM: applyChanges(changes)
    
    Note over GE: Trigger autosave
    GE->>GE: autosave(TICK)
```

### User Action Flow (Feed Pet)

```mermaid
sequenceDiagram
    participant User as User
    participant UI as UIManager
    participant EM as EventManager
    participant GE as GameEngine
    participant PS as PetSystem
    participant IS as ItemSystem
    participant SM as StateManager

    User->>UI: clickFeedButton(foodItem)
    UI->>EM: writeEvent(FEED_ACTION)
    
    Note over GE: Process event queue
    GE->>EM: dequeueEvent()
    EM-->>GE: FEED_ACTION
    
    Note over GE: Validate action
    GE->>SM: getState()
    SM-->>GE: GameState
    GE->>PS: validatePetAction(petState, FEED)
    PS-->>GE: Valid
    GE->>IS: validateItem(inventory, foodItem)
    IS-->>GE: Valid
    
    Note over GE: Process feeding
    GE->>PS: processFeed(petState, foodItem)
    PS-->>GE: StateChanges + Events
    GE->>IS: consumeItem(inventory, foodItem)
    IS-->>GE: InventoryChanges
    
    Note over GE: Update state
    GE->>SM: applyChanges(allChanges)
    
    Note over GE: Write resulting events
    GE->>EM: enqueueEvent(PET_FED_EVENT)
    
    Note over GE: Update UI
    GE->>UI: updatePetDisplay(newPetState)
    
    Note over GE: Autosave
    GE->>GE: autosave(USER_ACTION)
```

### Battle Flow

```mermaid
sequenceDiagram
    participant GE as GameEngine
    participant EM as EventManager
    participant BS as BattleSystem
    participant UI as UIManager
    participant SM as StateManager

    Note over GE: Battle triggered
    GE->>SM: getState()
    SM-->>GE: GameState
    
    GE->>BS: initializeBattle(petState, opponent)
    BS-->>GE: BattleState + BATTLE_START event
    
    GE->>SM: setBattleState(battleState)
    GE->>UI: showBattleScreen(battleState)
    
    loop Each Turn
        Note over GE: Wait for player action
        UI->>EM: writeEvent(USE_MOVE)
        
        GE->>EM: dequeueEvent()
        EM-->>GE: USE_MOVE
        
        GE->>BS: processTurn(battleState, move)
        BS-->>GE: TurnResult + Events
        
        GE->>SM: updateBattleState(turnResult)
        GE->>UI: updateBattleDisplay(battleState)
        
        GE->>BS: checkBattleEnd(battleState)
        BS-->>GE: BattleStatus
    end
    
    GE->>BS: finalizeBattle(battleState)
    BS-->>GE: BattleRewards + Events
    
    GE->>SM: applyRewards(rewards)
    GE->>UI: showBattleSummary(results)
```

### Offline Catch-up Flow

```mermaid
sequenceDiagram
    participant GE as GameEngine
    participant TM as TimeManager
    participant SM as StateManager
    participant PS as PetSystem
    participant AS as ActivitySystem
    participant ES as EventSystem

    Note over GE: Game resuming
    GE->>TM: calculateOfflineTime()
    TM-->>GE: offlineSeconds
    
    GE->>TM: calculateOfflineTicks(offlineSeconds)
    TM-->>GE: offlineTicks
    
    Note over GE: Get current state
    GE->>SM: getState()
    SM-->>GE: GameState
    
    Note over GE: Process pet updates
    GE->>PS: processOfflineUpdates(petState, offlineTicks)
    PS-->>GE: PetChanges + Events
    
    Note over GE: Process activities
    GE->>AS: processOfflineActivity(activityState, offlineTicks)
    AS-->>GE: ActivityChanges + Events
    
    Note over GE: Check events
    GE->>ES: checkEventClosures(eventState, currentTime)
    ES-->>GE: EventChanges + Events
    
    Note over GE: Apply all changes
    GE->>SM: batchApplyChanges(allChanges)
    
    Note over GE: Queue events for processing
    GE->>EM: enqueueEvents(offlineEvents)
```

## Implementation Notes

### Critical Design Decisions

1. **Sequential Event Processing**: All events are processed one at a time by GameEngine, eliminating race conditions and ensuring deterministic behavior. This is crucial for maintaining game state consistency.

2. **Pure System Design**: Systems are stateless transformers that receive state and return changes. They cannot directly modify state or communicate with other systems, ensuring predictable behavior and easier testing.

3. **Write-Only Event Interface**: Systems that need to emit events receive a write-only interface from GameEngine. They cannot read or process events, maintaining the unidirectional data flow.

4. **GameEngine as Ultimate Orchestrator**: All control flow goes through GameEngine. It owns the EventManager, StateManager, and TimeManager, and coordinates all system interactions.

5. **Tick-Based System**: The 60-second tick serves as the primary update mechanism for care decay and autosaves. User actions trigger immediate processing through the event queue.

6. **Hidden Tick Counters**: Care values use hidden tick counters for precise calculations. Display values are computed from ticks using multipliers (e.g., 1 Hydration = 15 ticks = 15 minutes).

7. **Offline Processing**: All offline calculations are deterministic and batched into a single update to maintain consistency and performance.

8. **State Management**: Single source of truth owned by GameEngine. Only GameEngine can modify state through StateManager.

### Performance Considerations

1. **Lazy Loading**: Load only necessary assets and systems based on current game state.

2. **Object Pooling**: Reuse UI elements and game objects to reduce garbage collection.

3. **Batch Updates**: Group multiple state changes into single update cycles.

4. **Efficient Offline Processing**: Calculate offline updates mathematically rather than simulating each tick.

5. **IndexedDB Transactions**: Use batch writes and transactions for save operations.

### Error Handling Strategy

1. **Graceful Degradation**: If a system fails, disable related features rather than crashing.

2. **Automatic Recovery**: Maintain rolling backups and attempt recovery from last valid state.

3. **User Notification**: Clear error messages with suggested actions for users.

4. **Logging System**: Comprehensive logging for debugging without exposing internals to users.

### Extensibility Points

1. **Plugin System**: Systems can register handlers for specific events without modifying core code.

2. **Data-Driven Content**: Species, items, activities defined in configuration files.

3. **Tuning Parameters**: All gameplay values exposed through configuration for easy balancing.

4. **Custom Events**: Calendar events can be added without code changes.

5. **Modular UI Components**: UI elements can be swapped or themed independently.

### Security Considerations

1. **Save Validation**: Checksums and version checks prevent corrupted or tampered saves.

2. **Input Sanitization**: All user inputs validated before processing.

3. **Resource Limits**: Caps on inventory, stats, and other values to prevent overflow.

4. **No External Dependencies**: Fully offline operation eliminates network attack vectors.
