# Digital Pet Game - System Architecture

## Architecture Overview

The game uses a **Domain-Driven Design** with four distinct layers that ensure clear separation of concerns and no overlapping responsibilities.

```
┌─────────────────────────────────────────────────┐
│          Layer 1: Input Layer                    │
│  (User Input, Timer Events, System Events)       │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│       Layer 2: Orchestration Layer               │
│  (Event Bus, Command Processor,                  │
│   State Coordinator)                             │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│          Layer 3: Domain Layer                   │
│  ┌─────────────────────────────────────┐        │
│  │        Core Domains                  │        │
│  │  (Pet, Player, World, Item)          │        │
│  └─────────────────────────────────────┘        │
│  ┌─────────────────────────────────────┐        │
│  │      Activity Systems                │        │
│  │  (Care, Battle, Trade, Craft,        │        │
│  │   Explore)                           │        │
│  └─────────────────────────────────────┘        │
│  ┌─────────────────────────────────────┐        │
│  │      Support Systems                 │        │
│  │  (Time, Save, Notification)          │        │
│  └─────────────────────────────────────┘        │
└─────────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│        Layer 4: Presentation Layer               │
│  (UI Components, Sound, Animations)              │
└─────────────────────────────────────────────────┘
```

## Core Design Principles

### 1. Single Responsibility
Each domain owns specific data and operations. No domain modifies another domain's data directly.

### 2. Event-Driven Communication
Domains communicate through events, not direct method calls. This ensures loose coupling.

### 3. Immutable State Updates
All state changes create new state objects. This enables history, undo, and predictable updates.

### 4. Command Pattern
User actions become commands that are validated before execution.

## Layer 1: Input Layer

### Purpose
Capture all external inputs and convert them to domain events.

### Components

#### UserInputHandler
- Captures clicks, taps, keyboard input
- Validates input before creating events
- Provides immediate feedback (button states, hover effects)

#### TimerSystem
- Manages game tick (every 15 seconds by default)
- Emits tick events for time-based updates
- Handles pause/resume functionality

#### SystemEventHandler
- Browser events (visibility, online/offline)
- PWA lifecycle events
- Save/load triggers

## Layer 2: Orchestration Layer

### Purpose
Coordinate between inputs and domains, ensuring proper event flow and state consistency.

### Components

#### EventBus
```typescript
interface EventBus {
  emit(event: GameEvent): void;
  subscribe(eventType: string, handler: EventHandler): void;
  unsubscribe(eventType: string, handler: EventHandler): void;
}

interface GameEvent {
  type: string;
  payload: any;
  timestamp: number;
  priority: EventPriority;
}

enum EventPriority {
  IMMEDIATE = 0,  // User actions
  HIGH = 1,       // Battle actions
  NORMAL = 2,     // Tick updates
  LOW = 3         // Background tasks
}
```

#### CommandProcessor
```typescript
interface Command {
  type: string;
  payload: any;
  validate(state: GameState): boolean;
  execute(state: GameState): StateChange[];
  undo?(state: GameState): StateChange[];
}

class CommandProcessor {
  process(command: Command, state: GameState): GameState {
    if (!command.validate(state)) {
      throw new ValidationError();
    }
    const changes = command.execute(state);
    return this.stateCoordinator.applyChanges(state, changes);
  }
}
```

#### StateCoordinator
```typescript
interface StateCoordinator {
  applyChanges(state: GameState, changes: StateChange[]): GameState;
  validateState(state: GameState): boolean;
  createSnapshot(state: GameState): StateSnapshot;
  restoreSnapshot(snapshot: StateSnapshot): GameState;
}
```

## Layer 3: Domain Layer

### Core Domains
These own the fundamental game data.

