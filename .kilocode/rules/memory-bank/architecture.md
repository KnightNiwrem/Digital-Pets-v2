# Digital Pet Game - Architecture Documentation

## System Architecture Overview

### Three-Layer Event-Driven Architecture

The game uses a three-layer architecture that ensures clean separation of concerns:

```
┌─────────────────────────────────────────────────┐
│           Layer 1: Event Sources                 │
│  (User Input, Timers, System Events, Activities) │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│           Layer 2: Game Engine                   │
│  (EventBus, GameEngine, ActionProcessor,         │
│   StateManager, EffectManager)                   │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│           Layer 3: Domain Systems                │
│  (Pet, Inventory, Battle, World, Progression,    │
│   Economy, Time, Save, Notification, Analytics)  │
└─────────────────────────────────────────────────┘
```

## Source Code Structure

### Project Root Structure
```
/Users/curtistanweijie/Digital-Pets-v2/
├── src/                    # Application source code
├── public/                 # Static assets (to be created)
├── tests/                  # Test files (to be created)
├── docs/                   # Documentation
└── .kilocode/rules/        # Memory bank and rules
```

### Planned Source Organization
```
src/
├── engine/                 # Layer 2: Game Engine
│   ├── core/
│   │   ├── GameEngine.ts
│   │   ├── EventBus.ts
│   │   ├── ActionProcessor.ts
│   │   └── StateManager.ts
│   ├── events/            # Layer 1: Event Sources
│   │   ├── EventEmitter.ts
│   │   ├── sources/
│   │   │   ├── InputEventSource.ts
│   │   │   ├── TickEventSource.ts
│   │   │   ├── SystemEventSource.ts
│   │   │   └── ActivityEventSource.ts
│   │   └── types/
│   │       └── events.ts
│   └── effects/
│       └── EffectManager.ts
│
├── systems/               # Layer 3: Domain Systems
│   ├── pet/
│   │   ├── PetSystem.ts
│   │   ├── personality/
│   │   ├── relationships/
│   │   └── types.ts
│   ├── inventory/
│   │   ├── InventorySystem.ts
│   │   ├── crafting/
│   │   └── trading/
│   ├── battle/
│   │   ├── BattleSystem.ts
│   │   ├── ai/
│   │   └── tournament/
│   ├── world/
│   │   ├── WorldSystem.ts
│   │   ├── locations/
│   │   └── npcs/
│   ├── progression/
│   │   ├── ProgressionSystem.ts
│   │   ├── achievements/
│   │   └── skills/
│   ├── economy/
│   │   ├── EconomySystem.ts
│   │   └── market/
│   └── infrastructure/
│       ├── SaveSystem.ts
│       ├── TimeSystem.ts
│       ├── NotificationSystem.ts
│       └── AnalyticsSystem.ts
│
├── state/                 # State Management
│   ├── types/
│   │   ├── GameState.ts
│   │   └── StateChange.ts
│   ├── initial/
│   │   └── initialState.ts
│   └── validators/
│       └── stateValidator.ts
│
├── ui/                    # React UI Components
│   ├── components/
│   │   ├── pet/
│   │   ├── inventory/
│   │   ├── battle/
│   │   └── world/
│   ├── screens/
│   │   ├── MainScreen.tsx
│   │   ├── PetScreen.tsx
│   │   └── BattleScreen.tsx
│   ├── hooks/
│   │   ├── useGameState.ts
│   │   └── useGameAction.ts
│   └── contexts/
│       └── GameContext.tsx
│
├── assets/               # Game Assets
│   ├── sprites/
│   ├── sounds/
│   └── data/
│       ├── pets.json
│       ├── items.json
│       └── locations.json
│
└── utils/                # Utility Functions
    ├── math/
    ├── random/
    └── performance/
```

## Key Technical Decisions

### Event Flow Architecture

1. **Event Generation** → Event sources emit typed events
2. **Event Queuing** → EventBus maintains priority queue
3. **Event Processing** → GameEngine processes events sequentially
4. **Action Mapping** → ActionProcessor converts events to actions
5. **System Execution** → Domain systems process actions
6. **State Update** → StateManager applies immutable changes
7. **Effect Scheduling** → EffectManager handles side effects
8. **UI Update** → React components re-render with new state

### State Management Pattern

```typescript
// Immutable state updates using Immer
interface StateManager {
  applyChanges(state: GameState, changes: StateChange[]): GameState {
    return produce(state, draft => {
      changes.forEach(change => {
        // Apply change to draft
        setByPath(draft, change.path, change.value);
      });
    });
  }
}

// State change tracking
interface StateChange {
  path: string[];        // ['pets', '0', 'stats', 'hunger']
  operation: 'SET' | 'INCREMENT' | 'PUSH' | 'REMOVE';
  value: any;
  timestamp: number;
  source: string;        // System that created change
}
```

### Event Priority System

```typescript
enum EventPriority {
  IMMEDIATE = 0,  // User actions - process immediately
  HIGH = 1,       // Battle actions - process soon
  NORMAL = 2,     // Tick events - regular priority
  LOW = 3,        // Background tasks - can defer
}

// Priority queue implementation
class EventQueue {
  private queues: Map<EventPriority, GameEvent[]>;
  
  dequeue(): GameEvent | null {
    for (let priority = 0; priority <= 3; priority++) {
      const queue = this.queues.get(priority);
      if (queue?.length > 0) {
        return queue.shift();
      }
    }
    return null;
  }
}
```

