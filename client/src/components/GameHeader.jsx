import ReactionPicker from './ReactionPicker';

export default function GameHeader({
  roomCode,
  players,
  currentPlayerId,
  gameState,
  turnTimeLeft,
  showReactionPicker,
  onToggleReactionPicker,
  onSendReaction
}) {
  return (
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
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({gameState.racks[p.id]?.length || 0})</span>
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

      <div style={{ marginLeft: turnTimeLeft !== null ? '0' : 'auto' }}>
        <ReactionPicker 
          show={showReactionPicker} 
          onToggle={onToggleReactionPicker} 
          onSelectEmoji={onSendReaction} 
        />
      </div>
    </div>
  );
}