#### Pet Domain
**Owns:**
```typescript
interface Pet {
  id: string;
  species: PetSpecies;
  name: string;
  
  // Core stats
  stats: {
    hunger: number;      // 0-100
    happiness: number;   // 0-100
    energy: number;      // 0-100
    hygiene: number;     // 0-100
    health: number;      // 0-100
  };
  
  // Battle attributes
  battleStats: {
    level: number;
    hp: number;
    attack: number;
    defense: number;
    speed: number;
  };
  
  abilities: PetAbility[];  // Moves for battle
  
  // Growth
  age: number;            // In game ticks
  growthStage: number;    // Current evolution stage
  experience: number;     // For leveling up
  
  // Personality
  personality: {
    traits: PersonalityTrait[];
    mood: Mood;
    preferences: Preferences;
  };
  
  // Relationships
  relationships: {
    playerId: number;     // Bond with player
    petBonds: Map<string, number>; // Bonds with other pets
  };
}
```

**Responsibilities:**
- Calculate stat decay over time
- Determine mood from current stats
- Level up and evolution logic
- Personality development

**Does NOT handle:**
- Items (owned by Player)
- Location (owned by World)
- Battle execution (handled by Battle System)

#### Player Domain
**Owns:**
```typescript
interface Player {
  id: string;
  name: string;
  
  // Inventory
  inventory: {
    items: Map<ItemId, number>;  // Item ID -> quantity
    maxCapacity: number;
  };
  
  // Economy
  currencies: {
    coins: number;
    gems: number;  // Premium currency
  };
  
  // Progression
  level: number;
  experience: number;
  achievements: Achievement[];
  statistics: PlayerStats;
  
  // Discovery
  discovered: {
    pets: Set<PetSpecies>;
    locations: Set<LocationId>;
    items: Set<ItemId>;
  };
  
  // Owned pets
  pets: {
    active: string[];    // Pet IDs currently active
    stored: string[];    // Pet IDs in storage
    graveyard: string[]; // Pet IDs that have passed
  };
  
  // Settings
  settings: PlayerSettings;
}
```

**Responsibilities:**
- Manage inventory (add/remove items)
- Track player progression
- Handle achievements
- Manage currency

**Does NOT handle:**
- Pet stats (owned by Pet)
- Market prices (owned by World)
- Item effects (handled by Activity Systems)

#### World Domain
**Owns:**
```typescript
interface World {
  // Locations
  locations: Map<LocationId, Location>;
  currentLocation: LocationId;
  
  // NPCs
  npcs: Map<NpcId, NPC>;
  
  // Economy (market is part of the world)
  market: {
    prices: Map<ItemId, PriceRange>;
    dailyDeals: Deal[];
    supplyDemand: Map<ItemId, number>;
  };
  
  // Environment
  environment: {
    timeOfDay: TimeOfDay;
    weather: Weather;
    season: Season;
  };
  
  // Events
  activeEvents: WorldEvent[];
}

interface Location {
  id: LocationId;
  name: string;
  description: string;
  
  // What you can do here
  availableActivities: ActivityType[];
  
  // NPCs present
  npcs: NpcId[];
  
  // Environmental modifiers
  modifiers: LocationModifier[];
}
```

**Responsibilities:**
- Manage world state and time
- Control market prices
- Handle environmental effects
- Manage NPCs and their state

**Does NOT handle:**
- Player inventory (owned by Player)
- Pet locations (pets follow player)
- Activity execution (handled by Activity Systems)

#### Item Domain
**Owns:**
```typescript
interface ItemDefinition {
  id: ItemId;
  name: string;
  category: ItemCategory;
  rarity: Rarity;
  
  // Base properties
  baseValue: number;
  stackable: boolean;
  maxStack: number;
  
  // Effects when used
  effects: ItemEffect[];
  
  // Crafting
  recipe?: CraftingRecipe;
  salvageable: boolean;
  salvageResults?: ItemId[];
}

enum ItemCategory {
  FOOD,
  DRINK,
  TOY,
  MEDICINE,
  GROOMING,
  EQUIPMENT,
  MATERIAL,
  SPECIAL
}
```

**Responsibilities:**
- Define all item properties
- Specify item effects
- Define crafting recipes

**Does NOT handle:**
- Who owns items (Player Domain)
- Current market prices (World Domain)
- Using items (Activity Systems)

### Activity Systems
These orchestrate interactions between domains.

#### Care System
**Uses:** Pet Domain, Player Domain, Item Domain

