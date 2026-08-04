# Game Rules and Validation Logic

This document details the official Rummikub rules implemented in the engine, validation algorithms, tile deck specifications, and joker handling rules.

---

## 1. Deck Composition

A standard game uses **106 tiles**:
- **104 Numbered Tiles**:
  - 4 Colors: `black`, `blue`, `red`, `orange`
  - Numbers: `1` through `13`
  - 2 identical sets of each number per color (e.g., two Red 7s).
- **2 Joker Tiles**:
  - `j-1` and `j-2` with `isJoker = true`.
  - Can substitute for any tile color and number in a run or group.

Each player is dealt **14 tiles** at the start of the game.

---

## 2. Valid Sets Definition

Every set on the board must contain **at least 3 tiles**. Sets are classified into two types:

### Groups (Same Number, Different Colors)
- Must consist of 3 or 4 tiles of the **same number**.
- All tiles in a group must have **different colors**.
- Maximum of 4 tiles per group (one of each color: `black`, `blue`, `red`, `orange`).
- Duplicate colors in a group are **invalid** (e.g., Red 8, Blue 8, Red 8 is invalid).

### Runs (Same Color, Consecutive Numbers)
- Must consist of 3 or more tiles of the **same color**.
- Tile numbers must be strictly **consecutive** (e.g., Blue 4-5-6-7).
- Cannot wrap around (e.g., 12-13-1 is invalid).
- Cannot extend below `1` or above `13`.

---

## 3. Joker Substitution Logic

Jokers can act as wildcards within groups or runs:

1. **Jokers in Groups**:
   - Count towards the 3 or 4 tile limit.
   - Match the number of the real tiles in the group.
2. **Jokers in Runs**:
   - Dynamically assume the number required to maintain consecutive sequence.
   - Example: Red 5, Joker, Red 7 -> Joker assumes value of Red 6.
   - Boundary checks enforce that jokers positioned at the beginning or end of a run do not push the sequence below `1` or above `13`.

---

## 4. Board Validation Algorithm (`GameState.validateSet`)

When a player attempts to end their turn, `GameState.isBoardValid(board)` iterates over every set:

```
1. If set.length < 3 -> FAIL ("Sets must have at least 3 tiles")
2. Extract real non-joker tiles.
3. Check if all real tiles share the same number:
   a. If YES -> Evaluate as GROUP:
      - If set.length > 4 -> FAIL ("Group cannot exceed 4 tiles")
      - If duplicate colors exist among real tiles -> FAIL
      - Else -> VALID
   b. If NO -> Evaluate as RUN:
      - If real tiles do not all share the same color -> FAIL
      - Check consecutive sequence logic considering joker gap fills
      - Calculate implied start number (firstRealNumber - firstRealIndex)
      - If impliedStart < 1 or impliedEnd > 13 -> FAIL ("Run goes out of bounds")
      - Verify tile numbers match expected sequence positions
      - Else -> VALID
```

---

## 5. Winning Condition & Ending Turns

- **Winning**: A player wins when their rack reaches **0 tiles** after committing a valid board state.
- **No Moves / Drawing**: If a player cannot or chooses not to make a valid move during their turn, they must draw a tile. The turn then advances to the next player.
