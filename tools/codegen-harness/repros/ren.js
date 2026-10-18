// Drive the real nodeGenerator + codeGenerator from the repo in plain Node (read-only use of repo files).
const REPO = require("path").resolve(__dirname, "../../.."); const R = REPO + "/out/lib/";
const {LiteGraph, LGraph} = require(REPO + "/assets/lib/litegraph/litegraph");
Object.assign(global, require(REPO + "/assets/lib/litegraph/litegraph"));
console.log = () => {}; console.warn = () => {}; console.info = () => {};
const out = (...a) => process.stdout.write(a.join(" ") + "\n");
const nodeGen = require(R + "nodeGenerator");
const codeGen = require(R + "codeGenerator");
const fs = require("fs");

function addOpt(node, name) {
  const o = (node.optional_outputs || []).find(x => x[0] === name);
  if (!o) throw new Error("no optional output " + name + " on " + node.type);
  node.addOutput(o[0], o[1], Object.assign({}, o[2]));
  return node.outputs.length - 1;
}
function idx(node, name, dir = "outputs") { return node[dir].findIndex(s => s.name === name); }

async function scenario(name, build) {
  const g = new LGraph(); global.graph = g;
  build(g);
  const code = await codeGen.generateClassCode(g, {package: "t." + name, debug: true});
  const dir = process.argv[2] + "/" + name + "/t/" + name;
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(dir + "/GeneratedPlugin.java", code);
  out("wrote", name);
}

nodeGen.init().then(async () => {
  // A: Variable Get feeding ConsoleLog inside a PlayerJoinEvent handler
  await scenario("getvar", g => {
    const ev = LiteGraph.createNode(nodeGen.getOrCreateBukkitClassNode("org.bukkit.event.player.PlayerJoinEvent")); g.add(ev);
    const set = LiteGraph.createNode("variables/Set"); set.properties.name = "greeting"; g.add(set);
    const get = LiteGraph.createNode("variables/Get"); get.properties.name = "greeting"; g.add(get);
    const log = LiteGraph.createNode("native/ConsoleLog"); g.add(log);
    ev.connect(idx(ev, "EXEC"), log, 0);
    get.connect(0, log, 1);
  });
  // B: Cast node with free-text castTo used to inject a static initializer + statement
  await scenario("inject", g => {
    const ev = LiteGraph.createNode(nodeGen.getOrCreateBukkitClassNode("org.bukkit.event.player.PlayerJoinEvent")); g.add(ev);
    const get = LiteGraph.createNode("variables/Get");
    get.properties.name = "null; } private java.lang.Object node_3_output_0; static { java.lang.System.out.println(\"INJECTED at class load\"); } private void pbPad() { java.lang.Object z = null"; g.add(get);
    const log = LiteGraph.createNode("native/ConsoleLog"); g.add(log);
    ev.connect(idx(ev, "EXEC"), log, 0); get.connect(0, log, 1);
  });
  // C: abstract PlayerEvent as an event node (offered in the Event menu)
  await scenario("abstractevent", g => {
    const ev = LiteGraph.createNode(nodeGen.getOrCreateBukkitClassNode("org.bukkit.event.player.PlayerEvent")); g.add(ev);
    const log = LiteGraph.createNode("native/ConsoleLog"); g.add(log);
    ev.connect(idx(ev, "EXEC"), log, 0);
  });
  // D: Adventure ClickEvent (offered in the Event menu because the name ends in "Event")
  await scenario("clickevent", g => {
    const ev = LiteGraph.createNode(nodeGen.getOrCreateBukkitClassNode("net.kyori.adventure.text.event.ClickEvent")); g.add(ev);
    const log = LiteGraph.createNode("native/ConsoleLog"); g.add(log);
    ev.connect(idx(ev, "EXEC"), log, 0);
  });
  // E: AsyncChatEvent -> message() -> ConsoleLog (shared-field race demo)
  await scenario("asyncchat", g => {
    const ev = LiteGraph.createNode(nodeGen.getOrCreateBukkitClassNode("io.papermc.paper.event.player.AsyncChatEvent")); g.add(ev);
    const p = addOpt(ev, "getPlayer");
    const log = LiteGraph.createNode("native/ConsoleLog"); g.add(log);
    ev.connect(idx(ev, "EXEC"), log, 0); ev.connect(p, log, 1);
  });
  // G: static generic method returning a type variable (T)
  await scenario("typevar", g => {
    const ev = LiteGraph.createNode(nodeGen.getOrCreateBukkitClassNode("org.bukkit.event.player.PlayerJoinEvent")); g.add(ev);
    const m = LiteGraph.createNode(nodeGen.getOrCreateBukkitMethodNode("org.bukkit.Bukkit", "getBanList(io.papermc.paper.ban.BanListType<B>)")); g.add(m);
    const log = LiteGraph.createNode("native/ConsoleLog"); g.add(log);
    ev.connect(idx(ev, "EXEC"), m, 0);
    m.connect(idx(m, "EXEC"), log, 0);
    m.connect(idx(m, "RETURN"), log, 1);
  });
  // H: NumberConstant whose "number" property (a string in the saved JSON) carries class-level code; no node-id dependency
  await scenario("numinject", g => {
    const ev = LiteGraph.createNode(nodeGen.getOrCreateBukkitClassNode("org.bukkit.event.player.PlayerJoinEvent")); g.add(ev);
    const num = LiteGraph.createNode("constants/NumberConstant"); g.add(num);
    num.configure({id: num.id, type: "constants/NumberConstant", properties: {type: "int", number: "0; static { java.lang.System.out.println(\"INJECTED via NumberConstant\"); } private int pbX = 0"}, outputs: num.outputs});
    const log = LiteGraph.createNode("native/ConsoleLog"); g.add(log);
    ev.connect(idx(ev, "EXEC"), log, 0); num.connect(0, log, 1);
  });
  // F: second compile in same session reuses module-level arrays (check reset)
  await scenario("second", g => {
    const ev = LiteGraph.createNode(nodeGen.getOrCreateBukkitClassNode("org.bukkit.event.player.PlayerQuitEvent")); g.add(ev);
  });
}).catch(e => { process.stderr.write(String(e.stack || e) + "\n"); process.exit(1); });