## Design Patterns Used

### Observer Pattern
- **Used in**: Event system
- **Purpose**: Decouple event sources from handlers
- **Implementation**: EventEmitter with subscription management

### Command Pattern
- **Used in**: Action system
- **Purpose**: Encapsulate state changes as objects
- **Implementation**: Action objects with execute/undo methods

### Strategy Pattern
- **Used in**: Stat decay curves, AI behaviors
- **Purpose**: Allow algorithm selection at runtime
- **Implementation**: Interchangeable decay/behavior strategies

### Factory Pattern
- **Used in**: Pet creation, item generation
- **Purpose**: Centralize object creation logic
- **Implementation**: PetFactory, ItemFactory classes

### State Pattern
- **Used in**: Pet states, battle flow
- **Purpose**: Manage complex state transitions
- **Implementation**: State machines with transition rules

## Component Relationships

### System Dependencies
```
GameEngine
├── EventBus (processes events)
├── ActionProcessor (maps events to actions)
├── StateManager (manages state)
├── EffectManager (handles effects)
└── Systems[]
    ├── PetSystem
    ├── InventorySystem
    ├── BattleSystem
    ├── WorldSystem
    ├── ProgressionSystem
    ├── EconomySystem
    ├── TimeSystem
    ├── SaveSystem
    ├── NotificationSystem
    └── AnalyticsSystem
```

### Data Flow
1. **Input** → User interaction or timer tick
2. **Event** → Created by event source
3. **Queue** → Added to priority queue
4. **Process** → GameEngine dequeues and processes
5. **Action** → Event mapped to domain action
6. **Execute** → System processes action
7. **Change** → State changes generated
8. **Update** → New state created
9. **Effect** → Side effects scheduled
10. **Render** → UI updates with new state

## Critical Implementation Paths

### Game Initialization
```typescript
1. Load saved state or create initial state
2. Initialize GameEngine with state
3. Register all domain systems
4. Setup event sources
5. Start game tick timer
6. Render initial UI
```

### Tick Processing
```typescript
1. TickEventSource emits tick event
2. GameEngine processes tick event
3. TimeSystem updates game time
4. PetSystem updates all pet stats
5. WorldSystem updates world state
6. SaveSystem performs autosave
7. UI updates to reflect changes
```

### User Action Flow
```typescript
1. User clicks "Feed Pet" button
2. InputEventSource emits FeedPetEvent
3. ActionProcessor creates FeedPetAction
4. InventorySystem validates food item
5. PetSystem applies feeding effects
6. InventorySystem removes food item
7. EffectManager plays animation/sound
8. UI updates pet stats display
```

## Performance Considerations

### Web Worker Usage
- **Offline calculations**: Process ticks in background
- **Pathfinding**: Calculate exploration paths
- **Battle simulation**: AI decision making
- **Save compression**: Compress save data

### Caching Strategy
```typescript
interface CacheLayer {
  computed: Map<string, CachedValue>;  // Computed values
  assets: Map<string, Asset>;          // Loaded assets
  queries: Map<string, QueryResult>;   // Database queries
}

interface CachedValue {
  value: any;
  timestamp: number;
  ttl: number;  // Time to live in ms
}
```

### Optimization Techniques
1. **Virtual scrolling** for large lists
2. **Sprite batching** for rendering
3. **Lazy loading** for assets
4. **Debouncing** for frequent updates
5. **Memoization** for expensive calculations
6. **Object pooling** for frequent allocations

## Security Considerations

### Save Data Protection
- Validate all loaded save data
- Checksum verification
- Version compatibility checks
- Corruption recovery mechanisms

### State Validation
- Validate all state changes
- Prevent impossible states
- Boundary checks on all values
- Type validation with TypeScript

### Client-Side Security
- No sensitive data in client
- All game logic client-side
- Future server validation for multiplayer
- Anti-cheat considerations for leaderboards

## Future Architecture Considerations

### Multiplayer Readiness
- Event replay system in place
- Deterministic state updates
- Action synchronization patterns
- Conflict resolution strategies

### Platform Expansion
- Modular rendering layer
- Platform-specific adapters
- Cloud save integration points
- Cross-platform state sync

### Monetization Integration
- Premium feature flags
- IAP transaction handling
- Ad placement system
- Analytics event tracking

## Testing Strategy

### Unit Test Coverage
- Each system tested in isolation
- Mock dependencies injected
- State transformation tests
- Business rule validation

### Integration Tests
- System interaction tests
- Event flow validation
- State persistence tests
- Performance benchmarks

### E2E Tests
- Complete user flows
- Save/load cycles
- Offline progression
- UI interaction tests

## Development Guidelines

### Code Standards
- TypeScript strict mode
- No `any` types
- ESLint configuration
- Prettier formatting

### Documentation Requirements
- JSDoc for public APIs
- README for each system
- Architecture decision records
- Change logs

### Review Process
- PR required for main branch
- Code review checklist
- Test coverage requirements
- Performance impact assessment