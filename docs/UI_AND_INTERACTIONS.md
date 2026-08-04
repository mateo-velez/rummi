# UI & Interaction Patterns

This document documents the user interface design, visual layout, tile interaction models (Click-to-Move and Drag & Drop), auto-sorting mechanics, and set splitting features in Rummi.

---

## 1. Interaction Models

Rummi supports dual interaction paradigms: **Click-to-Move** and **Drag & Drop**.

### Click-to-Move (Primary & Mobile-Friendly)

1. **Tile Selection**:
   - Clicking a tile toggles its selection state (glowing outline).
   - Multi-tile selection is supported within the same source (rack or set).
   - Clicking a selected tile toggles it off.
2. **Move Execution**:
   - **Add to Existing Set**: Click one or more selected tiles -> Click any tile set on the board -> Selected tiles are appended to that set and auto-sorted.
   - **Create New Set**: Click one or more selected tiles -> Click any empty board background area (or the "+ New Set" button) -> A new set is created with the selected tiles.
   - **Single Tile Swap (Within Same Region Only)**:
     - Rack-to-Rack: Clicking single rack tile A then rack tile B swaps their positions.
     - Set-to-Set: Clicking single set tile A then set tile B swaps their positions.
     - **Rack ↔ Board Swaps Disabled**: Selecting a tile from the rack and clicking a board tile will add the rack tile to the set rather than swapping places.

---

### Drag & Drop (Direct Manipulation)

1. **Dragging Tiles**:
   - Dragging a tile from rack to a board set appends it to that set.
   - Dragging a tile to an empty board region creates a new set.
2. **Gap Insertion**:
   - Hovering between two tiles in a run reveals a `tile-gap` insertion dropzone.
   - Dropping a tile directly onto the gap inserts the tile precisely into that position in the run.
3. **Manual Rack Reordering**:
   - Dragging a tile over another tile inside your rack swaps their positions.

---

## 2. Set Splitting Mechanics

- On any board set containing 2 or more tiles, hovering between tiles reveals a `tile-gap` line.
- **Clicking the gap**: Instantly splits the set into two independent sets at that index:
  ```
  Original Set: [Red 1, Red 2, Red 3, Red 4, Red 5]
  Click gap after Red 3 ->
  Set A: [Red 1, Red 2, Red 3]
  Set B: [Red 4, Red 5]
  ```

---

## 3. Auto-Sorting & Rack Preference Persistence

- **Rack Sort Controls**: Buttons in the rack header allow sorting by `123` (Number) or `Color`.
- **Sort Logic**:
  - `By 123`: Primary sort by tile number (1-13), secondary by color. Jokers placed at the end.
  - `By Color`: Primary sort by color (`black`, `blue`, `red`, `orange`), secondary by number. Jokers placed at the end.
- **Persistence**:
  - `rackSortType` is remembered in state.
  - When drawing tiles or ending turns, incoming rack updates are automatically re-sorted to match `rackSortType`.
  - Performing manual drag-and-drop tile reordering inside the rack sets `rackSortType = null` to respect user's manual arrangement.

---

## 4. Visual Aesthetics & Design System

- **Glassmorphism**: Backdrop blur (`backdrop-filter: blur(12px)`), subtle translucent surfaces, translucent borders.
- **Distinct Colors**: Modern HSL-tuned color palette for tiles (`black`, `#2563eb` blue, `#dc2626` red, `#f97316` orange).
- **Responsive Layout**: Top header (room info, timer, react), flexible multi-row board area, and bottom rack with integrated turn control action bar.
