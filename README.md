# Digital Pet Game 🐾

A sophisticated HTML5 client-side digital pet raising game built with modern web technologies and a clean domain-driven architecture.

## 🎮 What is this?

An engaging virtual pet experience similar to Tamagotchi but with significantly enhanced gameplay mechanics:

- **Deep Pet Care System** - Feed, groom, play, and nurture your pets
- **Battle System** - Strategic turn-based combat with elemental advantages
- **Dynamic World** - Explore locations, trade with NPCs, discover secrets
- **Crafting & Economy** - Create items, manage resources, build wealth
- **Long-term Progression** - Years of content with meaningful advancement

## 🏗️ Architecture

Built using **Domain-Driven Design** with **Event-Driven Architecture**:

```
┌─────────────────────────────────────────────────┐
│          Layer 1: Input Layer                    │
│  (User Input, Timer Events, System Events)       │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│       Layer 2: Orchestration Layer               │
│  (Event Bus, Command Processor,                  │
│   State Coordinator)                             │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│          Layer 3: Domain Layer                   │
│  • Core Domains (Pet, Player, World, Item)      │
│  • Activity Systems (Care, Battle, Trade, etc)  │
│  • Support Systems (Time, Save, Notification)   │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│        Layer 4: Presentation Layer               │
│  (UI Components, Sound, Animations)              │
└─────────────────────────────────────────────────┘
```

### Key Design Principles

- **Single Responsibility** - Each domain owns specific data exclusively
- **Event-Driven Communication** - Domains communicate through events, not direct calls
- **Immutable State Updates** - All state changes create new objects for predictability
- **Command Pattern** - User actions become validated commands before execution

## 🚀 Tech Stack

- **Runtime**: Bun v1.2.19 (fast JavaScript runtime)
- **Framework**: React 19 with TypeScript (strict mode)
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: Zustand + Immer for immutable updates
- **Build Tool**: Bun's native bundler
- **Testing**: Vitest + Testing Library
- **Code Quality**: ESLint + Prettier with strict rules

## 🛠️ Development Setup

### Prerequisites

