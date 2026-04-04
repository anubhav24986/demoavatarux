import { useEffect, useRef, useState } from "react";
import * as PIXI from "pixi.js";
import { createCharacter } from "../spineCharacter";
import {
  REELS,
  ROWS,
  SYMBOL_SIZE,
  REEL_WIDTH,
  REEL_GAP,
  REEL_STRIP_LENGTH,
  SPIN_DURATION_BASE,
  SPIN_DURATION_STEP,
  SPIN_MIN_ROTATIONS,
  SPIN_EXTRA_ROTATIONS,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  CHARACTER_AREA_WIDTH,
  SYMBOLS,
  WILD_SYM_ID,
  BONUS_SYM_ID,
  BONUS_ANTICIPATION_MIN_COUNT,
  BONUS_TRIGGER_COUNT,
  DEFAULT_BET,
  BG_PADDING,
  BG_CORNER_RADIUS,
  REEL_CORNER_RADIUS,
  REEL_AREA_X_PAD,
  REEL_AREA_Y,
  TITLE_Y,
  CHAR_SKELETON_HEIGHT,
  CHAR_SKELETON_ROOT_Y,
  COLOR_BG,
  COLOR_PANEL,
  COLOR_REEL_BG,
  COLOR_GOLD,
  COLOR_GOLD_STROKE_WIDTH,
} from "../constants";
import { getNextOutcome, USE_HARDCODED_OUTCOMES } from "../spinConfig";
import { tickReels, type ReelState } from "../reelTicker";
import { clearWinHighlight, applyWinHighlight } from "../winUtils";

// ─── symbol textures ─────────────────────────────────────────────────────────

const rawSymbolUrls = import.meta.glob("../../symbols/symbols/*.png", {
  query: "?url",
  import: "default",
  eager: true,
}) as Record<string, string>;

// Normal textures  →  no '_' in filename  (e.g. H1.png)
const symbolUrlByName: Record<string, string> = {};
// Connect textures →  filename ends with '_connect.png'  (e.g. H1_connect.png)
const symbolConnectUrlByName: Record<string, string> = {};

for (const [path, url] of Object.entries(rawSymbolUrls)) {
  const filename = path.split("/").pop()!;
  if (filename.endsWith("_connect.png")) {
    symbolConnectUrlByName[filename.replace("_connect.png", "")] = url;
  } else if (!filename.includes("_")) {
    symbolUrlByName[filename.replace(".png", "")] = url;
  }
}

// ─── helpers ────────────────────────────────────────────────────────────────

/** Shuffled strip that guarantees every symbol appears at least once */
function buildStrip(): number[] {
  const strip = SYMBOLS.map((_, i) => i); // one of every symbol
  for (let i = strip.length - 1; i > 0; i--) {
    // Fisher-Yates shuffle
    const j = Math.floor(Math.random() * (i + 1));
    [strip[i], strip[j]] = [strip[j], strip[i]];
  }
  while (strip.length < REEL_STRIP_LENGTH) {
    // pad to desired length
    strip.push(Math.floor(Math.random() * SYMBOLS.length));
  }

  return strip;
}

/** Create a Container holding one sprite, fitted to SYMBOL_SIZE */
function createSymbolContainer(
  textures: Record<string, PIXI.Texture>,
  symName: string,
): PIXI.Container {
  const container = new PIXI.Container();
  const sprite = new PIXI.Sprite(textures[symName] ?? PIXI.Texture.EMPTY);
  sprite.width = SYMBOL_SIZE;
  sprite.height = SYMBOL_SIZE;
  container.addChild(sprite);
  return container;
}


// ─── component ──────────────────────────────────────────────────────────────

// Total approximate height of all UI content (canvas + button + info + gaps)
const TOTAL_CONTENT_HEIGHT = CANVAS_HEIGHT + 200;

