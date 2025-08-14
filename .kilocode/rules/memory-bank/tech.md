# Digital Pet Game - Technology Stack Documentation

## Core Technologies

### Runtime Environment

- **Bun v1.2.19**: Fast all-in-one JavaScript runtime
  - Built-in TypeScript support
  - Native ESM support
  - Fast package installation
  - Hot module reloading (HMR)
  - Built-in test runner

### Frontend Framework

- **React 19**: Latest React version with concurrent features
  - Concurrent rendering for better performance
  - Automatic batching
  - Suspense improvements
  - Server components ready (future)

### Language

- **TypeScript (Strict Mode)**: Type-safe JavaScript
  - `strict: true` in tsconfig
  - No implicit `any`
  - Strict null checks
  - No unchecked indexed access

## UI & Styling

### CSS Framework

- **Tailwind CSS v4.1**: Utility-first CSS framework
  - JIT compilation
  - Custom design system
  - Responsive utilities
  - Dark mode support

### Component Library

- **shadcn/ui**: Radix UI + Tailwind CSS components
  - Accessible by default
  - Customizable components
  - TypeScript support
  - Copy-paste architecture

### UI Dependencies

- **@radix-ui/react-\***: Headless UI components
  - react-label
  - react-select
  - react-slot
- **class-variance-authority**: Component variant management
- **clsx**: Conditional className utility
- **tailwind-merge**: Merge Tailwind classes intelligently
- **lucide-react**: Icon library

## State Management (Planned)

### Options Under Consideration

1. **Zustand** (Preferred)
   - Simple API
   - TypeScript friendly
   - DevTools support
   - Small bundle size

2. **Valtio**
   - Proxy-based state
   - Automatic tracking
   - Simple mutations
   - Good performance

### Immutability

- **Immer**: Immutable state updates with mutable API
  - Work with draft states
  - Automatic immutability
  - TypeScript support

## Build & Development Tools

### Build System

- **Bun Build**: Native Bun bundler
  - Fast builds
  - Built-in optimization
  - Tree shaking
  - Code splitting ready

### Development Server

- **Bun Server**: Built-in development server
  - Hot Module Reloading (HMR)
  - API routes support
  - Static file serving
  - WebSocket support

### Build Configuration

```javascript
// build.ts configuration
{
  entrypoints: ["src/*.html"],
  outdir: "dist",
  plugins: [tailwindPlugin],
  minify: true,
  target: "browser",
  sourcemap: "linked",
  define: {
    "process.env.NODE_ENV": "production"
  }
}
```

## Testing Stack (Planned)

### Unit Testing

- **Vitest**: Fast unit test framework
  - Jest-compatible API
  - Native ESM support
  - TypeScript support
  - Watch mode

### E2E Testing

- **Playwright**: Cross-browser testing
  - Chromium, Firefox, Safari
  - Mobile viewports
  - Network interception
  - Visual testing

### Testing Utilities

- **@testing-library/react**: React testing utilities
- **@testing-library/user-event**: User interaction simulation
- **MSW**: Mock Service Worker for API mocking

## Development Tools

### Code Quality

- **ESLint**: Linting and code standards
  - TypeScript ESLint parser
  - React hooks rules
  - Import sorting
  - Custom rules

- **Prettier**: Code formatting
  - Consistent formatting
  - Editor integration
  - Pre-commit hooks

### Type Checking

- **TypeScript Compiler**: Type validation
  - Strict mode enabled
  - Path aliases configured
  - Module resolution: bundler

### Version Control

- **Git**: Source control
- **GitHub**: Repository hosting
- **.gitignore**: Excludes node_modules, dist, etc.

## Performance Libraries (Planned)

### Web Workers

- **Comlink**: Simplified Web Worker communication
  - RPC-style API
  - TypeScript support
  - Promise-based

### Data Management

- **localforage**: Unified storage API
  - IndexedDB with fallbacks
  - Promise-based API
  - Offline data persistence

### Date/Time

- **date-fns**: Modern date utility library
  - Tree-shakeable
  - Immutable
  - TypeScript support
  - Timezone handling

### Utilities

- **uuid**: UUID generation for unique IDs
- **lodash-es**: Utility functions (tree-shakeable)

## PWA Support (Planned)

### Service Worker

- **Workbox**: Service worker toolkit
  - Precaching strategies
  - Runtime caching
  - Offline support
  - Background sync

### PWA Features