- [Bun](https://bun.sh/) v1.2.19 or later

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd digital-pets-v2

# Install dependencies
bun install

# Start development server
bun dev
```

### Available Scripts

```bash
# Development
bun dev              # Start dev server with hot reload
bun start            # Run production server
bun run build.ts     # Build for production

# Code Quality
bun run lint         # Run ESLint
bun run lint:fix     # Fix ESLint issues
bun run format       # Format code with Prettier
bun run format:check # Check formatting
bun run typecheck    # Run TypeScript compiler

# Testing
bun test             # Run all tests
bun test:watch       # Run tests in watch mode
```

## 📁 Project Structure

```
src/
├── core/                   # 🔥 Orchestration Layer
│   ├── EventBus.ts        # ✅ Priority-based event system
│   ├── StateCoordinator.ts # ✅ Immutable state management
│   ├── types.ts           # ✅ Core type definitions
│   └── README.md          # Architecture documentation
│
├── domains/                # 🎯 Domain Layer
│   ├── pet/               # 🚧 Pet domain (stats, personality)
│   ├── player/            # 🚧 Player domain (inventory, progression)
│   ├── world/             # 🚧 World domain (locations, NPCs)
│   ├── item/              # 🚧 Item domain (definitions, recipes)
│   └── README.md          # Domain documentation
│
├── activities/             # 🎮 Activity Systems
│   ├── CareSystem.ts      # 🚧 Pet care activities
│   ├── BattleSystem.ts    # 🚧 Combat system
│   ├── TradeSystem.ts     # 🚧 Economic interactions
│   ├── CraftSystem.ts     # 🚧 Item creation
│   ├── ExploreSystem.ts   # 🚧 World exploration
│   └── README.md          # Activity documentation
│
├── support/                # ⚙️ Support Systems
│   ├── TimeSystem.ts      # 🚧 Game tick management
│   ├── SaveSystem.ts      # 🚧 Persistence layer
│   └── NotificationSystem.ts # 🚧 User notifications
│
├── input/                  # 📥 Input Layer
│   ├── UserInputHandler.ts # 🚧 User interaction capture
│   ├── TimerSystem.ts     # 🚧 Game timing events
│   └── SystemEventHandler.ts # 🚧 Browser events
│
├── ui/                     # 🎨 Presentation Layer
│   ├── screens/           # 🚧 Game screen components
│   ├── components/        # 🚧 Reusable UI components
│   ├── hooks/             # 🚧 React hooks for game state
│   └── contexts/          # 🚧 React context providers
│
├── assets/                 # 🎵 Game Assets
│   ├── sprites/           # Pet and UI graphics
│   └── sounds/            # Music and sound effects
│
└── utils/                  # 🔧 Utilities
    ├── math/              # Mathematical helpers
    └── validation/        # Data validation utilities
```

**Legend**: ✅ Complete | 🔥 In Progress | 🚧 Planned

## 🧪 Implementation Status

### ✅ Phase 1.1 - Project Setup (COMPLETE)

- [x] Domain-driven architecture design
- [x] TypeScript configuration with strict mode
- [x] ESLint + Prettier with game development rules
- [x] Vitest testing framework setup
- [x] Core type definitions for all domains
- [x] EventBus implementation with priority queues
- [x] StateCoordinator with Immer integration
- [x] Comprehensive documentation and README files
- [x] Sample test files with >80% coverage patterns

### 🔥 Phase 1.2 - Core Infrastructure (IN PROGRESS)

- [ ] CommandProcessor with validation and undo
- [ ] Basic UI framework with React components
- [ ] Save System for game persistence
- [ ] Input layer for user interactions

### 🚧 Upcoming Phases

- **Phase 2**: Core Domain implementation (Pet, Player, World, Item)
- **Phase 3**: Basic gameplay (Care system, stat decay, simple UI)
- **Phase 4**: Extended features (Battle, Trade, Craft, Explore systems)
- **Phase 5**: Polish (animations, sound, achievements, performance)

## 🎯 Game Features (Planned)

### Pet Management

- 31 unique species across 5 rarity tiers
- Dynamic personality development
- Stat decay system (hunger, happiness, energy, hygiene, health)
- Evolution through 50+ growth stages over ~2 years
- Relationship building between pets

### World & Exploration

- 10+ unique locations with activities
- Day/night cycles and weather systems
- Dynamic NPCs with schedules and dialogue
- Hidden areas and secrets to discover
- Resource gathering and environmental storytelling

### Battle System

- Turn-based strategic combat
- Elemental type advantages and environmental factors
- Move combinations and special abilities
- AI opponents with varying difficulty
- Tournament competitions and rankings

### Economy & Crafting

- Dynamic market with supply/demand pricing
- Multi-tier crafting system with recipes
- Item salvaging and upgrading
- Banking and investment systems
- Player-driven economy mechanics

## 🧪 Testing

The project uses a comprehensive testing strategy:

- **Unit Tests** - Each domain and system tested independently
- **Integration Tests** - Cross-system functionality verification
- **Type Tests** - TypeScript strict mode with no `any` types
- **E2E Tests** - Complete user workflows (planned)

Run tests:

```bash
# Run all tests
bun test

# Run with coverage
bun test --coverage

# Run specific test files
bun test src/core
```

## 🚀 Performance Targets

- **60 FPS** during gameplay
- **< 3 seconds** initial load time
- **< 100ms** response to user input
- **< 5%** save corruption rate
- Efficient memory usage with structural sharing

## 🔧 Development Guidelines

### Code Quality Standards

- **TypeScript strict mode** - No `any` types allowed
- **Comprehensive error handling** - All edge cases covered
- **Immutable state patterns** - Predictable state updates
- **Event-driven architecture** - Loose coupling between systems
- **Domain-driven design** - Clear boundaries and responsibilities

### Git Workflow

1. Feature branches for all changes
2. Conventional commits for clear history
3. Required tests for new functionality
4. Code review process for quality assurance

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Follow the established architecture patterns
4. Write tests for new functionality
5. Ensure all tests pass: `bun test`
6. Run linting: `bun run lint:fix`
7. Commit changes: `git commit -m 'feat: add amazing feature'`
8. Push to branch: `git push origin feature/amazing-feature`
9. Open a Pull Request

## 📈 Roadmap

### Short-term (1-2 weeks)

- Complete Phase 1 infrastructure
- Implement Pet domain with stat decay
- Basic pet care UI

### Medium-term (1-2 months)

- Full domain implementations
- Activity systems for gameplay
- Save/load functionality

### Long-term (3-6 months)

- Complete feature set
- Performance optimization
- Mobile PWA support
- Multiplayer preparation

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🎮 Vision

Creating a modern take on the classic digital pet genre with:

- **Deep emotional connections** through personality systems
- **Strategic gameplay** beyond basic care mechanics
- **Long-term engagement** with years of meaningful content
- **Technical excellence** using modern web technologies
- **Ethical design** without pay-to-win mechanics

---

**Status**: 🔥 **Active Development** | **Phase**: 1.1 Complete, 1.2 In Progress
