const H = require("../harness");
const fs = require("fs");
const path = require("path");
const OUT = path.join(__dirname, "..", "out", "jonas");
fs.mkdirSync(OUT, {recursive: true});
const tests = {};

// 1. generic return: PersistentDataContainerView#get(...) RETURN -> ConsoleLog; and try String -> set(...) value (type C)
tests.generic = (g) => {
  const ev = H.add(g, "org.bukkit.event.player.PlayerJoinEvent");
  const gp = H.addOptOut(ev, "getPlayer");
  const pl = H.add(g, "org.bukkit.entity.Player");
  H.link(ev, "EXEC", pl, "EXEC"); H.link(ev, gp, pl, "REF");
  const gpdc = H.addOptOut(pl, "getPersistentDataContainer");
  const pdc = H.add(g, "org.bukkit.persistence.PersistentDataContainer");
  H.link(pl, "EXEC", pdc, "EXEC"); H.link(pl, gpdc, pdc, "REF");
  const getOut = H.addOptOut(pdc, "get(NamespacedKey, PersistentDataType<P, C>)");
  const get = H.add(g, "io.papermc.paper.persistence.PersistentDataContainerView#get(org.bukkit.NamespacedKey, org.bukkit.persistence.PersistentDataType<P, C>)");
  H.link(pdc, "EXEC", get, "EXEC"); H.link(pdc, getOut, get, "REF");
  const log = H.add(g, "native/ConsoleLog");
  H.link(get, "EXEC", log, "EXEC"); H.link(get, "RETURN", log, 1);
  // set(...) value
  const setOut = H.addOptOut(pdc, "set(NamespacedKey, PersistentDataType<P, C>, C)");
  const set = H.add(g, "org.bukkit.persistence.PersistentDataContainer#set(org.bukkit.NamespacedKey, org.bukkit.persistence.PersistentDataType<P, C>, C)");
  H.link(pdc, setOut, set, "REF");
  const str = H.add(g, "constants/StringConstant", {string: "hello"});
  try { H.link(str, 0, set, "value"); H.log("generic: String -> set(value:C) ACCEPTED"); } catch (e) { H.log("generic: " + e.message); }
};

// 2. enum node getter + instance method on enum constant
tests.enumgetter = (g) => {
  const ev = H.add(g, "org.bukkit.event.player.PlayerJoinEvent");
  const mat = H.add(g, "org.bukkit.Material");
  const o = H.addOptOut(mat, "getMaxStackSize");
  const log = H.add(g, "native/ConsoleLog");
  H.link(ev, "EXEC", log, "EXEC"); H.link(mat, o, log, 1);
};
tests.enummethod = (g) => {
  const ev = H.add(g, "org.bukkit.event.player.PlayerJoinEvent");
  const mat = H.add(g, "org.bukkit.Material");
  const o = H.addOptOut(mat, "createBlockData(String)");
  const m = H.add(g, "org.bukkit.Material#createBlockData(java.lang.String)");
  H.link(ev, "EXEC", m, "EXEC"); H.link(mat, o, m, "REF");
  const s = H.add(g, "constants/StringConstant", {string: "[waterlogged=true]"});
  H.link(s, 0, m, "data");
};

// 3. onTabComplete abstract node
tests.tabcomplete = (g) => {
  const jp = H.add(g, "org.bukkit.plugin.java.JavaPlugin");
  const o = H.addOptOut(jp, "onTabComplete(CommandSender, Command, String, String[])");
  const t = H.add(g, "org.bukkit.plugin.java.JavaPlugin{" + jp.outputs[o].methodSignature + "}");
  H.link(jp, o, t, "REF");
  const log = H.add(g, "native/ConsoleLog");
  H.link(t, "EXEC", log, "EXEC"); H.link(t, "alias", log, 1);
};

// 4. JavaPlugin regular methods: saveDefaultConfig() and getCommand(String) RETURN
tests.javaplugin = (g) => {
  const jp = H.add(g, "org.bukkit.plugin.java.JavaPlugin");
  const oe = H.addOptOut(jp, "onEnable()");
  const en = H.add(g, "org.bukkit.plugin.java.JavaPlugin{onEnable()}");
  H.link(jp, oe, en, "REF");
  const o = H.addOptOut(jp, "saveDefaultConfig()");
  const m = H.add(g, "org.bukkit.plugin.java.JavaPlugin#saveDefaultConfig()");
  H.link(jp, o, m, "REF"); H.link(en, "EXEC", m, "EXEC");
};
tests.javaplugin2 = (g) => {
  const jp = H.add(g, "org.bukkit.plugin.java.JavaPlugin");
  const oe = H.addOptOut(jp, "onEnable()");
  const en = H.add(g, "org.bukkit.plugin.java.JavaPlugin{onEnable()}");
  H.link(jp, oe, en, "REF");
  const o = H.addOptOut(jp, "getCommand(String)");
  const m = H.add(g, "org.bukkit.plugin.java.JavaPlugin#getCommand(java.lang.String)");
  H.link(jp, o, m, "REF"); H.link(en, "EXEC", m, "EXEC");
  const s = H.add(g, "constants/StringConstant", {string: "hello"}); H.link(s, 0, m, "name");
  const log = H.add(g, "native/ConsoleLog"); H.link(m, "EXEC", log, "EXEC"); H.link(m, "RETURN", log, 1);
};

