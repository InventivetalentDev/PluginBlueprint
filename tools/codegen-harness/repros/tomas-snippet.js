// Re-implements graph.html serializeSnippet/configureSnippet logic (minus canvas offsets)
// to see what a partial-selection snippet does on import + codegen.
const path = require("path");
const REPO = path.resolve(__dirname, "../../..");
const realLog = console.log; console.log = () => {}; console.warn = () => {};
const LG = require(REPO + "/assets/lib/litegraph/litegraph"); Object.assign(global, LG);
const {LiteGraph, LGraph} = LG;
const NodeGenerator = require(REPO + "/js/nodeGenerator");
const CodeGenerator = require(REPO + "/js/codeGenerator");
const fs = require("fs");
(async () => {
  await NodeGenerator.init();
  // source graph = the join-message example
  const src = new LGraph(); global.graph = src;
  const data = JSON.parse(fs.readFileSync(REPO + "/docs/examples/join-message.pbs", "utf8"));
  // import full example (same as configureSnippet)
  function configureSnippet(graph, data) {
    const newNodeIdMap = {}, newLinkIdMap = {};
    for (const n of data.nodes) { const newId = ++graph.last_node_id; newNodeIdMap[n.id] = newId; n.id = newId;
      const node = LiteGraph.createNode(n.type, n.title); if (!node) continue; node.id = newId; graph.add(node, true); }
    for (const l of data.links) { const newId = ++graph.last_link_id; newLinkIdMap[l.id] = newId;
      graph.links[newId] = {id: newId, origin_id: newNodeIdMap[l.oId], origin_slot: l.oSlot, target_id: newNodeIdMap[l.tId], target_slot: l.tSlot, type: l.type}; }
    for (const n of data.nodes) {
      if (n.inputs) for (const i of n.inputs) if (i.link) i.link = newLinkIdMap[i.link];
      if (n.outputs) for (const o of n.outputs) if (o.links) o.links = o.links.map(x => newLinkIdMap[x]);
      const node = graph.getNodeById(n.id); if (node) node.configure(n);
    }
  }
  configureSnippet(src, JSON.parse(JSON.stringify(data)));
  // select everything except the PlayerJoinEvent node, export like serializeSnippet
  const selected = src._nodes.filter(n => n.type !== "org.bukkit.event.player.PlayerJoinEvent");
  const ids = selected.map(n => n.id);
  const snip = {nodes: selected.map(n => LiteGraph.cloneObject(n.serialize())), links: [], groups: []};
  for (const k in src.links) { const l = src.links[k]; if (ids.indexOf(l.origin_id) >= 0 || ids.indexOf(l.target_id) >= 0)
    snip.links.push({id: l.id, oId: l.origin_id, oSlot: l.origin_slot, tId: l.target_id, tSlot: l.target_slot, type: l.type}); }
  const dangling = snip.links.filter(l => ids.indexOf(l.oId) < 0 || ids.indexOf(l.tId) < 0);
  realLog("exported links:", snip.links.length, "crossing the selection boundary:", dangling.length);
  const dst = new LGraph(); global.graph = dst;
  configureSnippet(dst, snip);
  const bad = Object.values(dst.links).filter(l => l && (l.origin_id === undefined || l.target_id === undefined));
  realLog("links in imported graph with undefined origin/target:", bad.length);
  try {
    const code = await Promise.race([CodeGenerator.generateClassCode(dst, {package: "t", debug: false}), new Promise(r => setTimeout(() => r("__TIMEOUT__"), 8000))]);
    realLog(code === "__TIMEOUT__" ? "generateClassCode never resolved (8s)" : "generated lines with 'undefined': " + code.split("\n").filter(l => l.includes("undefined")).join(" || "));
  } catch (e) { realLog("generateClassCode threw:", e.message); }
  process.exit(0);
})();
process.on("unhandledRejection", e => { realLog("unhandledRejection:", e && e.message); });
