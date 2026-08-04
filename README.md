# Rummikub Web Application

A modern, real-time multiplayer Rummikub web application built with **React**, **Node.js**, **Socket.io**, and **Vite**. 

Featuring rich UI aesthetics, smooth click-to-move and drag-and-drop mechanics, customizable turn timeouts, floating emoji reactions, state undo/revert, automatic set sorting, and seamless session rejoining.

---

## 🚀 Quick Start

### Option 1: Docker (Recommended for instant play)

Run the entire application (backend + built frontend) in a single container:

```bash
docker-compose up --build
```

Then open your browser and navigate to `http://localhost:3001`.

### Option 2: Local Development

#### 1. Start the Backend Server

```bash
cd server
npm install
node server.js
```
The server will run on `http://localhost:3001`.

#### 2. Start the Frontend Dev Server

In a new terminal:

```bash
cd client
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## ✨ Features

- **Real-Time Multiplayer**: Instant board updates and turn synchronization using Socket.io.
- **Session Reconnection**: If a player accidentally closes their browser or refreshes, they can rejoin the ongoing room seamlessly without losing their hand or position.
- **Intuitive Controls**:
  - **Click-to-Move**: Click one or multiple tiles in your rack or on the board, then click any existing set or empty board space to add/create sets.
  - **Drag & Drop**: Drag tiles into sets, between gaps in a run, or into new sets.
  - **Set Splitting**: Click between two tiles in a set to split it instantly into two separate sets.
  - **Auto-Sorting**: Sort your rack by number (`123`) or color (`Color`), with preference persistence across turns.
- **Turn Actions**:
  - **Undo**: Revert your last micro-move during your turn.
  - **Revert All**: Reset the board and your rack back to the initial state at the start of your turn.
  - **Draw Tile**: End turn and draw a penalty tile if no move was made (or auto-reverts and draws).
  - **Sort Sets**: Auto-arrange board sets logically.
- **Customizable Room Settings**: Host can configure a turn timer (10s–300s or disabled).
- **Interactive Emoji Reactions**: Express yourself with floating animated emojis sent to all room members in real time.

---

## 🛠️ Project Structure

```
rummi/
├── client/                 # React + Vite Frontend
│   ├── src/
│   │   ├── components/     # Modular UI Components (Board, TileSet, Rack, GameHeader, etc.)
│   │   ├── hooks/          # Custom React Hooks (useGameSocket, useTurnTimer, useRackSort)
│   │   ├── pages/          # Home (Lobby) & Room (Game Coordinator)
│   │   ├── utils/          # Pure Utilities (gameUtils, persistentId, constants)
│   │   ├── App.jsx         # Socket initialization & Router
│   │   └── index.css       # Design system & Animations
│   └── vite.config.js
├── server/                 # Node.js + Express + Socket.io Server
│   ├── game/
│   │   └── RummikubLogic.js# Core game state, deck generation, validation
│   └── server.js           # Socket handlers, room lifecycle, turn timers
├── docs/                   # Developer & System Documentation
│   ├── ARCHITECTURE.md
│   ├── GAME_RULES_AND_LOGIC.md
│   ├── SOCKET_PROTOCOL.md
│   └── UI_AND_INTERACTIONS.md
├── AGENTS.md               # Guidelines for AI agents working on this codebase
├── Dockerfile              # Production multi-stage Docker build
└── docker-compose.yml      # Docker Compose configuration
```

---

## 🤝 Contribution Guide

We welcome contributions! Please follow these guidelines:

1. **State Immutability**: Always deep-clone board state and rack arrays before mutating (`cloneBoard` helper in `gameUtils.js`). Direct mutation of React or server state causes state desynchronization bugs.
2. **Prevent Event Bubbling**: Always call `e.stopPropagation()` when interacting with individual tiles or sets to avoid accidental parent board click triggers.
3. **Socket Protocol Rules**: All state-modifying actions must be broadcasted via Socket.io events (`boardSync`, `roomUpdate`). See [`docs/SOCKET_PROTOCOL.md`](docs/SOCKET_PROTOCOL.md) for full event definitions.
4. **Code Style**: Keep CSS cleanly organized in `index.css` using modern design tokens (variables, glassmorphism, fluid layouts).
5. **Testing & Verification**: Ensure board validation (`RummikubLogic.isBoardValid`) passes cleanly before ending turns.

---

## 📄 Documentation Index

- [Architecture Overview](docs/ARCHITECTURE.md)
- [Game Rules & Validation Logic](docs/GAME_RULES_AND_LOGIC.md)
- [Socket Protocol Reference](docs/SOCKET_PROTOCOL.md)
- [UI Interaction Patterns](docs/UI_AND_INTERACTIONS.md)
