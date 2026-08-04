# Socket.io Protocol Reference

This document documents all client-to-server (`socket.emit`) and server-to-client (`socket.on` / `io.to`) messages used in the Rummi application.

---

## 1. Client-to-Server Events

### Room Lifecycle

#### `createRoom`
Creates a new game room.
- **Payload**: `{ name: string, avatar: string, persistentId: string }`
- **Ack Callback**: `({ success: boolean, roomCode: string }) => void`

#### `joinRoom`
Joins an existing room or reconnects to an active room.
- **Payload**: `{ roomCode: string, name: string, avatar: string, persistentId: string }`
- **Ack Callback**: `({ success: boolean, message?: string, reconnected?: boolean }) => void`

#### `updateConfig`
Updates room configuration (Host only, prior to game start).
- **Payload**: `{ roomCode: string, config: { turnTimeout: number } }`

#### `startGame`
Starts the game, generates decks, deals 14 tiles to each player, creates initial turn snapshot, and starts turn timer (Host only).
- **Payload**: `{ roomCode: string }`

---

### In-Game Turn Actions

#### `updateBoardLocal`
Broadcasts transient board updates to other players during a turn without ending the turn.
- **Payload**: `{ roomCode: string, board: Array<Array<Tile>>, rack: Array<Tile> }`
- **Broadcast**: Triggers `boardSync` to all other sockets in the room.

#### `updateRack`
Updates player's local rack sorting order on the server.
- **Payload**: `{ roomCode: string, rack: Array<Tile> }`

#### `revertTurn`
Reverts board and active player's rack back to the state saved at turn start.
- **Payload**: `{ roomCode: string }`

#### `endTurn`
Validates board state. If valid and unchanged, draws a tile. If valid and changed, commits board, checks win condition, advances turn.
- **Payload**: `{ roomCode: string }`
- **Ack Callback**: `({ success: boolean, message?: string }) => void`

#### `drawTile`
Reverts any uncommitted moves made during current turn, draws a tile from deck, and advances turn.
- **Payload**: `{ roomCode: string }`

---

### Social & Interaction

#### `reaction`
Broadcasts an animated emoji reaction to all room members.
- **Payload**: `{ roomCode: string, emoji: string }`

---

## 2. Server-to-Client Events

#### `roomUpdate`
Emitted to all room members whenever player list, room state, or turn changes.
- **Payload**:
  ```json
  {
    "players": [
      { "id": "socketId", "name": "Alice", "avatar": "🦊", "offline": false }
    ],
    "host": "socketId",
    "gameState": {
      "playerIds": ["socketId1", "socketId2"],
      "currentTurnIndex": 0,
      "board": [ ... ],
      "racks": { "socketId1": [ ... ] },
      "turnTimeout": 30,
      "turnStartTime": 1720000000000,
      "winner": null
    },
    "config": { "turnTimeout": 30 }
  }
  ```

#### `boardSync`
Real-time board state synchronization sent to non-active players while current player is moving tiles.
- **Payload**:
  ```json
  {
    "board": [ ... ],
    "turnOf": "activeSocketId"
  }
  ```

#### `reaction`
Emitted to all clients in room when a reaction is sent.
- **Payload**:
  ```json
  {
    "playerId": "socketId",
    "playerName": "Alice",
    "playerAvatar": "🦊",
    "emoji": "🔥"
  }
  ```
