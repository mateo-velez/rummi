import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Custom hook to encapsulate game socket event subscriptions and state
 */
export function useGameSocket(socket) {
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [host, setHost] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [config, setConfig] = useState({ turnTimeout: 0 });
  const [reactions, setReactions] = useState([]);
  const [gameOverInfo, setGameOverInfo] = useState(null);
  const reactionIdRef = useRef(0);

  useEffect(() => {
    if (!socket.connected) {
      navigate('/');
      return;
    }

    const handleRoomUpdate = (data) => {
      setPlayers(data.players);
      setHost(data.host);
      setGameState(data.gameState);
      if (data.config) setConfig(data.config);
      if (data.gameState?.gameOver) {
        setGameOverInfo({ winner: data.gameState.winner, reason: 'empty_rack' });
      } else {
        setGameOverInfo(null);
      }
    };

    const handleBoardSync = (data) => {
      if (data.turnOf !== socket.id) {
        setGameState(prev => {
          if (!prev) return prev;
          return { ...prev, board: data.board };
        });
      }
    };

    const handleReaction = (data) => {
      const id = reactionIdRef.current++;
      setReactions(prev => [...prev, { ...data, id }]);
      setTimeout(() => {
        setReactions(prev => prev.filter(r => r.id !== id));
      }, 3000);
    };

    const handleGameOver = (data) => {
      setGameOverInfo(data);
    };

    socket.on('roomUpdate', handleRoomUpdate);
    socket.on('boardSync', handleBoardSync);
    socket.on('reaction', handleReaction);
    socket.on('gameOver', handleGameOver);

    return () => {
      socket.off('roomUpdate', handleRoomUpdate);
      socket.off('boardSync', handleBoardSync);
      socket.off('reaction', handleReaction);
      socket.off('gameOver', handleGameOver);
    };
  }, [socket, navigate]);

  return {
    players,
    host,
    gameState,
    setGameState,
    config,
    reactions,
    gameOverInfo,
    setGameOverInfo
  };
}
