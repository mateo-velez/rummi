# Architecture Overview

This document describes the high-level system architecture, client-server communication topology, session lifecycle, and state synchronization mechanics of the **Rummi** application.

---

## 1. System Topology

```
                  ┌─────────────────────────────────────────┐
                  │              Vite / React               │
                  │             (Single Page App)            │
                  └────────────────────┬────────────────────┘
                                       │
                               Socket.io (WebSocket)
                                       │
                  ┌────────────────────▼────────────────────┐
                  │             Node.js Express             │
                  │             Socket.io Server            │
                  ├─────────────────────────────────────────┤
                  │ GameState Manager (RummikubLogic.js)     │
                  │ Room State Store (In-Memory)             │
                  │ Turn Timer Controller                    │
                  └─────────────────────────────────────────┘
```

---

## 2. In-Memory Data Models

The backend manages rooms in an in-memory dictionary `rooms`:

```javascript
rooms = {
  "ROOM_CODE": {
    host: "socketId",
    players: {
      "socketId": {
        id: "socketId",
        name: "PlayerName",
        avatar: "🦊",
        persistentId: "p-abc123xyz",
        offline: false
      }
    },
    gameState: GameStateInstance,
    config: {
      turnTimeout: 30 // turn duration in seconds (0 = disabled)
    },
    persistentMap: {
      "p-abc123xyz": "socketId"
    }
  }
}
```

### GameState Model (`server/game/RummikubLogic.js`)

- `playerIds`: Array of active player socket IDs determining turn order.
- `deck`: Stack of remaining shuffled `Tile` objects.
- `racks`: Dictionary mapping `playerId => Array<Tile>`.
- `board`: Array of sets, where each set is `Array<Tile>`.
- `snapshot`: Saved turn start state `{ board, rack }` for the current active player.
- `turnTimeout` & `turnStartTime`: Used for server-enforced turn timeout calculations.

---

## 3. Session Reconnection Flow

To prevent accidental room abandonment when a player closes their tab or loses network connectivity:

1. **Client Identity**: Upon first load, the client generates a unique `persistentId` stored in `localStorage` under `rummi-pid`.
2. **Room Registration**: When joining or creating a room, `persistentId` is sent alongside player metadata.
3. **Disconnection Handling**:
   - If a game is in progress, the socket disconnect handler marks `player.offline = true` instead of removing the player.
   - The player's rack and turn position remain intact in `gameState`.
4. **Reconnection**:
   - When the user reconnects, `joinRoom` looks up `persistentId` in `room.persistentMap`.
   - If found, `server.js` migrates all references to the old socket ID (`gs.racks`, `gs.playerIds`, `gs.initialMeldCompleted`, `gs.snapshot.rackPlayerId`, `gs.winner`, `room.host`) to the new socket ID.
   - The updated room state is broadcasted back to the reconnected client.

---

## 4. Real-Time Synchronization Patterns

- **Full Broadcast (`roomUpdate`)**: Emitted whenever room configurations change, a player joins/leaves, game starts, or turn ends.
- **Local Turn Broadcast (`boardSync`)**: Sent only to opponents during an active turn (`socket.to(roomCode).emit('boardSync', ...)`) to display real-time moves without committing backend snapshots.
- **Turn Timers**: Controlled on the server using `setTimeout`. When a timer triggers, the server auto-reverts the player's turn, auto-draws a tile, advances the turn, and emits `roomUpdate`.
