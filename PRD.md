# Digital Pet Game PRD (Client‑Only HTML5) — Revised Per Feedback

Scope: Single‑player, client‑only browser game with no server interaction; fully playable offline after initial load

1. Vision, Goals, and Non‑Goals

- Vision: A cozy, care‑and‑explore digital pet that fits into short sessions yet supports long‑term engagement through collections, activities, and calendar events.
- Goals:
  - Clear care loop using positive indicators: Satiety, Hydration, Happiness.
  - Robust offline and background behavior using device time, with simple, predictable rules.
  - Mobile‑first UX with keyboard/mouse parity and accessibility options.
- Non‑Goals:
  - No multiplayer, accounts, or cloud saves.
  - No pet evolution trees; growth stages only.
  - No monetization or real‑money purchases.

2. Target Platforms, Performance, and Accessibility

- Platforms: Modern desktop/mobile browsers (latest 2 versions of Chromium, WebKit, Gecko).
- Performance:
  - Target 60 FPS on mid‑range mobile; gracefully degrade on low‑end devices.
  - Idle and background states should minimize CPU/GPU use.
- Storage:
  - Persist saves locally (localStorage). Provide export and import of save as a JSON file.
  - Warn users that clearing browser data removes progress.
- Time:
  - Uses device real‑time clock.
- Accessibility:
  - Input: touch, mouse, keyboard.
  - Visuals: color‑blind safe palette; high‑contrast mode; reduced motion toggle.
  - Text size scaling; readable defaults; screen‑reader friendly UI labels.

3. Core Loops

- Care: Maintain Satiety, Hydration, Happiness; manage Poop with instant cleaning; treat sickness and injuries with items and sleep.
- Explore: Travel between locations; perform timed activities that yield items, currency, and eggs; occasional battles.
- Progress: Train battle stats, including the Action stat; occasionally learn new moves; participate in calendar events.

4. Pet: Species, Rarity, Starters, and Eggs

- Single active pet at a time. Additional eggs may be held until hatched.
- Rarity tiers: Common, Uncommon, Rare, Epic, Legendary.
- Starters: Three predefined Common species are always selectable when the player has no pet and no eggs.
- Egg sources: Activity rewards, event rewards, shop purchases (in‑game currency), rare finds.
- Hatching:
  - Real‑time incubation continues while the game is closed.
  - On completion, rolls species based on egg type with rarity‑weighted outcome.
  - Baseline generic egg weights (tunable): Common 60%, Uncommon 25%, Rare 10%, Epic 4%, Legendary 1%.

5. Growth Stages

- Stages: Hatchling → Juvenile → Adult.
- Stage gating:
  - Minimum real‑time duration per stage (defaults): Hatchling 24 hours, Juvenile 72 hours.
  - Manual Advance Stage action becomes available once duration and basic care conditions are met.
- Effects by stage (tunable baselines):
  - Max Energy: Hatchling 50, Juvenile 80, Adult 120.
  - Sleep regeneration rate: increases by stage.
  - Activity access: some activities require Juvenile or Adult.
  - Battle stat increases on advancement: modest flat bonuses to Health, Attack, Defense, Speed, and Action.

6. Care Values and Hidden Life

- Visible care values (range 0–100):
  - Satiety
  - Hydration
  - Happiness
- Hidden wellness stat:
  - Life is a hidden value representing overall wellness outside combat. It decreases when care is neglected and recovers when care is maintained. It is not displayed to the player.
  - Death due to neglect is based on Life, not Health.
- Decay baselines (positive framing):
  - Satiety, Hydration, and Happiness gradually decrease over time
- Hidden backing ticks for care:
  - Game tick: 60 seconds. Autosave is triggered every tick.
  - Each care value has a hidden tick counter, for example satiety ticks, hydration ticks, happiness ticks.
  - The displayed care value is computed from its ticks using a fixed multiplier per value. Example: if one unit of Hydration represents ten ticks (ten minutes), then the displayed Hydration equals the hidden hydration ticks divided by ten, rounded up.
  - Restoring care adds ticks directly to the hidden counter. Example: restoring ten Hydration adds one hundred hydration ticks.
  - Use similar multipliers for Satiety and Happiness to keep calculations simple, consistent, and performant.

7. Poop and Hygiene

- Poop spawn:
  - Spawns infrequently while the pet is awake: between six and twenty‑four hours per occurrence, randomized within that window.
  - There is no cap on total Poop.
- Effects:
  - Higher Poop counts increase the chance of sickness and reduce Happiness over time.
