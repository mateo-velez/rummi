import { useEffect, useRef } from 'react';
import { sortRackTiles } from '../utils/gameUtils';

/**
 * Custom hook to enforce rack auto-sorting preference (Rule #4)
 */
export function useRackSort(gameState, socket, rackSortType, syncRackLocal) {
  const currentRack = gameState?.racks?.[socket.id];
  const rackTileIds = currentRack ? JSON.stringify(currentRack.map(t => t.id)) : '';
  const syncRef = useRef(syncRackLocal);

  useEffect(() => {
    syncRef.current = syncRackLocal;
  });

  useEffect(() => {
    if (!rackSortType || !currentRack || currentRack.length === 0) return;

    const sorted = sortRackTiles(currentRack, rackSortType);
    const sortedTileIds = JSON.stringify(sorted.map(t => t.id));

    // Only sync if order changed to prevent infinite loops
    if (rackTileIds !== sortedTileIds) {
      syncRef.current(sorted);
    }
  }, [rackTileIds, currentRack, rackSortType]);
}
