# Core Orchestration Layer

The core layer provides the foundational infrastructure for the game's domain-driven architecture. It handles event processing, state management, and command execution.

## Components

### ✅ EventBus (`EventBus.ts`)

**Status: Implemented**

Priority-based event system that enables loose coupling between domains.

**Features:**
- Priority-based event queue (IMMEDIATE → HIGH → NORMAL → LOW)
- Pub/Sub pattern with type-safe subscriptions
- Async event processing with error handling
- Singleton instance available as `eventBus`

**Usage:**
```typescript
import { eventBus, EventPriority } from '@/core';

// Subscribe to events
const unsubscribe = eventBus.subscribe('pet.hunger.changed', (event) => {
  console.log('Pet hunger changed:', event.payload);
});

// Emit events
eventBus.emit({
  type: 'pet.hunger.changed',
  payload: { petId: 'pet-1', newHunger: 50 },
  timestamp: Date.now(),
  priority: EventPriority.HIGH
});
```

### ✅ StateCoordinator (`StateCoordinator.ts`)

**Status: Implemented**

Manages immutable state updates using Immer for structural sharing.

**Features:**
- Immutable state updates with dot-notation paths
- State validation and integrity checks
- Snapshot creation/restoration for save/load
- Efficient structural sharing via Immer

**Usage:**
```typescript
import { stateCoordinator } from '@/core';

// Apply state changes
const newState = stateCoordinator.applyChanges(currentState, [
  { path: 'player.currencies.coins', newValue: 100 },
  { path: 'pets.pet-1.stats.hunger', newValue: 75 }
]);

// Validate state
if (!stateCoordinator.validateState(newState)) {
  throw new Error('Invalid state detected');
}
```

### 🚧 CommandProcessor (`CommandProcessor.ts`)

**Status: Not Implemented**

Will handle command validation and execution with undo/redo support.

**Planned Features:**
- Command pattern implementation
- Validation before execution
- Transaction-like all-or-nothing execution
- Undo/redo history management

### ✅ Type System (`types.ts`)

**Status: Complete**

Comprehensive type definitions for all game domains and systems.

**Key Types:**
- `GameState` - Root state interface
- `GameEvent` - Event system types
- `Command` - Command pattern interfaces
- Domain models: `Pet`, `Player`, `World`, `ItemDefinition`

## Architecture Principles

1. **Event-Driven**: Domains communicate through events, not direct calls
2. **Immutable State**: All state changes create new objects
3. **Command Pattern**: User actions become validated commands
4. **Type Safety**: Strict TypeScript with no `any` types

## Next Steps

1. Implement `CommandProcessor` with validation and undo support
2. Add comprehensive unit tests for all components
3. Create development utilities (state inspector, event debugger)
4. Add performance monitoring and metrics

## Testing

Run tests with:
```bash
bun test src/core
```

## Performance Considerations

- Events are processed asynchronously to prevent blocking
- Immer provides efficient structural sharing for large state objects
- Priority queue ensures critical events are processed first
- State validation is optimized for common failure cases