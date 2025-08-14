# Domain Layer

The domain layer contains the core business logic of the game, organized into four distinct domains with clear ownership boundaries.

## Domain-Driven Design Principles

Each domain:

- **Owns specific data** - No overlapping responsibilities
- **Manages its own state** - Internal consistency and validation
- **Communicates via events** - No direct domain-to-domain calls
- **Provides domain services** - Business logic encapsulated

## Core Domains

### 🚧 Pet Domain (`pet/`)

**Status: Not Implemented**

**Owns:**

- Individual pet data (stats, personality, relationships)
- Pet evolution and growth logic
- Stat decay calculations
- Mood determination

**Key Responsibilities:**

- Calculate hunger/happiness/energy/hygiene/health decay
- Manage personality development through interactions
- Handle level-up and evolution triggers
- Determine pet mood from current stats

**Does NOT own:**

- Items (owned by Player domain)
- Locations (owned by World domain)
- Battle execution (handled by Battle Activity System)

### 🚧 Player Domain (`player/`)

**Status: Not Implemented**

**Owns:**

- Player profile and progression
- Inventory management
- Currency tracking
- Achievement system
- Discovery records

**Key Responsibilities:**

- Add/remove items from inventory with capacity limits
- Track player experience and leveling
- Manage currency transactions
- Unlock and track discoveries

**Does NOT own:**

- Pet stats (owned by Pet domain)
- Market prices (owned by World domain)
- Item effects (handled by Activity Systems)

### 🚧 World Domain (`world/`)

**Status: Not Implemented**

**Owns:**

- Game world state and environment
- Location definitions and properties
- NPC behavior and schedules
- Market economy with dynamic pricing
- Environmental conditions (time, weather, seasons)

**Key Responsibilities:**

- Update day/night cycles and weather
- Calculate market price fluctuations based on supply/demand
- Manage NPC availability and dialogue
- Control world events and special occasions

**Does NOT own:**

- Player inventory (owned by Player domain)
- Pet locations (pets follow player)
- Activity execution (handled by Activity Systems)

### 🚧 Item Domain (`item/`)

**Status: Not Implemented**

**Owns:**

- Item definitions and properties
- Crafting recipes and requirements
- Item effects and interactions
- Salvaging recipes

**Key Responsibilities:**

- Define item categories, rarity, and base properties
- Specify crafting recipes and material requirements
- Define item effects when used
- Determine salvaging outcomes

**Does NOT own:**

- Item ownership (handled by Player domain)
- Current market prices (owned by World domain)
- Using items (handled by Activity Systems)

## Planned Domain Structure

```
domains/
├── pet/
│   ├── Pet.ts                 # Core pet entity
│   ├── PetStats.ts           # Stats management
│   ├── PetPersonality.ts     # Personality system
│   ├── PetEvolution.ts       # Growth and evolution
│   └── index.ts              # Pet domain exports
├── player/
│   ├── Player.ts             # Core player entity
│   ├── Inventory.ts          # Inventory management
│   ├── Achievements.ts       # Achievement system
│   ├── Progression.ts        # Level and XP system
│   └── index.ts              # Player domain exports
├── world/
│   ├── World.ts              # World state management
│   ├── Location.ts           # Location definitions
│   ├── Market.ts             # Economy system
│   ├── NPC.ts                # NPC behavior
│   └── index.ts              # World domain exports
└── item/
    ├── Item.ts               # Item definitions
    ├── ItemEffects.ts        # Effect system
    ├── CraftingRecipes.ts    # Crafting system
    └── index.ts              # Item domain exports
```

## Domain Communication

Domains communicate **only** through the event system:

```typescript
// ❌ Wrong - Direct domain communication
const pet = petDomain.getPet(petId);
playerDomain.addExperience(pet.level * 10);

// ✅ Correct - Event-driven communication
eventBus.emit({
  type: 'pet.action.completed',
  payload: { petId, actionType: 'feed', experienceGained: 10 },
  priority: EventPriority.NORMAL,
  timestamp: Date.now(),
});
```

## Implementation Guidelines

### Domain Entity Pattern

Each domain provides:

1. **Entity classes** - Core data structures
2. **Repository pattern** - Data access and persistence
3. **Domain services** - Business logic operations
4. **Event handlers** - React to domain events
5. **Factory methods** - Entity creation

### Example Domain Service

```typescript
// pet/PetService.ts
export class PetService {
  updateStats(pet: Pet, deltaTime: number): Pet {
    const decay = this.calculateStatDecay(pet, deltaTime);
    return {
      ...pet,
      stats: {
        hunger: Math.max(0, pet.stats.hunger - decay.hunger),
        happiness: Math.max(0, pet.stats.happiness - decay.happiness),
        energy: Math.max(0, pet.stats.energy - decay.energy),
        hygiene: Math.max(0, pet.stats.hygiene - decay.hygiene),
        health: Math.max(0, pet.stats.health - decay.health),
      },
    };
  }
}
```

## Testing Strategy

Each domain will have:

- **Unit tests** for domain logic
- **Integration tests** with event system
- **Mock repositories** for isolated testing
- **Property-based tests** for invariants

## Next Steps

1. Implement Pet domain with stat decay system
2. Implement Player domain with inventory management
3. Implement Item domain with effect definitions
4. Implement World domain with basic locations
5. Add comprehensive test coverage for all domains

## Performance Considerations

- Domains use immutable data structures
- Event handlers are async to prevent blocking
- Repository pattern enables efficient caching
- Domain services are stateless for easy testing
