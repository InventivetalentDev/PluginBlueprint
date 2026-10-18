const H = require("../../../test/support/harness");
const fs = require("fs"); const path = require("path");
const OUT = path.join(__dirname, "..", "out", "jonas");
const tests = {};
// BasicCommand via JavaPlugin#registerCommand (the modern non-Brigadier-tree path)
tests.basiccommand = (g) => {
  const jp = H.add(g, "org.bukkit.plugin.java.JavaPlugin");
  const oe = H.addOptOut(jp, "onEnable()");
  const en = H.add(g, "org.bukkit.plugin.java.JavaPlugin{onEnable()}"); H.link(jp, oe, en, "REF");
  const bc = H.add(g, "io.papermc.paper.command.brigadier.BasicCommand#BasicCommand()");
  H.link(en, "EXEC", bc, "EXEC");
  const ro = H.addOptOut(jp, "registerCommand(String, BasicCommand)");
  const reg = H.add(g, jp.outputs[ro].type); H.link(jp, ro, reg, "REF");
  H.link(bc, "EXEC", reg, "EXEC"); H.link(bc, "THIS", reg, "basicCommand");
  const s = H.add(g, "constants/StringConstant", {string: "hello"}); H.link(s, 0, reg, "label");
  const ex = H.add(g, "io.papermc.paper.command.brigadier.BasicCommand{execute(io.papermc.paper.command.brigadier.CommandSourceStack, java.lang.String[])}");
  H.link(bc, bc.outputs.findIndex(o => o.name.startsWith("execute(")), ex, "REF");
  const log = H.add(g, "native/ConsoleLog"); H.link(ex, "EXEC", log, "EXEC"); H.link(ex, "args", log, 1);
};
// MiniMessage.miniMessage().deserialize(String, TagResolver...) with no resolvers wired
tests.minimessage = (g) => {
  const ev = H.add(g, "org.bukkit.event.player.PlayerJoinEvent");
  const mmStatic = H.add(g, "net.kyori.adventure.text.minimessage.MiniMessage#miniMessage()");
  H.link(ev, "EXEC", mmStatic, "EXEC");
  const mm = H.add(g, "net.kyori.adventure.text.minimessage.MiniMessage");
  H.link(mmStatic, "EXEC", mm, "EXEC"); H.link(mmStatic, "RETURN", mm, "REF");
  const dO = H.addOptOut(mm, "deserialize(String, TagResolver...)");
  const de = H.add(g, mm.outputs[dO].type); H.link(mm, dO, de, "REF"); H.link(mm, "EXEC", de, "EXEC");
  const s = H.add(g, "constants/StringConstant", {string: "<red>hi"}); H.link(s, 0, de, 1 + 1);
};
// Component.text(String) static -> Player#sendMessage(Component): the happy path
tests.componenttext = (g) => {
  const ev = H.add(g, "org.bukkit.event.player.PlayerJoinEvent");
  const gp = H.addOptOut(ev, "getPlayer");
  const pl = H.add(g, "org.bukkit.entity.Player"); H.link(ev, "EXEC", pl, "EXEC"); H.link(ev, gp, pl, "REF");
  const t = H.add(g, "net.kyori.adventure.text.Component#text(java.lang.String)");
  H.link(pl, "EXEC", t, "EXEC");
  const s = H.add(g, "constants/StringConstant", {string: "hi"}); H.link(s, 0, t, "content");
  const so = H.addOptOut(pl, "sendMessage(Component)");
  const sm = H.add(g, pl.outputs[so].type); H.link(pl, so, sm, "REF"); H.link(t, "EXEC", sm, "EXEC");
  try { H.link(t, "RETURN", sm, "message"); H.log("TextComponent -> Component: ok"); } catch (e) { H.log("componenttext: " + e.message.slice(0, 200)); }
};
(async () => {
  for (const name of Object.keys(tests)) {
    const g = await H.setup();
    try { tests[name](g); } catch (e) { H.log(name + " BUILD ERROR: " + e.message); continue; }
    const code = await H.gen(g, false);
    const dir = path.join(OUT, name, "my/awesome/plugin"); fs.mkdirSync(dir, {recursive: true});
    fs.writeFileSync(path.join(dir, "GeneratedPlugin.java"), code);
    H.log(name + ": generated");
  }
})().catch(e => H.log("ERR", e.stack));
