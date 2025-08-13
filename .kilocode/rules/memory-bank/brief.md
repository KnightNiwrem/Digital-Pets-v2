# Improved Specifications for HTML5 Pet Raising Game
## Architecture Overview
The game follows a clean architecture pattern with three main components:
1. **Systems**: Manage non-UI domains (PetSystem, InventorySystem, BattleSystem, WorldSystem, TimeSystem, SaveSystem)
2. **Actors**: Manage UI domains and Game Tick domain, firing actions to the GameEngine
3. **GameEngine**: Coordinates GameState, Actions, and Systems to compute new game states
## Systems
### PetSystem
**Responsibilities**: Manages all pet-related logic including stats, growth, states, health, and death.
**Features**:
- **Pet Rarities**: 10 common (3 starters), 8 uncommon, 6 rare, 4 epic, 3 legendary
- **Starter Selection**: Manages initial pet selection from 3 common pets
- **Pet Stats**:
  - Displayed (computed-only) stats (integers): Satiety, Hydration, Happiness
  - Hidden counters: `satietyTicksLeft`, `hydrationTicksLeft`, `happinessTicksLeft`, `lifeTicksLeft`, `poopTicksLeft`, `sickByPoopTicksLeft`
  - Stat calculation: `Math.ceil(ticksLeft / multiplier)` per stat
- **Health States**: Healthy, Injured, Sick (with specific illnesses)
- **Growth System**:
  - ~50 growth stages over ~2 real years
  - Max Energy increases per stage (starts at 100)
  - Energy recovery rate improves during sleep in later stages
- **Pet States**: Idle (default), Sleeping, Travelling, Exploring, Battling, Training
- **Death Mechanics**:
  - Triggers when `lifeTicksLeft` (1,000,000 max) reaches 0
  - Manages reset to starter selection or egg hatch
  - Handles return to starting city
- **Life Mechanics** (per tick):
  - Decrease rates: 100 (injured), 200 (sick), 300 (0 satiety), 500 (0 hydration), 1 (final growth stage)
  - Recovery: +1 if life did not decrease for any reason
- **Poop System**:
  - Manages `poopTicksLeft` (random reset after pooping between 10800 and 86400)
  - Manages `sickByPoopTicksLeft` (resets to 17,280 ticks when clean; decreases faster per tick with more poop)
  - Triggers sickness when `sickByPoopTicksLeft` reaches 0
- **Balancing System**:
  - Configurable stat depletion rates and recovery rates
  - Adjustable growth stage duration and energy increases
  - Feedback collection mechanism for player experience
### InventorySystem
**Responsibilities**: Manages all items in the player's inventory and their usage.
**Features**:
- **Item Types**:
  - Consumables (food/drinks)
  - Durability items (toys)
  - Medicine (for health states)
  - Hygiene items (for poop cleaning)
  - Energy boosters
  - Eggs (for pet hatching after death)
- **Item Usage**:
  - Processes item consumption effects
  - Manages durability reduction for applicable items
  - Handles item effects on pet stats and states
### BattleSystem
**Responsibilities**: Manages all battle-related logic including stats, combat, and training.
**Features**:
- **Battle Stats**: Attack, Defense, Speed, Health (current/max)
- **Combat Mechanics**:
  - Turn-based battle system
  - Damage calculation based on stats
  - Move selection and execution
- **Training System**:
  - Stat improvement through training
  - Move learning mechanics
  - Training facility interactions
- **Balancing System**:
  - Configurable damage formulas and stat growth rates
  - Adjustable difficulty scaling for opponents
  - Feedback collection mechanism for battle experience
### WorldSystem
**Responsibilities**: Manages game world, locations, travel, and activities.
**Features**:
- **Locations**:
  - Towns and cities
  - Explorable areas
  - Starting city + multiple destinations
- **Travel System**:
  - Time-based "travelling" state
  - Blocks sleep during transit
  - Location transitions
- **Activities**:
  - Foraging/fishing/mining in explorable areas
  - Shop interactions (buy/sell items)
  - NPC interactions:
    - Quest lines (item turn-ins, tasks)
    - Conversational interactions
    - Guides and Lore
### TimeSystem
**Responsibilities**: Manages game time, ticks, and offline progression.
**Features**:
- **Game Tick**: 15-second intervals
- **Offline Progression**:
  - Calculates offline game ticks using current time and save state time
  - Advances pet states during offline periods (stat depletion, recovery, poop, life, energy)
  - **Simplified Long Offline Calculation**: For offline periods exceeding 24 hours, implements a direct calculation model that skips intermediate states and computes the end result directly to prevent UI freezing
