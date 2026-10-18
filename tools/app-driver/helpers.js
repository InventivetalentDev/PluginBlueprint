window.H = {
  add(type, x, y) { const n = LiteGraph.createNode(type); if (!n) throw new Error("no node type " + type); n.pos = [x, y]; graph.add(n); return n; },
  out(n, name) {
    let i = n.outputs ? n.outputs.findIndex(o => o.name === name) : -1;
    if (i >= 0) return i;
    const o = (n.optional_outputs || []).find(o => o[0] === name);
    if (!o) throw new Error(n.type + " has no output " + name + "; options: " + (n.optional_outputs || []).map(o => o[0]).join("|"));
    n.addOutput(o[0], o[1], o[2]); return n.outputs.length - 1;
  },
  inp(n, name) {
    let i = n.inputs ? n.inputs.findIndex(o => o.name === name) : -1;
    if (i >= 0) return i;
    const o = (n.optional_inputs || []).find(o => o[0] === name);
    if (!o) throw new Error(n.type + " has no input " + name + "; inputs: " + (n.inputs||[]).map(i=>i.name).join("|"));
    n.addInput(o[0], o[1], o[2]); return n.inputs.length - 1;
  },
  link(a, aOut, b, bIn) { const r = a.connect(H.out(a, aOut), b, H.inp(b, bIn)); if (!r) throw new Error("link failed " + a.type + "." + aOut + " -> " + b.type + "." + bIn); return r; },
  dbl(n, name) { const before = new Set(graph._nodes.map(x => x.id)); n.onOutputDblClick(H.out(n, name), {canvasX: n.pos[0] + 300, canvasY: n.pos[1]}); return graph._nodes.find(x => !before.has(x.id)); },
  clear() { graph.clear(); },
  summary() { return graph._nodes.map(n => n.id + " " + n.type + " in[" + (n.inputs||[]).map(i => i.name + (i.link != null ? "*" : "")).join(",") + "] out[" + (n.outputs||[]).map(o => o.name + ((o.links||[]).length ? "*" : "")).join(",") + "]"); }
};
"helpers loaded";
H.fit = function (pad = 60) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const n of graph._nodes) {
    x0 = Math.min(x0, n.pos[0]); y0 = Math.min(y0, n.pos[1] - LiteGraph.NODE_TITLE_HEIGHT);
    x1 = Math.max(x1, n.pos[0] + n.size[0]); y1 = Math.max(y1, n.pos[1] + n.size[1]);
  }
  const w = canvas.canvas.width, h = canvas.canvas.height;
  const s = Math.min(1, (w - 2 * pad) / (x1 - x0), (h - 2 * pad) / (y1 - y0));
  canvas.scale = s;
  canvas.offset[0] = (w / s - (x1 - x0)) / 2 - x0;
  canvas.offset[1] = (h / s - (y1 - y0)) / 2 - y0;
  canvas.deselectAllNodes();
  canvas.setDirty(true, true); canvas.draw(true, true);
  return {s, box: [x0, y0, x1, y1]};
};
H.snippet = function () { canvas.selectNodes(graph._nodes); const s = JSON.stringify(serializeSnippet()); canvas.deselectAllNodes(); return s; };
"helpers v2";
H.rect = function (pad = 24) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const n of graph._nodes) {
    x0 = Math.min(x0, n.pos[0]); y0 = Math.min(y0, n.pos[1] - LiteGraph.NODE_TITLE_HEIGHT);
    x1 = Math.max(x1, n.pos[0] + n.size[0]); y1 = Math.max(y1, n.pos[1] + n.size[1]);
  }
  const r = canvas.canvas.getBoundingClientRect(), s = canvas.scale, o = canvas.offset;
  const sx = v => r.left + (v + o[0]) * s, sy = v => r.top + (v + o[1]) * s;
  return {x: Math.max(0, sx(x0) - pad), y: Math.max(r.top, sy(y0) - pad), width: (x1 - x0) * s + 2 * pad, height: (y1 - y0) * s + 2 * pad};
};
H.prop = function (n, k, v) { n.properties[k] = v; if (n.onPropertyChanged) n.onPropertyChanged(k, v); return n; };
"helpers v3";
H.after = function (prev, n, gap = 70, dy = 0) { n.pos = [prev.pos[0] + prev.size[0] + gap, prev.pos[1] + dy]; return n; };
H.below = function (ref, n, gap = 70, dx = 0) { n.pos = [ref.pos[0] + dx, ref.pos[1] + ref.size[1] + gap]; return n; };
"helpers v4";
H.leftOf = function (target, n, gap = 50, dy = 60) { n.pos = [target.pos[0] - n.size[0] - gap, target.pos[1] + dy]; return n; };
"helpers v5";
