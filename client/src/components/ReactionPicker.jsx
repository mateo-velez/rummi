import { REACTION_EMOJIS } from '../utils/constants';

export default function ReactionPicker({ show, onToggle, onSelectEmoji }) {
  return (
    <div style={{ position: 'relative' }}>
      <button 
        onClick={onToggle}
        style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', background: 'var(--surface-border)', color: 'var(--text)' }}
      >
        😄 React
      </button>
      {show && (
        <div 
          className="glass" 
          style={{ 
            position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem', 
            zIndex: 100, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', 
            gap: '4px', padding: '0.5rem' 
          }}
        >
          {REACTION_EMOJIS.map(emoji => (
            <button 
              key={emoji} 
              onClick={() => onSelectEmoji(emoji)}
              style={{ padding: '0.4rem', fontSize: '1.2rem', background: 'var(--surface)', minWidth: 0 }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
