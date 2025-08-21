# Digital Pet Game Implementation Todo

## Overview

This document outlines the implementation plan for the Digital Pet game, organized into phases that ensure the game remains in a working, testable state at each stage. Each phase builds upon the previous one, adding new features while maintaining stability.

## Phase 1: Core Infrastructure (Foundation)

**Goal**: Establish the fundamental architecture and ensure basic game loop functionality.

### 1.1 Project Setup

- [x] Review existing Bun build configuration in `build.ts`
- [x] Update TypeScript configuration for game requirements
- [x] Configure Bun development server with hot reload
- [x] Update `src/index.html` as game entry point
- [x] Set up Tailwind CSS for game styling (already configured in build)
- [x] Configure Bun test framework (`bun:test`)

### 1.2 Core Systems Implementation

- [ ] **GameEngine**
  - [ ] Implement `initialize()` method
  - [ ] Implement `startGameLoop()` with requestAnimationFrame
  - [ ] Implement `tick()` method with 60-second timer
  - [ ] Implement `update(deltaTime)` for frame updates
  - [ ] Implement `registerSystem()` for system registration
  - [ ] Implement `getSystem()` for system access
  - [ ] Implement `triggerAutosave()` with reason tracking

- [ ] **TimeManager**
  - [ ] Implement `getCurrentTime()` using Date.now()
  - [ ] Implement `startTicking()` with setInterval
  - [ ] Implement `processTick()` to emit tick events
  - [ ] Implement `calculateOfflineTicks()` for offline time calculation
  - [ ] Implement `formatTimeRemaining()` utility

- [ ] **StateManager**
  - [ ] Define GameState interface
  - [ ] Implement `getState()` for state access
  - [ ] Implement `dispatch()` for state mutations
  - [ ] Implement `subscribe()` for state change listeners
  - [ ] Implement `createSnapshot()` for saving
  - [ ] Implement state validation logic

- [ ] **EventManager**
  - [ ] Implement `emit()` for synchronous events
  - [ ] Implement `on()` for event subscription
  - [ ] Implement `off()` for unsubscription
  - [ ] Implement event queue system
  - [ ] Add event history for debugging

### 1.3 Persistence Layer

- [ ] **PersistenceManager**
  - [ ] Implement `save()` method
  - [ ] Implement `load()` method
  - [ ] Implement `autosave()` with debouncing
  - [ ] Add save versioning system

- [ ] **SaveManager**
  - [ ] Implement IndexedDB initialization
  - [ ] Implement `writeSave()` with transactions
  - [ ] Implement `readSave()` with error handling
  - [ ] Implement `generateChecksum()` for validation

- [ ] **BackupManager**
  - [ ] Implement `createBackup()` method
  - [ ] Implement rolling backup system (keep last 3)
  - [ ] Implement `restoreFromBackup()` method

### 1.4 Basic Testing & Verification (using Bun:test)

- [ ] Create unit tests for TimeManager (`TimeManager.test.ts`)
- [ ] Create unit tests for StateManager (`StateManager.test.ts`)
- [ ] Create integration test for save/load cycle
- [ ] Verify game loop runs at 60 FPS
- [ ] Verify tick fires every 60 seconds
- [ ] Test offline time calculation

**Deliverable**: Console-based game that initializes, runs game loop, and saves/loads empty state.

---

## Phase 2: Basic Pet System

**Goal**: Implement core pet functionality with basic care mechanics.

### 2.1 Pet Core Implementation

- [ ] **PetSystem**
  - [ ] Define Pet data model
  - [ ] Implement `createPet()` with species selection
  - [ ] Implement `activatePet()` for pet activation
  - [ ] Implement `getPet()` for current pet access
  - [ ] Implement `updatePetState()` for state changes

### 2.2 Care System