// 5. checked exception: FileConfiguration#save(File)
tests.checked = (g) => {
  const jp = H.add(g, "org.bukkit.plugin.java.JavaPlugin");
  const oe = H.addOptOut(jp, "onDisable()");
  const dis = H.add(g, "org.bukkit.plugin.java.JavaPlugin{onDisable()}");
  H.link(jp, oe, dis, "REF");
  const gc = H.addOptOut(jp, "getConfig"); const df = H.addOptOut(jp, "getDataFolder");
  const fc = H.add(g, "org.bukkit.configuration.file.FileConfiguration");
  H.link(dis, "EXEC", fc, "EXEC"); H.link(jp, gc, fc, "REF");
  const so = H.addOptOut(fc, "save(File)");
  const m = H.add(g, "org.bukkit.configuration.file.FileConfiguration#save(java.io.File)");
  H.link(fc, "EXEC", m, "EXEC"); H.link(fc, so, m, "REF"); H.link(jp, df, m, "file");
};

// 6. overloaded method with unconnected reference param -> null literal
tests.ambiguous = (g) => {
  const ev = H.add(g, "org.bukkit.event.player.PlayerJoinEvent");
  const gp = H.addOptOut(ev, "getPlayer");
  const pl = H.add(g, "org.bukkit.entity.Player");
  H.link(ev, "EXEC", pl, "EXEC"); H.link(ev, gp, pl, "REF");
  const o = H.addOptOut(pl, "sendMessage(Component)");
  const m = H.add(g, "org.bukkit.command.CommandSender#sendMessage(net.kyori.adventure.text.Component)");
  H.link(pl, "EXEC", m, "EXEC"); H.link(pl, o, m, "REF");
};
// 7. primitive array param unconnected
tests.bytearray = (g) => {
  const ev = H.add(g, "org.bukkit.event.player.PlayerJoinEvent");
  const gp = H.addOptOut(ev, "getPlayer");
  const pl = H.add(g, "org.bukkit.entity.Player");
  H.link(ev, "EXEC", pl, "EXEC"); H.link(ev, gp, pl, "REF");
  const name = pl.optional_outputs.map(o=>o[0]).find(n => n.startsWith("sendPluginMessage("));
  const o = H.addOptOut(pl, name);
  const m = H.add(g, pl.outputs[o].type);
  H.link(pl, "EXEC", m, "EXEC"); H.link(pl, o, m, "REF");
};

// 8. Folia-style Consumer<ScheduledTask>
tests.folia = (g) => {
  const jp = H.add(g, "org.bukkit.plugin.java.JavaPlugin");
  const oe = H.addOptOut(jp, "onEnable()");
  const en = H.add(g, "org.bukkit.plugin.java.JavaPlugin{onEnable()}");
  H.link(jp, oe, en, "REF");
  const gs = H.addOptOut(jp, "getServer");
  const srv = H.add(g, "org.bukkit.Server");
  H.link(en, "EXEC", srv, "EXEC"); H.link(jp, gs, srv, "REF");
  const gg = H.addOptOut(srv, "getGlobalRegionScheduler");
  const grs = H.add(g, "io.papermc.paper.threadedregions.scheduler.GlobalRegionScheduler");
  H.link(srv, "EXEC", grs, "EXEC"); H.link(srv, gg, grs, "REF");
  const ro = H.addOptOut(grs, "runAtFixedRate(Plugin, Consumer<ScheduledTask>, long, long)");
  const run = H.add(g, grs.outputs[ro].type);
  H.link(grs, ro, run, "REF");
  const cons = H.add(g, "java.util.function.Consumer#Consumer()");
  H.link(grs, "EXEC", cons, "EXEC"); H.link(cons, "EXEC", run, "EXEC");
  H.link(cons, "THIS", run, "task");
  H.link(jp, "THIS", run, "plugin");
  const d = H.add(g, "constants/NumberConstant", {type: "long", number: 1}); H.link(d, 0, run, "initialDelayTicks");
  const p = H.add(g, "constants/NumberConstant", {type: "long", number: 20}); H.link(p, 0, run, "periodTicks");
  const acc = H.add(g, "java.util.function.Consumer{accept(T)}");
  H.link(cons, "accept(T)", acc, "REF");
  H.log("folia: accept output types:", acc.outputs.map(o=>o.name+":"+o.type).join(", "));
  const st = H.add(g, "io.papermc.paper.threadedregions.scheduler.ScheduledTask");
  try { H.link(acc, "t", st, "REF"); H.log("folia: Object t -> ScheduledTask REF ACCEPTED"); } catch (e) { H.log("folia: " + e.message); }
  const log = H.add(g, "native/ConsoleLog"); H.link(acc, "EXEC", log, "EXEC"); H.link(acc, "t", log, 1);
};

