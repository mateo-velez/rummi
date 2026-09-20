import TileSet from './TileSet';

export default function Board({
  board,
  selectedTiles,
  isMyTurn,
  onBoardClick,
  onDragOver,
  onDropOnBoardEmpty,
  onMoveSelectedToNewSet,
  onSetClick,
  onTileClick,
  onDragStart,
  onDropOnSet,
  onDropOnTile,
  onDropInGap,
  onSplitSet
}) {
  return (
    <div 
      className="board-area glass" 
      style={{ position: 'relative', flex: 1, minHeight: '300px' }}
      onDragOver={onDragOver}
      onDrop={onDropOnBoardEmpty}
      onClick={onBoardClick}
    >
      {(!board || board.length === 0) && (
        <p style={{ margin: 'auto', color: 'var(--text-muted)', pointerEvents: 'none' }}>
          Board is empty
        </p>
      )}

      {board && board.map((set, idx) => (
        <TileSet 
          key={set.length > 0 ? set.map(t => t.id).join('-') : idx}
          set={set}
          setIdx={idx}
          selectedTiles={selectedTiles}
          isMyTurn={isMyTurn}
          onSetClick={onSetClick}
          onTileClick={onTileClick}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDropOnSet={onDropOnSet}
          onDropOnTile={onDropOnTile}
          onDropInGap={onDropInGap}
          onSplitSet={onSplitSet}
        />
      ))}

      {isMyTurn && selectedTiles.length > 0 && (
        <div 
          onClick={(e) => { 
            e.stopPropagation(); 
            onMoveSelectedToNewSet(); 
          }}
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
          + New Set
        </div>
      )}
    </div>
  );
}
