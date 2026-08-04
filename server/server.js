const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const { GameState } = require('./game/RummikubLogic');

const app = express();
app.use(cors());

// Serve built React client in production
if (process.env.NODE_ENV === 'production') {
  const publicDir = path.join(__dirname, 'public');
  app.use(express.static(publicDir));
  app.get('*', (_, res) => res.sendFile(path.join(publicDir, 'index.html')));
}

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// In-memory state
const rooms = {};

const generateRoomCode = () => {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
};

// Turn timeout management
const turnTimers = {}; // { roomCode: timeoutId }

const clearTurnTimer = (roomCode) => {
  if (turnTimers[roomCode]) {
    clearTimeout(turnTimers[roomCode]);
    delete turnTimers[roomCode];
  }
};

const startTurnTimer = (roomCode) => {
  clearTurnTimer(roomCode);
  const room = rooms[roomCode];
  if (!room || !room.gameState || !room.gameState.turnTimeout) return;

  const timeout = room.gameState.turnTimeout * 1000;
  room.gameState.startTurnTimer();

  turnTimers[roomCode] = setTimeout(() => {
    const gs = room.gameState;
    if (!gs) return;
    // Auto-revert and draw
    gs.revertToSnapshot();
    const tile = gs.drawTile();
    if (tile) {
      gs.racks[gs.getCurrentPlayerId()].push(tile);
    }
    gs.nextTurn();
    gs.createSnapshot();
    startTurnTimer(roomCode);
    broadcastRoom(roomCode);
  }, timeout);
};

