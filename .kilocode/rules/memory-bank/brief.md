# HTML5 Digital Pet Game - Enhanced Architecture Specification

## Project Overview

A sophisticated HTML5 client-side digital pet raising game with deep gameplay mechanics, built using a domain-driven architecture with clear separation of concerns for scalability, maintainability, and performance.

## Core Architecture Philosophy

### Domain-Driven Design with Event-Driven Architecture

The game is organized into four distinct layers with clear boundaries:

1. **Input Layer** - Captures all external events
2. **Orchestration Layer** - Coordinates event processing and state management
3. **Domain Layer** - Encapsulates business logic in focused domains
4. **Presentation Layer** - Handles all UI and user feedback

This architecture ensures no overlapping responsibilities and clear ownership of data and operations.

## Layer 1: Input Layer

### Purpose

Convert all external inputs into domain events.

### Components

- **UserInputHandler**: Mouse, touch, and keyboard events with validation
- **TimerSystem**: Game tick events (default 15-second intervals)
- **SystemEventHandler**: Browser events, PWA lifecycle, save/load triggers

## Layer 2: Orchestration Layer

### Core Components

#### EventBus

- Priority-based event queue (Immediate > High > Normal > Low)
- Publish-subscribe pattern for loose coupling
- Event replay capability for debugging

#### CommandProcessor

- Converts events into validated commands
- Transaction-like execution (all-or-nothing)
- Undo/redo support through command history

#### StateCoordinator

- Immutable state management with structural sharing
- State validation and corruption recovery
- Snapshot creation and restoration
- Efficient diff calculation for UI updates

## Layer 3: Domain Layer

### Core Domains (Data Ownership)

#### Pet Domain

**Owns**: Individual pet data and behavior

- **Stats**: Hunger, happiness, energy, hygiene, health (0-100 scale)
- **Battle Stats**: Level, HP, attack, defense, speed
- **Abilities**: Moves and special traits for battle
- **Growth**: Age, evolution stages, experience
- **Personality**: Dynamic traits, mood, preferences
- **Relationships**: Bonds with player and other pets

**Key Responsibilities**:

- Calculate stat decay over time
- Manage mood based on stats
- Handle level-up and evolution
- Develop personality through interactions

#### Player Domain

**Owns**: Player profile and resources

- **Inventory**: Items with quantities and capacity limits
- **Currency**: Coins (standard) and gems (premium)
- **Progression**: Level, experience, achievements
- **Discovery**: Unlocked pets, locations, items
- **Pet Ownership**: Active, stored, and memorial pets
- **Settings**: Preferences and configurations

**Key Responsibilities**:

- Manage item storage and organization
- Track player achievements and statistics
- Handle currency transactions
- Maintain discovery records

#### World Domain

**Owns**: Game world state and environment

- **Locations**: Places with unique properties and activities
- **NPCs**: Non-player characters with dialogue and trades
- **Market**: Dynamic economy with supply/demand pricing
- **Environment**: Time of day, weather, seasons
- **Events**: World events and special occasions

**Key Responsibilities**:

- Update environmental conditions
- Manage NPC behavior and schedules
- Calculate market price fluctuations
- Control world event timing

#### Item Domain

**Owns**: Item definitions and properties

- **Categories**: Food, drinks, toys, medicine, grooming, materials
- **Properties**: Effects, rarity, value, stack limits
- **Recipes**: Crafting requirements and outputs
- **Salvaging**: Breakdown into component materials

**Key Responsibilities**:

- Define item effects and interactions
- Specify crafting recipes
- Determine salvage outcomes

### Activity Systems (Domain Orchestration)

These systems coordinate between domains to implement gameplay features:

#### Care System

Manages pet care activities using Pet, Player, and Item domains.

- Feed pets with food items
- Hydrate with drinks
- Play with toys
- Administer medicine
- Groom for hygiene

#### Battle System

Handles turn-based combat using Pet and World domains.

- Initialize battles with environmental factors
- Process moves with type advantages
- Calculate damage and effects
- Distribute experience and rewards

#### Trade System

Manages economy using Player, World, and Item domains.

- Buy items from NPCs at market prices
- Sell items with price negotiation
- Trade pets for special rewards
- Handle special deals and events

#### Craft System

Handles item creation using Player and Item domains.

- Combine materials following recipes
- Salvage items into components
- Upgrade equipment with enhancements
- Discover new recipes through experimentation

#### Explore System

