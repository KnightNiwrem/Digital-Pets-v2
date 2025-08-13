# HTML5 Digital Pet Game - Enhanced Architecture Specification

## Project Overview
A sophisticated HTML5 client-side digital pet raising game with deep gameplay mechanics, built using a three-layer event-driven architecture for scalability, maintainability, and performance.

## Core Architecture Philosophy

### Three-Layer Event-Driven Architecture
1. **Layer 1: Event Sources** - Capture and emit events from various sources (user input, timers, system)
2. **Layer 2: Game Engine** - Process events, coordinate systems, manage state transitions
3. **Layer 3: Domain Systems** - Encapsulate domain-specific business logic

This architecture ensures clean separation of concerns, testability, and extensibility.

## Layer 1: Event Sources

### Event System
- **EventEmitter**: Central event bus with priority queue (Immediate, High, Normal, Low)
- **Event Sources**:
  - InputEventSource: User interactions with validation and feedback
  - TickEventSource: Configurable game timer (default 15s intervals)
  - SystemEventSource: Browser/system events, PWA lifecycle
  - ActivityEventSource: Timed activities and completion events

## Layer 2: Game Engine

### Core Components

#### GameEngine
**Responsibilities**: Central coordinator for event processing and game flow
**Features**:
- Priority-based event queue management
- Transaction-like state updates (all-or-nothing)
- System execution ordering based on dependencies
- Rollback capability for failed operations
- Performance monitoring and adaptive processing

#### ActionProcessor
**Responsibilities**: Transform events into domain-specific actions
**Features**:
- Event-to-action mapping
- Action validation against current state
- Compensating actions for rollback
- Batch action processing

#### StateManager
**Responsibilities**: Manage immutable state transitions
**Features**:
- Immutable state operations using structural sharing
- State history with undo capability
- State diffing for optimized updates
- Serialization/deserialization for saves
- State validation and corruption recovery

#### EffectManager
**Responsibilities**: Handle side effects outside state changes
**Features**:
- Sound effects and music management
- Visual animations and particle effects
- Achievement notifications
- Analytics tracking
- Asynchronous save operations

## Layer 3: Domain Systems

### PetSystem
**Responsibilities**: Comprehensive pet management including stats, growth, personality, and relationships

**Core Features**:
- **Pet Rarities**: 10 common (3 starters), 8 uncommon, 6 rare, 4 epic, 3 legendary
- **Stats System**:
  - Displayed stats: Satiety, Hydration, Happiness, Energy, Hygiene
  - Hidden counters with configurable decay curves (linear, exponential, logarithmic)
  - Stat modifiers and buffs/debuffs
- **Health System**:
  - Health states: Healthy, Injured, Sick (with specific illnesses)
  - Condition tracking with immunities
  - Medicine and recovery mechanics
- **Growth System**:
  - ~50 growth stages over ~2 real years
  - Branching evolution paths based on care quality
  - Stage-specific energy caps and recovery rates

**Advanced Features**:
- **Personality System**:
  - Dynamic personality traits developed through interactions
  - Preferences affecting pet behavior
  - Mood calculation based on multiple factors
- **Relationship System**:
  - Bonds with other pets and NPCs
  - Relationship levels affecting interactions
  - Social needs and group dynamics
- **Breeding System**:
  - Genetic trait inheritance
  - Rarity combinations
  - Offspring variations
- **Life Mechanics**:
  - Maximum lifespan of 1,000,000 ticks
  - Variable depletion rates based on conditions
  - Death and rebirth cycle with egg system

### InventorySystem
**Responsibilities**: Item management, crafting, and trading

**Features**:
- **Item Categories**:
  - Consumables (food/drinks) with stat effects
  - Equipment with durability system
  - Medicine for health conditions
  - Crafting materials and components
  - Special items (eggs, evolution stones)
- **Crafting System**:
  - Recipe-based crafting with success rates
  - Tool requirements
  - Material salvaging
