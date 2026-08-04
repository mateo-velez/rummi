# AGENTS.md

Instructions and guidelines for AI coding agents working on the **Rummi** codebase.

---

## Core Technical Rules

### 1. State Immutability & Deep Cloning
- **NEVER mutate `gameState.board` or `gameState.racks` directly.**
- Always use deep cloning for sets and racks:
  ```javascript
  const cloneBoard = (board) => board.map(set => [...set]);
  ```
- When moving tiles, ensure nested arrays (individual sets) are cloned independently before performing array splices or updates.

### 2. Event Bubbling & Stop Propagation
- When handling tile or set clicks, **ALWAYS** call `e.stopPropagation()`.
- Missing `e.stopPropagation()` on tile clicks causes parent set or board click handlers to trigger simultaneously, leading to tile duplication bugs or unwanted set creations.

### 3. Separation of Local vs Server Board State
- **Local Move State (`updateBoardLocal`)**: Broadcasts transient board modifications during a turn to opponents via `socket.to(roomCode).emit('boardSync', ...)` without saving them permanently as turn end states.
- **Definitive Turn Commit (`endTurn`)**: Server validates board with `GameState.isBoardValid()`. Only on valid board states does turn advance, creating a new snapshot.

### 4. Rack Auto-Sorting & Sort Preference
- User rack sorting preference (`rackSortType`: `'number'` | `'color'`) must be preserved across server state broadcasts.
- When `myRack` updates from server broadasts, re-apply `rackSortType` in a `useEffect` without causing infinite state render loops (compare JSON stringified tile IDs before emitting updates).
- Manual drag-and-drop within the rack sets `rackSortType` to `null` to respect the user's custom manual ordering.

### 5. Swapping Restrictions
- **Rack ↔ Board tile swapping is strictly disabled.**
- Single tile clicks between rack and board must add tiles to sets, not swap places between rack and board.
- Single tile swaps are only permitted **within the rack itself** or **within sets on the board**.

### 6. Session & Reconnection Architecture
- Player identity is bound to `persistentId` generated in `localStorage` (`rummi-pid`).
- When a user reconnects to an active room:
  - Server maps new socket ID to old `persistentId`.
  - Server migrates `gs.racks[oldSocketId]` to `gs.racks[newSocketId]`, updates `playerIds`, and updates `initialMeldCompleted`.
  - Disconnected players during an active game are marked `offline: true` rather than purged from the room state.

---

## Important Files Reference

- [`server/game/RummikubLogic.js`](file:///home/mateo/Workspace/rummi/server/game/RummikubLogic.js): Deck generator, board validation (`validateSet`, `isBoardValid`), game state snapshot creation and revert logic.
- [`server/server.js`](file:///home/mateo/Workspace/rummi/server/server.js): Socket event handling, turn timer management, room state broadcasting, player reconnection migration.
- [`client/src/pages/Room.jsx`](file:///home/mateo/Workspace/rummi/client/src/pages/Room.jsx): Main game page component containing tile selection state, click/drag handlers, set insertion/splitting, and layout.
- [`client/src/pages/Home.jsx`](file:///home/mateo/Workspace/rummi/client/src/pages/Home.jsx): Room creation, joining, persistent identity management, avatar selection.

---

## Key Testing Verification Steps

When adding new features or fixing bugs:
1. Test tile move interactions (click-to-select, click set to move, click empty space to create set).
2. Verify board validation logic with jokers and boundary values (runs cannot extend below 1 or above 13).
3. Verify `endTurn`, `undo`, `revertTurn`, and `drawTile` flows.
4. Verify turn timer expiration triggers auto-revert and auto-draw.
5. Verify browser refresh / reconnect restores hand and room state.