const broadcastRoom = (roomCode) => {
  const room = rooms[roomCode];
  if (room) {
    io.to(roomCode).emit('roomUpdate', {
      players: Object.values(room.players),
      host: room.host,
      gameState: room.gameState,
      config: room.config
    });
  }
};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('createRoom', (data, callback) => {
    const { name, avatar } = data;
    const roomCode = generateRoomCode();

    rooms[roomCode] = {
      host: socket.id,
      players: {
        [socket.id]: { id: socket.id, name, avatar, persistentId: data.persistentId || socket.id }
      },
      gameState: null,
      config: { turnTimeout: 0 },
      // Track persistent IDs for reconnection
      persistentMap: {} // { persistentId: socketId }
    };
    if (data.persistentId) {
      rooms[roomCode].persistentMap[data.persistentId] = socket.id;
    }

    socket.join(roomCode);
    console.log(`Room created: ${roomCode} by ${socket.id}`);

    callback({ success: true, roomCode });
    broadcastRoom(roomCode);
  });

  socket.on('updateConfig', ({ roomCode, config }) => {
    const room = rooms[roomCode];
    if (room && room.host === socket.id && !room.gameState) {
      room.config = { ...room.config, ...config };
      broadcastRoom(roomCode);
    }
  });

  socket.on('joinRoom', (data, callback) => {
    const { roomCode, name, avatar, persistentId } = data;

    if (!rooms[roomCode]) {
      callback({ success: false, message: 'Room not found' });
      return;
    }

    const room = rooms[roomCode];

    // Check if this is a reconnection
    if (persistentId && room.persistentMap[persistentId]) {
      const oldSocketId = room.persistentMap[persistentId];

      // If there's game state, migrate the old socket ID to the new one
      if (room.gameState) {
        const gs = room.gameState;

        // Migrate rack
        if (gs.racks[oldSocketId]) {
          gs.racks[socket.id] = gs.racks[oldSocketId];
          delete gs.racks[oldSocketId];
        }

        // Migrate playerIds array
        const pidx = gs.playerIds.indexOf(oldSocketId);
        if (pidx !== -1) {
          gs.playerIds[pidx] = socket.id;
        }

        // Migrate initialMeldCompleted
        if (gs.initialMeldCompleted[oldSocketId] !== undefined) {
          gs.initialMeldCompleted[socket.id] = gs.initialMeldCompleted[oldSocketId];
          delete gs.initialMeldCompleted[oldSocketId];
        }

        // Migrate snapshot rack if it belongs to the reconnecting player
        if (gs.snapshot && gs.snapshot.rackPlayerId === oldSocketId) {
          gs.snapshot.rackPlayerId = socket.id;
        }

        // Migrate winner
        if (gs.winner === oldSocketId) {
          gs.winner = socket.id;
        }
      }

      // Remove old player entry
      delete room.players[oldSocketId];
      if (room.host === oldSocketId) {
        room.host = socket.id;
      }

      // Update persistent map
      room.persistentMap[persistentId] = socket.id;
    } else if (persistentId) {
      room.persistentMap[persistentId] = socket.id;
    }

    room.players[socket.id] = { id: socket.id, name, avatar, persistentId: persistentId || socket.id };
    socket.join(roomCode);
    console.log(`User ${socket.id} joined room: ${roomCode}`);

    callback({ success: true, reconnected: !!(persistentId && room.gameState) });
    broadcastRoom(roomCode);
  });

  socket.on('startGame', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (room && room.host === socket.id) {
      room.gameState = new GameState(Object.keys(room.players), { turnTimeout: room.config.turnTimeout });
      room.gameState.createSnapshot();
      broadcastRoom(roomCode);
      startTurnTimer(roomCode);
    }
  });

  socket.on('updateBoardLocal', ({ roomCode, board, rack }) => {
    const room = rooms[roomCode];
    if (room && room.gameState && room.gameState.getCurrentPlayerId() === socket.id) {
      room.gameState.board = board;
      room.gameState.racks[socket.id] = rack;
      socket.to(roomCode).emit('boardSync', { board, turnOf: socket.id });
    }
  });

  socket.on('updateRack', ({ roomCode, rack }) => {
    const room = rooms[roomCode];
    if (room && room.gameState && room.gameState.racks[socket.id]) {
      room.gameState.racks[socket.id] = rack;
    }
  });

  socket.on('revertTurn', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (room && room.gameState && room.gameState.getCurrentPlayerId() === socket.id) {
      room.gameState.revertToSnapshot();
      broadcastRoom(roomCode);
    }
  });

  socket.on('endTurn', ({ roomCode }, callback) => {
    const room = rooms[roomCode];
    if (room && room.gameState && room.gameState.getCurrentPlayerId() === socket.id) {
      const gs = room.gameState;
      const validation = GameState.isBoardValid(gs.board);
      if (validation.valid) {
        const boardUnchanged = JSON.stringify(gs.board) === JSON.stringify(gs.snapshot.board);
        const rackUnchanged = JSON.stringify(gs.racks[socket.id]) === JSON.stringify(gs.snapshot.rack);
        if (boardUnchanged && rackUnchanged) {
          const newTile = gs.drawTile();
          if (newTile) {
            gs.racks[socket.id].push(newTile);
          }
        }

        if (gs.racks[socket.id].length === 0) {
          gs.winner = socket.id;
          clearTurnTimer(roomCode);
        } else {
          gs.nextTurn();
          gs.createSnapshot();
          startTurnTimer(roomCode);
        }
        broadcastRoom(roomCode);
        if (callback) callback({ success: true });
      } else {
        if (callback) callback({ success: false, message: 'Invalid board: ' + validation.error });
      }
    }
  });

  socket.on('drawTile', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (room && room.gameState && room.gameState.getCurrentPlayerId() === socket.id) {
      room.gameState.revertToSnapshot();
      const tile = room.gameState.drawTile();
      if (tile) {
        room.gameState.racks[socket.id].push(tile);
      }
      room.gameState.nextTurn();
      room.gameState.createSnapshot();
      startTurnTimer(roomCode);
      broadcastRoom(roomCode);
    }
  });

  // Emoji reactions
  socket.on('reaction', ({ roomCode, emoji }) => {
    const room = rooms[roomCode];
    if (room && room.players[socket.id]) {
      const player = room.players[socket.id];
      io.to(roomCode).emit('reaction', {
        playerId: socket.id,
        playerName: player.name,
        playerAvatar: player.avatar,
        emoji
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    for (const roomCode in rooms) {
      if (rooms[roomCode].players[socket.id]) {
        const room = rooms[roomCode];
        const player = room.players[socket.id];

        // If game is in progress, keep the player data but mark offline
        if (room.gameState) {
          player.offline = true;
          // Don't delete — they can reconnect
          broadcastRoom(roomCode);
        } else {
          // No game yet, remove normally
          delete room.players[socket.id];

          if (Object.keys(room.players).length === 0) {
            clearTurnTimer(roomCode);
            delete rooms[roomCode];
            console.log(`Room ${roomCode} deleted (empty)`);
          } else {
            if (room.host === socket.id) {
              room.host = Object.keys(room.players)[0];
            }
            broadcastRoom(roomCode);
          }
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
