# Activity Systems Layer

Activity systems orchestrate interactions between multiple domains to implement gameplay features. They are the "conductors" that coordinate domain operations without owning any data themselves.

## Architecture Principle

Activity systems:
- **Orchestrate domains** - Coordinate between Pet, Player, World, and Item domains
- **Own no data** - All data belongs to domains
- **Implement game features** - Turn-based battles, crafting, exploration
- **Handle complex workflows** - Multi-step processes involving several domains

## Activity Systems

### 🚧 Care System (`CareSystem.ts`)

**Status: Not Implemented**

**Orchestrates:** Pet Domain ↔ Player Domain ↔ Item Domain

**Responsibilities:**
- Feed pets with food items from player inventory
- Hydrate pets with drinks
- Play with pets using toys
- Administer medicine to sick pets
- Groom pets for hygiene

**Workflow Example:**
```typescript
// Feeding a pet workflow:
// 1. Validate player has food item (Player Domain)
// 2. Check pet can be fed (Pet Domain)  
// 3. Remove food from inventory (Player Domain)
// 4. Apply food effects to pet (Pet Domain)
// 5. Update pet happiness/bond (Pet Domain)
// 6. Grant experience to player (Player Domain)
```

### 🚧 Battle System (`BattleSystem.ts`)

**Status: Not Implemented**

**Orchestrates:** Pet Domain ↔ World Domain

**Responsibilities:**
- Initialize battles with environmental factors
- Process turn-based combat mechanics
- Calculate damage using pet stats and abilities
- Apply environmental battle modifiers
- Distribute experience and rewards after battle

**Features:**
- Turn-based strategic combat
- Elemental type advantages
- Environmental battle factors (weather, location)
- Combo move system
- AI opponents with different difficulty levels

### 🚧 Trade System (`TradeSystem.ts`)

**Status: Not Implemented**

**Orchestrates:** Player Domain ↔ World Domain ↔ Item Domain

**Responsibilities:**
- Buy items from NPCs at current market prices
- Sell items with dynamic pricing
- Handle special NPC trade offers
- Update market supply/demand based on transactions
- Process bulk transactions efficiently

**Features:**
- Dynamic market pricing based on supply/demand
- NPC-specific trade preferences and discounts
- Bulk transaction support
- Special rare item trades

### 🚧 Craft System (`CraftSystem.ts`)

**Status: Not Implemented**

**Orchestrates:** Player Domain ↔ Item Domain

**Responsibilities:**
- Combine materials following crafting recipes
- Salvage items into component materials
- Upgrade equipment with enhancement materials
- Discover new recipes through experimentation
- Handle crafting failures and critical successes

**Features:**
- Recipe-based crafting with material requirements
- Item salvaging for material recovery
- Equipment upgrading system
- Recipe discovery mechanics

### 🚧 Explore System (`ExploreSystem.ts`)

**Status: Not Implemented**

**Orchestrates:** Player Domain ↔ World Domain ↔ Pet Domain

**Responsibilities:**
- Navigate between locations
- Discover hidden areas and secrets
- Encounter wild pets in different biomes
- Gather location-specific resources
- Complete location-based activities and quests

**Features:**
- Location unlocking system
- Resource gathering mechanics
- Wild pet encounters
- Hidden area discovery
- Environmental storytelling

## Activity System Architecture

### Base Activity System Pattern

```typescript
// Base pattern all activity systems follow
export abstract class ActivitySystem {
  constructor(
    protected eventBus: EventBus,
    protected stateCoordinator: StateCoordinator
  ) {}

  // All activity systems implement command creation
  abstract createCommand(action: string, payload: unknown): Command;
  
  // Common validation logic
  protected validateState(state: GameState): boolean {
    return this.stateCoordinator.validateState(state);
  }
  
  // Common event emission
  protected emitEvent(type: string, payload: unknown): void {
    this.eventBus.emit({
      type,
      payload,
      timestamp: Date.now(),
      priority: EventPriority.NORMAL
    });
  }
}
```

### Command-Driven Operations

Activity systems create commands that are processed by the CommandProcessor:

```typescript
// Example: Feed Pet Command
export class FeedPetCommand implements Command<FeedPetPayload> {
  constructor(public payload: FeedPetPayload) {}

  validate(state: GameState): boolean {
    const { petId, itemId, playerId } = this.payload;
    
    // Check player has the item
    const playerItem = state.player.inventory.items.find(i => i.itemId === itemId);
    if (!playerItem || playerItem.quantity < 1) return false;
    
    // Check pet exists and can be fed
    const pet = state.pets[petId];
    if (!pet) return false;
    
    // Check item is food
    const item = state.items[itemId];
    return item?.category === ItemCategory.FOOD;
  }

  execute(state: GameState): StateChange[] {
    const { petId, itemId } = this.payload;
    const item = state.items[itemId];
    
    return [
      // Remove item from inventory
      { path: `player.inventory.items[${itemId}].quantity`, newValue: playerItem.quantity - 1 },
      // Apply food effects to pet
      { path: `pets.${petId}.stats.hunger`, newValue: Math.min(100, pet.stats.hunger + 20) },
      { path: `pets.${petId}.stats.happiness`, newValue: Math.min(100, pet.stats.happiness + 5) }
    ];
  }
}
```

## Planned Structure

```
activities/
├── CareSystem.ts           # Pet care activities
├── BattleSystem.ts         # Combat system
├── TradeSystem.ts          # Economy interactions
├── CraftSystem.ts          # Item creation
├── ExploreSystem.ts        # World exploration
├── commands/               # Command implementations
│   ├── FeedPetCommand.ts
│   ├── BattleMoveCommand.ts
│   ├── CraftItemCommand.ts
│   └── index.ts
├── sessions/               # Activity session management
│   ├── BattleSession.ts
│   ├── ExploreSession.ts
│   └── index.ts
└── index.ts               # Activity exports
```

## Testing Strategy

Activity systems require integration testing:

```typescript
// Example integration test
describe('CareSystem', () => {
  it('should feed pet and update stats', async () => {
    const gameState = createTestGameState();
    const careSystem = new CareSystem(eventBus, stateCoordinator);
    
    const command = careSystem.feedPet('pet-1', 'apple-001');
    const newState = commandProcessor.process(command, gameState);
    
    expect(newState.pets['pet-1'].stats.hunger).toBeGreaterThan(gameState.pets['pet-1'].stats.hunger);
  });
});
```

## Error Handling

Activity systems implement robust error handling:

- **Validation failures** - Return clear error messages
- **State inconsistencies** - Rollback partial operations
- **Domain constraints** - Respect domain business rules
- **Concurrency issues** - Handle simultaneous operations

## Performance Considerations

- Commands are batched for efficiency
- Complex workflows use async processing
- State changes are minimized using targeted updates
- Activity sessions track resource usage

## Next Steps

1. Implement Care System for basic pet interactions
2. Create Command classes for all core operations
3. Add comprehensive integration tests
4. Implement Battle System for combat mechanics
5. Add activity session management for long-running operations