- **Stat Depletion**: Decreases hidden counters by 1 per tick
### SaveSystem
**Responsibilities**: Manages game state persistence using Web Storage API.
**Features**:
- **Autosave**: Saves game state every tick with timestamp
- **Load Game**: Loads saved game state and triggers offline progression calculation
- **Storage Management**: Efficient use of Web Storage API space
## Actors
### UIActor
**Responsibilities**: Manages all UI interactions and user inputs.
**Features**:
- **User Input Handling**:
  - Pet interactions (feeding, playing, etc.)
  - Navigation between game screens
  - Item selection and usage
  - Battle move selection
- **UI State Management**:
  - Updates UI based on game state changes
  - Manages screen transitions
  - Displays appropriate information for current game state
### TickActor
**Responsibilities**: Manages game tick events and scheduled timers.
**Features**:
- **Tick Generation**: Triggers game tick events at 15-second intervals
- **Timer Management**: Manages various game timers (travel, activities, etc.)
- **Action Firing**: Sends tick-related actions to the GameEngine
### TravelActor
**Responsibilities**: Manages travel-related UI and state transitions.
**Features**:
- **Travel UI**: Displays travel options and status
- **Destination Selection**: Handles user selection of travel destinations
- **Travel State Management**: Updates UI based on travel state
### BattleActor
**Responsibilities**: Manages battle UI and interactions.
**Features**:
- **Battle UI**: Displays battle interface with pet stats, enemy stats, and move options
- **Move Selection**: Handles player move selection in battles
- **Battle Animation**: Manages visual feedback during battles
### ActivityActor
**Responsibilities**: Manages activity UI and interactions.
**Features**:
- **Activity UI**: Displays interfaces for foraging, fishing, mining, etc.
- **Activity Selection**: Handles user selection of activities
- **Activity Results**: Displays results of activities (items found, etc.)
## GameEngine
**Responsibilities**: Coordinates GameState, Actions, and Systems to compute new game states.
**Features**:
- **Action Processing**:
  - Receives actions from Actors
  - Determines which Systems need to process each action
  - Coordinates System execution order
- **State Management**:
  - Maintains current GameState using immutable data structures
  - Creates new GameState based on System outputs without mutating previous state
  - Validates state transitions
  - Implements clear state management pattern with defined state update rules
- **Error Handling**:
  - Catches and handles errors from Systems
  - Prevents invalid state changes
  - Manages error recovery
- **Autosave Coordination**:
  - Triggers autosave after successful state changes
  - Ensures state consistency before saving
- **Performance Optimization**:
  - Optimizes calculations for efficient execution
  - Implements web workers for intensive computations
  - Includes performance profiling capabilities
## GameState
**Data Structure**: Represents the complete state of the game at a given moment using immutable data structures.
**Components**:
- **Pet Data**:
  - Pet type and rarity
  - Current stats (Satiety, Hydration, Happiness)
  - Hidden counters (satietyTicksLeft, hydrationTicksLeft, happinessTicksLeft, lifeTicksLeft)
  - Health state
  - Growth stage
  - Current state (Idle, Sleeping, etc.)
  - Battle stats (Attack, Defense, Speed, Health)
  - Known moves
- **Inventory Data**:
  - List of items with quantities and durability (if applicable)
  - Currency
- **World Data**:
  - Current location
  - Travel status (if travelling)
  - Unlocked locations
  - Quest progress
- **Time Data**:
  - Last tick timestamp
  - Total ticks played
- **Battle Data** (if in battle):
  - Current enemy
  - Battle state (player turn, enemy turn, etc.)
## Data Flow
1. **User Input**: User interacts with UI, which triggers UIActor
2. **Action Creation**: UIActor creates appropriate action based on user input
3. **Action Processing**: GameEngine receives action and determines which Systems need to process it
4. **System Execution**: Relevant Systems process the action and return results
5. **State Update**: GameEngine updates GameState based on System results
6. **State Persistence**: If no errors, GameEngine triggers SaveSystem to persist the new GameState
7. **UI Update**: GameEngine notifies UIActor of state changes, which updates the UI
## Technical Requirements
1. **Client-only**: No server dependencies
2. **Storage**: Web Storage API (with potential fallback to IndexedDB if needed)
3. **Development Workflow**:
   - Ensure typecheck passes, avoiding `any` and `unknown` types
   - Ensure lint and prettier formatting passes
   - Ensure project production builds successfully
   - Ensure tests pass (unit tests for Systems, integration tests for GameEngine, UI tests for Actors)
