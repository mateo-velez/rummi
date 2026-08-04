import { useState } from 'react';
import { useParams } from 'react-router-dom';
import Lobby from '../components/Lobby';
import GameHeader from '../components/GameHeader';
import Board from '../components/Board';
import Rack from '../components/Rack';
import ErrorMessage from '../components/ErrorMessage';
import FloatingReactions from '../components/FloatingReactions';

import { useGameSocket } from '../hooks/useGameSocket';
import { useTurnTimer } from '../hooks/useTurnTimer';
import { useRackSort } from '../hooks/useRackSort';

import { cloneBoard, autoSortSet, removeEmptySets, sortRackTiles } from '../utils/gameUtils';

export default function Room({ socket }) {
  const { roomCode } = useParams();
  const [errorMsg, setErrorMsg] = useState(null);
  const [moveHistory, setMoveHistory] = useState([]);
  const [selectedTiles, setSelectedTiles] = useState([]);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [lobbyTimeout, setLobbyTimeout] = useState(0);
  const [rackSortType, setRackSortType] = useState(null);

  // Socket state hook
  const {
    players,
    host,
    gameState,
    setGameState,
    config,
    reactions
  } = useGameSocket(socket);

  // Turn countdown hook
  const turnTimeLeft = useTurnTimer(gameState);

  const isMyTurn = gameState && gameState.playerIds[gameState.currentTurnIndex] === socket.id;

  // Sync local rack update helper
  const syncRackLocal = (newRack) => {
    setGameState(prev => ({
      ...prev,
      racks: { ...prev.racks, [socket.id]: newRack }
    }));
    socket.emit('updateRack', { roomCode, rack: newRack });
  };

  // Enforce auto-sorting preference on rack (Rule #4)
  useRackSort(gameState, socket, rackSortType, syncRackLocal);

  const pushHistory = (board, rack) => {
    setMoveHistory(prev => [...prev, {
      board: cloneBoard(board),
      rack: [...rack]
    }]);
  };

  const syncLocalMove = (newBoard, newRack) => {
    pushHistory(gameState.board, gameState.racks[socket.id]);
    
    setGameState(prev => ({
      ...prev,
      board: newBoard,
      racks: { ...prev.racks, [socket.id]: newRack }
    }));
    socket.emit('updateBoardLocal', { roomCode, board: newBoard, rack: newRack });
  };

  const startGame = () => {
    socket.emit('startGame', { roomCode });
  };

  const updateConfig = (key, value) => {
    socket.emit('updateConfig', { roomCode, config: { [key]: value } });
  };

  const sortBoard = () => {
    if (!isMyTurn) return;
    const newBoard = gameState.board.map(set => autoSortSet([...set]));
    syncLocalMove(newBoard, gameState.racks[socket.id]);
  };

  const undoMove = () => {
    if (moveHistory.length === 0) return;
    const historyCopy = [...moveHistory];
    const previousState = historyCopy.pop();
    setMoveHistory(historyCopy);
    
    setGameState(prev => ({
      ...prev,
      board: previousState.board,
      racks: { ...prev.racks, [socket.id]: previousState.rack }
    }));
    socket.emit('updateBoardLocal', { roomCode, board: previousState.board, rack: previousState.rack });
    setSelectedTiles([]);
  };

  // --- CLICK HANDLERS ---
  const handleTileClick = (e, tile, source, setIdx = null) => {
    e.stopPropagation(); // Rule #2
    
    if (!isMyTurn && source === 'board') return;

    const isSelected = selectedTiles.find(t => t.id === tile.id);
    
    if (isSelected) {
      setSelectedTiles(prev => prev.filter(t => t.id !== tile.id));
      return;
    }

    // If we have selected tiles, clicking a tile in a DIFFERENT location should ADD them there
    if (selectedTiles.length > 0) {
      const firstSel = selectedTiles[0];
      const sameLocation = firstSel.source === source && firstSel.setIdx === setIdx;

      if (!sameLocation && isMyTurn) {
        // If selected tiles are from rack/board and we click on a board set → add them to that set
        if (source === 'board' && setIdx !== null) {
          moveSelectedTilesToSet(setIdx);
          return;
        }
        // If we click a rack tile while having board tiles selected, or vice versa: swap if exactly 1
        if (selectedTiles.length === 1) {
          if (firstSel.source !== source) {
            // Cannot swap between rack and board (Rule #5)
            setSelectedTiles([{ ...tile, source, setIdx }]);
            return;
          }
          if (!isMyTurn && (source === 'board' || firstSel.source === 'board')) {
            setSelectedTiles([{ ...tile, source, setIdx }]);
            return;
          }
          performSwap(selectedTiles[0], { ...tile, source, setIdx });
          return;
        } else {
          // Multi-select from different source: reset selection
          setSelectedTiles([{ ...tile, source, setIdx }]);
          return;
        }
      }
    }

    // Add to selection (same source)
    setSelectedTiles(prev => [...prev, { ...tile, source, setIdx }]);
  };

  const performSwap = (t1, t2) => {
    const newBoard = cloneBoard(gameState.board);
    let newRack = [...gameState.racks[socket.id]];

    const replaceTile = (tInfo, newTile) => {
      if (tInfo.source === 'rack') {
        const idx = newRack.findIndex(t => t.id === tInfo.id);
        newRack[idx] = newTile;
      } else {
        const idx = newBoard[tInfo.setIdx].findIndex(t => t.id === tInfo.id);
        newBoard[tInfo.setIdx][idx] = newTile;
      }
    };

    const actualTile1 = t1.source === 'rack' 
      ? newRack.find(t => t.id === t1.id) 
      : newBoard[t1.setIdx]?.find(t => t.id === t1.id);
      
    const actualTile2 = t2.source === 'rack'
      ? newRack.find(t => t.id === t2.id)
      : newBoard[t2.setIdx]?.find(t => t.id === t2.id);

    if (!actualTile1 || !actualTile2) return;

    replaceTile(t1, actualTile2);
    replaceTile(t2, actualTile1);

    if (t1.source === 'rack' && t2.source === 'rack') {
      syncRackLocal(newRack);
    } else {
      syncLocalMove(newBoard, newRack);
    }
    setSelectedTiles([]);
  };

  const handleSetClick = (setIdx) => {
    if (!isMyTurn || selectedTiles.length === 0) return;
    if (selectedTiles.every(t => t.source === 'board' && t.setIdx === setIdx)) return;
    moveSelectedTilesToSet(setIdx);
  };

  const handleBoardClick = (e) => {
    if (!isMyTurn || selectedTiles.length === 0) return;
    if (e.target !== e.currentTarget) return;
    moveSelectedTilesToSet(null);
  };

  const moveSelectedTilesToSet = (targetSetIdx) => {
    if (!isMyTurn || selectedTiles.length === 0) return;

    const newBoard = cloneBoard(gameState.board);
    let newRack = [...gameState.racks[socket.id]];

    const actualTilesToMove = selectedTiles.map(sel => {
      if (sel.source === 'rack') {
        return newRack.find(t => t.id === sel.id);
      } else {
        return newBoard[sel.setIdx]?.find(t => t.id === sel.id);
      }
    }).filter(Boolean);

    selectedTiles.forEach(sel => {
      if (sel.source === 'rack') {
        newRack = newRack.filter(t => t.id !== sel.id);
      } else {
        newBoard[sel.setIdx] = newBoard[sel.setIdx].filter(t => t.id !== sel.id);
      }
    });

    // Clean up empty sets and adjust target index
    for (let i = newBoard.length - 1; i >= 0; i--) {
      if (newBoard[i].length === 0) {
        newBoard.splice(i, 1);
        if (targetSetIdx !== null && targetSetIdx > i) {
          targetSetIdx--; 
        }
      }
    }

    if (targetSetIdx !== null && newBoard[targetSetIdx]) {
      newBoard[targetSetIdx].push(...actualTilesToMove);
      newBoard[targetSetIdx] = autoSortSet(newBoard[targetSetIdx]);
    } else {
      newBoard.push(autoSortSet([...actualTilesToMove]));
    }

    syncLocalMove(newBoard, newRack);
    setSelectedTiles([]);
  };

  // --- DRAG AND DROP HANDLERS ---
  const handleDragStart = (e, tile, source, setIdx = null) => {
    if (!isMyTurn && source === 'board') {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('application/json', JSON.stringify({ ...tile, source, setIdx }));
  };

  const handleDragOver = (e) => {
    e.preventDefault(); 
  };

  const handleDropOnTile = (e, targetTile, targetSource, targetSetIdx = null) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isMyTurn && targetSource === 'board') return;

    try {
      const data = e.dataTransfer.getData('application/json');
      if (!data) return;
      const draggedTile = JSON.parse(data);

      if (!isMyTurn && draggedTile.source === 'board') return;
      if (draggedTile.id === targetTile.id) return; 

      const newBoard = cloneBoard(gameState.board);
      let newRack = [...gameState.racks[socket.id]];

      const actualDraggedTile = draggedTile.source === 'rack' 
        ? newRack.find(t => t.id === draggedTile.id) 
        : newBoard[draggedTile.setIdx]?.find(t => t.id === draggedTile.id);
        
      if (!actualDraggedTile) return;

      if (targetSource === 'rack') {
        const actualTargetTile = newRack.find(t => t.id === targetTile.id);
        if (!actualTargetTile) return;

        if (draggedTile.source === 'rack') {
          setRackSortType(null); // Clear auto-sort when manually dragging in rack (Rule #4)
          const idx1 = newRack.findIndex(t => t.id === draggedTile.id);
          const idx2 = newRack.findIndex(t => t.id === targetTile.id);
          newRack[idx1] = actualTargetTile;
          newRack[idx2] = actualDraggedTile;
          syncRackLocal(newRack);
        } else {
          // Cannot swap board to rack (Rule #5)
          return;
        }
      } else {
        if (draggedTile.source === 'rack') {
          newRack = newRack.filter(t => t.id !== draggedTile.id);
        } else {
          newBoard[draggedTile.setIdx] = newBoard[draggedTile.setIdx].filter(t => t.id !== draggedTile.id);
        }

        newBoard[targetSetIdx].push(actualDraggedTile);
        newBoard[targetSetIdx] = autoSortSet(newBoard[targetSetIdx]);

        removeEmptySets(newBoard);
        syncLocalMove(newBoard, newRack);
      }
    } catch(err) { console.error("Drop err", err); }
  };

  const handleDropInGap = (e, setIdx, insertAfterIdx) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isMyTurn) return;

    try {
      const data = e.dataTransfer.getData('application/json');
      if (!data) return;
      const draggedTile = JSON.parse(data);

      const newBoard = cloneBoard(gameState.board);
      let newRack = [...gameState.racks[socket.id]];

      const actualTile = draggedTile.source === 'rack'
        ? newRack.find(t => t.id === draggedTile.id)
        : newBoard[draggedTile.setIdx]?.find(t => t.id === draggedTile.id);

      if (!actualTile) return;

      if (draggedTile.source === 'rack') {
        newRack = newRack.filter(t => t.id !== draggedTile.id);
      } else {
        newBoard[draggedTile.setIdx] = newBoard[draggedTile.setIdx].filter(t => t.id !== draggedTile.id);
      }

      if (newBoard[setIdx]) {
        let insertPosition = insertAfterIdx + 1;
        if (draggedTile.source === 'board' && draggedTile.setIdx === setIdx) {
          const originalIdx = gameState.board[setIdx].findIndex(t => t.id === draggedTile.id);
          if (originalIdx !== -1 && originalIdx <= insertAfterIdx) {
            insertPosition--;
          }
        }
        newBoard[setIdx].splice(Math.max(0, insertPosition), 0, actualTile);
      }

      removeEmptySets(newBoard);
      syncLocalMove(newBoard, newRack);
    } catch(err) { console.error(err); }
  };

  const handleDropOnSet = (e, setIdx) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isMyTurn) return;

    try {
      const data = e.dataTransfer.getData('application/json');
      if (!data) return;
      const draggedTile = JSON.parse(data);

      if (draggedTile.source === 'board' && draggedTile.setIdx === setIdx) return;

      const newBoard = cloneBoard(gameState.board);
      let newRack = [...gameState.racks[socket.id]];

      const actualTile = draggedTile.source === 'rack'
        ? newRack.find(t => t.id === draggedTile.id)
        : newBoard[draggedTile.setIdx]?.find(t => t.id === draggedTile.id);

      if (!actualTile) return;

      if (draggedTile.source === 'rack') {
        newRack = newRack.filter(t => t.id !== draggedTile.id);
      } else {
        newBoard[draggedTile.setIdx] = newBoard[draggedTile.setIdx].filter(t => t.id !== draggedTile.id);
      }

      if (newBoard[setIdx]) {
        newBoard[setIdx].push(actualTile);
        newBoard[setIdx] = autoSortSet(newBoard[setIdx]);
      }

      removeEmptySets(newBoard);
      syncLocalMove(newBoard, newRack);
    } catch(err) { console.error(err); }
  };

  const handleDropOnBoardEmpty = (e) => {
    e.preventDefault();
    if (!isMyTurn) return;

    try {
      const data = e.dataTransfer.getData('application/json');
      if (!data) return;
      const draggedTile = JSON.parse(data);

      const newBoard = cloneBoard(gameState.board);
      let newRack = [...gameState.racks[socket.id]];

      const actualTile = draggedTile.source === 'rack'
        ? newRack.find(t => t.id === draggedTile.id)
        : newBoard[draggedTile.setIdx]?.find(t => t.id === draggedTile.id);

      if (!actualTile) return;

      if (draggedTile.source === 'rack') {
        newRack = newRack.filter(t => t.id !== draggedTile.id);
      } else {
        newBoard[draggedTile.setIdx] = newBoard[draggedTile.setIdx].filter(t => t.id !== draggedTile.id);
      }

      newBoard.push([actualTile]);

      removeEmptySets(newBoard);
      syncLocalMove(newBoard, newRack);
    } catch(err) { console.error(err); }
  };

  const splitSet = (e, setIdx, splitAfterIndex) => {
    e.stopPropagation(); // Rule #2
    if (!isMyTurn) return;

    const newBoard = cloneBoard(gameState.board);
    const set = newBoard[setIdx];
    
    const set1 = set.slice(0, splitAfterIndex + 1);
    const set2 = set.slice(splitAfterIndex + 1);
    
    newBoard.splice(setIdx, 1, set1, set2);
    
    syncLocalMove(newBoard, gameState.racks[socket.id]);
    setSelectedTiles([]);
  };

  const sortRack = (type) => {
    setRackSortType(type);
    const sortedRack = sortRackTiles(gameState.racks[socket.id], type);
    syncRackLocal(sortedRack);
  };

  const endTurn = () => {
    setSelectedTiles([]);
    socket.emit('endTurn', { roomCode }, (res) => {
      if (!res.success) {
        setErrorMsg(res.message);
      } else {
        setMoveHistory([]);
      }
    });
  };

  const revertTurn = () => {
    setSelectedTiles([]);
    setErrorMsg(null);
    setMoveHistory([]);
    socket.emit('revertTurn', { roomCode });
  };

  const drawTile = () => {
    setSelectedTiles([]);
    setErrorMsg(null);
    setMoveHistory([]);
    socket.emit('drawTile', { roomCode });
  };

  const sendReaction = (emoji) => {
    socket.emit('reaction', { roomCode, emoji });
    setShowReactionPicker(false);
  };

  // Render pre-game lobby if game has not started
  if (!gameState) {
    return (
      <Lobby
        roomCode={roomCode}
        players={players}
        host={host}
        socketId={socket.id}
        config={config}
        lobbyTimeout={lobbyTimeout}
        onTimeoutChange={(val) => {
          setLobbyTimeout(val);
          updateConfig('turnTimeout', val);
        }}
        onStartGame={startGame}
      />
    );
  }

  const myRack = gameState.racks[socket.id] || [];
  const currentPlayerId = gameState.playerIds[gameState.currentTurnIndex];

  return (
    <div className="game-container" style={{ flexDirection: 'column' }}>
      <FloatingReactions reactions={reactions} />

      <ErrorMessage 
        errorMsg={errorMsg} 
        onClose={() => setErrorMsg(null)} 
      />

      <GameHeader
        roomCode={roomCode}
        players={players}
        currentPlayerId={currentPlayerId}
        gameState={gameState}
        turnTimeLeft={turnTimeLeft}
        showReactionPicker={showReactionPicker}
        onToggleReactionPicker={() => setShowReactionPicker(!showReactionPicker)}
        onSendReaction={sendReaction}
      />

      <Board
        board={gameState.board}
        selectedTiles={selectedTiles}
        isMyTurn={isMyTurn}
        onBoardClick={handleBoardClick}
        onDragOver={handleDragOver}
        onDropOnBoardEmpty={handleDropOnBoardEmpty}
        onMoveSelectedToNewSet={() => moveSelectedTilesToSet(null)}
        onSetClick={handleSetClick}
        onTileClick={handleTileClick}
        onDragStart={handleDragStart}
        onDropOnSet={handleDropOnSet}
        onDropOnTile={handleDropOnTile}
        onDropInGap={handleDropInGap}
        onSplitSet={splitSet}
      />

      <Rack
        myRack={myRack}
        selectedTiles={selectedTiles}
        isMyTurn={isMyTurn}
        hasMoveHistory={moveHistory.length > 0}
        onSortRack={sortRack}
        onClearSelection={() => setSelectedTiles([])}
        onUndoMove={undoMove}
        onSortBoard={sortBoard}
        onDrawTile={drawTile}
        onRevertTurn={revertTurn}
        onEndTurn={endTurn}
        onTileClick={handleTileClick}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDropOnTile={handleDropOnTile}
      />
    </div>
  );
}
