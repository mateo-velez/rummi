const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { GameState } = require('./game/RummikubLogic');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // For local development
    methods: ['GET', 'POST']
  }
});

// In-memory state
// rooms = { roomCode: { host: socketId, players: { socketId: { name, avatar } }, gameState: GameState } }
const rooms = {};

const generateRoomCode = () => {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  const broadcastRoom = (roomCode) => {
    const room = rooms[roomCode];
    if (room) {
      io.to(roomCode).emit('roomUpdate', { 
        players: Object.values(room.players), 
        host: room.host,
        gameState: room.gameState 
      });
    }
  };

  socket.on('createRoom', (data, callback) => {
    const { name, avatar } = data;
    const roomCode = generateRoomCode();
    
    rooms[roomCode] = {
      host: socket.id,
      players: {
        [socket.id]: { id: socket.id, name, avatar }
      },
      gameState: null 
    };

    socket.join(roomCode);
    console.log(`Room created: ${roomCode} by ${socket.id}`);
    
    callback({ success: true, roomCode });
    broadcastRoom(roomCode);
  });

  socket.on('joinRoom', (data, callback) => {
    const { roomCode, name, avatar } = data;
    
    if (rooms[roomCode]) {
      rooms[roomCode].players[socket.id] = { id: socket.id, name, avatar };
      socket.join(roomCode);
      console.log(`User ${socket.id} joined room: ${roomCode}`);
      
      callback({ success: true });
      broadcastRoom(roomCode);
    } else {
      callback({ success: false, message: 'Room not found' });
    }
  });

  socket.on('startGame', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (room && room.host === socket.id) {
      room.gameState = new GameState(Object.keys(room.players));
      room.gameState.createSnapshot(); // initial snapshot for first turn
      broadcastRoom(roomCode);
    }
  });

  socket.on('updateBoardLocal', ({ roomCode, board, rack }) => {
    const room = rooms[roomCode];
    if (room && room.gameState && room.gameState.getCurrentPlayerId() === socket.id) {
      // Update intermediate state (messy board)
      room.gameState.board = board;
      room.gameState.racks[socket.id] = rack;
      // Broadcast to everyone else so they see the tiles moving
      socket.to(roomCode).emit('boardSync', { board, turnOf: socket.id });
    }
  });

  socket.on('updateRack', ({ roomCode, rack }) => {
    const room = rooms[roomCode];
    if (room && room.gameState && room.gameState.racks[socket.id]) {
      // Allow players to reorder their rack anytime
      room.gameState.racks[socket.id] = rack;
      // If it's their turn, we might also update the snapshot's rack? No, snapshot is the start of turn.
      // We shouldn't broadcast this to everyone since racks are private (only count is public).
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
        // If board and rack are unchanged from snapshot, auto-draw a tile
        const boardUnchanged = JSON.stringify(gs.board) === JSON.stringify(gs.snapshot.board);
        const rackUnchanged = JSON.stringify(gs.racks[socket.id]) === JSON.stringify(gs.snapshot.rack);
        if (boardUnchanged && rackUnchanged) {
          const newTile = gs.drawTile();
          if (newTile) {
            gs.racks[socket.id].push(newTile);
          }
        }

        // Check win condition
        if (gs.racks[socket.id].length === 0) {
          gs.winner = socket.id;
        } else {
          gs.nextTurn();
          gs.createSnapshot();
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
        room.gameState.revertToSnapshot(); // Clean messy board
        const tile = room.gameState.drawTile();
        if (tile) {
           room.gameState.racks[socket.id].push(tile);
        }
        room.gameState.nextTurn();
        room.gameState.createSnapshot();
        broadcastRoom(roomCode);
     }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    for (const roomCode in rooms) {
      if (rooms[roomCode].players[socket.id]) {
        delete rooms[roomCode].players[socket.id];
        
        if (Object.keys(rooms[roomCode].players).length === 0) {
          delete rooms[roomCode];
          console.log(`Room ${roomCode} deleted (empty)`);
        } else {
          if (rooms[roomCode].host === socket.id) {
            rooms[roomCode].host = Object.keys(rooms[roomCode].players)[0];
          }
          broadcastRoom(roomCode);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
