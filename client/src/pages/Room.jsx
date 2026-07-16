import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Tile from '../components/Tile';

export default function Room({ socket }) {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [host, setHost] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  
  // Undo history for the current turn
  const [moveHistory, setMoveHistory] = useState([]);
  
  // Array of selected tiles to allow multi-select
  const [selectedTiles, setSelectedTiles] = useState([]); 

  useEffect(() => {
    if (!socket.connected) {
      navigate('/');
      return;
    }

    socket.on('roomUpdate', (data) => {
      setPlayers(data.players);
      setHost(data.host);
      setGameState(data.gameState);
    });

    socket.on('boardSync', (data) => {
      if (data.turnOf !== socket.id) {
        setGameState(prev => {
          if (!prev) return prev;
          return { ...prev, board: data.board };
        });
      }
    });

    return () => {
      socket.off('roomUpdate');
      socket.off('boardSync');
    };
  }, [socket, navigate]);

  const startGame = () => {
    socket.emit('startGame', { roomCode });
  };

  const isMyTurn = gameState && gameState.playerIds[gameState.currentTurnIndex] === socket.id;

  // Deep-copy the board so we never mutate React state
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

  const handleTileClick = (e, tile, source, setIdx = null) => {
    e.stopPropagation();
    
    if (!isMyTurn && source === 'board') return;

    const isSelected = selectedTiles.find(t => t.id === tile.id);
    
    if (isSelected) {
      setSelectedTiles(prev => prev.filter(t => t.id !== tile.id));
    } else {
      const currentSource = selectedTiles.length > 0 ? selectedTiles[0].source : null;
      const currentSetIdx = selectedTiles.length > 0 ? selectedTiles[0].setIdx : null;
      
      if (currentSource && (currentSource !== source || currentSetIdx !== setIdx)) {
         if (selectedTiles.length === 1) {
            if (!isMyTurn && (source === 'board' || currentSource === 'board')) {
                setSelectedTiles([{ ...tile, source, setIdx }]);
                return;
            }

            const newBoard = cloneBoard(gameState.board);
            let newRack = [...gameState.racks[socket.id]];
            
            const t1 = selectedTiles[0];
            const t2 = { ...tile, source, setIdx };

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
              : newBoard[t1.setIdx].find(t => t.id === t1.id);
              
            const actualTile2 = t2.source === 'rack'
              ? newRack.find(t => t.id === t2.id)
              : newBoard[t2.setIdx].find(t => t.id === t2.id);

            replaceTile(t1, actualTile2);
            replaceTile(t2, actualTile1);

            if (t1.source === 'rack' && t2.source === 'rack') {
               syncRackLocal(newRack);
            } else {
               syncLocalMove(newBoard, newRack);
            }
            setSelectedTiles([]);
            return;
         } else {
            setSelectedTiles([{ ...tile, source, setIdx }]);
         }
      } else {
         setSelectedTiles(prev => [...prev, { ...tile, source, setIdx }]);
      }
    }
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
          const idx1 = newRack.findIndex(t => t.id === draggedTile.id);
          const idx2 = newRack.findIndex(t => t.id === targetTile.id);
          newRack[idx1] = actualTargetTile;
          newRack[idx2] = actualDraggedTile;
          syncRackLocal(newRack);
        } else {
          newBoard[draggedTile.setIdx] = newBoard[draggedTile.setIdx].filter(t => t.id !== draggedTile.id);
          const rIdx = newRack.findIndex(t => t.id === targetTile.id);
          newRack[rIdx] = actualDraggedTile;
          newBoard[draggedTile.setIdx] = autoSortSet(newBoard[draggedTile.setIdx]);
          // Put the target tile back into the board set where dragged tile came from
          newBoard[draggedTile.setIdx].push(actualTargetTile);
          newBoard[draggedTile.setIdx] = autoSortSet(newBoard[draggedTile.setIdx]);
          syncLocalMove(newBoard, newRack);
        }
      } else {
        // Dropping onto a board tile in a set — add dragged tile to that set
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
         // Adjust insert position if we removed from the same set at an earlier index
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
    e.stopPropagation(); // Prevent bubbling to handleDropOnBoardEmpty
    if (!isMyTurn) return;

    try {
      const data = e.dataTransfer.getData('application/json');
      if (!data) return;
      const draggedTile = JSON.parse(data);

      // Dropping a tile back onto its own set is a no-op
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

  const moveSelectedTiles = (targetSetIdx) => {
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
    } else if (targetSetIdx === null) {
      newBoard.push(autoSortSet([...actualTilesToMove]));
    }

    syncLocalMove(newBoard, newRack);
    setSelectedTiles([]);
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
            <button onClick={startGame} style={{ marginTop: '2rem' }}>Start Game</button>
          )}
          <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Share URL to invite friends!</p>
        </div>
      </div>
    );
  }

  const myRack = gameState.racks[socket.id] || [];

  return (
    <div className="game-container">
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
      <div className="glass" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3>Room {roomCode}</h3>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
             {players.map(p => (
                <div key={p.id} style={{ 
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  opacity: gameState.playerIds[gameState.currentTurnIndex] === p.id ? 1 : 0.5,
                  padding: '0.5rem',
                  background: gameState.playerIds[gameState.currentTurnIndex] === p.id ? 'var(--surface)' : 'transparent',
                  borderRadius: '8px'
                }}>
                  <span style={{ fontSize: '1.5rem' }}>{p.avatar}</span>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 'bold' }}>{p.name}</span>
                    <span style={{ fontSize: '0.8rem' }}>{gameState.racks[p.id]?.length} tiles</span>
                  </div>
                </div>
             ))}
          </div>
        </div>
      </div>

      <div 
        className="board-area glass" 
        style={{ position: 'relative' }}
        onDragOver={handleDragOver}
        onDrop={handleDropOnBoardEmpty}
      >
        {gameState.board.length === 0 && <p style={{ margin: 'auto', color: 'var(--text-muted)', pointerEvents: 'none' }}>Board is empty</p>}
        {gameState.board.map((set, idx) => (
          <div 
            key={idx} 
            className="tile-set"
            onClick={() => moveSelectedTiles(idx)}
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
            onClick={() => moveSelectedTiles(null)}
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
            + Play as New Set
          </div>
        )}
      </div>

      <div className="glass" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '0.5rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', borderTopLeftRadius: '16px', borderTopRightRadius: '16px', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 'auto 0' }}>Sort Rack:</span>
            <button onClick={() => sortRack('number')} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'var(--surface-border)' }}>By 123</button>
            <button onClick={() => sortRack('color')} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'var(--surface-border)' }}>By Color</button>
          </div>
          {isMyTurn && (
            <div className="controls" style={{ margin: 0, gap: '0.5rem', display: 'flex', flexWrap: 'wrap' }}>
              {moveHistory.length > 0 && (
                <button onClick={undoMove} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'var(--color-blue)' }}>Undo Last Move</button>
              )}
              <button onClick={sortBoard} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'var(--surface-border)', color: 'var(--text)' }}>Sort Board Sets</button>
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
