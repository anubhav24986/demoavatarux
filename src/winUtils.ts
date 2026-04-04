import * as PIXI from "pixi.js";
import { ROWS, REELS, SYMBOLS, BONUS_SYM_ID } from "./constants";
import type { ReelState } from "./reelTicker";

/** [reelIndex, rowIndex] — reelIndex 0-4 (L→R), rowIndex 0=top/1=mid/2=bot */
export type WinCoord = [reelIndex: number, rowIndex: number];

/**
 * Scan each row left→right for 3+ consecutive identical symbols.
 * Returns every winning cell as a WinCoord.
 */
export function detectWins(reelStates: ReelState[]): WinCoord[] {
  const coords: WinCoord[] = [];

  let displayGrid: number[][] = [];
  let reelWiseSymbols: number[] = [];
  for (let reel = 0; reel < REELS; reel++) {
    reelWiseSymbols = [];
    for (let row = 0; row < ROWS; row++) {
      reelWiseSymbols.push(reelStates[reel].tiles[row].symId);
    }
    displayGrid.push(reelWiseSymbols);
  }

  const result: {
    symbolId: number;
    positions: [number, number][];
  }[] = findWaysWins(displayGrid);

  result.map((obj) => obj.positions.map((pos) => coords.push(pos)));
  const uniqueCoords = Array.from(
    new Set(coords.map((item) => JSON.stringify(item))),
  ).map((item) => JSON.parse(item));

  return uniqueCoords;
}

function findElement(matrix: number[][], target: number) {
  const coordinates: any = [];

  for (let r = 0; r < matrix.length; r++) {
    // Rows (0 to 4)
    for (let c = 0; c < matrix[r].length; c++) {
      // Columns (0 to 2)
      if (
        matrix[r][c] === target &&
        matrix[r][c] === BONUS_SYM_ID &&
        coordinates.length > 0
      ) {
        if (coordinates[0][0] !== r) {
          coordinates.push([r, c]);
        }
      } else {
        if (matrix[r][c] === target) {
          coordinates.push([r, c]);
        }
      }
    }
  }

  return coordinates;
}
// function transpose(arr: number[][]): number[][] {
//   return arr[0].map((_, colIndex) => arr.map((row) => row[colIndex]));
// }

function findWaysWins(grid: number[][]) {
  // grid = [
  //   [1, 6, 2, 3, 1],
  //   [4, 11, 4, 11, 6],
  //   [9, 10, 11, 6, 18],
  // ];
  let calculatePositionGrid: number[][] = grid;
  // let winningPatternGrid: number[][] = transpose(grid);

  let initialColumnSymbolPatternList = [];
  for (let _row = 0; _row < calculatePositionGrid.length; _row++) {
    for (let _col = 0; _col < calculatePositionGrid[_row].length; _col++) {
      let initialColumnSymbolPattern: any = { symbolId: 0, positions: [] };
      if (BONUS_SYM_ID === calculatePositionGrid[_row][_col]) {
        initialColumnSymbolPattern.symbolId = BONUS_SYM_ID;
        initialColumnSymbolPattern.positions = findElement(
          calculatePositionGrid,
          calculatePositionGrid[_row][_col],
        );
        const bonusExists = initialColumnSymbolPatternList.filter(
          (item) => item.symbolId === BONUS_SYM_ID,
        );

        if (bonusExists.length === 0) {
          initialColumnSymbolPatternList.push(initialColumnSymbolPattern);
        }
      } else if (_row == 0) {
        initialColumnSymbolPattern.symbolId = calculatePositionGrid[_row][_col];
        initialColumnSymbolPattern.positions = findElement(
          calculatePositionGrid,
          calculatePositionGrid[_row][_col],
        );

        let sequesnceCounter = 0;
        calculatePositionGrid.map((row, i) => {
          if (row.indexOf(initialColumnSymbolPattern.symbolId) !== -1) {
            sequesnceCounter++;
          } 
          if (
            (calculatePositionGrid[i].indexOf(
              initialColumnSymbolPattern.symbolId,
            ) === -1 &&
              i !== calculatePositionGrid.length - 1 &&
              i < 3) ||
            (sequesnceCounter == 1 &&
              calculatePositionGrid[i].indexOf(
                initialColumnSymbolPattern.symbolId,
              ) > -1 &&
              i === calculatePositionGrid.length - 1)
          ) {
            sequesnceCounter = 0;
          }
        });

        const hasGapOfOne =
          sequesnceCounter >= 3 &&
          initialColumnSymbolPattern.positions.every(
            (item: [number, number], index: number) => {
              // Skip the first item because there's nothing before it to compare

              if (index === 0) {
                return true;
              }

              // Compare current first element with the previous one
              const currentFirst = item[0];
              const previousFirst =
                initialColumnSymbolPattern.positions[index - 1][0];

              if (index >= 3) {
                if (
                  initialColumnSymbolPattern.positions[index - 1] &&
                  item[0] - initialColumnSymbolPattern.positions[index - 1][0] >
                    1
                ) {
                  initialColumnSymbolPattern.positions.splice(index, 1);
                }
                return true;
              }
              return (
                currentFirst - previousFirst <= 1 &&
                initialColumnSymbolPattern.positions[0][0] == 0
              );
            },
          );
        if (hasGapOfOne) {
          initialColumnSymbolPatternList.push(initialColumnSymbolPattern);
        }
      }
    }
  }
  let calculateWins: {
    symbolId: number;
    positions: WinCoord[];
  }[] = [];
  calculateWins = initialColumnSymbolPatternList.filter(
    (item) => item.positions.length >= 3,
  );

 
  return calculateWins;
}

