import Tile from './Tile';
import GameControls from './GameControls';

export default function Rack({
  myRack,
  selectedTiles,
  isMyTurn,
  hasMoveHistory,
  onSortRack,
  onClearSelection,
  onUndoMove,
  onSortBoard,
  onDrawTile,
  onRevertTurn,
  onEndTurn,
  onTileClick,
  onDragStart,
  onDragOver,
  onDropOnTile
}) {
  return (
    <div className="glass" style={{ display: 'flex', flexDirection: 'column' }}>
      <GameControls
        isMyTurn={isMyTurn}
        selectedTilesCount={selectedTiles.length}
        hasMoveHistory={hasMoveHistory}
        onSortRack={onSortRack}
        onClearSelection={onClearSelection}
        onUndoMove={onUndoMove}
        onSortBoard={onSortBoard}
        onDrawTile={onDrawTile}
        onRevertTurn={onRevertTurn}
        onEndTurn={onEndTurn}
      />
      <div 
        className="rack-area" 
        style={{ flexWrap: 'wrap', height: 'auto', minHeight: '120px' }}
        onDragOver={onDragOver}
      >
        {myRack.map(tile => (
          <Tile 
            key={tile.id} 
            tile={tile} 
            selected={!!selectedTiles.find(t => t.id === tile.id)}
            onClick={(e) => onTileClick(e, tile, 'rack')} 
            onDragStart={(e) => onDragStart(e, tile, 'rack')}
            onDragOver={onDragOver}
            onDrop={(e) => onDropOnTile(e, tile, 'rack')}
          />
        ))}
      </div>
    </div>
  );
}