export default function SlotMachine() {
  const pixiContainerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const reelsRef = useRef<ReelState[]>([]);
  const spinningRef = useRef(false);
  const texturesRef = useRef<Record<string, PIXI.Texture>>({});
  const connectTexturesRef = useRef<Record<string, PIXI.Texture>>({});
  const pendingOutcomeRef = useRef<ReturnType<typeof getNextOutcome> | null>(
    null,
  );
  const [spinning, setSpinning] = useState(false);
  const [_result, setResult] = useState<string[][]>([]);
  // const [winLabel, setWinLabel] = useState<string | undefined>();
  const [winAmount, setWinAmount] = useState<number>(0);
  const [balance, setBalance] = useState<number>(100000);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    function updateScale() {
      const scaleX = window.innerWidth / CANVAS_WIDTH;
      const scaleY = window.innerHeight / TOTAL_CONTENT_HEIGHT;
      setScale(Math.min(scaleX, scaleY));
    }
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);
  useEffect(() => {
    let initializedApp: PIXI.Application | null = null;
    let unmounted = false;

    async function init() {
      // ── load all assets in parallel ──────────────────────────────────────
      // Kick off the character build immediately so it runs alongside symbols
      const characterPromise = createCharacter();

      const [textureEntries, connectEntries] = await Promise.all([
        Promise.all(
          SYMBOLS.map(async (sym) => {
            const url = symbolUrlByName[sym.name];
            const tex = url
              ? await PIXI.Assets.load<PIXI.Texture>(url)
              : PIXI.Texture.EMPTY;
            return [sym.name, tex] as const;
          }),
        ),
        Promise.all(
          SYMBOLS.map(async (sym) => {
            const url = symbolConnectUrlByName[sym.name];
            const tex = url
              ? await PIXI.Assets.load<PIXI.Texture>(url)
              : PIXI.Texture.EMPTY;
            return [sym.name, tex] as const;
          }),
        ),
      ]);

      const character = await characterPromise;

      // Return to idle automatically after any non-looping win animation finishes
      character.state.addListener({
        complete: (entry) => {
          if (entry.animation?.name !== "character_idle") {
            character.state.setAnimation(0, "character_idle", true);
          }
        },
      });

      // Pick and play the right animation based on win amount
      function playWinAnim(amount: number, symbolId: number | null) {
        if (amount <= 0) {
          return;
        } // no win — stay in idle

        // console.log("WIN AMOUNT :::", amount, "WINNING SYMBOL ID :::", symbolId,anticipationTracker.getTotal());
        let anim = "character_small_win";
        if (symbolId !== null) {
          if (symbolId === BONUS_SYM_ID) {
            if (anticipationTracker.getTotal() >= BONUS_TRIGGER_COUNT) {
              anim = "character_bonus_anticipation_win";
            } else {
              anim = "character_bonus_anticipation_lose";
            }
          } else if (symbolId === WILD_SYM_ID) {
            anim = "character_wild_throw";
          }
        }

        character.state.setAnimation(0, anim, false);
      }
      function playLandingAnim(stoppingSymbolIdList: Array<number>) {
        //lets suppose 7 is awild symbol and we want to play a different animation when a wild lands, we can do that here by checking the symbolId of the winning symbol
        //BONUS_ANTICIPAYION_MIN_COUNT
        if (stoppingSymbolIdList.includes(WILD_SYM_ID)) {
          const anim = "character_wild_landing";
          character.state.setAnimation(0, anim, false);
        }
        if (stoppingSymbolIdList.includes(BONUS_SYM_ID)) {
          //+=BONUS_ANTICIPAYION_MIN_COUNT
          anticipationTracker.add(1);
        }
        if (anticipationTracker.getTotal() >= BONUS_ANTICIPATION_MIN_COUNT) {
          // Play bonus anticipation animation
          const anim = "character_bonus_anticipation";
          character.state.setAnimation(0, anim, false);
        }
      }

      const textures = Object.fromEntries(textureEntries);
      const connectTextures = Object.fromEntries(connectEntries);
      texturesRef.current = textures;
      connectTexturesRef.current = connectTextures;

      const app = new PIXI.Application();
      await app.init({
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        backgroundColor: COLOR_BG,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      if (unmounted) {
        app.destroy(true, { children: true });
        return;
      }

      initializedApp = app;
      appRef.current = app;
      if (pixiContainerRef.current)
        pixiContainerRef.current.appendChild(app.canvas);

      // ── background ──────────────────────────────────────────────────────
      const bg = new PIXI.Graphics();
      bg.roundRect(BG_PADDING, BG_PADDING, CANVAS_WIDTH - BG_PADDING * 2, CANVAS_HEIGHT - BG_PADDING * 2, BG_CORNER_RADIUS);
      bg.fill({ color: COLOR_PANEL });
      bg.stroke({ color: COLOR_GOLD, width: COLOR_GOLD_STROKE_WIDTH });
      app.stage.addChild(bg);

      // ── spine character (behind reels and title) ─────────────────────────
      const CHAR_SCALE = CANVAS_HEIGHT / CHAR_SKELETON_HEIGHT;
      character.scale.set(CHAR_SCALE);
      character.x = CHARACTER_AREA_WIDTH / 2;
      character.y = CANVAS_HEIGHT - CHAR_SKELETON_ROOT_Y * CHAR_SCALE;
      app.stage.addChild(character);

      // ── title ────────────────────────────────────────────────────────────
      const title = new PIXI.Text({
        text: "SLOT PROTOTYPE",
        style: {
          fontFamily: "Arial Black, Arial",
          fontSize: 22,
          fontWeight: "bold",
          fill: 0xffd700,
          letterSpacing: 4,
        },
      });
      title.anchor.set(0.5, 0);
      title.x =
        CHARACTER_AREA_WIDTH + (REELS * (REEL_WIDTH + REEL_GAP) - REEL_GAP) / 2;
      title.y = TITLE_Y;
      app.stage.addChild(title);

      // ── reel area ────────────────────────────────────────────────────────
      const reelAreaX = CHARACTER_AREA_WIDTH + REEL_AREA_X_PAD;
      const reelAreaY = REEL_AREA_Y;
      const reelAreaW = REELS * (REEL_WIDTH + REEL_GAP) - REEL_GAP;
      const reelAreaH = ROWS * SYMBOL_SIZE;

      const reelMask = new PIXI.Graphics();
      reelMask.rect(reelAreaX, reelAreaY, reelAreaW, reelAreaH);
      reelMask.fill(0xffffff);
      app.stage.addChild(reelMask);

      // ── build reels ───────────────────────────────────────────────────────
      const reelStates: ReelState[] = [];

      for (let i = 0; i < REELS; i++) {
        const strip = buildStrip();
        //console.log('anubhav : strip for reel', i, strip  )
        const reelX = reelAreaX + i * (REEL_WIDTH + REEL_GAP);

        const reelBg = new PIXI.Graphics();
        reelBg.roundRect(reelX, reelAreaY, REEL_WIDTH, reelAreaH, REEL_CORNER_RADIUS);
        reelBg.fill({ color: COLOR_REEL_BG });
        app.stage.addChild(reelBg);

        const container = new PIXI.Container();
        container.x = reelX;
        container.y = reelAreaY;
        container.mask = reelMask;
        app.stage.addChild(container);

        const tiles: ReelState["tiles"] = [];
        for (let row = 0; row < ROWS + 1; row++) {
          const symId = strip[row];
          const tile = createSymbolContainer(
            textures,
            SYMBOLS[symId].name,
          ) as PIXI.Container & { symId: number };
          tile.symId = symId;
          tile.y = row * SYMBOL_SIZE;
          //console.log('anubhav : tiles', i,"::",tile)
          container.addChild(tile);
          tiles.push(tile);
        }

        reelStates.push({
          container,
          strip,
          position: 0,
          targetPosition: 0,
          velocity: 0,
          spinning: false,
          stopTime: 0,
          tiles,
          pendingSymbols: null,
          pendingInsertAt: 0,
        });
      }

      reelsRef.current = reelStates;

      // ── reel separators ───────────────────────────────────────────────────
      for (let i = 1; i < REELS; i++) {
        const sep = new PIXI.Graphics();
        const sepX = reelAreaX + i * (REEL_WIDTH + REEL_GAP) - REEL_GAP;
        sep.rect(sepX, reelAreaY, REEL_GAP, reelAreaH);
        sep.fill({ color: COLOR_BG });
        app.stage.addChild(sep);
      }

      // ── win-line overlay (centre row) ─────────────────────────────────────
      // const winLine = new PIXI.Graphics()
      // winLine.rect(reelAreaX - 4, reelAreaY + SYMBOL_SIZE * 1.5 - 3, reelAreaW + 8, 6)
      // winLine.fill({ color: 0xffd700, alpha: 0.35 })
      // app.stage.addChild(winLine)

      // ── ticker ────────────────────────────────────────────────────────────
      app.ticker.add((ticker) => {
        character.update(ticker.deltaMS / 1000);

        tickReels(reelStates, ticker.deltaMS, {
          textures,
          connectTextures,
          pendingOutcome:      pendingOutcomeRef.current,
          spinningRef,
          anticipationTracker,
          setSpinning,
          setWinAmount,
          setBalance,
          updateResult,
          playLandingAnim,
          playWinAnim,
          applyWinHighlightFn: applyWinHighlight,
          onReelLanded:        () => {},
          onAllReelsStopped:   () => {},
        });
      });

      updateResult(reelStates);
    }

    init();

    return () => {
      unmounted = true;
      initializedApp?.destroy(true, { children: true });
    };
  }, []);

  function updateResult(reelStates: ReelState[]) {
    const grid: string[][] = [];
    for (let row = 0; row < ROWS; row++) {
      const rowSymbols: string[] = [];
      for (const reel of reelStates) {
        const stripH = reel.strip.length * SYMBOL_SIZE;
        const reversePos = (stripH - (reel.position % stripH)) % stripH;
        const baseIndex =
          Math.floor(reversePos / SYMBOL_SIZE) % reel.strip.length;
        rowSymbols.push(
          SYMBOLS[reel.strip[(baseIndex + row) % reel.strip.length]].label,
        );
      }
      grid.push(rowSymbols);
    }
    setResult(grid);
  }
  const anticipationTracker = totalAniticipationSymbolCount(0);
  function totalAniticipationSymbolCount(initialValue = 0) {
    let total = initialValue; // This is the private variable

    return {
      add: function (value: number) {
        total += value;
        return total;
      },
      reset: function () {
        total = initialValue;
        return total;
      },
      getTotal: function () {
        return total;
      },
    };
  }
  function spin() {
    if (spinningRef.current) return;
    spinningRef.current = true;
    setSpinning(true);
    // setWinLabel(undefined);
    setWinAmount(0);
    setBalance((prev) => prev - DEFAULT_BET);
    clearWinHighlight(reelsRef.current, texturesRef.current);
    reelsRef.current.forEach((r) => {
      r.pendingSymbols = null;
    });

    const outcome = getNextOutcome();
    const now = performance.now();

    reelsRef.current.forEach((reel, reelIdx) => {
      const len = reel.strip.length;
      const stripH = len * SYMBOL_SIZE;
      const minTravel = (SPIN_MIN_ROTATIONS + Math.floor(Math.random() * SPIN_EXTRA_ROTATIONS)) * stripH;

      let landIdx: number; // strip index that will appear at row-0 (top) when reel stops

      if (USE_HARDCODED_OUTCOMES) {
        // ── schedule outcome symbols for injection at easing start ────────
        // Do NOT write to strip here — that causes a flash of the result.
        // The ticker will inject them the moment this reel enters easing.
        const insertAt = len - ROWS; // e.g. index 17 for a 20-symbol strip
        const syms = Array.from({ length: ROWS }, (_, row) => {
          const label = outcome.rows[row][reelIdx];
          const symIdx = SYMBOLS.findIndex((s) => s.label === label);
          return symIdx !== -1 ? symIdx : 0;
        });
        reel.pendingSymbols = syms;
        reel.pendingInsertAt = insertAt;
        landIdx = insertAt;
      } else {
        // ── random mode: pick a random landing index ──────────────────────
        landIdx = Math.floor(Math.random() * len);
      }

      // Convert landIdx → displayPos → targetPosition
      // reversePos = landIdx * SYMBOL_SIZE  →  displayPos = (stripH - reversePos) % stripH
      const displayPos = (stripH - landIdx * SYMBOL_SIZE) % stripH;
      const rawTarget = reel.position + minTravel;
      reel.targetPosition = Math.ceil(rawTarget / stripH) * stripH + displayPos;
      reel.stopTime = now + SPIN_DURATION_BASE + reelIdx * SPIN_DURATION_STEP;
      reel.spinning = true;
    });

    pendingOutcomeRef.current = outcome;
  }

  //  const middleRow = result[1] ?? []
  //  const isWin = middleRow.length === REELS && middleRow.every((s) => s === middleRow[0])

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        background: "#16213e",
      }}
    >
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 20,
        transform: `scale(${scale})`,
        transformOrigin: "center center",
      }}
    >
      <div
        ref={pixiContainerRef}
        style={{
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 0 40px rgba(0,200,255,0.3)",
        }}
      />
      
      <button
        onClick={spin}
        disabled={spinning}
        style={{
          padding: "14px 60px",
          fontSize: 20,
          fontWeight: "bold",
          letterSpacing: 3,
          border: "none",
          borderRadius: 50,
          cursor: spinning ? "not-allowed" : "pointer",
          background: spinning
            ? "linear-gradient(135deg, #555, #333)"
            : "linear-gradient(135deg, #ffd700, #ff8c00)",
          color: spinning ? "#888" : "#1a1a2e",
          boxShadow: spinning ? "none" : "0 4px 20px rgba(255, 140, 0, 0.5)",
          transition: "all 0.2s",
          textTransform: "uppercase",
        }}
      >
        {spinning ? "Spinning…" : "SPIN"}
      </button>
      <div
        style={{
          display: "contents",
          alignItems: "center",
          gap: 20,
        }}
      >
        <div
          style={{
            fontSize: 28,
            fontWeight: "bold",
            color: "#ffd700",
            textShadow: "0 0 20px #ffd700",
            letterSpacing: 4,
          }}
        >
          {"BET: "} ${DEFAULT_BET.toFixed(2) || "$1.00"}
          {"   ||   WIN:"}${winAmount.toFixed(2) || "$0.00"}
          {/* {winLabel ?? "★ BIG WIN! ★"} ${winAmount.toFixed(2)} */}
        </div>

        <div
          style={{
            fontSize: 28,
            fontWeight: "bold",
            color: "#ffd700",
            textShadow: "0 0 20px #ffd700",
            letterSpacing: 4,
          }}
        >
          {"BALANCE: "} ${balance.toFixed(2) || "$100000.00"}
        </div>
      </div>
    </div>
    </div>
  );
}