**Handles:**
```typescript
interface CareSystem {
  feedPet(petId: string, itemId: ItemId): Command;
  groomPet(petId: string, itemId: ItemId): Command;
  playWithPet(petId: string, itemId: ItemId): Command;
  giveMedicine(petId: string, itemId: ItemId): Command;
}
```

**Process:**
1. Validate player has item
2. Check pet can receive care
3. Remove item from inventory
4. Apply effects to pet
5. Update pet happiness/bond

#### Battle System
**Uses:** Pet Domain, World Domain

**Handles:**
```typescript
interface BattleSystem {
  startBattle(petId1: string, petId2: string): Battle;
  executeMove(battleId: string, move: Move): BattleUpdate;
  endBattle(battleId: string): BattleResult;
}

interface Battle {
  id: string;
  participants: BattleParticipant[];
  environment: BattleEnvironment;
  turn: number;
  status: BattleStatus;
}
```

**Process:**
1. Initialize battle with pets
2. Apply environmental modifiers
3. Process moves in speed order
4. Calculate damage/effects
5. Distribute rewards

#### Trade System
**Uses:** Player Domain, World Domain, Item Domain

**Handles:**
```typescript
interface TradeSystem {
  buyItem(itemId: ItemId, quantity: number, npcId: NpcId): Command;
  sellItem(itemId: ItemId, quantity: number, npcId: NpcId): Command;
  tradePet(petId: string, npcId: NpcId, offer: TradeOffer): Command;
}
```

**Process:**
1. Check market prices
2. Validate player resources
3. Execute transaction
4. Update inventories
5. Adjust market supply/demand

#### Craft System
**Uses:** Player Domain, Item Domain

**Handles:**
```typescript
interface CraftSystem {
  craft(recipeId: RecipeId): Command;
  salvage(itemId: ItemId): Command;
  upgrade(itemId: ItemId, materials: ItemId[]): Command;
}
```

**Process:**
1. Validate recipe requirements
2. Check player has materials
3. Remove materials
4. Create crafted item
5. Add to inventory

#### Explore System
**Uses:** Player Domain, World Domain, Pet Domain

**Handles:**
```typescript
interface ExploreSystem {
  explore(locationId: LocationId, petId: string): ExploreSession;
  forage(): ForageResult;
  encounter(): EncounterResult;
}
```

**Process:**
1. Check location accessibility
2. Start exploration timer
3. Generate encounters/resources
4. Update discoveries
5. Distribute rewards

### Support Systems
These provide infrastructure services.

#### Time System
```typescript
interface TimeSystem {
  currentTick: number;
  tickInterval: number; // milliseconds
  isPaused: boolean;
  
  onTick(callback: TickHandler): void;
  calculateOfflineProgress(lastTick: number): OfflineProgress;
}
```

#### Save System
```typescript
interface SaveSystem {
  save(state: GameState): Promise<void>;
  load(slot: number): Promise<GameState>;
  autoSave(state: GameState): Promise<void>;
  validateSave(data: any): boolean;
}
```

#### Notification System
```typescript
interface NotificationSystem {
  notify(message: string, type: NotificationType): void;
  queueAchievement(achievement: Achievement): void;
  showToast(content: string): void;
}
```

## Layer 4: Presentation Layer

### Purpose
Handle all UI rendering and user feedback.

### Components

#### UI Components
- React components for each screen
- Responsive design with Tailwind CSS
- Accessibility features built-in

#### Sound Manager
- Background music
- Sound effects
- Volume controls

#### Animation Manager
- CSS animations
- Sprite animations
- Particle effects

## Data Flow Example: Feeding a Pet

1. **User Action**: Player clicks "Feed" button
2. **Input Layer**: Creates `FeedPetCommand`
3. **Orchestration Layer**: 
   - CommandProcessor validates command
   - Checks player has food item
   - Checks pet can be fed
4. **Domain Layer**:
   - Care System orchestrates:
     - Player Domain: Remove food item
     - Pet Domain: Increase hunger stat
     - Pet Domain: Update happiness
5. **State Update**: New immutable state created
6. **Presentation Layer**: UI updates to show changes

