export default function Tile({ tile, onClick, selected, onDragStart, onDragOver, onDrop }) {
  if (!tile) return null;
  
  const isJoker = tile.isJoker;
  const colorClass = tile.color ? tile.color : 'joker';
  
  return (
    <div 
      className={`tile ${colorClass}`} 
      onClick={(e) => {
        e.stopPropagation();
        if (onClick) onClick(e, tile);
      }}
      draggable={!!onDragStart}
      onDragStart={(e) => onDragStart && onDragStart(e, tile)}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop && onDrop(e, tile)}
      style={{
        border: selected ? '2px solid var(--primary)' : '1px solid var(--tile-border)',
        transform: selected ? 'translateY(-5px)' : 'none'
      }}
    >
      {isJoker ? '☻' : tile.number}
    </div>
  );
}
