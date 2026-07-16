const COLORS = ['black', 'blue', 'red', 'orange'];
const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

class Tile {
  constructor(id, color, number, isJoker = false) {
    this.id = id;
    this.color = color;
    this.number = number;
    this.isJoker = isJoker;
  }
}

class GameState {
  constructor(playerIds) {
    this.playerIds = playerIds; // array of socket ids
    this.deck = this.generateDeck();
    this.racks = {}; // { playerId: [Tile] }
    this.board = []; // Array of sets, where each set is an Array of Tiles
    
    // Initialize racks
    for (let id of playerIds) {
      this.racks[id] = [];
      for (let i = 0; i < 14; i++) {
        this.racks[id].push(this.drawTile());
      }
    }
    
    this.currentTurnIndex = 0;
    this.snapshot = null;
    this.winner = null;
    // Track if a player has made their initial 30 point meld
    this.initialMeldCompleted = {};
    for (let id of playerIds) {
      this.initialMeldCompleted[id] = false;
    }
  }

  generateDeck() {
    let deck = [];
    let idCounter = 1;
    // 2 sets of tiles
    for (let set = 0; set < 2; set++) {
      for (let color of COLORS) {
        for (let number of NUMBERS) {
          deck.push(new Tile(`t-${idCounter++}`, color, number));
        }
      }
    }
    // 2 Jokers
    deck.push(new Tile(`j-1`, null, null, true));
    deck.push(new Tile(`j-2`, null, null, true));
    
    // Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  drawTile() {
    if (this.deck.length === 0) return null;
    return this.deck.pop();
  }

  getCurrentPlayerId() {
    return this.playerIds[this.currentTurnIndex];
  }

  nextTurn() {
    this.currentTurnIndex = (this.currentTurnIndex + 1) % this.playerIds.length;
    this.snapshot = null;
  }

  createSnapshot() {
    // Deep clone the board and current player's rack
    this.snapshot = {
      board: JSON.parse(JSON.stringify(this.board)),
      rack: JSON.parse(JSON.stringify(this.racks[this.getCurrentPlayerId()]))
    };
  }

  revertToSnapshot() {
    if (this.snapshot) {
      this.board = JSON.parse(JSON.stringify(this.snapshot.board));
      this.racks[this.getCurrentPlayerId()] = JSON.parse(JSON.stringify(this.snapshot.rack));
      // Do not clear the snapshot, allowing multiple reverts in a turn
    }
  }

  // Validate if a single set is a valid run or group
  static validateSet(set) {
    if (!set || set.length < 3) return { valid: false, error: 'Sets must have at least 3 tiles.' };

    const realTiles = set.filter(t => !t.isJoker);
    if (realTiles.length === 0) return { valid: true }; 
    
    const isGroup = realTiles.every(t => t.number === realTiles[0].number);
    if (isGroup) {
      if (set.length > 4) return { valid: false, error: 'A group can have a maximum of 4 tiles.' };
      const colors = new Set();
      for (let tile of realTiles) {
        if (colors.has(tile.color)) return { valid: false, error: `Duplicate color (${tile.color}) in a group of ${tile.number}s.` };
        colors.add(tile.color);
      }
      return { valid: true };
    }

    const isRunColor = realTiles.every(t => t.color === realTiles[0].color);
    if (!isRunColor) return { valid: false, error: 'Tiles in a run must be the same color, or tiles in a group must be the same number.' };

    let currentNumber = -1;
    for (let i = 0; i < set.length; i++) {
      let tile = set[i];
      if (tile.isJoker) {
        if (currentNumber !== -1) currentNumber++;
      } else {
        if (currentNumber !== -1 && tile.number !== currentNumber + 1) {
          return { valid: false, error: `Invalid sequence in run: ${currentNumber} followed by ${tile.number}.` };
        }
        currentNumber = tile.number;
      }
    }
    
    let firstRealIdx = set.findIndex(t => !t.isJoker);
    if (firstRealIdx === -1) return { valid: true };
    
    let expectedStart = set[firstRealIdx].number - firstRealIdx;
    if (expectedStart < 1 || expectedStart + set.length - 1 > 13) return { valid: false, error: 'Run goes out of bounds (below 1 or above 13).' };

    for (let i = 0; i < set.length; i++) {
      if (!set[i].isJoker && set[i].number !== expectedStart + i) return { valid: false, error: 'Invalid run sequence.' };
    }
    
    return { valid: true };
  }

  // Validates the entire board
  static isBoardValid(board) {
    for (let set of board) {
      const result = this.validateSet(set);
      if (!result.valid) return result;
    }
    return { valid: true };
  }
}

module.exports = { GameState, Tile };
