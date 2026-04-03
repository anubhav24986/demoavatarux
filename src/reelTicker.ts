/**
 * reelTicker.ts
 *
 * Pure tick function for the reel physics loop.
 * Called every frame by the PixiJS ticker — no React, no PIXI imports needed.
 */

import * as PIXI from "pixi.js";
import {
  SYMBOL_SIZE,
  SYMBOLS,
  SPIN_ACCEL,
  SPIN_MAX_SPEED,
  SPIN_EASE_DECAY,
  SPIN_EASE_FRAME_MS,
  SPIN_SNAP_THRESHOLD,
} from "./constants";
import {
  calculateWinAmountAndSymbolId,
  applyWinHighlight,
  detectWins,
} from "./winUtils";
import { USE_HARDCODED_OUTCOMES, type SpinOutcome } from "./spinConfig";

// ── types used by the ticker ─────────────────────────────────────────────────

export interface ReelState {
  container: PIXI.Container;
  strip: number[];
  position: number;
  targetPosition: number;
  velocity: number;
  spinning: boolean;
  stopTime: number;
  tiles: Array<PIXI.Container & { symId: number }>;
  /** Symbols to inject into the strip right when easing begins */
  pendingSymbols: number[] | null;
  pendingInsertAt: number;
}

export interface TickCallbacks {
  /** Called once when every reel has stopped */
  onAllReelsStopped: (winAmount: number, winSymbolId: number | null) => void;
  /** Called for each reel the moment it snaps to its final position */
  onReelLanded: (landedSymbolIds: number[]) => void;
  playLandingAnim: (symbolIds: number[]) => void;
  playWinAnim: (amount: number, symbolId: number | null) => void;
  applyWinHighlightFn: typeof applyWinHighlight;
  textures: Record<string, PIXI.Texture>;
  connectTextures: Record<string, PIXI.Texture>;
  pendingOutcome: SpinOutcome | null;
  setSpinning: (v: boolean) => void;
  setWinAmount: (v: number) => void;
  setBalance: (updater: (prev: number) => number) => void;
  updateResult: (reels: ReelState[]) => void;
  spinningRef: { current: boolean };
  anticipationTracker: { reset: () => void };
}

// ── per-reel physics step ────────────────────────────────────────────────────

function advanceReel(reel: ReelState, dt: number, now: number): void {
  if (now < reel.stopTime) {
    // Accelerate toward max speed
    reel.velocity = Math.min(reel.velocity + SPIN_ACCEL * dt, SPIN_MAX_SPEED);
    reel.position += reel.velocity * dt;
  } else {
    // Inject outcome symbols exactly once at the start of easing
    if (reel.pendingSymbols) {
      for (let row = 0; row < reel.pendingSymbols.length; row++) {
        reel.strip[reel.pendingInsertAt + row] = reel.pendingSymbols[row];
      }
      reel.pendingSymbols = null;
    }

    // Delta-time–correct ease toward target
    const factor = 1 - Math.pow(SPIN_EASE_DECAY, dt / SPIN_EASE_FRAME_MS);
    const diff = reel.targetPosition - reel.position;
    reel.position += diff * factor;
    reel.velocity = (diff * factor) / dt;

    if (Math.abs(diff) < SPIN_SNAP_THRESHOLD) {
      reel.position = reel.targetPosition;
      reel.velocity = 0;
      reel.spinning = false;
    }
  }
}

// ── per-reel visual update ───────────────────────────────────────────────────

