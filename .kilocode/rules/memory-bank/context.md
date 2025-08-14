# Digital Pet Game - Current Context

## Current State

### Project Status

- **Phase**: Pre-implementation / Architecture Design Complete
- **Environment**: Development setup with Bun + React + TypeScript
- **Implementation**: Basic React template with no game code yet
- **Architecture**: Domain-driven design with clear separation of concerns

### What Has Been Done

1. **Architecture Design**: Complete domain-driven architecture with four distinct layers
2. **Domain Boundaries**: Clear separation between Pet, Player, World, and Item domains
3. **Activity Systems**: Defined Care, Battle, Trade, Craft, and Explore systems that orchestrate domains
4. **Development Environment**: Bun-based React project initialized with TypeScript and Tailwind CSS
5. **UI Components**: Basic shadcn/ui components integrated
6. **Documentation**: Comprehensive architecture documentation created and refined

### Architecture Redesign (Latest)

- Each domain owns specific data exclusively
- Activity systems orchestrate between domains
- No direct domain-to-domain communication
- Clear mental model of responsibilities

### Current Files Structure

```
Digital-Pets-v2/
├── src/
│   ├── index.tsx          # Bun server entry point
│   ├── frontend.tsx       # React app entry point
│   ├── App.tsx           # Main app component (template)
│   ├── APITester.tsx     # API testing component (template)
│   ├── index.html        # HTML entry point
│   ├── index.css         # Global styles
│   ├── components/ui/    # shadcn/ui components
│   └── lib/utils.ts      # Utility functions
├── .kilocode/rules/memory-bank/
│   ├── brief.md          # Enhanced architecture specification
│   ├── product.md        # Product documentation
│   ├── context.md        # This file
│   ├── architecture.md   # Detailed system architecture
│   └── tech.md           # Technology stack
├── improved-architecture.md     # Initial architecture design
├── architecture-diagrams.md     # Visual architecture diagrams
├── architecture-improvements-summary.md  # Summary of improvements
├── package.json          # Project dependencies
├── tsconfig.json         # TypeScript configuration
└── build.ts             # Bun build script
```

### Implementation Status

- **Game Engine**: Not implemented
- **Event System**: Not implemented
- **State Management**: Not implemented
- **Domain Systems**: Not implemented
- **UI Components**: Template components only
- **Assets**: No game assets yet
- **Tests**: No tests written

## Recent Changes

### Architecture Redesign (Just Completed)

- Switched from mixed system model to domain-driven design
- Created four core domains: Pet, Player, World, Item
- Defined five activity systems: Care, Battle, Trade, Craft, Explore
- Added three support systems: Time, Save, Notification
- Clarified all domain boundaries and responsibilities

### Key Architecture Decisions

- **Pet Domain** owns all pet-specific data (stats, abilities, personality)
- **Player Domain** owns inventory, currency, achievements
- **World Domain** owns locations, NPCs, and market economy
- **Item Domain** owns item definitions and crafting recipes
- **Activity Systems** orchestrate interactions between domains
- **No direct domain communication** - all through events

## Next Steps

### Immediate Priorities (Phase 1: Core Infrastructure)

1. **Set up project structure** following domain-driven design
2. **Implement Event System** with priority queue
3. **Build Orchestration Layer** (EventBus, CommandProcessor, StateCoordinator)
4. **Create basic UI framework** with React components
5. **Implement Save System** for persistence

### Short-term Goals (Phase 2: Core Domains)

1. **Implement Pet Domain** with stats and decay
2. **Build Player Domain** with inventory management
3. **Create Item Domain** with item definitions
4. **Set up World Domain** with basic locations
5. **Implement Time System** for game ticks

### Medium-term Goals (Phase 3: Activity Systems)

1. **Care System** for pet interactions
2. **Basic UI screens** for pet management
3. **Stat decay logic** over time
4. **Simple activities** for engagement

## Technical Decisions Made

### Architecture Choices

- **Domain-Driven Design** for clear boundaries
- **Event-driven communication** between domains
- **Immutable state updates** for predictability
- **Command pattern** for user actions
- **Priority-based event queue** for performance

### Technology Stack (Confirmed)

- **Runtime**: Bun for fast development
- **Framework**: React 19 with TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: TBD (Zustand or Valtio)
- **Build Tool**: Bun's native bundler

### Design Patterns

- **Observer Pattern**: Event system
- **Command Pattern**: User actions
- **Repository Pattern**: Domain data access
- **Factory Pattern**: Entity creation

## Current Blockers

### None Currently

- Architecture design is complete and refined
- Development environment is ready
- Clear implementation path defined

## Questions to Resolve

### Implementation Questions

1. **State Management Library**: Zustand vs Valtio - need to decide
2. **Asset Pipeline**: How to handle sprites and sounds
3. **Testing Strategy**: Vitest setup and test structure
4. **PWA Configuration**: When to add PWA support

### Game Design Questions

1. **Initial Pet Selection**: UI/UX for choosing starter pet
2. **Tutorial Flow**: How to onboard new players
3. **Difficulty Curve**: Balancing stat decay rates
4. **Visual Style**: Art direction for pets and UI

## Development Environment

### Current Setup

- **OS**: macOS Ventura
- **Runtime**: Bun v1.2.19
- **Editor**: VS Code with Kilo Code
- **Package Manager**: Bun

### Available Scripts

- `bun dev` - Start development server with HMR
- `bun start` - Run production server
- `bun run build.ts` - Build for production

## Notes for Next Session

### Remember To

1. Follow domain-driven design principles strictly
2. Keep domains isolated - no direct communication
3. Use activity systems to orchestrate domain interactions
4. Implement event system before domain logic
5. Write tests alongside implementation

### Architecture Reminders

- Domains own data, not logic for using that data
- Activity systems orchestrate between domains
- Events flow through the orchestration layer
- State is immutable, use StateCoordinator for updates
- Commands are validated before execution

### Code Quality Goals

- TypeScript strict mode always
- No `any` types
- Comprehensive error handling
- Performance monitoring from start
- Accessibility features built-in

## Active Work Focus

Currently completing memory bank rebuild with clarified domain-driven architecture. The architecture now has clear boundaries with no overlapping responsibilities. Ready to begin Phase 1 implementation starting with the core orchestration layer (EventBus, CommandProcessor, StateCoordinator).
