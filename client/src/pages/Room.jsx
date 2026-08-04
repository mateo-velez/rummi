import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Tile from '../components/Tile';

const REACTION_EMOJIS = ['😂', '🔥', '👏', '😱', '💀', '🎉', '😤', '🤔'];

export default function Room({ socket }) {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [host, setHost] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [config, setConfig] = useState({ turnTimeout: 0 });
  const [errorMsg, setErrorMsg] = useState(null);
  const [moveHistory, setMoveHistory] = useState([]);
  const [selectedTiles, setSelectedTiles] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [turnTimeLeft, setTurnTimeLeft] = useState(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [lobbyTimeout, setLobbyTimeout] = useState(0);
  const [rackSortType, setRackSortType] = useState(null);
  const reactionIdRef = useRef(0);

  useEffect(() => {
    if (!socket.connected) {
      navigate('/');
      return;
    }

    socket.on('roomUpdate', (data) => {
      setPlayers(data.players);
      setHost(data.host);
      setGameState(data.gameState);
      if (data.config) setConfig(data.config);
    });

    socket.on('boardSync', (data) => {
      if (data.turnOf !== socket.id) {
        setGameState(prev => {
          if (!prev) return prev;
          return { ...prev, board: data.board };
        });
      }
    });

    socket.on('reaction', (data) => {
      const id = reactionIdRef.current++;
      setReactions(prev => [...prev, { ...data, id }]);
      setTimeout(() => {
        setReactions(prev => prev.filter(r => r.id !== id));
      }, 3000);
    });

    return () => {
      socket.off('roomUpdate');
      socket.off('boardSync');
      socket.off('reaction');
    };
  }, [socket, navigate]);

  // Turn timer countdown
  useEffect(() => {
    if (!gameState || !gameState.turnTimeout || !gameState.turnStartTime) {
      setTurnTimeLeft(null);
      return;
    }

    const updateTimer = () => {
      const elapsed = (Date.now() - gameState.turnStartTime) / 1000;
      const remaining = Math.max(0, gameState.turnTimeout - elapsed);
      setTurnTimeLeft(Math.ceil(remaining));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 500);
    return () => clearInterval(interval);
  }, [gameState?.turnStartTime, gameState?.turnTimeout]);

  // Auto-sort rack if preference is set
  useEffect(() => {
    if (!rackSortType || !gameState || !gameState.racks[socket.id]) return;
    const currentRack = gameState.racks[socket.id];
    if (currentRack.length === 0) return;

    let sorted = [...currentRack];
    if (rackSortType === 'number') {
      sorted.sort((a, b) => {
        if (a.isJoker) return 1;
        if (b.isJoker) return -1;
        if (a.number === b.number) return a.color.localeCompare(b.color);
        return a.number - b.number;
      });
    } else {
      sorted.sort((a, b) => {
        if (a.isJoker) return 1;
        if (b.isJoker) return -1;
        if (a.color === b.color) return a.number - b.number;
        return a.color.localeCompare(b.color);
      });
    }
    
    // Only update if order changed to prevent infinite loops
    if (JSON.stringify(currentRack.map(t=>t.id)) !== JSON.stringify(sorted.map(t=>t.id))) {
      syncRackLocal(sorted);
    }
  }, [gameState?.racks?.[socket.id], rackSortType]);

  const startGame = () => {
    socket.emit('startGame', { roomCode });
  };

  const updateConfig = (key, value) => {
    socket.emit('updateConfig', { roomCode, config: { [key]: value } });
  };

  const isMyTurn = gameState && gameState.playerIds[gameState.currentTurnIndex] === socket.id;

  const cloneBoard = (board) => board.map(set => [...set]);

  const pushHistory = (board, rack) => {
    setMoveHistory(prev => [...prev, {
      board: cloneBoard(board),
      rack: [...rack]
    }]);
  };

  const autoSortSet = (set) => {
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

  const removeEmptySets = (board) => {
    for (let i = board.length - 1; i >= 0; i--) {
      if (board[i].length === 0) board.splice(i, 1);
    }
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

  const syncLocalMove = (newBoard, newRack) => {
    pushHistory(gameState.board, gameState.racks[socket.id]);
    
    setGameState(prev => ({
      ...prev,
      board: newBoard,
      racks: { ...prev.racks, [socket.id]: newRack }
    }));
    socket.emit('updateBoardLocal', { roomCode, board: newBoard, rack: newRack });
  };

  const syncRackLocal = (newRack) => {
    setGameState(prev => ({
      ...prev,
      racks: { ...prev.racks, [socket.id]: newRack }
    }));
    socket.emit('updateRack', { roomCode, rack: newRack });
  };

  // --- CLICK HANDLERS ---
  const handleTileClick = (e, tile, source, setIdx = null) => {
    e.stopPropagation();
    
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
            // Cannot swap between rack and board
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

  // Click on a set → add selected tiles to it
  const handleSetClick = (setIdx) => {
    if (!isMyTurn || selectedTiles.length === 0) return;
    // Don't do anything if clicking the same set tiles are selected from
    if (selectedTiles.every(t => t.source === 'board' && t.setIdx === setIdx)) return;
    moveSelectedTilesToSet(setIdx);
  };

  // Click on empty board area → create new set from selected tiles
  const handleBoardClick = (e) => {
    if (!isMyTurn || selectedTiles.length === 0) return;
    // Only fire if the click target is the board area itself, not a child
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
          setRackSortType(null); // Clear auto-sort when manually dragging in rack
          const idx1 = newRack.findIndex(t => t.id === draggedTile.id);
          const idx2 = newRack.findIndex(t => t.id === targetTile.id);
          newRack[idx1] = actualTargetTile;
          newRack[idx2] = actualDraggedTile;
          syncRackLocal(newRack);
        } else {
          // Can't swap board to rack
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
    } catch(err) { console.error(err) }
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
    } catch(err) { console.error(err) }
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
    } catch(err) { console.error(err) }
  };

  const splitSet = (e, setIdx, splitAfterIndex) => {
    e.stopPropagation();
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
    let newRack = [...gameState.racks[socket.id]];
    if (type === 'number') {
      newRack.sort((a, b) => {
        if (a.isJoker) return 1;
        if (b.isJoker) return -1;
        if (a.number === b.number) return a.color.localeCompare(b.color);
        return a.number - b.number;
      });
    } else {
      newRack.sort((a, b) => {
        if (a.isJoker) return 1;
        if (b.isJoker) return -1;
        if (a.color === b.color) return a.number - b.number;
        return a.color.localeCompare(b.color);
      });
    }
    syncRackLocal(newRack);
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

  // --- LOBBY ---
  if (!gameState) {
    return (
      <div className="lobby-container">
        <div className="lobby-card glass">
          <h2>Room: {roomCode}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {players.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '1.2rem' }}>
                <span style={{ fontSize: '2rem' }}>{p.avatar}</span>
                <span>{p.name} {p.id === host ? '(Host)' : ''}</span>
              </div>
            ))}
          </div>

          {socket.id === host && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              <label style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Turn Timer (seconds, 0 = off)</label>
              <input
                type="number"
                min="0"
                max="300"
                value={lobbyTimeout}
                onChange={e => {
                  const v = parseInt(e.target.value) || 0;
                  setLobbyTimeout(v);
                  updateConfig('turnTimeout', v);
                }}
                style={{ width: '100px' }}
              />
            </div>
          )}
          {socket.id !== host && config.turnTimeout > 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>⏱️ Turn timer: {config.turnTimeout}s</p>
          )}

          {socket.id === host && (
            <button onClick={startGame} style={{ marginTop: '1rem' }}>Start Game</button>
          )}
          <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Share URL to invite friends!</p>
        </div>
      </div>
    );
  }

  const myRack = gameState.racks[socket.id] || [];
  const currentPlayerId = gameState.playerIds[gameState.currentTurnIndex];

  return (
    <div className="game-container" style={{ flexDirection: 'column' }}>
      {/* Floating reactions */}
      <div style={{ position: 'fixed', top: '80px', right: '20px', zIndex: 999, display: 'flex', flexDirection: 'column', gap: '0.5rem', pointerEvents: 'none' }}>
        {reactions.map(r => (
          <div key={r.id} style={{
            background: 'rgba(0,0,0,0.7)', padding: '0.5rem 1rem', borderRadius: '20px',
            display: 'flex', alignItems: 'center', gap: '0.5rem', animation: 'fadeIn 0.3s ease',
            fontSize: '1rem', color: 'white', pointerEvents: 'none'
          }}>
            <span>{r.playerAvatar}</span>
            <span style={{ fontSize: '1.5rem' }}>{r.emoji}</span>
          </div>
        ))}
      </div>

      {errorMsg && (
        <div style={{
          position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--color-orange)', color: 'white', padding: '1rem 2rem',
          borderRadius: '8px', zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', gap: '1rem'
        }}>
          <strong>Error:</strong> {errorMsg}
          <button 
            onClick={() => setErrorMsg(null)}
            style={{ background: 'transparent', border: '1px solid white', color: 'white', padding: '0.2rem 0.5rem', fontSize: '0.8rem', cursor: 'pointer' }}
          >Dismiss</button>
        </div>
      )}

      {/* TOP HEADER */}
      <div className="glass" style={{ display: 'flex', gap: '1rem', padding: '0.5rem 1rem', alignItems: 'center', overflowX: 'auto' }}>
        <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Room {roomCode}</h4>
        
        {players.map(p => (
          <div key={p.id} style={{ 
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            opacity: currentPlayerId === p.id ? 1 : (p.offline ? 0.3 : 0.6),
            padding: '0.2rem 0.5rem',
            background: currentPlayerId === p.id ? 'var(--surface)' : 'transparent',
            borderRadius: '6px', fontSize: '0.85rem'
          }}>
            <span>{p.avatar}</span>
            <span style={{ fontWeight: 'bold' }}>{p.name} {p.offline ? '📴' : ''}</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({gameState.racks[p.id]?.length})</span>
          </div>
        ))}

        {turnTimeLeft !== null && turnTimeLeft > 0 && (
          <div style={{ 
            marginLeft: 'auto',
            fontSize: '1.1rem', fontWeight: 'bold',
            color: turnTimeLeft <= 10 ? 'var(--color-red)' : 'var(--text)',
            padding: '0.2rem 0.5rem', borderRadius: '6px',
            background: turnTimeLeft <= 10 ? 'rgba(220,38,38,0.15)' : 'transparent',
            animation: turnTimeLeft <= 5 ? 'pulse 1s infinite' : 'none'
          }}>
            ⏱️ {turnTimeLeft}s
          </div>
        )}

        {/* Reaction picker */}
        <div style={{ position: 'relative', marginLeft: turnTimeLeft !== null ? '0' : 'auto' }}>
          <button 
            onClick={() => setShowReactionPicker(!showReactionPicker)}
            style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', background: 'var(--surface-border)', color: 'var(--text)' }}
          >
            😄 React
          </button>
          {showReactionPicker && (
            <div className="glass" style={{ position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem', zIndex: 100, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', padding: '0.5rem' }}>
              {REACTION_EMOJIS.map(emoji => (
                <button 
                  key={emoji} 
                  onClick={() => sendReaction(emoji)}
                  style={{ padding: '0.4rem', fontSize: '1.2rem', background: 'var(--surface)', minWidth: 0 }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* BOARD AREA */}
      <div 
        className="board-area glass" 
        style={{ position: 'relative', flex: 1, minHeight: '300px' }}
        onDragOver={handleDragOver}
        onDrop={handleDropOnBoardEmpty}
        onClick={handleBoardClick}
      >
        {gameState.board.length === 0 && <p style={{ margin: 'auto', color: 'var(--text-muted)', pointerEvents: 'none' }}>Board is empty</p>}
        {gameState.board.map((set, idx) => (
          <div 
            key={idx} 
            className="tile-set"
            onClick={(e) => { e.stopPropagation(); handleSetClick(idx); }}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDropOnSet(e, idx)}
            style={{ 
              cursor: selectedTiles.length > 0 && isMyTurn ? 'copy' : 'default',
              border: selectedTiles.length > 0 && isMyTurn ? '1px dashed var(--primary)' : '1px solid transparent',
              display: 'flex', alignItems: 'center',
              padding: '16px 24px',
              margin: '4px',
              minHeight: '60px',
              minWidth: '60px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '12px'
            }}
          >
            {set.map((tile, tIdx) => (
              <div key={tile.id} style={{ display: 'flex', alignItems: 'center' }}>
                <Tile 
                  tile={tile} 
                  selected={!!selectedTiles.find(t => t.id === tile.id)}
                  onClick={(e) => handleTileClick(e, tile, 'board', idx)} 
                  onDragStart={(e) => handleDragStart(e, tile, 'board', idx)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDropOnTile(e, tile, 'board', idx)}
                />
                {tIdx < set.length - 1 && isMyTurn && (
                  <div 
                    className="tile-gap"
                    onClick={(e) => splitSet(e, idx, tIdx)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDropInGap(e, idx, tIdx)}
                    title="Click to split, drop here to insert"
                  ></div>
                )}
              </div>
            ))}
          </div>
        ))}
        {isMyTurn && selectedTiles.length > 0 && (
          <div 
            onClick={(e) => { e.stopPropagation(); moveSelectedTilesToSet(null); }}
            style={{
              padding: '1rem',
              border: '2px dashed var(--color-orange)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--color-orange)',
              fontWeight: 'bold',
              minWidth: '100px',
              height: '60px'
            }}
          >
            + New Set
          </div>
        )}
      </div>

      {/* RACK & CONTROLS */}
      <div className="glass" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '0.5rem 1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', background: 'rgba(0,0,0,0.2)', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Sort:</span>
          <button onClick={() => sortRack('number')} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'var(--surface-border)' }}>123</button>
          <button onClick={() => sortRack('color')} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'var(--surface-border)' }}>Color</button>
          {selectedTiles.length > 0 && (
            <button onClick={() => setSelectedTiles([])} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'rgba(220,38,38,0.3)' }}>
              Clear Selection ({selectedTiles.length})
            </button>
          )}

          {isMyTurn && (
            <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
              {moveHistory.length > 0 && (
                <button onClick={undoMove} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'var(--color-blue)' }}>↩ Undo</button>
              )}
              <button onClick={sortBoard} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'var(--surface-border)', color: 'var(--text)' }}>Sort Sets</button>
              <button onClick={drawTile} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'var(--surface)' }}>Draw Tile</button>
              <button onClick={revertTurn} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'var(--color-orange)' }}>Revert All</button>
              <button onClick={endTurn} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'var(--primary)' }}>End Turn</button>
            </div>
          )}
        </div>
        <div 
          className="rack-area" 
          style={{ flexWrap: 'wrap', height: 'auto', minHeight: '120px' }}
          onDragOver={handleDragOver}
          onDrop={(e) => {}}
        >
          {myRack.map(tile => (
            <Tile 
              key={tile.id} 
              tile={tile} 
              selected={!!selectedTiles.find(t => t.id === tile.id)}
              onClick={(e) => handleTileClick(e, tile, 'rack')} 
              onDragStart={(e) => handleDragStart(e, tile, 'rack')}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDropOnTile(e, tile, 'rack')}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