- **Web App Manifest**: App metadata
- **Push Notifications**: Engagement features
- **Background Sync**: Offline actions
- **Install Prompts**: Add to home screen

## Asset Management

### Image Optimization

- **Sharp** (via Bun): Image processing
  - Resize and compress
  - Format conversion
  - Sprite generation

### Sound/Music

- **Howler.js** (Planned): Audio library
  - Cross-browser support
  - Audio sprites
  - 3D spatial audio
  - Mobile compatibility

## Package Management

### Package Manager

- **Bun**: Fast package management
  - Lock file: `bun.lock`
  - Workspace support
  - Binary dependencies
  - Offline cache

### Current Dependencies

```json
{
  "dependencies": {
    "@radix-ui/react-label": "^2.1.7",
    "@radix-ui/react-select": "^2.2.5",
    "@radix-ui/react-slot": "^1.2.3",
    "bun-plugin-tailwind": "^0.0.15",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.525.0",
    "react": "^19",
    "react-dom": "^19",
    "tailwind-merge": "^3.3.1",
    "tailwindcss": "^4.1.11",
    "tailwindcss-animate": "^1.0.7"
  },
  "devDependencies": {
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@types/bun": "latest"
  }
}
```

## Development Scripts

### Available Commands

```bash
# Development server with HMR
bun dev

# Production server
bun start

# Build for production
bun run build.ts

# Install dependencies
bun install
```

### Custom Build Script

- **build.ts**: Flexible build configuration
  - Command-line argument parsing
  - Multiple build targets
  - Minification options
  - Source map generation

## TypeScript Configuration

### Compiler Options

```json
{
  "lib": ["ESNext", "DOM"],
  "target": "ESNext",
  "module": "Preserve",
  "jsx": "react-jsx",
  "strict": true,
  "moduleResolution": "bundler",
  "allowImportingTsExtensions": true,
  "noEmit": true,
  "skipLibCheck": true,
  "baseUrl": ".",
  "paths": {
    "@/*": ["./src/*"]
  }
}
```

## Environment Configuration

### Development Environment

- **Hot Reloading**: Instant updates
- **Source Maps**: Debugging support
- **Error Overlay**: Visual error reporting
- **Console Forwarding**: Browser logs in terminal

### Production Environment

- **Minification**: Reduced bundle size
- **Tree Shaking**: Dead code elimination
- **Compression**: Gzip/Brotli support
- **Caching**: Long-term caching strategies

## Browser Support

### Target Browsers

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Android)

### Polyfills (If Needed)

- Core-js for older browsers
- Intersection Observer
- ResizeObserver
- Web Animations API

## Security Considerations

### Content Security Policy

- Strict CSP headers
- XSS prevention
- Script integrity checks

### Dependencies

- Regular updates
- Security audits
- License compliance
- Supply chain security

## Performance Targets

### Build Performance

- Development build: < 1 second
- Production build: < 10 seconds
- HMR update: < 100ms

### Runtime Performance

- Initial load: < 3 seconds
- Time to Interactive: < 4 seconds
- First Contentful Paint: < 1.5 seconds
- 60 FPS during gameplay

## Deployment Strategy

### Static Hosting Options

- **Vercel**: Optimal for React apps
- **Netlify**: Good CDN and edge functions
- **Cloudflare Pages**: Fast global CDN
- **GitHub Pages**: Simple static hosting

### Build Output

- Static HTML/CSS/JS files
- Optimized assets
- Service worker for PWA
- Manifest files

## Future Technology Considerations

### Mobile App Wrappers

- **Capacitor**: Cross-platform native APIs
- **Tauri**: Lightweight desktop apps
- **React Native**: Native mobile apps

### Backend Integration (Future)

- **Supabase**: Backend as a Service
- **Firebase**: Google's BaaS
- **Custom API**: Node.js/Bun backend

### Multiplayer Stack (Future)

- **Socket.io**: Real-time communication
- **WebRTC**: Peer-to-peer connections
- **Colyseus**: Multiplayer game framework

## Development Best Practices

### Code Organization

- Feature-based folders
- Barrel exports
- Consistent naming
- Clear separation of concerns

### Git Workflow

- Feature branches
- Conventional commits
- Pull request reviews
- CI/CD integration

### Documentation

- JSDoc comments
- README files
- Architecture Decision Records (ADRs)
- API documentation

### Performance Monitoring

- Lighthouse CI
- Bundle size tracking
- Runtime performance metrics
- User analytics