- Cleaning:
  - Cleaning Poop is instant.
  - Hygiene items can reduce the Poop count by a set amount or reset it to zero.

8. Sickness and Injury

- Sickness:
  - Causes: high Poop count, exposure from activities, small passive chance over time.
  - Effects: reduced activity success, reduced sleep Energy regeneration, small Life decrease over time.
  - Treatment: Medicine item removes or reduces sickness after a short use time; severe cases may require multiple treatments or rest.
- Injury:
  - Causes: battle losses or heavy hits, rare mishaps in activities.
  - Effects: slower travel, blocks specific activities such as Training, may slightly reduce Happiness and Life until treated.
  - Treatment: Bandage item plus rest; some injuries require both.

9. Energy and Sleep

- Energy consumption: Travel and activities consume Energy according to distance and intensity.
- Regeneration:
  - Sleeping enables passive Energy regeneration; no passive Energy regeneration while awake.
  - Energy boosters restore a chunk of Energy instantly and may use a short cooldown to prevent spam (tunable).
- Sleep end rules:
  - The pet automatically wakes when Energy is fully recovered or after eight hours of sleep, whichever occurs first.
  - Forcing the pet to wake early halves the Energy recovered during that sleep session and decreases Happiness.
- Minimum Energy checks: Prevent starting a travel or activity if Energy is below the required cost.

10. Actions, Time, Concurrency, and Cancellation

- Action types:
  - Instant: Feed, Drink, Use Item, Play (toys), Clean Poop, intra‑city movement.
  - Timed: Inter‑city travel and activities such as fishing, foraging, mining, training, and sleeping.
- Concurrency:
  - While traveling: the pet may Eat, Drink, and Play; cannot Sleep or perform other activities.
  - While training: exclusive; cannot Eat, Drink, Play, Sleep, Travel, or perform other activities.
  - While sleeping: exclusive.
  - While in battle: exclusive.
- Cancellation and refunds:
  - Canceling travel, training, or an activity refunds Energy fully.
  - Instant intra‑city movement is free and non‑cancellable.

11. Locations, Travel, and Activities

- Locations:
  - Cities (with areas such as Square, Gym, Shop, Arena).
  - Wild biomes (Forest, Mountains, Lake, etc.).
- Travel:
  - Intra‑city: instant and free.
  - Inter‑city or to wild biomes: timed and costs Energy based on distance tier.
  - Modifiers: injuries slow travel; items can temporarily improve travel speed.
- Activities (examples and baselines):
  - Fishing and Foraging: short, medium, and long durations; yield food, ingredients, and materials.
  - Mining: medium and long only; requires Juvenile or Adult and a Pick tool; yields ores.
  - Training: timed; raises battle stats; chance to learn a new move.
  - Arena practice or events: timed or immediate battles; see Battles and Events.
- Outcomes:
  - Rewards include currency, food, drink, toys, materials, tools, eggs, and egg fragments.
  - Risks include battle encounters, minor injuries, and sickness exposure.

12. Training and Battle Stats

- Trainable battle stats:
  - Health, Attack, Defense, Speed, Action.
  - Action is consumed to execute battle moves. Stronger moves generally cost more Action.
- Training rules:
  - Each session targets one stat and provides progress with no diminishing returns.
  - Chance per session to learn a new move related to the chosen training focus.
  - If the pet already knows four moves, the player may replace one to learn the new move.
- Stage advancement:
  - Advancing to a new growth stage grants modest flat increases to battle stats, including Action.

13. Battle System

- Triggers:
  - Random encounters during activities or travel where applicable.
  - City events such as Arena or Tournaments.
  - NPC requests tied to the calendar.
- Turn order:
  - Determined by Speed; ties break randomly.
- Turn flow:
  - The player selects a known move, uses an item, attempts to flee if allowed, or chooses the special skip turn to restore Action.
  - Damage and effects resolve; status updates apply; faint checks occur.
- Moves:
  - No physical or special categories.
  - No per‑move usage counters.
  - Each move has an Action cost, accuracy, power, priority, and optional status effects.
  - The pet always has a special skip turn move available that restores Action and does not count toward the four known moves.
- Items in battle: limited use of healing or curative items; using an item consumes the turn unless specified otherwise.
- Outcomes:
  - Victory grants rewards such as currency or items; may trigger follow‑up events.
  - Defeat increases injury likelihood and may end the underlying timed action without rewards.