- [ ] **CareSystem**
  - [ ] Define care value ranges (0-100)
  - [ ] Implement hidden tick counters
  - [ ] Implement `getSatiety()` with tick conversion
  - [ ] Implement `getHydration()` with tick conversion
  - [ ] Implement `getHappiness()` with tick conversion
  - [ ] Implement `feed()` to add satiety ticks
  - [ ] Implement `drink()` to add hydration ticks
  - [ ] Implement `play()` to add happiness ticks
  - [ ] Implement `processCareDecay()` for tick-based decay
  - [ ] Implement `calculateDisplayValue()` with multipliers
  - [ ] Implement hidden Life stat management
  - [ ] Implement `checkLifeStatus()` for death detection

### 2.3 Growth System

- [ ] **GrowthSystem**
  - [ ] Define growth stages (Hatchling, Juvenile, Adult)
  - [ ] Implement `getCurrentStage()` method
  - [ ] Implement `getTimeInStage()` tracking
  - [ ] Implement `checkAdvancementEligibility()`
  - [ ] Implement `advanceStage()` with stat bonuses
  - [ ] Implement `getMaxEnergy()` by stage

### 2.4 Energy System

- [ ] Implement energy as part of PetState
- [ ] Add energy consumption logic
- [ ] Implement sleep state
- [ ] Implement `startSleep()` method
- [ ] Implement energy regeneration during sleep
- [ ] Implement auto-wake conditions

### 2.5 Starter Selection

- [ ] Define 3 starter species (Common rarity)
- [ ] Create starter selection logic
- [ ] Implement first-time player detection

### 2.6 Basic Testing (using Bun:test)

- [ ] Test pet creation (`PetSystem.test.ts`)
- [ ] Test care value decay over time (`CareSystem.test.ts`)
- [ ] Test feeding/drinking/playing
- [ ] Test energy and sleep mechanics
- [ ] Test offline care decay
- [ ] Test pet death from neglect

**Deliverable**: Console game where you can create a pet and maintain its care values.

---

## Phase 3: UI Foundation

**Goal**: Create basic visual interface for interacting with the pet.

### 3.1 UI Manager Setup

- [ ] **UIManager**
  - [ ] Implement `initialize()` with DOM setup
  - [ ] Implement `setupEventListeners()`
  - [ ] Implement `update()` for UI refresh
  - [ ] Implement screen management system

### 3.2 HUD Implementation

- [ ] **HUDController**
  - [ ] Create pet portrait display
  - [ ] Implement care value bars (Satiety, Hydration, Happiness)
  - [ ] Implement energy bar
  - [ ] Create location breadcrumbs
  - [ ] Add pet name display
  - [ ] Add growth stage indicator

### 3.3 Action Panel

- [ ] Create action button layout
- [ ] Implement Feed button
- [ ] Implement Drink button
- [ ] Implement Play button
- [ ] Implement Sleep/Wake button
- [ ] Add button enable/disable logic
- [ ] Add visual feedback for actions

### 3.4 Starter Selection Screen

- [ ] Create starter selection UI
- [ ] Display 3 starter options with sprites
- [ ] Implement selection confirmation
- [ ] Add pet naming interface

### 3.5 Notification System

- [ ] **NotificationSystem**
  - [ ] Implement `showToast()` for notifications
  - [ ] Create low care value alerts
  - [ ] Add death notification
  - [ ] Implement notification queue

### 3.6 Responsive Design

- [ ] Implement mobile-first layout
- [ ] Add touch event support
- [ ] Test on various screen sizes
- [ ] Add viewport meta tags

### 3.7 Visual Testing

- [ ] Test all care interactions through UI
- [ ] Verify bar updates in real-time
- [ ] Test notification displays
- [ ] Verify mobile responsiveness
- [ ] Create E2E tests using Bun test runner

**Deliverable**: Visual game with clickable UI for basic pet care.

---

## Phase 4: Advanced Care & Status

**Goal**: Add poop system, sickness, and injuries.

### 4.1 Poop System