export interface ColumnMatchResult {
  value: number;
  /** Columns matched beyond the first (max = grid.length - 1) */
  count: number;
}
export function countConsecutiveColumnMatches(
  grid: number[][],
): ColumnMatchResult[] {
  if (grid.length === 0 || grid[0].length === 0) return [];

  const firstCol = grid[0];
  const results: ColumnMatchResult[] = [];

  for (const value of firstCol) {
    let count = 0;

    for (let col = 1; col < grid.length; col++) {
      if (grid[col].includes(value)) {
        count++;
      } else {
        break; // consecutive chain broken — stop checking further columns
      }
    }

    results.push({ value, count });
  }

  return results;
}

/** Sum symbol values across all winning cells; also returns the winning symbol id */
export function calculateWinAmountAndSymbolId(
  reelStates: ReelState[],
  coords: WinCoord[],
): [amount: number, symbolId: number | null] {
  let winAmount = 0;
  let winningSymbolId: number | null = null;
  for (const [ri, row] of coords) {
    const tile = reelStates[ri]?.tiles[row];
    if (!tile) continue;
    winAmount += SYMBOLS[tile.symId]?.value ?? 0;
    winningSymbolId = tile.symId;
  }
  return [winAmount, winningSymbolId];
}

/** Swap winning-cell sprites to their _connect variant */
export function applyWinHighlight(
  reelStates: ReelState[],
  coords: WinCoord[],
  textures: Record<string, PIXI.Texture>,
  connectTextures: Record<string, PIXI.Texture>,
): void {
  for (const [ri, row] of coords) {
    const tile = reelStates[ri]?.tiles[row];
    if (!tile) continue;
    const name = SYMBOLS[tile.symId]?.name;
    if (!name) continue;
    (tile.children[0] as PIXI.Sprite).texture =
      connectTextures[name] ?? textures[name] ?? PIXI.Texture.EMPTY;
  }
}

/** Restore all visible tile sprites to their normal (non-connect) textures */
export function clearWinHighlight(
  reelStates: ReelState[],
  textures: Record<string, PIXI.Texture>,
): void {
  for (const reel of reelStates) {
    for (let row = 0; row < ROWS; row++) {
      const tile = reel.tiles[row];
      if (!tile) continue;
      const name = SYMBOLS[tile.symId]?.name;
      if (!name) continue;
      (tile.children[0] as PIXI.Sprite).texture =
        textures[name] ?? PIXI.Texture.EMPTY;
    }
  }
}
