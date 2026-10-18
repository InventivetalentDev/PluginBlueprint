# litegraph.js

Upstream: jagenjo/litegraph.js 0.7.18, MIT license.

Vendored files:

- `build/litegraph.core.js` → `litegraph.js`
- `css/litegraph.css` → `litegraph.css`
- `src/litegraph.d.ts` → `litegraph.d.ts` (unchanged)

Local patches:

- `LGraphCanvas.prototype.showEditPropertyValue` calls `graph.onNodePropertyChanged` in `setValue` so property edits update the unsaved state and undo history.
- `LGraphCanvas.onShowPropertyEditor` calls `graph.afterChange(node)` after setting a title or group property so the editor can record undo history.
- `LGraph.add` and `LGraph.remove` call `afterChange(group)` after adding or removing a group so group membership is undoable.
- `LGraphCanvas.processMouseUp` calls `graph.afterChange(group)` after a group move or resize ends so each drag records one undo step.
- `LGraphCanvas.processMouseUp` skips node snapping and group rounding when the pointer stays at its press position so a plain click preserves off-grid positions.
- `ContextMenu` omits the wheel handler and listeners so the menu scrolls natively instead of moving across the window.
- `.litegraph.litecontextmenu` sets `max-height: calc(100vh - 20px); overflow-y: auto;` so long menus scroll inside the window.

To upgrade: replace the three files, re-apply the patches, run `npm test`; snapshots must not change.
