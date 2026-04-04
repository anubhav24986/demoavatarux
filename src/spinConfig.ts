/**
 * Predefined spin outcomes in 5×3 format.
 *
 * Each outcome defines the exact symbol that must appear on every cell of
 * the visible grid:
 *
 *   rows[0]  →  top    row  [reel0, reel1, reel2, reel3, reel4]
 *   rows[1]  →  middle row  [reel0, reel1, reel2, reel3, reel4]
 *   rows[2]  →  bottom row  [reel0, reel1, reel2, reel3, reel4]
 *
 * The spin engine embeds every outcome's 3-symbol column into each reel's
 * strip so the reel can always land exactly on the configured position.
 *
 * Winning coordinates:
 *   winCoords is a list of [reelIndex, rowIndex] pairs that identify every
 *   cell belonging to the winning combination.  Only present on outcomes
 *   that carry a winLabel.
 *     reelIndex : 0–4  (left → right)
 *     rowIndex  : 0=top, 1=middle, 2=bottom
 *
 * Cycle mode:
 *   "sequential" – outcomes are consumed one by one, wrapping around.
 *   "random"     – a random outcome is picked each spin.
 */

import { REELS, ROWS, SYMBOLS } from './constants'

export type WinCoord = [reelIndex: number, rowIndex: number]

export type SpinOutcome = {
  /**
   * rows[rowIndex][reelIndex] = symbol label
   * Must be exactly ROWS × REELS.
   */
  rows: [
    [string, string, string, string, string],   // row 0 – top
    [string, string, string, string, string],   // row 1 – middle
    [string, string, string, string, string],   // row 2 – bottom
  ]
  /** Label shown in the win banner – only present on winning outcomes */
  winLabel?: string
  /**
   * Coordinates of every cell that forms the winning combination.
   * Only present when winLabel is set.
   */
  winCoords?: WinCoord[]
}

/**
 * true  → outcomes come from SPIN_OUTCOMES (hardcoded)
 * false → each spin generates a fully random grid
 */
export const USE_HARDCODED_OUTCOMES = false


export const CYCLE_MODE: 'sequential' | 'random' = 'sequential'

// ── sequential cursor ─────────────────────────────────────────────────────────
let outcomeIndex = 0

/**
 * Returns the next SpinOutcome.
 * Hardcoded mode: pulls from SPIN_OUTCOMES (sequential or random cycle).
 * Random mode:    builds a random ROWS×REELS grid on the fly.
 */
export function getNextOutcome(): SpinOutcome {
  if (!USE_HARDCODED_OUTCOMES) {
    const rows = Array.from({ length: ROWS }, () =>
      Array.from({ length: REELS }, () =>
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)].label,
      ),
    ) as SpinOutcome['rows']
    return { rows }
  }

  if (CYCLE_MODE === 'random') {
    return SPIN_OUTCOMES[Math.floor(Math.random() * SPIN_OUTCOMES.length)]
  }

  const o = SPIN_OUTCOMES[outcomeIndex % SPIN_OUTCOMES.length]
  outcomeIndex++
  return o
}


function outcome(
  rows: SpinOutcome['rows'],
  winLabel?: string,
  winCoords?: WinCoord[],
): SpinOutcome {
  if (rows.length !== ROWS || rows.some((r) => r.length !== REELS)) {
    throw new Error(`SpinOutcome must be ${ROWS}×${REELS}`)
  }
  return { rows, winLabel, winCoords }
}

