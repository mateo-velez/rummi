export default function Lobby({
  roomCode,
  players,
  host,
  socketId,
  config,
  lobbyTimeout,
  onTimeoutChange,
  onStartGame
}) {
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

        {socketId === host && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
            <label style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Turn Timer (seconds, 0 = off)</label>
            <input
              type="number"
              min="0"
              max="300"
              value={lobbyTimeout}
              onChange={e => {
                const v = parseInt(e.target.value, 10) || 0;
                onTimeoutChange(v);
              }}
              style={{ width: '100px' }}
            />
          </div>
        )}
        {socketId !== host && config.turnTimeout > 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>⏱️ Turn timer: {config.turnTimeout}s</p>
        )}

        {socketId === host && (
          <button onClick={onStartGame} style={{ marginTop: '1rem' }}>Start Game</button>
        )}
        <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Share URL to invite friends!</p>
      </div>
    </div>
  );
}
