export const REELS = 5
export const ROWS = 3
export const SYMBOL_SIZE = 150
export const REEL_WIDTH = SYMBOL_SIZE + 10
export const REEL_GAP = 8

// How many symbols are on a reel strip
export const REEL_STRIP_LENGTH = 20
export const WILD_SYM_ID = 7
export const BONUS_SYM_ID = 6
export const BONUS_ANTICIPATION_MIN_COUNT = 2

export const BONUS_TRIGGER_COUNT = 3
// Spin config
export const SPIN_DURATION_BASE = 1200   // ms of full-speed spin for first reel
export const SPIN_DURATION_STEP = 200    // extra ms per reel (cascade stagger)
export const SPIN_MAX_SPEED = 1.8       
export const SPIN_ACCEL = 0.005         

/** Width reserved on the left side for the Spine character */
export const CHARACTER_AREA_WIDTH = 220

export const CANVAS_WIDTH = CHARACTER_AREA_WIDTH + REELS * (REEL_WIDTH + REEL_GAP) - REEL_GAP + 40
export const CANVAS_HEIGHT = 580

export const DEFAULT_BET = 10

// ── Spin physics ─────────────────────────────────────────────────────────────
/** Minimum number of full strip rotations before a reel begins easing */
export const SPIN_MIN_ROTATIONS = 3
/** Extra random rotations added on top of the minimum (0 to N-1) */
export const SPIN_EXTRA_ROTATIONS = 3
/** Easing decay base: fraction of distance covered per reference frame (60 fps) */
export const SPIN_EASE_DECAY = 0.04
/** Reference frame time in ms used to normalise the easing decay (1000/60) */
export const SPIN_EASE_FRAME_MS = 16.67
/** Distance threshold in px below which a reel snaps to its target */
export const SPIN_SNAP_THRESHOLD = 0.5

// ── Layout ───────────────────────────────────────────────────────────────────
export const BG_PADDING        = 10   // px inset for the canvas background rect
export const BG_CORNER_RADIUS  = 20   // px corner radius for canvas background
export const REEL_CORNER_RADIUS = 8   // px corner radius for each reel background
export const REEL_AREA_X_PAD   = 20   // px gap between character area and reels
export const REEL_AREA_Y       = 50   // px from canvas top to reel area
export const TITLE_Y           = 16   // px from canvas top to title text

// ── Spine character skeleton dimensions (from Spine editor) ──────────────────
export const CHAR_SKELETON_HEIGHT  = 617  // px — full skeleton height
export const CHAR_SKELETON_ROOT_Y  = 302  // px — distance from feet to skeleton root

// ── Colours (PixiJS hex) ─────────────────────────────────────────────────────
export const COLOR_BG         = 0x16213e  // canvas / separator background
export const COLOR_PANEL      = 0x0f3460  // main panel fill
export const COLOR_REEL_BG    = 0x0a1628  // individual reel background
export const COLOR_GOLD       = 0xffd700  // accent / win colour
export const COLOR_GOLD_STROKE_WIDTH = 3  // px stroke width for panel border

// Symbol definitions
export interface SymbolDef {
  id: number
  label: string   // display name used for win detection / result grid
  name: string    // PNG filename (without extension) inside the symbols folder
  value: number   // point value for win calculations
}

export const SYMBOLS: SymbolDef[] = [
  { id: 0,  label: '9',     name: '9' ,value:10},
  { id: 1,  label: '10',    name: '10' ,value:10},
  { id: 2,  label: 'J',     name: 'J',value:10 },
  { id: 3,  label: 'Q',     name: 'Q' ,value:10},
  { id: 4,  label: 'K',     name: 'K' ,value:10},
  { id: 5,  label: 'A',     name: 'A' ,value:10},
  { id: 6,  label: 'BONUS', name: 'BONUS' ,value:10},
  { id: 7,  label: 'H1',    name: 'H1' ,value:20},
  { id: 8,  label: 'H2',    name: 'H2' ,value:20},
  { id: 9,  label: 'H3',    name: 'H3' ,value:20},
  { id: 10, label: 'H4',    name: 'H4' ,value:20},
  { id: 11, label: 'H5',    name: 'H5' ,value:20},
  { id: 12, label: 'H6',    name: 'H6' ,value:20},
  { id: 13, label: 'M1',    name: 'M1' ,value:15},
  { id: 14, label: 'M2',    name: 'M2' ,value:15},
  { id: 15, label: 'M3',    name: 'M3' ,value:15},
  { id: 16, label: 'M4',    name: 'M4' ,value:15},
  { id: 17, label: 'M5',    name: 'M5' ,value:15},
  { id: 18, label: 'M6',    name: 'M6' ,value:15},
]