Manages exploration using Player, World, and Pet domains.

- Navigate to new locations
- Discover hidden areas
- Encounter wild pets
- Gather resources
- Complete location-specific activities

### Support Systems (Infrastructure)

#### Time System

- Game tick management (15-second default)
- Offline progress calculation
- Pause/resume functionality
- Time-based event scheduling

#### Save System

- Multi-slot save management
- Auto-save every tick
- Save validation and repair
- Import/export functionality

#### Notification System

- In-game notifications
- Achievement popups
- System messages
- PWA push notifications

## Layer 4: Presentation Layer

### Components

- **UI Components**: React components with Tailwind CSS
- **Sound Manager**: Music and effects with volume control
- **Animation Manager**: Sprite animations and transitions
- **Accessibility**: Screen reader support and keyboard navigation

## Technical Implementation

### State Structure

```typescript
interface GameState {
  player: PlayerState;
  pets: Map<string, PetState>;
  world: WorldState;
  items: Map<string, ItemDefinition>;
  activities: ActiveActivity[];
  ui: UIState;
  metadata: GameMetadata;
}
```

### Event Flow

1. User performs action → Input Layer captures
2. Input Layer → Creates event with priority
3. EventBus → Queues event by priority
4. CommandProcessor → Validates and executes
5. Domains → Update their state immutably
6. StateCoordinator → Merges changes
7. Presentation Layer → Updates UI

### Performance Optimizations

- Web Workers for offline calculations
- Virtual scrolling for large lists
- Lazy loading of assets
- Memoization of expensive computations
- Sprite batching for animations

## Game Content

### Pets

- **31 Species Total**:
  - 10 Common (3 starters)
  - 8 Uncommon
  - 6 Rare
  - 4 Epic
  - 3 Legendary

### Progression

- **Pet Growth**: ~50 stages over ~2 real years
- **Player Levels**: 100 levels with milestone rewards
- **Achievements**: 100+ achievements across categories
- **Mastery System**: Long-term goals for dedicated players

### World

- **Starting City**: Tutorial and basic facilities
- **10+ Locations**: Each with unique activities
- **Dynamic Events**: Seasonal and special events
- **Hidden Areas**: Secret locations to discover

### Activities

- **Daily Tasks**: 5-15 minute sessions
- **Extended Play**: 30+ minute exploration
- **Mini-games**: Quick activities for rewards
- **Tournaments**: Competitive battles

## Development Phases

### Phase 1: Core Infrastructure (Week 1)

- Event system and orchestration layer
- State management
- Basic UI framework
- Save system

### Phase 2: Core Domains (Week 2)

- Pet domain with stats
- Player domain with inventory
- Item definitions
- Basic world structure

### Phase 3: Care Gameplay (Week 3)

- Care system implementation
- Time system with ticks
- Stat decay and mood
- Pet care UI

### Phase 4: Extended Features (Week 4-5)

- Battle system
- Trade system
- Explore system
- Additional locations

### Phase 5: Polish (Week 6)

- Animations and sound
- Tutorial system
- Achievements
- Performance optimization

## Success Metrics

### Technical

- 60 FPS gameplay
- < 3 second initial load
- < 100ms input response
- < 5% save corruption rate

### Engagement

- 50% D1 retention
- 30% D7 retention
- 15-30 minute average session
- 40% achievement engagement

## Future Expansion

### Multiplayer Ready

- Event sourcing for replay
- State synchronization patterns
- Conflict resolution strategies

### Monetization Ready

- Premium currency system
- Cosmetic shop infrastructure
- Battle pass framework

### Platform Ready

- PWA for mobile
- Desktop wrapper support
- Cloud save preparation

## Key Design Decisions

### Why Domain-Driven?

- **Clear Boundaries**: Each domain owns specific data
- **No Overlaps**: Single source of truth for each concept
- **Maintainable**: Easy to understand and modify
- **Testable**: Domains can be tested independently

### Why Event-Driven?

- **Loose Coupling**: Domains don't directly depend on each other
- **Extensible**: Easy to add new features
- **Debuggable**: Complete event history
- **Replayable**: Reproduce bugs easily

### Why Immutable State?

- **Predictable**: No hidden mutations
- **Time Travel**: Undo/redo capability
- **Performance**: React optimization
- **Debugging**: State snapshots

This architecture provides a solid foundation that balances immediate playability with long-term sustainability, ensuring the game can grow and evolve while maintaining code quality and performance.