function syncReelTiles(
  reel: ReelState,
  textures: Record<string, PIXI.Texture>,
): void {
  const stripH = reel.strip.length * SYMBOL_SIZE;
  const displayPos = reel.position % stripH;
  const reversePos = (stripH - displayPos) % stripH;
  const baseIndex = Math.floor(reversePos / SYMBOL_SIZE) % reel.strip.length;
  const yOffset = -(reversePos % SYMBOL_SIZE);

  for (let t = 0; t < reel.tiles.length; t++) {
    const currentSymId = reel.strip[(baseIndex + t) % reel.strip.length];
    const tile = reel.tiles[t];
    tile.y = yOffset + t * SYMBOL_SIZE;

    if (tile.symId !== currentSymId) {
      tile.symId = currentSymId;
      (tile.children[0] as PIXI.Sprite).texture =
        textures[SYMBOLS[currentSymId].name] ?? PIXI.Texture.EMPTY;
    }
  }
}

// ── landing symbol resolver ───────────────────────────────────────────────────

function getLandedSymbolIds(reel: ReelState): number[] {
  const stripH = reel.strip.length * SYMBOL_SIZE;
  const landedDisplayPos = reel.targetPosition % stripH;
  const landedReversePos = (stripH - landedDisplayPos) % stripH;
  const landedBase =
    Math.floor(landedReversePos / SYMBOL_SIZE) % reel.strip.length;

  return reel.strip.filter((_v, id) => id >= landedBase);
}

// ── win resolution ────────────────────────────────────────────────────────────

function resolveWins(reelStates: ReelState[], cb: TickCallbacks): void {
  const { pendingOutcome, textures, connectTextures } = cb;
  // const winsTest = detectWins(reelStates);
  // if (USE_HARDCODED_OUTCOMES && pendingOutcome?.winLabel && winsTest) {
  if (
    USE_HARDCODED_OUTCOMES &&
    pendingOutcome?.winLabel &&
    pendingOutcome.winCoords
  ) {
    // applyWinHighlight(reelStates, winsTest, textures, connectTextures);
    // const [amount, symbolId] = calculateWinAmountAndSymbolId(
    //   reelStates,
    //   winsTest,
    // );
    applyWinHighlight(
      reelStates,
      pendingOutcome.winCoords,
      textures,
      connectTextures,
    );
    const [amount, symbolId] = calculateWinAmountAndSymbolId(
      reelStates,
      pendingOutcome.winCoords,
    );
    cb.setWinAmount(amount);
    cb.setBalance((prev) => prev + amount);
    cb.playWinAnim(amount, symbolId);
    cb.onAllReelsStopped(amount, symbolId);
  } else if (!USE_HARDCODED_OUTCOMES) {
    const wins = detectWins(reelStates);
    if (wins.length > 0) {
      applyWinHighlight(reelStates, wins, textures, connectTextures);
      const [amount, symbolId] = calculateWinAmountAndSymbolId(
        reelStates,
        wins,
      );
      cb.setWinAmount(amount);
      cb.setBalance((prev) => prev + amount);
      cb.playWinAnim(amount, symbolId);
      cb.onAllReelsStopped(amount, symbolId);
    }
  }

  cb.anticipationTracker.reset();
}


/**
 * Call this from `app.ticker.add(...)` each frame.
 *
 * @param reelStates  - mutable array of reel state objects
 * @param dt          - ticker.deltaMS
 * @param cb          - callbacks and shared state from the component
 */
export function tickReels(
  reelStates: ReelState[],
  dt: number,
  cb: TickCallbacks,
): void {
  const now = performance.now();

  for (const reel of reelStates) {
    if (!reel.spinning) continue;

    const wasSpinning = reel.spinning;
    advanceReel(reel, dt, now);
    syncReelTiles(reel, cb.textures);

    // Reel just landed this frame
    if (wasSpinning && !reel.spinning) {
      const landedIds = getLandedSymbolIds(reel).filter((_, id) => id < 3);

      cb.playLandingAnim(landedIds);
      cb.onReelLanded(landedIds);

      cb.spinningRef.current = reelStates.some((r) => r.spinning);

      if (!cb.spinningRef.current) {
        cb.setSpinning(false);
        cb.updateResult(reelStates);
        resolveWins(reelStates, cb);
      }
    }
  }
}
