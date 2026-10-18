# litegraph.js

Upstream: jagenjo/litegraph.js 0.7.18, MIT license.

Vendored files:

- `build/litegraph.core.js` → `litegraph.js`
- `css/litegraph.css` → `litegraph.css`
- `src/litegraph.d.ts` → `litegraph.d.ts` (unchanged)

Local patches:

- `LGraphCanvas.prototype.showEditPropertyValue` calls `graph.onNodePropertyChanged` in `setValue` so property edits update the unsaved state and undo history.
- `ContextMenu` omits the wheel handler and listeners so the menu scrolls natively instead of moving across the window.
- `.litegraph.litecontextmenu` sets `max-height: calc(100vh - 20px); overflow-y: auto;` so long menus scroll inside the window.

To upgrade: replace the three files, re-apply the patches, run `npm test`; snapshots must not change.
