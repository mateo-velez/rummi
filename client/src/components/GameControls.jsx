export default function GameControls({
  isMyTurn,
  selectedTilesCount,
  hasMoveHistory,
  onSortRack,
  onClearSelection,
  onUndoMove,
  onSortBoard,
  onDrawTile,
  onRevertTurn,
  onEndTurn
}) {
  return (
    <div style={{ padding: '0.5rem 1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', background: 'rgba(0,0,0,0.2)', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}>
      <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Sort:</span>
      <button onClick={() => onSortRack('number')} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'var(--surface-border)' }}>123</button>
      <button onClick={() => onSortRack('color')} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'var(--surface-border)' }}>Color</button>
      
      {selectedTilesCount > 0 && (
        <button onClick={onClearSelection} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'rgba(220,38,38,0.3)' }}>
          Clear Selection ({selectedTilesCount})
        </button>
      )}

      {isMyTurn && (
        <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
          {hasMoveHistory && (
            <button onClick={onUndoMove} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'var(--color-blue)' }}>↩ Undo</button>
          )}
          <button onClick={onSortBoard} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'var(--surface-border)', color: 'var(--text)' }}>Sort Sets</button>
          <button onClick={onDrawTile} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'var(--surface)' }}>Draw Tile</button>
          <button onClick={onRevertTurn} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'var(--color-orange)' }}>Revert All</button>
          <button onClick={onEndTurn} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'var(--primary)' }}>End Turn</button>
        </div>
      )}
    </div>
  );
}