- Interruptions and resumption:
  - If a battle triggers during a timed action, the timed action pauses.
  - After battle, if the pet is still active, the paused action resumes; otherwise it cancels with Energy refunds per the cancellation policy.

14. Calendar Events (Real‑Time)

- Scheduling and availability:
  - Events are defined in the local device timezone.
  - Examples: arena windows on specific weekdays, weekend tournaments, seasonal festivals.
  - The game checks availability on load and at regular intervals.
- Participation:
  - Enter events during open windows to access event content and rewards.
- Graceful closure:
  - When an event ends:
    - Ongoing battles end immediately with a safe retreat resolution and partial rewards, if applicable.
    - Ongoing event activities end immediately with partial rewards; Energy refunds per the cancellation policy.
    - Event tokens convert to currency at a fixed rate.
  - Show a summary and return the pet to a safe location.

15. Timekeeping, Ticks, Offline Catch‑Up, and Autosave

- Tick cadence:
  - One game tick occurs every sixty seconds.
  - Autosave occurs every tick.
- Hidden tick counters:
  - Care values use hidden tick counters to streamline calculations and maintain consistent behavior across active and offline time.
  - Multipliers define how many ticks equal one displayed unit for each care value; examples can use ten ticks per Hydration unit to represent ten minutes.
- Offline catch‑up:
  - On resume, compute elapsed time and mathematically flatten all ticks into a single step update for ongoing sleep, travel, activities, care decay, Poop spawns, sickness checks, and egg incubation. For example, if offline time is 10 minutes, then simply compute (10 \* 60 / 15 = 40 ticks) and decrease hidden tick counters for care value by 40.

16. Items, Inventory, Currency, and Shops

- Currency: Coins (in‑game only).
- Inventory:
  - Most items stack up to a defined limit; some items are not stackable.
  - Items with durability are not stackable.
  - Sorting and filtering by category are supported.
- Item categories:
  - Food: increases Satiety by small, medium, or large amounts.
  - Drinks: increases Hydration by small, medium, or large amounts.
  - Toys: increases Happiness but requires and costs energy; stronger toys may have durability.
  - Medicine: treats sickness and may improve Life indirectly by removing negative effects.
  - Bandage: treats injuries; improves recovery and removes certain activity blocks.
  - Energy boosters: instantly restore Energy; optional short cooldown.
  - Tools: unlock activities such as Fishing or Mining; tool tiers can affect yields.
- Shops:
  - Located in city; inventory rotates daily.
  - Prices scale with rarity; event discounts may apply.

17. UI and UX

- Main HUD:
  - Pet portrait with animated state.
  - Bars for Energy, Satiety, Hydration, Happiness. Health is shown in battle contexts only.
  - Poop count indicator and status icons for sickness and injury.
  - Location breadcrumbs and ETAs for timed travel and activities.
- Actions panel:
  - Contextual actions per location: Feed, Drink, Play, Clean Poop, Use Item, Sleep, Travel, Activities, Train.
  - Timed action card with progress and Cancel, stating that Energy will be fully refunded on cancel.
- Events:
  - Calendar view with local time windows and countdowns; Join buttons during open windows.
- Notifications:
  - Toasts for low care values and high Poop.
  - Modal for event closure and post‑battle summaries.
- Accessibility:
  - Font scaling, color‑blind palettes, reduced motion, and high‑contrast options.
  - Keyboard shortcuts for common actions and visible focus outlines.

18. Onboarding and First‑Run

- First‑run flow:
  - If no pet and no eggs, present a starter selection of three Common species.
  - Guided tooltips for feeding, drinking, playing, cleaning Poop, sleeping, and first activity.
  - Short quest chain: visit shop, buy food, perform first activity, open rewards.
- Safety:
  - If the pet dies during onboarding due to Life depletion, grant a common egg and re‑enter starter flow.

19. Baseline Tuning (Initial Defaults; all tunable)

- Care value ranges: 0 to 100 for Satiety, Hydration, and Happiness.
- Care decay examples:
  - Satiety decreases by approximately three per hour.
  - Hydration decreases by approximately four per hour.
  - Happiness decreases by approximately two per hour.
- Hidden tick multipliers:
  - Satiety decrease by three per hour, equals one per twenty minutes, equals 20 ticks, so satiety multiplier is 20.
  - Hydration decrease by four per hour, equals one per fifteen minutes, equals 15 ticks, so hydration multiplier is 15.
  - Happiness decrease by two per hour, equals one per thirty minutes, equals 30 ticks, so happiness multiplier is 30.
