import Tile from './Tile';

export default function TileSet({
  set,
  setIdx,
  selectedTiles,
  isMyTurn,
  onSetClick,
  onTileClick,
  onDragStart,
  onDragOver,
  onDropOnSet,
  onDropOnTile,
  onDropInGap,
  onSplitSet
}) {
  const isSelectedForTarget = selectedTiles.length > 0 && isMyTurn;

  return (
    <div 
      className="tile-set"
      onClick={(e) => { 
        e.stopPropagation(); 
        onSetClick(setIdx); 
      }}
      onDragOver={onDragOver}
      onDrop={(e) => onDropOnSet(e, setIdx)}
      style={{ 
        cursor: isSelectedForTarget ? 'copy' : 'default',
        border: isSelectedForTarget ? '1px dashed var(--primary)' : '1px solid transparent',
        display: 'flex', alignItems: 'center',
        padding: '16px 24px',
        margin: '4px',
        minHeight: '60px',
        minWidth: '60px',
        background: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '12px'
      }}
    >
      {set.map((tile, tIdx) => (
        <div key={tile.id} style={{ display: 'flex', alignItems: 'center' }}>
          <Tile 
            tile={tile} 
            selected={!!selectedTiles.find(t => t.id === tile.id)}
            onClick={(e) => onTileClick(e, tile, 'board', setIdx)} 
            onDragStart={(e) => onDragStart(e, tile, 'board', setIdx)}
            onDragOver={onDragOver}
            onDrop={(e) => onDropOnTile(e, tile, 'board', setIdx)}
          />
          {tIdx < set.length - 1 && isMyTurn && (
            <div 
              className="tile-gap"
              onClick={(e) => onSplitSet(e, setIdx, tIdx)}
              onDragOver={onDragOver}
              onDrop={(e) => onDropInGap(e, setIdx, tIdx)}
              title="Click to split, drop here to insert"
            />
          )}
        </div>
      ))}
    </div>
  );
}
