Create a purely client-side HTML5 pet raising game using Web Storage API. Implement the following features:

**Pet System**
- Rarities: 10 common (3 starters), 8 uncommon, 6 rare, 4 epic, 3 legendary
- Starter selection: Player chooses from 3 common pets initially
- Care stats (displayed as integers):
  - Satiety, Hydration, Happiness
  - Hidden counters: `satietyTicksLeft`, `hydrationTicksLeft`, `happinessTicksLeft`
  - Calculation: `Math.ceil(ticksLeft / multiplier)` per stat
- Health states: Healthy, Injured, Sick (with specific illnesses)
- Growth: ~50 stages over ~2 real years
  - Max Energy increases per stage (starts at 100)
  - Energy recovers faster during sleep in later stages
- States: Idle (default), Sleeping, Travelling
- Death: When `life` (1,000,000 max) reaches 0
  - Reset to starter selection/egg hatch
  - Return to starting city

**Game Mechanics**
- Game tick: 15-second intervals
- Autosave: Game state is autosaved every tick with timestamp of save state
- Load Game: When loading game, compute offline game ticks progression using current time and save state time, and advance pet states (e.g. stat depletion, recovery, poop, life, energy, etc)
- Stat depletion: Ticks decrease hidden counters by 1/tick
- Item usage:
  - Consumables (food/drinks) vs. Durability items (toys)
  - Medicine for health states
  - Hygiene items for poop cleaning
- Poop system:
  - `poopTicksLeft` (random reset after pooping)
  - `sickByPoopTicksLeft` (resets to 17,280 ticks when clean; decreases faster per tick when there is more poop)
  - When `sickByPoopTicksLeft` is 0, pet falls sick, and `sickByPoopTicksLeft` resets
- Life mechanics (per tick):
  - Decrease: 100 (injured), 200 (sick), 300 (0 satiety), 500 (0 hydration), 1 (final growth stage)
  - Recovery: +1 if life did not decrease for any reason
- Energy system:
  - Consumed through activities
  - No passive depletion
  - Can be recovered by energy booster items
- Battle stats: Attack, Defense, Speed, Health (current/max)
  - Turn-based combat
  - Training facilities: Improve stats + chance to learn moves

**World & Progression**
- Locations: Towns, cities, explorable areas
  - Starting city + multiple destinations
- Travel:
  - Time-based "travelling" state
  - Blocks sleep during transit
- Activities:
  - Foraging/fishing/mining in explorable areas
  - Shops: Buy/sell items
  - NPCs: Quest lines (item turn-ins, tasks), Conversational, Guides and Lore
- Death reset: Hatch new pet from inventory eggs or starter selection + Reset to starting city

**Technical Requirements**
1. Client-only: No server dependencies
2. Storage: Web Storage API
3. Workflow:
   - Ensure typecheck passes, avoiding `any` and `unknown` types
   - Ensure lint and prettier formatting passes
   - Ensure project production builds successfully
   - Ensure tests passes
