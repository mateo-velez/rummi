export default function ErrorMessage({ errorMsg, onClose }) {
  if (!errorMsg) return null;

  return (
    <div style={{
      position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
      background: 'var(--color-orange)', color: 'white', padding: '1rem 2rem',
      borderRadius: '8px', zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', gap: '1rem'
    }}>
      <strong>Error:</strong> {errorMsg}
      <button 
        onClick={onClose}
        style={{ background: 'transparent', border: '1px solid white', color: 'white', padding: '0.2rem 0.5rem', fontSize: '0.8rem', cursor: 'pointer' }}
      >
        Dismiss
      </button>
    </div>
  );
}
