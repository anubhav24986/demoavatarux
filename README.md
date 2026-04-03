# Slot Prototype

A browser-based slot machine prototype built with React, PixiJS v8, and Spine skeletal animation. Developed as part of the AvatarUX 2026 Game Developer test.

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| React | 18 | UI shell and state management |
| PixiJS | 8 | WebGL/Canvas 2D rendering |
| Spine (spine-pixi-v8) | 4.2 | Animated character |
| Vite | 5 | Build tooling and dev server |
| TypeScript | 5 | Type safety |

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Other scripts

```bash
npm run build    # TypeScript check + production bundle → dist/
npm run preview  # Serve the production build locally
```

## Project Structure

```
slot-prototype/
├── src/
│   ├── main.tsx               # React entry point
│   ├── App.tsx                # Root component
│   ├── constants.ts           # All layout, physics, colour, and symbol constants
│   ├── spinConfig.ts          # Spin outcomes (hardcoded or random mode)
│   ├── reelTicker.ts          # Frame-by-frame reel physics (pure, no React)
│   ├── winUtils.ts            # Win detection, highlight, and payout calculation
│   ├── spineCharacter.ts      # Spine character loader and atlas builder
│   └── components/
│       └── SlotMachine.tsx    # Main PixiJS canvas component
├── symbols/symbols/           # Symbol PNGs (normal + _connect variants)
├── character/character/       # Spine skeleton JSON + character PNGs
└── dist/                      # Production build output
```

## Game Architecture

### Rendering

The slot machine renders into a PixiJS `Application` canvas mounted inside a React `div`. React manages only the HUD state (balance, win amount, spin button). All reel animation runs inside the PixiJS ticker loop, completely outside the React render cycle.

### Reel Physics

Each reel goes through three phases per spin:

1. **Acceleration** — velocity ramps up to `SPIN_MAX_SPEED` while `now < reel.stopTime`
2. **Easing** — exponential decay toward `targetPosition` once stop time is reached
3. **Snap** — position locks to `targetPosition` when the delta falls below `SPIN_SNAP_THRESHOLD`

Reels stop left-to-right with a configurable stagger (`SPIN_DURATION_STEP`).

### Symbol Strip

Each reel uses a circular symbol strip of length `REEL_STRIP_LENGTH` (default 20). The strip is shuffled at startup using Fisher-Yates so every symbol appears at least once. During a spin, the engine calculates how far the strip must travel (`minTravel`) to guarantee a minimum number of full rotations before landing.

### Outcome Modes

Controlled by `USE_HARDCODED_OUTCOMES` in [src/spinConfig.ts](src/spinConfig.ts):

- **`false` (default)** — each spin generates a fully random 5×3 grid; wins are detected automatically via `detectWins()`
- **`true`** — outcomes are pulled from the `SPIN_OUTCOMES` array in `spinConfig.ts`; the exact symbols for each reel column are injected into the strip at easing start to guarantee the configured result lands

When using hardcoded outcomes, `CYCLE_MODE` controls whether they replay `sequential`ly or in `random` order.

### Win Detection

`detectWins()` in [src/winUtils.ts](src/winUtils.ts) implements a **ways-to-win** mechanic:

- Scans for any symbol that appears in every column starting from reel 0 (left-to-right consecutive match)
- Requires at least 3 consecutive reels
- BONUS symbol is treated specially — all BONUS positions on the grid are collected as a single win group regardless of rows

### Character Animations

The Spine character reacts to game events:

| Event | Animation |
|---|---|
| Idle | `character_idle` (looping) |
| Any win | `character_small_win` |
| Wild symbol lands | `character_wild_landing` |
| Wild win | `character_wild_throw` |
| 2+ BONUS symbols landed | `character_bonus_anticipation` |
| BONUS trigger (3+) wins | `character_bonus_anticipation_win` |
| BONUS trigger (3+) loses | `character_bonus_anticipation_lose` |

After any non-looping animation completes, the character automatically returns to `character_idle`.

## Configuration

All tuneable constants live in [src/constants.ts](src/constants.ts):

```ts
REELS = 5                    // number of reels
ROWS  = 3                    // visible rows
SYMBOL_SIZE = 120            // px per symbol cell
REEL_STRIP_LENGTH = 20       // symbols per reel strip
DEFAULT_BET = 10             // bet deducted per spin

SPIN_DURATION_BASE = 1200    // ms full-speed spin for reel 0
SPIN_DURATION_STEP = 200     // extra ms stagger per reel
SPIN_MIN_ROTATIONS = 3       // minimum full rotations before easing
SPIN_MAX_SPEED = 1.8         // px/ms at full speed
SPIN_EASE_DECAY = 0.04       // easing decay per reference frame

WILD_SYM_ID  = 7             // symbol index of the Wild (H1)
BONUS_SYM_ID = 6             // symbol index of the Bonus
BONUS_ANTICIPATION_MIN_COUNT = 2   // BONUS symbols needed for anticipation anim
BONUS_TRIGGER_COUNT = 3            // BONUS symbols needed for a trigger win
```

## Symbol Definitions

Symbols are defined in `SYMBOLS` array inside `constants.ts`. Each entry specifies:

| Field | Description |
|---|---|
| `id` | Numeric index used internally |
| `label` | String identifier used in outcome grids (`'H1'`, `'BONUS'`, etc.) |
| `name` | PNG filename (without extension) in `symbols/symbols/` |
| `value` | Payout value per winning cell |

Symbol tiers and their values:

| Tier | Symbols | Value |
|---|---|---|
| Low | 9, 10, J, Q, K, A | 10 |
| Mid | M1–M6 | 15 |
| High | H1–H6 | 20 |
| Special | BONUS | 10 |

Each symbol may have a `_connect.png` variant (e.g. `H1_connect.png`) which is swapped in on winning cells as a highlight effect.
