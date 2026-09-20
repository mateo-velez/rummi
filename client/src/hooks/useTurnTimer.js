import { useState, useEffect } from 'react';

/**
 * Custom hook to calculate and update turn timer countdown
 */
export function useTurnTimer(gameState) {
  const [turnTimeLeft, setTurnTimeLeft] = useState(null);

  const turnStartTime = gameState?.turnStartTime;
  const turnTimeout = gameState?.turnTimeout;

  useEffect(() => {
    if (!turnTimeout || !turnStartTime || gameState?.gameOver) {
      setTurnTimeLeft(null);
      return;
    }

    const updateTimer = () => {
      const elapsed = (Date.now() - turnStartTime) / 1000;
      const remaining = Math.max(0, turnTimeout - elapsed);
      setTurnTimeLeft(Math.ceil(remaining));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 500);
    return () => clearInterval(interval);
  }, [turnStartTime, turnTimeout, gameState?.gameOver]);

  return turnTimeLeft;
}
