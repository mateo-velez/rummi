import React from 'react';
import './WinScreen.css';

export default function WinScreen({ winner, isHost, onPlayAgain }) {
  if (!winner) return null;

  return (
    <div className="win-screen-overlay">
      <div className="win-screen-content">
        <h1 className="win-title">Winner!</h1>
        <div className="winner-info">
          {winner.avatar && <div className="winner-avatar">{winner.avatar}</div>}
          <h2 className="winner-name">{winner.name}</h2>
        </div>
        <p className="win-reason">emptied their rack!</p>
        
        {isHost ? (
          <button className="play-again-btn" onClick={onPlayAgain}>
            Play Again
          </button>
        ) : (
          <p className="waiting-host-msg">Waiting for host to restart...</p>
        )}
      </div>
    </div>
  );
}