- **Storage Management**:
  - Limited inventory with expansion options
  - Item stacking and organization
  - Storage sorting and filtering
- **Trading System**:
  - NPC trading with dynamic prices
  - Trade offers and negotiations
  - Auction house (future multiplayer ready)

### BattleSystem
**Responsibilities**: Turn-based combat with environmental factors

**Features**:
- **Combat Mechanics**:
  - Turn-based system with priority and speed
  - Elemental type advantages
  - Critical hits and miss chances
  - Status effects (buffs/debuffs)
- **Environmental Factors**:
  - Terrain effects on combat
  - Weather conditions affecting moves
  - Environmental hazards
- **Advanced Features**:
  - Combo system for chaining moves
  - Tournament system with brackets
  - Training facilities for stat improvement
  - Adaptive AI that learns player patterns
- **Battle Stats**:
  - Attack, Defense, Speed, Health
  - Elemental affinities
  - Move sets with PP system

### WorldSystem
**Responsibilities**: Dynamic game world with locations, NPCs, and activities

**Features**:
- **Dynamic World**:
  - Multiple regions with unique characteristics
  - Day/night cycle affecting activities
  - Seasonal changes and events
  - World state that evolves over time
- **Locations**:
  - Towns with facilities (shops, centers, gyms)
  - Wild areas for exploration
  - Hidden locations with discovery system
  - Starting city + 10+ destinations
- **NPC System**:
  - Dynamic NPCs with schedules
  - Relationship building with reputation
  - Quest givers and merchants
  - Dialogue trees with choices
- **Activities**:
  - Resource gathering (foraging, fishing, mining)
  - Exploration with random encounters
  - Mini-games for rewards
  - Time-based activities with rewards

### ProgressionSystem
**Responsibilities**: Player advancement and achievements

**Features**:
- **Player Level System**:
  - Experience from various activities
  - Level-based unlocks
  - Skill point allocation
- **Skill System**:
  - Trainable skills affecting gameplay
  - Skill trees with specializations
  - Passive and active abilities
- **Achievement System**:
  - Short and long-term goals
  - Rewards for completion
  - Statistics tracking
- **Mastery System**:
  - Long-term progression goals
  - Category-based mastery (Pet Care, Battle, Exploration)
  - Prestige system for dedicated players

### EconomySystem
**Responsibilities**: Economic simulation and currency management

**Features**:
- **Currency Types**:
  - Standard currency (gold/coins)
  - Premium currency (gems) - future monetization ready
  - Activity-specific currencies
- **Market Dynamics**:
  - Supply and demand affecting prices
  - Market fluctuations
  - Seasonal price changes
- **Banking**:
  - Savings accounts with interest
  - Investment opportunities
  - Property ownership

### TimeSystem
**Responsibilities**: Game timing and offline progression

**Features**:
- **Game Tick**: 15-second base interval
- **Offline Progression**:
  - Smart calculation based on offline duration
  - Simplified calculations for >24 hour periods
  - Prevents UI freezing with worker threads
- **Time Management**:
  - Pause/resume functionality
  - Speed modifiers for testing
  - Real-time clock integration

### SaveSystem
**Responsibilities**: Data persistence and recovery

**Features**:
- **Save Management**:
  - Multiple save slots
  - Autosave every tick
  - Manual save option
  - Quick save/load
- **Storage Strategy**:
  - Primary: LocalStorage for quick access
  - Fallback: IndexedDB for larger saves
  - Future: Cloud sync preparation
- **Data Integrity**:
  - Save validation and checksums
  - Corruption detection and repair
  - Import/export functionality
  - Version migration support

### NotificationSystem
**Responsibilities**: User notifications and alerts

**Features**:
- In-game notification queue
- PWA push notifications
- Event feed history
- Customizable notification preferences

### AnalyticsSystem
**Responsibilities**: Performance and behavior tracking

**Features**:
- Event tracking for user actions
- Performance metrics collection
- A/B testing framework
- Automated reporting

## GameState Structure

