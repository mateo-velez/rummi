// Utility functions for Rummikub tile & board operations

/**
 * Deep clone board array of sets (Rule #1: State Immutability & Deep Cloning)
 */
export const cloneBoard = (board) => (board ? board.map(set => [...set]) : []);

/**
 * Automatically sort a set (group vs run with jokers)
 */
export const autoSortSet = (set) => {
  if (!set || set.length <= 1) return set;
  const realTiles = set.filter(t => !t.isJoker);
  const jokers = set.filter(t => t.isJoker);
  
  if (realTiles.length <= 1) {
    return [...realTiles, ...jokers];
  }
  
  const isGroup = realTiles.every(t => t.number === realTiles[0].number);
  if (isGroup) {
    realTiles.sort((a, b) => (a.color || '').localeCompare(b.color || ''));
    return [...realTiles, ...jokers];
  } else {
    // Edge case: Jokers in runs depend on manual placement, so we preserve the original order if a joker is present.
    if (set.some(t => t.isJoker)) return [...set];

    realTiles.sort((a, b) => a.number - b.number);
    const sortedRun = [];
    let expectedNumber = realTiles[0].number;
    
    for (let tile of realTiles) {
      while (expectedNumber < tile.number && jokers.length > 0) {
        sortedRun.push(jokers.shift());
        expectedNumber++;
      }
      sortedRun.push(tile);
      expectedNumber = tile.number + 1;
    }
    sortedRun.push(...jokers);
    return sortedRun;
  }
};

/**
 * Remove empty sets in-place from board array
 */
export const removeEmptySets = (board) => {
  for (let i = board.length - 1; i >= 0; i--) {
    if (board[i].length === 0) board.splice(i, 1);
  }
};

/**
 * Sort rack tiles by 'number' or 'color'
 */
export const sortRackTiles = (rack, type) => {
  if (!rack) return [];
  const sorted = [...rack];
  if (type === 'number') {
    sorted.sort((a, b) => {
      if (a.isJoker) return 1;
      if (b.isJoker) return -1;
      if (a.number === b.number) return a.color.localeCompare(b.color);
      return a.number - b.number;
    });
  } else if (type === 'color') {
    sorted.sort((a, b) => {
      if (a.isJoker) return 1;
      if (b.isJoker) return -1;
      if (a.color === b.color) return a.number - b.number;
      return a.color.localeCompare(b.color);
    });
  }
  return sorted;
};