- [ ] **CareSystem** (extend)
  - [ ] Implement poop spawn timer (6-24 hours)
  - [ ] Implement `spawnPoop()` method
  - [ ] Implement `cleanPoop()` instant action
  - [ ] Implement `getPoopCount()` method
  - [ ] Add poop effect on happiness
  - [ ] Add poop effect on sickness chance

### 4.2 Status System

- [ ] **StatusSystem**
  - [ ] Define Status types (Sick, Injured)
  - [ ] Implement `applySickness()` method
  - [ ] Implement `applyInjury()` method
  - [ ] Implement `treatSickness()` with medicine
  - [ ] Implement `treatInjury()` with bandage
  - [ ] Implement status effects on activities
  - [ ] Implement `processStatusTick()` for ongoing effects

### 4.3 UI Updates

- [ ] Add poop count indicator
- [ ] Add Clean button
- [ ] Add status icons (sick, injured)
- [ ] Update HUD with status displays
- [ ] Add medicine/bandage use buttons

### 4.4 Testing (using Bun:test)

- [ ] Test poop spawn timing (`CareSystem.test.ts`)
- [ ] Test sickness from high poop (`StatusSystem.test.ts`)
- [ ] Test treatment mechanics
- [ ] Test status persistence across saves

**Deliverable**: Game with full hygiene and health management.

---

## Phase 5: Locations & Activities

**Goal**: Implement travel system and basic activities.

### 5.1 Location System

- [ ] **LocationSystem**
  - [ ] Define location data structure
  - [ ] Create city locations (Square, Shop, Gym, Arena)
  - [ ] Create wild biomes (Forest, Mountains, Lake)
  - [ ] Implement `getCurrentLocation()` method
  - [ ] Implement `setLocation()` method
  - [ ] Implement distance calculations

### 5.2 Travel System

- [ ] **TravelSystem**
  - [ ] Implement `performIntraCityMove()` (instant)
  - [ ] Implement `startInterCityTravel()` (timed)
  - [ ] Implement travel time calculations
  - [ ] Implement energy cost system
  - [ ] Implement `cancelTravel()` with refund
  - [ ] Add concurrent action validation

### 5.3 Activity System

- [ ] **ActivitySystem**
  - [ ] Define activity types (Fishing, Foraging, Mining)
  - [ ] Implement `startActivity()` method
  - [ ] Implement `cancelActivity()` with refund
  - [ ] Implement activity duration system
  - [ ] Implement energy requirements
  - [ ] Implement reward calculation
  - [ ] Implement risk calculation (injuries, sickness)

### 5.4 Activity Implementations

- [ ] Implement Fishing activity
  - [ ] Define fishing rewards (food items)
  - [ ] Add duration tiers (short, medium, long)
- [ ] Implement Foraging activity
  - [ ] Define foraging rewards (ingredients)
  - [ ] Add location-based rewards
- [ ] Implement Mining activity
  - [ ] Define mining rewards (ores)
  - [ ] Add tool requirements

### 5.5 UI Updates

- [ ] Create location selection interface
- [ ] Add travel progress indicator
- [ ] Create activity selection menu
- [ ] Add activity progress bar
- [ ] Add cancel button with refund notice
- [ ] Update location breadcrumbs

### 5.6 Testing (using Bun:test)

- [ ] Test instant city movement (`TravelSystem.test.ts`)
- [ ] Test timed travel
- [ ] Test activity completion (`ActivitySystem.test.ts`)
- [ ] Test cancellation and refunds
- [ ] Test offline activity progression

**Deliverable**: Game with explorable world and resource gathering.

---

## Phase 6: Items & Inventory

**Goal**: Implement full item system and inventory management.

### 6.1 Item System

- [ ] **ItemSystem**
  - [ ] Define Item base class
  - [ ] Create item categories (Food, Drink, Toy, Medicine, Tool)
  - [ ] Implement `addItem()` method
  - [ ] Implement `removeItem()` method
  - [ ] Implement `useItem()` method
  - [ ] Implement stack limits
  - [ ] Implement durability system

