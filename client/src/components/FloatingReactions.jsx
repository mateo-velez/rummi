export default function FloatingReactions({ reactions }) {
  if (!reactions || reactions.length === 0) return null;

  return (
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
  );
}
