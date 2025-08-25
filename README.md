# Digital Pet Game

A client-only browser game where you care for a cozy companion across short sessions while progressing over time. The game runs fully offline after the first load.

## Features

- **Care Loop**: Maintain Satiety, Hydration, and Happiness while managing cleanliness and health.
- **Explore and Progress**: Travel between locations, perform timed activities, train stats, and participate in calendar events.
- **Offline Friendly**: Uses the device clock and saves to `localStorage` for robust offline play with import/export support.
- **Accessible by Design**: Mobile-first UX with touch, mouse, and keyboard support plus options for color-blind palettes, high contrast, and reduced motion.

## Architecture

The game follows a modular design where isolated systems communicate through a central `GameEngine` using a `GameUpdates` queue. This keeps responsibilities clear and processing deterministic.

## Development

### Install dependencies

```bash
bun install
```

### Start a development server

```bash
bun dev
```

### Run for production

```bash
bun start
```

### Useful scripts

- `bun test` – run unit tests
- `bun run lint` – run ESLint
- `bun run build` – create a production build

## Documentation

For more details, see the [PRD](./PRD.md) and [architecture overview](./architecture.md).