### 6.2 Item Definitions

- [ ] Create food items (small, medium, large)
- [ ] Create drink items
- [ ] Create toy items with happiness effects
- [ ] Create medicine items
- [ ] Create bandage items
- [ ] Create energy booster items
- [ ] Create tool items (Fishing Rod, Pick)

### 6.3 Inventory Management

- [ ] Implement inventory data structure
- [ ] Add inventory capacity limits
- [ ] Implement `sortInventory()` method
- [ ] Implement `filterInventory()` by category
- [ ] Add item tooltips with descriptions

### 6.4 Currency System

- [ ] Implement Coins as currency
- [ ] Add coin rewards from activities
- [ ] Implement `addCoins()` method
- [ ] Implement `spendCoins()` method

### 6.5 Shop System

- [ ] **ShopSystem**
  - [ ] Implement shop inventory structure
  - [ ] Implement `refreshShopInventory()` daily rotation
  - [ ] Implement `purchaseItem()` method
  - [ ] Implement price calculation
  - [ ] Add rarity-based pricing

### 6.6 UI Updates

- [ ] Create inventory screen
- [ ] Add item grid display
- [ ] Implement drag-and-drop or click to use
- [ ] Create shop interface
- [ ] Add purchase confirmation dialog
- [ ] Display coin balance

### 6.7 Testing (using Bun:test)

- [ ] Test item usage effects (`ItemSystem.test.ts`)
- [ ] Test inventory limits
- [ ] Test shop purchases (`ShopSystem.test.ts`)
- [ ] Test daily shop rotation
- [ ] Test item persistence

**Deliverable**: Game with full item and economy system.

---

## Phase 7: Battle & Training System

**Goal**: Implement combat mechanics and stat training.

### 7.1 Battle Stats

- [ ] Add battle stats to Pet model
  - [ ] Health stat
  - [ ] Attack stat
  - [ ] Defense stat
  - [ ] Speed stat
  - [ ] Action stat (for move costs)
- [ ] Implement stat display in UI

### 7.2 Training System

- [ ] **TrainingSystem**
  - [ ] Implement `startTraining()` for each stat
  - [ ] Implement 8-minute training duration
  - [ ] Implement stat gain calculations
  - [ ] Implement energy cost for training
  - [ ] Implement move learning chance
  - [ ] Implement move replacement flow

### 7.3 Move System

- [ ] Define Move data structure
- [ ] Create basic move database
- [ ] Implement move properties (power, accuracy, action cost)
- [ ] Implement special "Skip Turn" move for action recovery
- [ ] Limit pet to 4 learned moves

### 7.4 Battle System

- [ ] **BattleSystem**
  - [ ] Implement `startBattle()` initialization
  - [ ] Implement turn order by Speed
  - [ ] Implement `useMove()` action
  - [ ] Implement damage calculation
  - [ ] Implement accuracy checks
  - [ ] Implement action point consumption
  - [ ] Implement `skipTurn()` for action recovery
  - [ ] Implement `useItem()` in battle
  - [ ] Implement `attemptFlee()` mechanic
  - [ ] Implement victory/defeat handling

### 7.5 Battle Triggers

- [ ] Add random encounters during activities
- [ ] Create wild opponent generation
- [ ] Implement encounter rate system

### 7.6 Battle UI

- [ ] Create battle screen layout
- [ ] Display health bars
- [ ] Display action points
- [ ] Create move selection interface
- [ ] Add battle log for actions
- [ ] Create victory/defeat modals

### 7.7 Testing (using Bun:test)

- [ ] Test stat training progression (`TrainingSystem.test.ts`)
- [ ] Test move learning
- [ ] Test battle flow (`BattleSystem.test.ts`)
- [ ] Test damage calculations
- [ ] Test flee mechanics
- [ ] Test battle rewards