// 9. native nodes: Get variable, duplicate Set, StringFormat w/o variable, Switch w/o condition, FlipFlop
tests.getvar = (g) => {
  const ev = H.add(g, "org.bukkit.event.player.PlayerJoinEvent");
  const s = H.add(g, "variables/Set", {name: "greeting", type: "string"});
  const c = H.add(g, "constants/StringConstant", {string: "hi"});
  H.link(ev, "EXEC", s, "EXEC"); H.link(c, 0, s, 1);
  const gv = H.add(g, "variables/Get", {name: "greeting", type: "string"});
  const ev2 = H.add(g, "org.bukkit.event.player.PlayerQuitEvent");
  const log = H.add(g, "native/ConsoleLog"); H.link(ev2, "EXEC", log, "EXEC"); H.link(gv, 0, log, 1);
  H.log("getvar: Set outputs = " + JSON.stringify((s.outputs||[]).map(o=>o.name)) + ", Get inputs = " + JSON.stringify((gv.inputs||[]).map(o=>o.name)));
};
tests.dupset = (g) => {
  const ev = H.add(g, "org.bukkit.event.player.PlayerJoinEvent");
  const ev2 = H.add(g, "org.bukkit.event.player.PlayerQuitEvent");
  const c = H.add(g, "constants/StringConstant", {string: "hi"});
  const s1 = H.add(g, "variables/Set", {name: "last", type: "string"});
  const s2 = H.add(g, "variables/Set", {name: "last", type: "string"});
  H.link(ev, "EXEC", s1, "EXEC"); H.link(c, 0, s1, 1);
  H.link(ev2, "EXEC", s2, "EXEC"); H.link(c, 0, s2, 1);
};
tests.strformat = (g) => {
  const ev = H.add(g, "org.bukkit.event.player.PlayerJoinEvent");
  const f = H.add(g, "native/StringFormat");
  const c = H.add(g, "constants/StringConstant", {string: "Welcome!"});
  H.link(ev, "EXEC", f, "EXEC"); H.link(c, 0, f, "Format");
};
tests.switchnocond = (g) => {
  const ev = H.add(g, "org.bukkit.event.player.PlayerJoinEvent");
  const sw = H.add(g, "flow/Switch");
  H.link(ev, "EXEC", sw, "EXEC");
};
tests.flipflop = (g) => {
  const ev = H.add(g, "org.bukkit.event.player.PlayerJoinEvent");
  const ff = H.add(g, "flow/FlipFlop");
  const la = H.add(g, "native/ConsoleLog"); const lb = H.add(g, "native/ConsoleLog");
  const ca = H.add(g, "constants/StringConstant", {string: "A"}); const cb = H.add(g, "constants/StringConstant", {string: "B"});
  H.link(ev, "EXEC", ff, "EXEC"); H.link(ff, "A", la, "EXEC"); H.link(ff, "B", lb, "EXEC"); H.link(ca, 0, la, 1); H.link(cb, 0, lb, 1);
};
// 10. async chat event + Adventure ClickEvent "event" + abstract PlayerEvent
tests.asyncchat = (g) => {
  const ev = H.add(g, "io.papermc.paper.event.player.AsyncChatEvent");
  const so = H.addOptOut(ev, "setCancelled(boolean)");
  const m = H.add(g, ev.outputs[so].type);
  H.link(ev, "EXEC", m, "EXEC"); H.link(ev, so, m, "REF");
  const b = H.add(g, "constants/BooleanConstant", {value: true}); H.link(b, 0, m, 1 + 0 + 1);
};
tests.clickevent = (g) => {
  const ev = H.add(g, "net.kyori.adventure.text.event.ClickEvent");
  const pe = H.add(g, "org.bukkit.event.player.PlayerEvent");
  const log = H.add(g, "native/ConsoleLog"); H.link(ev, "EXEC", log, "EXEC");
  const log2 = H.add(g, "native/ConsoleLog"); H.link(pe, "EXEC", log2, "EXEC");
};
// 11. Equal relational on strings? (types only numeric) and Cast without input
tests.castnoinput = (g) => {
  const ev = H.add(g, "org.bukkit.event.player.PlayerJoinEvent");
  const c = H.add(g, "native/Cast", {castTo: "org.bukkit.entity.Player"});
  H.link(ev, "EXEC", c, "EXEC");
};

(async () => {
  const only = process.argv.slice(2);
  for (const name of Object.keys(tests)) {
    if (only.length && !only.includes(name)) continue;
    const g = await H.setup();
    try { tests[name](g); } catch (e) { H.log(name + " BUILD ERROR: " + e.message); continue; }
    const code = await H.gen(g, false);
    const dir = path.join(OUT, name, "my/awesome/plugin"); fs.mkdirSync(dir, {recursive: true});
    fs.writeFileSync(path.join(dir, "GeneratedPlugin.java"), code);
    H.log(name + ": generated " + code.split("\n").length + " lines");
  }
})().catch(e => H.log("ERR", e.stack));