```typescript
interface GameState {
  // Metadata
  version: string;
  timestamp: number;
  sessionId: string;
  
  // Core Data
  player: PlayerProfile;
  pets: {
    active: Pet[];
    stored: Pet[];
    graveyard: Pet[];
  };
  inventory: Inventory;
  world: WorldState;
  economy: Economy;
  
  // Active States
  activities: ActiveActivity[];
  battles: Battle[];
  quests: QuestState[];
  
  // UI State
  ui: {
    currentScreen: string;
    preferences: UserPreferences;
    tutorialProgress: TutorialState;
  };
  
  // System Data
  statistics: GameStatistics;
  achievements: Achievement[];
}
```

## Performance Optimizations

### Computation Strategies
- **Web Workers**: Offline calculations, pathfinding, battle simulations
- **Lazy Evaluation**: Calculate values only when needed
- **Batch Processing**: Group similar operations
- **Caching**: Multi-level cache with TTL

### Rendering Optimizations
- **Virtual Scrolling**: For large lists
- **Sprite Batching**: Combined render calls
- **Progressive Loading**: On-demand asset loading
- **RequestAnimationFrame**: Smooth animations

## Technical Stack

### Core Technologies
- **TypeScript** (strict mode) - Type safety
- **React 18+** - Modern UI with concurrent features
- **Zustand/Valtio** - State management
- **Immer** - Immutable state updates

### Build & Development
- **Vite** - Fast development and builds
- **SWC** - Fast transpilation
- **Vitest** - Unit testing
- **Playwright** - E2E testing

### Libraries
- **date-fns** - Time calculations
- **uuid** - Unique identifiers
- **localforage** - Storage abstraction
- **workbox** - PWA support

## Development Phases

### Phase 1: Core Infrastructure (Week 1-2)
- Three-layer architecture setup
- Event system and GameEngine
- State management
- Basic UI framework

### Phase 2: Essential Systems (Week 3-4)
- PetSystem (basic features)
- InventorySystem (basic)
- TimeSystem
- SaveSystem

### Phase 3: Gameplay Loop (Week 5-6)
- Pet care mechanics
- Basic activities
- Simple progression
- UI polish

### Phase 4: Advanced Features (Week 7-8)
- BattleSystem
- WorldSystem basics
- Quest system
- NPC interactions

### Phase 5: Polish & Balance (Week 9-10)
- Performance optimization
- Game balancing
- Bug fixes
- PWA features

### Phase 6: Extended Features (Post-launch)
- Economy system
- Breeding system
- Tournaments
- Social features

## Success Metrics

### Technical Metrics
- 60 FPS during gameplay
- < 3 second initial load
- < 100ms input response
- < 500ms offline calculation

### Engagement Metrics
- Daily Active Users
- Average session length
- D1/D7/D30 retention
- Achievement completion rate

### Quality Metrics
- < 1% crash rate
- > 90% test coverage
- < 5% save corruption
- > 95% recovery success

## Future Expansion Ready

### Multiplayer Preparation
- Event replay system
- State synchronization patterns
- Conflict resolution strategies
- Server authoritative design ready

### Monetization Ready
- Premium currency system
- IAP integration points
- Ad placement system
- Cosmetic shop infrastructure

### Platform Expansion
- PWA for mobile
- Electron for desktop
- Cloud save sync
- Cross-platform progression

## Key Improvements from Original Design

1. **Three-layer architecture** replacing mixed Actor/System responsibilities
2. **Priority-based event system** for better performance
3. **Advanced state management** with history and rollback
4. **Personality and relationship systems** for deeper gameplay
5. **Dynamic world** that evolves over time
6. **Comprehensive progression systems** for long-term engagement
7. **Performance optimizations** using Web Workers and caching
8. **Robust save system** with corruption recovery
9. **Clear development roadmap** with phased approach
10. **Future-ready design** for multiplayer and monetization

This architecture provides a professional-grade foundation that balances immediate playability with long-term sustainability and growth potential.