**Deliverable**: Game with complete combat system.

---

## Phase 8: Eggs & Advanced Pet Features

**Goal**: Implement egg system and pet lifecycle.

### 8.1 Egg System

- [ ] Define Egg data structure
- [ ] Implement egg types with rarity weights
- [ ] Implement `startIncubation()` method
- [ ] Implement real-time incubation timer
- [ ] Implement `hatchEgg()` with species roll
- [ ] Add egg inventory management

### 8.2 Egg Sources

- [ ] Add eggs as activity rewards
- [ ] Add eggs to shop inventory
- [ ] Implement egg fragments system
- [ ] Add fragment combination mechanic

### 8.3 Pet Death & Memorial

- [ ] Implement death from Life depletion
- [ ] Create death notification
- [ ] Implement memorial log
- [ ] Add restart flow with egg grant

### 8.4 Stage Advancement

- [ ] Implement manual stage advancement button
- [ ] Add time requirements (24h, 72h)
- [ ] Add care condition checks
- [ ] Apply stat bonuses on advancement

### 8.5 UI Updates

- [ ] Create egg management screen
- [ ] Add incubation progress display
- [ ] Create hatching animation/screen
- [ ] Add memorial screen
- [ ] Update pet portrait for stages

### 8.6 Testing (using Bun:test)

- [ ] Test egg incubation timing
- [ ] Test species rarity rolls
- [ ] Test death and restart flow
- [ ] Test stage advancement (`GrowthSystem.test.ts`)

**Deliverable**: Game with complete pet lifecycle.

---

## Phase 9: Events & Calendar System

**Goal**: Implement time-based events and tournaments.

### 9.1 Event System

- [ ] **EventSystem**
  - [ ] Implement calendar event structure
  - [ ] Implement `scheduleEvent()` method
  - [ ] Implement `checkEventAvailability()`
  - [ ] Implement `joinEvent()` method
  - [ ] Implement event closure handling
  - [ ] Implement partial reward distribution

### 9.2 Event Types

- [ ] Create Arena events (weekday battles)
- [ ] Create Tournament events (weekends)
- [ ] Create Seasonal events
- [ ] Define event-specific rewards
- [ ] Implement event tokens

### 9.3 Time-Based Features

- [ ] Implement local timezone support
- [ ] Add event countdown timers
- [ ] Implement event windows
- [ ] Add recurring event scheduling

### 9.4 UI Updates

- [ ] Create calendar view
- [ ] Add event list with times
- [ ] Create join event buttons
- [ ] Add event progress tracking
- [ ] Display event rewards

### 9.5 Testing (using Bun:test)

- [ ] Test event scheduling (`EventSystem.test.ts`)
- [ ] Test timezone handling
- [ ] Test event participation
- [ ] Test closure during events
- [ ] Test reward distribution

**Deliverable**: Game with calendar events.

---

## Phase 10: Polish & Accessibility

**Goal**: Final polish, accessibility features, and optimizations.

### 10.1 Accessibility

- [ ] **AccessibilityController**
  - [ ] Implement color-blind modes
  - [ ] Implement high contrast mode
  - [ ] Implement font scaling
  - [ ] Implement reduced motion toggle
  - [ ] Add keyboard navigation
  - [ ] Add screen reader support

### 10.2 Performance Optimization

- [ ] Implement asset lazy loading
- [ ] Add sprite atlasing
- [ ] Optimize render cycles
- [ ] Implement object pooling
- [ ] Profile and fix memory leaks
- [ ] Optimize IndexedDB operations

### 10.3 Save Import/Export

- [ ] Implement save export to JSON
- [ ] Implement save import with validation
- [ ] Add save file versioning
- [ ] Create migration system
- [ ] Add checksum validation

### 10.4 Tutorial & Onboarding