- Energy:
  - Max Energy by stage: Hatchling 50, Juvenile 80, Adult 120.
  - Sleep regeneration rate increases by stage; Energy boosters restore a significant chunk instantly.
  - Sleep ends at full Energy or eight hours; forced wake halves Energy recovered and reduces Happiness.
- Travel tiers:
  - Intra‑city: instant and free.
  - Inter‑city: short three minutes, medium six minutes, long ten minutes, with increasing Energy costs.
- Activities:
  - Short two minutes, medium five minutes, long ten minutes, with increasing Energy costs and yields.
- Training:
  - Eight minutes per session with a meaningful Energy cost; no diminishing returns.
  - Chance to learn a new move per session; move replacement flow if four moves are already known.
- Battles:
  - Moves consume Action; stronger moves cost more Action.
  - The special skip turn is always available and restores Action.

20. Data Model (Conceptual)

- Pet:
  - Species, Rarity, Stage, battle stats (Health, Attack, Defense, Speed, Action), Energy, visible care values (Satiety, Hydration, Happiness), hidden Life, statuses (Sick, Injured), known moves up to four.
- Hidden care counters:
  - satiety ticks, hydration ticks, happiness ticks; multipliers to convert ticks to displayed units.
- Inventory:
  - Items with quantities; non‑stackable flags for specific items such as durability items; Tools; Currency.
- World:
  - Current location; active timers for Travel, Activity, Sleep, and Training; Event participation references.
- Time:
  - last saved timestamp; tick scheduler; optional batch processing metadata for large offline deltas.
- Meta:
  - Settings and accessibility; tutorial progress; memorial log.

21. Persistence and Backup

- Storage:
  - localStorage primary save; autosave every tick; transactional write on critical events.
- Export and import:
  - Export produces a JSON file with checksum and version.
  - Import validates checksum and version and shows a summary before overwrite.
- Versioning:
  - Semantic save version; migrations for schema changes.

22. Error Handling and Edge Cases

- Corrupted save: keep a rolling backup snapshot and offer rollback.
- Large offline gaps: process in batches for performance; no anti‑exploit intent.
- Event closure during critical states: apply immediate closure policy with partial rewards and full Energy refunds on cancel; never soft‑lock.
- Storage quota exceeded: prompt to export and reduce inventory or snapshots.

23. Acceptance Criteria (Representative)

- Client‑only and persistence:
  - Game loads and plays with network disabled after first load; autosaves every tick.
- Starters and eggs:
  - Starter selection appears when appropriate; incubation is real‑time; hatching respects rarity weights.
- Care and hygiene:
  - Satiety, Hydration, and Happiness decrease at baseline rates; feeding, drinking, playing, and hygiene items adjust values appropriately.
  - Poop spawns between six and twenty‑four hours with no cap; cleaning is instant; hygiene items reduce or reset Poop counts.
- Energy and sleep:
  - Energy costs enforced for travel and activities; sleep regenerates Energy; no passive regeneration while awake.
  - The pet auto‑wakes at full Energy or after eight hours; forced wake halves Energy recovered and reduces Happiness.
- Concurrency and cancel:
  - Traveling allows Eat, Drink, and Play; Sleep and Activities are blocked.
  - Training, Sleep, and Battle are exclusive.
  - Canceling travel, training, or activities fully refunds Energy.
- Travel and activities:
  - Intra‑city movement is instant and free.
  - Inter‑city travel uses time and Energy tiers with correct ETAs.
- Training and stats:
  - Training increases selected battle stats with no diminishing returns; Action is trainable and used in battle.
  - Stage advancement provides modest increases to battle stats including Action.
- Battles:
  - Turn order by Speed; moves consume Action; no categories and no per‑move usage counters.
  - The special skip turn that restores Action is always available and does not count toward the four known moves.
- Events:
  - Event availability respects the local calendar; joining is restricted to open windows.
  - On closure, ongoing event content ends safely; partial rewards apply; Energy refunds on cancellation occur; token conversion happens.
- Time and ticks:
  - Game uses sixty‑second ticks; autosaves every tick.
  - Care calculations use hidden tick counters and multipliers; offline catch‑up simulates the right number of ticks.

24. Content and Tuning Hooks

- Centralized tuning for rates, timers, chances, and costs.
- Data‑driven definitions for species, moves, tools, activities, and events.
- Difficulty and progression adjust primarily through yields, encounter rates, stat curves, and event constraints.

25. Technical Notes (Non‑binding)

- IndexedDB for state; tick‑driven autosave.
- Deterministic RNG seeds for debugging encounters.