## Key Architecture Decisions

### Why Domain-Driven Design?
- **Clear boundaries**: Each domain has specific responsibilities
- **No overlaps**: Trading is one system using Player and World domains
- **Maintainable**: Easy to understand what code owns what data
- **Testable**: Domains can be tested in isolation

### Why Event-Driven?
- **Loose coupling**: Domains don't directly depend on each other
- **Extensible**: Easy to add new event handlers
- **Debuggable**: Event log shows exactly what happened
- **Replayable**: Can replay events for testing/debugging

### Why Immutable State?
- **Predictable**: State changes are explicit
- **Debuggable**: Can see before/after states
- **Undoable**: Easy to implement undo
- **Optimizable**: Can use React memo/PureComponent

## Project Structure

```
src/
├── core/                   # Layer 2: Orchestration
│   ├── EventBus.ts
│   ├── CommandProcessor.ts
│   └── StateCoordinator.ts
│
├── domains/                # Layer 3: Core Domains
│   ├── pet/
│   │   ├── Pet.ts
│   │   ├── PetStats.ts
│   │   ├── PetEvolution.ts
│   │   └── PetPersonality.ts
│   ├── player/
│   │   ├── Player.ts
│   │   ├── Inventory.ts
│   │   ├── Achievements.ts
│   │   └── Progression.ts
│   ├── world/
│   │   ├── World.ts
│   │   ├── Location.ts
│   │   ├── Market.ts
│   │   └── NPC.ts
│   └── item/
│       ├── Item.ts
│       ├── ItemEffects.ts
│       └── CraftingRecipes.ts
│
├── activities/             # Layer 3: Activity Systems
│   ├── CareSystem.ts
│   ├── BattleSystem.ts
│   ├── TradeSystem.ts
│   ├── CraftSystem.ts
│   └── ExploreSystem.ts
│
├── support/                # Layer 3: Support Systems
│   ├── TimeSystem.ts
│   ├── SaveSystem.ts
│   └── NotificationSystem.ts
│
├── input/                  # Layer 1: Input
│   ├── UserInputHandler.ts
│   ├── TimerSystem.ts
│   └── SystemEventHandler.ts
│
├── ui/                     # Layer 4: Presentation
│   ├── screens/
│   ├── components/
│   ├── hooks/
│   └── contexts/
│
├── assets/                 # Game Assets
│   ├── sprites/
│   ├── sounds/
│   └── data/
│
└── utils/                  # Utilities
    ├── math/
    ├── random/
    └── validation/
```

## Implementation Priorities

### Phase 1: Core Infrastructure (Week 1)
1. EventBus and CommandProcessor
2. StateCoordinator with immutable updates
3. Basic UI framework
4. Save System

### Phase 2: Core Domains (Week 2)
1. Pet Domain with stats
2. Player Domain with inventory
3. Item definitions
4. Basic World structure

### Phase 3: Basic Activities (Week 3)
1. Care System (feeding, playing)
2. Time System with ticks
3. Stat decay logic
4. Simple UI for pet care

### Phase 4: Extended Features (Week 4-5)
1. Battle System
2. Trade System
3. Explore System
4. More locations and NPCs

### Phase 5: Polish (Week 6)
1. Animations and sound
2. Achievements
3. Tutorial
4. Performance optimization

## Performance Considerations

### Optimization Strategies
1. **Immutable updates with structural sharing** - Only create new objects for changed parts
2. **Memoization** - Cache expensive calculations
3. **Virtual scrolling** - For long lists
4. **Lazy loading** - Load assets on demand
5. **Web Workers** - Offline progress calculations

### Performance Targets
- 60 FPS during gameplay
- < 100ms response to user input
- < 3 second initial load
- < 500ms for offline calculation

## Testing Strategy

### Unit Tests
- Each domain tested independently
- Mock dependencies injected
- Test state transformations
- Test validation logic

### Integration Tests
- Test activity systems with real domains
- Test event flow
- Test save/load cycle
- Test offline progression

### E2E Tests
- Complete user workflows
- Cross-browser testing
- Performance benchmarks
- Accessibility testing