export const SPIN_OUTCOMES: SpinOutcome[] = [
    outcome(
    [
      ['A',  'K',  'Q',  'J',  '10'],
      ['H3', 'H3', 'H3', 'M2', 'K' ],
      ['9',  'Q',  'A',  'H1', 'M4'],
    ],
    '★ 3 OF A KIND! ★',
    // A across the entire middle row
    [[0, 1], [1, 1], [2, 1]],
  ),
  outcome(
    [
      ['H6', 'A', '10', 'M2', 'H6'],
      ['H3', 'A', 'A', 'A', '10'],
      ['A', 'M2', '10', 'J', 'A'],
    ],
    '★ JACKPOT! ★'
  ),
  // ── 5-of-a-kind wins ─────────────────────────────────────────────────────
  outcome(
    [
      ['M5', 'BONUS', 'M2', 'M2', 'BONUS'],
      ['M4', 'M4', 'M4', 'M4', 'M4'],
      ['M2', '10', 'BONUS', 'K', 'M2'],
    ]
  ),
  outcome(
    [
      ['H3', 'H4', 'H5', 'H6', 'M1'],
      ['H2', 'H2', 'H2', 'H2', 'H2'],
      ['A',  'K',  'Q',  'J',  '10'],
    ],
    '★ BIG WIN! ★',
    // H2 across the entire middle row
    [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]],
  ),
  outcome(
    [
      ['K',  'Q',  'J',  '10', '9' ],
      ['M1', 'M1', 'M1', 'M1', 'M1'],
      ['H1', 'M2', 'M3', 'M4', 'M5'],
    ],
    '★ WIN! ★',
    // M1 across the entire middle row
    [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]],
  ),
  outcome(
    [
      ['H2', 'H3', 'H4', 'H5', 'H6'],
      ['A',  'A',  'A',  'A',  'A' ],
      ['M6', 'M1', 'M2', 'M3', 'M4'],
    ],
    '★ WIN! ★',
    // A across the entire middle row
    [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]],
  ),
  outcome(
    [
      ['M2', 'M3', 'M4', 'M5', 'M6'],
      ['BONUS', 'BONUS', 'BONUS', 'BONUS', 'BONUS'],
      ['H1', 'H2', 'H3', 'H4', 'H5'],
    ],
    '★ BONUS! ★',
    // BONUS across the entire middle row
    [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]],
  ),

  // ── 3-of-a-kind on left reels ─────────────────────────────────────────────
  outcome(
    [
      ['A',  'K',  'Q',  'J',  '10'],
      ['H3', 'H3', 'H3', 'M2', 'K' ],
      ['9',  'Q',  'A',  'H1', 'M4'],
    ],
    '★ 3 OF A KIND! ★',
    // A across the entire middle row
    [[0, 1], [1, 1], [2, 1]],
  ),
  outcome(
    [
      ['M3', 'H5', '9',  'K',  'A' ],
      ['M4', 'M4', 'M4', 'Q',  'J' ],
      ['H6', 'M1', 'H2', '10', 'M5'],
    ],
    '★ 3 OF A KIND! ★',
    // A across the entire middle row
    [[0, 1], [1, 1], [2, 1]],
  ),
  outcome(
    [
      ['H4', 'M6', 'M2', 'H1', 'Q' ],
      ['K',  'K',  'K',  'A',  '9' ],
      ['M5', 'H3', 'H5', 'M3', 'J' ],
    ],
    '★ 3 OF A KIND! ★',
    // A across the entire middle row
    [[0, 1], [1, 1], [2, 1]],
  ),

  // ── near misses ───────────────────────────────────────────────────────────
  outcome(
    [
      ['M1', 'H1', 'M3', 'H1', 'K' ],
      ['H5', 'H5', 'M3', 'H5', '10'],
      ['Q',  'M4', 'H2', 'M6', 'A' ],
    ],
  ),
  outcome(
    [
      ['H1', 'A',  'H1', 'K',  'M2'],
      ['M6', 'Q',  'M6', 'M6', 'A' ],
      ['J',  'M5', '9',  'H3', 'H4'],
    ],
  ),

  // ── mixed / losses ────────────────────────────────────────────────────────
  outcome(
    [
      ['H2', 'M1', 'K',  'H4', 'M3'],
      ['9',  'J',  'Q',  'K',  'A' ],
      ['M4', 'H5', 'M5', '10', 'H6'],
    ],
  ),
  outcome(
    [
      ['H1', 'K',  'M5', 'J',  'H3'],
      ['M2', 'H4', '10', 'M5', 'Q' ],
      ['A',  'M6', 'H2', '9',  'M1'],
    ],
  ),
  outcome(
    [
      ['M4', 'H2', 'A',  'M2', 'K' ],
      ['J',  'M3', 'K',  '9',  'H6'],
      ['H5', '10', 'M6', 'H1', 'Q' ],
    ],
  ),
  outcome(
    [
      ['K',  'H3', 'M1', 'A',  'M3'],
      ['10', 'A',  'M1', 'J',  'M4'],
      ['H4', 'M5', 'H6', 'M2', '9' ],
    ],
  ),
  outcome(
    [
      ['J',  'M4', 'H5', 'M6', 'H1'],
      ['Q',  'H2', '9',  'M6', 'K' ],
      ['M3', 'A',  'M2', 'H3', '10'],
    ],
  ),
]