- [ ] Create interactive tutorial
- [ ] Add tooltip system
- [ ] Implement guided first quest
- [ ] Add help documentation
- [ ] Create tutorial skip option

### 10.5 Audio System (Optional)

- [ ] Add background music
- [ ] Add sound effects
- [ ] Implement volume controls
- [ ] Add mute options

### 10.6 Visual Polish

- [ ] Add animations for actions
- [ ] Create particle effects
- [ ] Implement smooth transitions
- [ ] Add loading screens
- [ ] Polish UI animations

### 10.7 Error Handling

- [ ] Add comprehensive error boundaries
- [ ] Implement crash recovery
- [ ] Add error reporting UI
- [ ] Create fallback states
- [ ] Add connection loss handling

### 10.8 Final Testing

- [ ] Complete gameplay testing
- [ ] Cross-browser testing
- [ ] Mobile device testing
- [ ] Performance testing
- [ ] Accessibility audit
- [ ] Save system stress testing

**Deliverable**: Polished, accessible, production-ready game.

---

## Phase 11: Content & Balancing

**Goal**: Add content variety and balance gameplay.

### 11.1 Content Expansion

- [ ] Add 10+ species per rarity tier
- [ ] Create 20+ unique moves
- [ ] Design 30+ items
- [ ] Create 5+ cities
- [ ] Add 5+ wild biomes
- [ ] Design 10+ calendar events

### 11.2 Balancing

- [ ] Tune care decay rates
- [ ] Balance activity rewards
- [ ] Adjust training gains
- [ ] Balance battle damage
- [ ] Tune egg rarity rates
- [ ] Adjust shop prices

### 11.3 Data-Driven Configuration

- [ ] Create JSON configs for species
- [ ] Create JSON configs for items
- [ ] Create JSON configs for moves
- [ ] Create JSON configs for locations
- [ ] Create tuning parameter file
- [ ] Add hot-reload for configs

### 11.4 Testing & QA

- [ ] Progression testing
- [ ] Balance testing
- [ ] Edge case testing
- [ ] Long-term play testing

**Deliverable**: Content-rich, well-balanced game.

---

## Testing Strategy (using Bun:test)

### Unit Testing Checklist

- [ ] Set up test directory structure (`__tests__/` or `*.test.ts` files)
- [ ] Configure `bun test` in package.json scripts
- [ ] Test all pure functions
- [ ] Test state mutations
- [ ] Test time calculations
- [ ] Test save/load operations
- [ ] Test item effects
- [ ] Test battle calculations

### Integration Testing Checklist

- [ ] Test system interactions
- [ ] Test event flow
- [ ] Test offline processing
- [ ] Test save migration
- [ ] Test UI updates

### End-to-End Testing Checklist

- [ ] Test complete game flow
- [ ] Test all user interactions
- [ ] Test error recovery
- [ ] Test performance targets

### Bun Test Configuration

- [ ] Create test setup file for global test utilities
- [ ] Configure test coverage reporting
- [ ] Set up test watch mode for development
- [ ] Create test fixtures for game data

---

## Performance Targets

- [ ] 60 FPS on mid-range mobile devices
- [ ] < 100ms UI response time
- [ ] < 500ms save operation
- [ ] < 1s initial load time
- [ ] < 50MB memory usage
- [ ] < 10MB save file size

---

## Development Milestones

1. **Milestone 1** (Phase 1-2): Core game loop with basic pet
2. **Milestone 2** (Phase 3-4): Playable UI with care mechanics
3. **Milestone 3** (Phase 5-6): World exploration and items
4. **Milestone 4** (Phase 7-8): Combat and pet lifecycle
5. **Milestone 5** (Phase 9-10): Events and polish
6. **Milestone 6** (Phase 11): Content and release

---

## Notes

- Each phase should be fully tested before moving to the next
- Keep the game playable at every stage
- Prioritize mobile experience
- Focus on performance from the start
- Document all systems as they're built
- Create debug tools early for easier testing
