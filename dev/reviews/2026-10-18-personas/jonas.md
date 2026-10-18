# Jonas Weber — experienced Paper plugin developer

> Written on 2026-10-18 against `codex/modernize` at `6700653`. Paths that start with `SP/` point to the review session's scratch folder, which no longer exists. The headless codegen scripts are now in `tools/codegen-harness/`, the app-driving scripts are in `tools/app-driver/`, the generated examples are in `evidence/`, and a selection of June's screenshots is in `images/`.

Jonas is 32 and maintains two public Paper plugins on Hangar and Modrinth, running on about 10k servers combined. They know Adventure/MiniMessage, lifecycle Brigadier commands, paper-plugin.yml, Folia schedulers, PDC, registries and data components well. They are testing PluginBlueprint 2.0.0 (`codex/modernize`) for two jobs: quick prototypes, and a way for contributors who don't code to help.

## Walkthrough

Jonas reviewed the code only. They read `js/codeGenerator.js` end to end and most of `js/nodeGenerator.js`, `js/classDataStore.js`, `js/util.js` and `js/nodes/*.js`. They got both generators running headless in plain Node by stubbing `electron` with a `Module._load` override; litegraph loads without a DOM. That harness took about 10 minutes. With it they built 21 small test graphs through the real `nodeGenerator`/litegraph `connect()` path and compiled every result with javac against the evidence project's classpath (`--release 25`). Scripts and output are in `SP/p4/` (`harness.js`, `battery.js`, `battery2.js`, `gen/<test>/…/GeneratedPlugin.java`, `my.args`). SP = `SP`.

**1. The state model.** Every node output is a field of `GeneratedPlugin`. An event handler starts by writing the event into a field (`codeGenerator.js:171`, `code += nodeV(node.id) + " = event;\n"`). It then copies getters into more fields (`:201`) and calls `node_N_exec()` methods, which read those fields back. The evidence `block-protect.java` shows the pattern: `node_2 = event; node_2_output_2 = event.getPlayer(); node_3_exec();`, and later `node_2.setCancelled(node_6_output_0)` reads the field again. Jonas's concerns:

- **Re-entrancy.** Suppose an `EntityDamageByEntityEvent` graph calls `LivingEntity#damage(double, Entity)`. That fires a nested `EntityDamageByEntityEvent` synchronously, so `on2` runs again and `node_2` now holds the inner event. When control returns, the outer chain's `setCancelled`/`setDamage` act on the inner event, which has already finished. The same happens with `teleport` inside `PlayerTeleportEvent`, and so on.
- **Async.** 12 non-deprecated async events are offered, including `AsyncChatEvent` and `AsyncPlayerPreLoginEvent`. Paper fires them on pooled threads, concurrently for different players. The generated `on2(AsyncChatEvent)` (SP/p4/gen/asyncchat) does `node_2 = event; node_3_exec();` and `node_3` then reads `node_2` with no synchronization. Two chatting players can cancel or rewrite each other's messages. Async scheduler tasks share the same fields with sync handlers.
- **Leaks between invocations.** Values persist on purpose: `timed-broadcast.java` uses `node_4` (Server), assigned in `onEnable`, inside the `Runnable` 5 minutes later. The flip side is that a getter feeding a node on another exec path silently reads a stale value from an earlier invocation. Each field holds only one value, so this isn't unbounded growth. But after logout, the last `Player`, `Block` or `Location` stays reachable through `node_*` fields until the next event of that type, and so does everything it references (connection, level).
- **Folia.** This design can never be thread-safe on Folia, where events run on many region threads. Not emitting `folia-supported` is the correct choice for now.

**2. Exec flow.** Branching is the `Switch` node: `boolean val = …; if (val) {…} else {…}` (`nodes/flow.js:18-27`). There is no Return/Break node and no ForEach over an `Iterable`. `ForLoop` is int-indexed and exclusive (`i < lastIndex`, despite the "LastIndex" label). `Server#getOnlinePlayers()` returns a raw `java.util.Collection`, so the common "for every online player" needs `toArray` → `GetIndex` → `Cast`. There is no try/catch. The class data doesn't record `throws` (`JsonDoclet.java` `common()`/`executableData` only), so any checked exception is a javac error. Confirmed: `FileConfiguration#save(File)` gives `unreported exception IOException` (SP/p4/gen/checked).

`onCommand` always returns `true` (`codeGenerator.js:109`, `// TODO: variable return`). The abstract node's `node_3_return=false` is dead code (evidence `hello-command.java`). Cancelling works through `setCancelled(boolean)` with a Boolean constant. `@EventHandler` is emitted bare (`:167`), with no priority and no `ignoreCancelled`. A protection plugin needs `ignoreCancelled = true`, and a logger needs `MONITOR`.

**3. Types.** This is where most problems are.

- Inputs only accept an exact type or one of its known subtypes. `addNodeInput` expands the type into a comma-joined list of all subclasses (`nodeGenerator.js:893-899`), and litegraph compares strings.
- There is no boxing and no widening. `int → long`, `int → Integer` and `Player → Object` are all refused. A `java.lang.Object` parameter accepts 509 types, but no interfaces, so no Player and no Component (SP/p4/t4.js).
- Type variables are kept as raw names on method nodes: parameter type `"C"` (`nodeGenerator.js:701`), RETURN type `"C"` (`:709`), abstract RETURN (`:777`). So `PersistentDataContainerView#get(NamespacedKey, PersistentDataType<P,C>)` emits `private C node_5_output_1;` and fails to compile (`codeGenerator.js:418`). A String constant can't even connect to `PersistentDataContainer#set(…, C value)`; the connection is refused.
- 259 non-deprecated API methods return a type variable, including `ItemStack#getData(DataComponentType.Valued<T>)`. Another 178 take one as a parameter.
- The batch.md `typeVariable` fix did land, but only in the anonymous-class path (`codeGenerator.js:588, 594, 602`) and in abstract-method parameter outputs (`nodeGenerator.js:767`). The method-node parameter/RETURN path above is untouched.
- The structured class data has no type arguments at all. `PersistentDataType.STRING` is stored as raw `org.bukkit.persistence.PersistentDataType`, and `getOnlinePlayers()` as raw `java.util.Collection`; the arguments exist only in the `signature` strings. So fixing generics starts in `JsonDoclet.java`.

**4. Static members and enums.** `nodeGenerator.js` never reads `fields`. `fieldsByName` is filled in `classDataStore.js:56-61` and used nowhere. Only real enums get a constant dropdown (`nodeGenerator.js:537`). Material is still an enum, so `starter-kit` works. These classes, however, have no constant outputs (SP/p4/t1.js):

- `DataComponentTypes`: 109 fields, 0 methods
- `PersistentDataType`: 14 fields, including STRING
- `NamedTextColor`: 17 fields
- `Sound`: now an interface, with static fields
- `RegistryKey`: 44 fields
- `LifecycleEvents`: COMMANDS, TAGS, DATAPACK_DISCOVERY

As a result, PDC, data components, registries and lifecycle commands can't be reached from the graph at all.

Enum nodes are also broken for anything beyond picking a constant:

- A getter on an enum constant emits `private int node_3_output_1 = org.bukkit.Material.undefined;` (`codeGenerator.js:402`).
- An instance method on the constant is called statically: `org.bukkit.Material.createBlockData(...)` (`:454`, `sourceNode.classType === "enum"`).

Both are confirmed by javac.

**5. Lambdas and anonymous classes.** Constructor nodes on interfaces produce raw anonymous classes. `Runnable()` works (evidence `timed-broadcast.java`). `new io.papermc.paper.command.brigadier.BasicCommand() { public void execute(CommandSourceStack, String[] args) {…} }` is generated correctly. Folia's `GlobalRegionScheduler#runAtFixedRate(Plugin, Consumer<ScheduledTask>, long, long)` compiles with a raw `new java.util.function.Consumer() { public void accept(java.lang.Object t) … }` (unchecked warning). But `t` is typed `Object`, so it can't connect to a `ScheduledTask` REF without a free-text `Cast` (SP/p4/gen/folia). `BukkitRunnable()` has no `run()` output; the docs admit this (`docs/Examples.md:280`).

**6. Unconnected inputs.** These become bare literals from `getNullForType(param.type.qualifiedName)` (`codeGenerator.js:474`). The dimension is ignored and there is no cast. Confirmed:

- `CommandSender#sendMessage(Component)` with nothing wired gives `sendMessage(null)`: "reference to sendMessage is ambiguous".
- `MiniMessage#deserialize(String, TagResolver...)` gives `deserialize(str, null)`: ambiguous.
- `Player#sendPluginMessage(Plugin, String, byte[])` gives `…,0)`: "int cannot be converted to byte[]".

The single-argument `MiniMessage#deserialize(String)` is inherited from `ComponentSerializer#deserialize(R) -> O`, so it is generic-broken too. Getting a `Component` from MiniMessage therefore needs a zero-element `MakeArray` of `TagResolver`. `Component.text(String)` → `sendMessage(Component)` compiles fine (SP/p4/gen/componenttext).

**7. Commands.** The command editor has name, description, usage and aliases only (`pages/infoEditor.html`, `commandEditor.html`); no permission field. `makePluginYml` writes them to plugin.yml (`main.js:709-720`). All commands go to the single `onCommand` override, and the graph has to compare `command.getName()` itself (`docs/Examples.md:118-121`).

Tab completion is doubly broken:

- The class template never emits an `onTabComplete` override. `onTabCompleteMethods` is filled (`codeGenerator.js:504`) but never used in `classCode` (`:61-138`).
- Just adding a `JavaPlugin{onTabComplete}` node breaks compilation. Its RETURN field is declared with the comma-expanded type `private java.util.List,java.util.AbstractList,…,java.util.Stack node_3_return;` (`codeGenerator.js:463`, which uses `node.inputs[i].type` after `nodeGenerator.js:898` expanded it).

There is a modern path in the data: `JavaPlugin#registerCommand(String, BasicCommand)`, documented as "only valid inside onEnable". Jonas wired it with a `BasicCommand()` constructor node. Codegen drops every regular method declared on JavaPlugin and emits `node_2.registerCommand(}` (SP/p4/gen/basiccommand). The `JavaPlugin` branch at `codeGenerator.js:481-506` treats every JavaPlugin method node as a lifecycle hook and never emits the call. The same happens with `saveDefaultConfig()` and `getCommand(String)`. A paper-plugin.yml, bootstrapper or Brigadier tree is impossible: `com.mojang.brigadier` is absent from the class data and `LifecycleEvents.*` is unreachable.

**8. Debug mode.** It is on by default (`main.js:345`). It puts `getLogger().info("pb_debug_exec=N")` at the top of every node exec (`codeGenerator.js:806`). On `PlayerMoveEvent` that is several synchronous log writes per move per player. The log window parses them to animate the graph (`main.js:958-963`). The flag also adds `-bN` to the version on every compile (`main.js:703`). The only way to turn it off is a checkbox (`pages/infoEditor.html:100`) plus a recompile, and the docs say so (`docs/Testing-your-Plugin.md:60`). Anyone who forgets ships a log-spamming jar.

**9. Class data.**

- 2,380 Paper/Adventure classes and 721 java.base classes, generated from real sources by `tools/classdata`. Spot checks matched the 26.3 jar.
- Only `@Deprecated` is recorded (`JsonDoclet.java:106`). There is no `@ApiStatus.Internal`/`Experimental` and no nullability. `io.papermc.paper.InternalAPIBridge` (marked `ApiStatus$Internal` per `javap -v`) and all of `net.kyori.adventure.text.minimessage.internal.*` show up in the menus.
- Present: adventure-api, adventure-key and adventure-text-minimessage. Missing: adventure-text-serializer-plain and -legacy (no `PlainTextComponentSerializer`, so a chat filter can't read `AsyncChatEvent#message()` as text) and Brigadier.
- Events are detected by name: `isEvent = qualifiedName.endsWith("Event")` (`classDataStore.js:43`). So Adventure `ClickEvent`/`HoverEvent`, `org.bukkit.GameEvent` and the lifecycle/registry "events" are offered as Bukkit events and can't be created as objects. In the other direction, 18 abstract events with no `getHandlerList` in their hierarchy (`Event`, `PlayerEvent`, `BlockEvent`, `EntityEvent`, `AbstractChatEvent`, …) are offered in the event menu.
- Deprecated members are hidden only in the "Add Bukkit Method" menus (`nodeGenerator.js:228`). The per-node Outputs menu (`addClassIO`, `:573`) still lists 141 deprecated methods among `Player`'s 831 optional outputs.

**10. Jonas's use cases.** For prototyping, Jonas is faster in an IDE. The graph only wins for "event → getter → method" one-liners, and those are already easy in Java. For non-coder contributors:

- `graph.pbg` is one line of minified JSON (18.7 KB for 5 nodes).
- It stores float positions and colors, and it serializes the expanded subtype lists: one `CommandSender` REF input type string is 6,697 chars.
- A one-node change is an unreadable one-line diff, and merges are hopeless.
- The generated Java can't be reviewed either: one field per output, `node_N` names, and the header comment itself says "do NOT use this code as a starting point".

There is no way to emit a graph as a `Listener` that Jonas could register from their real plugin.

## Likes (max 5)

1. **Codegen is headless and mostly deterministic.** `codeGenerator.js` runs outside Electron with a three-line stub. A real golden-test suite is cheap to add (see feature 8).
2. **Class data comes from the real Paper 26.3 + Adventure 5.2 sources** with a reproducible generator (`tools/classdata/generate.mjs`). The signatures Jonas spot-checked (PDC, `registerCommand`, `GlobalRegionScheduler`, `NamespacedKey(Plugin, String)`) match the jar (checked with `javap` against paper-api 26.3.build.205).
3. **Runtime errors map back to nodes.** Stack-trace lines containing `node_` are sent to the editor for highlighting (`main.js:973-977`), and the debug trace animates the exec path (`pages/graph.html:738-771`). That is a good teaching aid for beginners.
4. **The test loop is fully automated**: Fill v3 Paper download, a JDK ≥ 25 check, the `@argfile` compile, and reload done as stop, copy and start (no `/reload`). `api-version` is correctly quoted (`main.js:708`).
5. **The happy path compiles cleanly**: `sendRichMessage` with MiniMessage strings, `Component.text`, `ItemStack.of(Material, int)`, `BlockBreakEvent#setCancelled`. The anonymous `BasicCommand` generation is also correct, so the building blocks for modern commands are nearly there.

## Dislikes (max 5)

1. **Shared mutable fields as the only state model.** Re-entrancy and async races, stale values across invocations, a pinned last `Player`, and no possible path to Folia.
2. **Generics and static constants are missing.** Together they cut off PDC, data components, registries, `NamedTextColor`, `Sound` and lifecycle commands: most of what changed in Paper over the last three years.
3. **Many easy graphs produce code that doesn't compile**: an unconnected overloaded parameter, any JavaPlugin method like `saveDefaultConfig()`, an onTabComplete node, a `Get` variable node, a checked exception. The user then gets a javac error about `node_7_output_1`, which a non-coder can't act on. Nothing validates the graph before compiling.
4. **Commands are 2012-style**: one `onCommand` dispatcher, `return true`, no permissions, broken tab completion. `JavaPlugin#registerCommand(String, BasicCommand)` is in the data but blocked by a codegen bug.
5. **Nothing is reviewable.** Minified, unstable graph JSON with embedded class-hierarchy strings, and generated Java that is unreadable by design. Neither of Jonas's two use cases can work without diffs a maintainer can review.

## Bugs found

Severity: H = breaks common graphs or the plugin, M = breaks a specific feature, L = cosmetic or edge case. "Confirmed" means Jonas built the graph through the harness and compiled it with javac 27 `--release 25` against the evidence classpath, or ran the generator and read its output.

1. **Regular methods declared on JavaPlugin are dropped, leaving broken syntax.** `codeGenerator.js:481-506`: if the class is `org.bukkit.plugin.java.JavaPlugin`, the method node only registers lifecycle hooks. The `else if (!node.isAbstractMethod)` branch that appends `params + ");"` never runs, but REF handling (`:452-457`) already emitted `node_2.name(`. Affects `registerCommand(…)`, `saveDefaultConfig()`, `saveConfig()`, `reloadConfig()`, `saveResource(…)` and `getCommand(String)`. Repro: JavaPlugin → `onEnable()` → `JavaPlugin#saveDefaultConfig()`. Output: `node_2.saveDefaultConfig(}` (SP/p4/gen/javaplugin, javaplugin2, basiccommand). **H, confirmed (javac).**
2. **Type variables on method-node parameters and RETURN.** `nodeGenerator.js:701, 709, 777` keep `"C"`/`"T"` as slot types, and `codeGenerator.js:418` declares `private C node_5_output_1;`. Repro: Player → `getPersistentDataContainer` → `PersistentDataContainerView#get(NamespacedKey, PersistentDataType<P,C>)` → RETURN → ConsoleLog. Result: "cannot find symbol: class C". A String constant can't connect to `set(…, C value)`. 259 return-type-variable methods are affected, including `ItemStack#getData`. The batch.md fix landed only at `codeGenerator.js:588/594/602`. **H, confirmed (javac + connect refused).**
3. **The abstract-method RETURN field uses the comma-expanded type list.** `codeGenerator.js:463` uses `node.inputs[i].type`, which `addNodeInput` (`nodeGenerator.js:893-899`) turned into `java.util.List,java.util.AbstractList,…`. The field is declared even when RETURN isn't linked. Repro: add `JavaPlugin{onTabComplete(...)}` and wire its EXEC. Result: 14 syntax errors (SP/p4/gen/tabcomplete). **H, confirmed (javac) for onTabComplete.** Inferred from the same code: any abstract method returning a non-final reference type (e.g. `BasicCommand{suggest}`) breaks the same way.
4. **onTabComplete is never wired.** Its exec calls go into `onTabCompleteMethods` (`codeGenerator.js:504`), but the class template (`:61-138`) has no `onTabComplete` override. Even after fixing bug 3, tab completion does nothing. **M, confirmed (generated output has no override).**
5. **Unconnected parameters become a bare `null`/`0`, which is ambiguous or wrongly typed.** At `codeGenerator.js:474`, `getNullForType(param.type.qualifiedName)` ignores `dimension` and adds no cast. Repros:
   - `CommandSender#sendMessage(Component)` unwired: `sendMessage(null)`, "reference to sendMessage is ambiguous".
   - `MiniMessage#deserialize(String, TagResolver...)` without resolvers: ambiguous.
   - `Player#sendPluginMessage(Plugin,String,byte[])`: `…,0)`, "int cannot be converted to byte[]" (SP/p4/gen/ambiguous, minimessage, bytearray).

   **M, confirmed (javac).**
6. **Enum node outputs other than the constant are broken.**
   - `codeGenerator.js:402` emits `Class.<enumName>` for every linked non-method output, so a getter becomes `org.bukkit.Material.undefined`.
   - `codeGenerator.js:454` calls instance methods statically when REF comes from an enum node: `org.bukkit.Material.createBlockData(…)`, "non-static method … static context".

   Repros: `Material` → `getMaxStackSize` → ConsoleLog, and `Material` → `createBlockData(String)` (SP/p4/gen/enumgetter, enummethod). **M, confirmed (javac).**
7. **Abstract events without a HandlerList are offered and break plugin enable.** Classification is by name (`classDataStore.js:43`), and the menu filter at `nodeGenerator.js:84-129` doesn't check `isAbstract` or the presence of `getHandlerList`. 18 such events appear (`Event`, `PlayerEvent`, `BlockEvent`, `EntityEvent`, `AbstractChatEvent`, `WorldEvent`, …). `on3(org.bukkit.event.player.PlayerEvent event)` compiles (SP/p4/gen/clickevent). At runtime `registerEvents(this, this)` (`codeGenerator.js:95`) should throw `IllegalPluginAccessException: Unable to find handler list for event … Static getHandlerList method required!` (string verified in `PaperEventManager.class` in the 26.3 server jar). `onEnable` aborts at that first statement, so none of the plugin's handlers, commands or tasks get set up, and Paper logs an enable error. **H, compile confirmed, runtime inferred.**
8. **Non-Bukkit "*Event" classes are misclassified.** Adventure `ClickEvent`/`HoverEvent`, `org.bukkit.GameEvent`, `LifecycleEvent`, `RegistryEvent` and others get `classType = "event"` (SP/p4/t1.js), so they can't be used as object nodes. If added, they generate `@EventHandler public void on2(net.kyori.adventure.text.event.ClickEvent event)`, which Paper skips with "attempted to register an invalid EventHandler method signature" (string verified in the server jar). Fix: classify by "extends `org.bukkit.event.Event`". **M, compile confirmed, runtime inferred.**
9. **Shared-field state is not re-entrant or thread-safe.** `codeGenerator.js:171, 201, 418` plus all `node_N_exec()` methods read from fields. A nested same-type event overwrites `node_<id>` mid-handler. Concurrent `AsyncChatEvent`/`AsyncPlayerPreLoginEvent` invocations race (SP/p4/gen/asyncchat shows the unsynchronized `node_2 = event; node_3_exec();`). The last `Player`/`Block` stays reachable after the handler returns. **H (design), inferred from generated code; not run.**
10. **Checked exceptions are uncompilable.** There is no `throws` data (`JsonDoclet.java`) and no try/catch emission. `FileConfiguration#save(File)` in `onDisable` gives "unreported exception IOException" (SP/p4/gen/checked). **M, confirmed (javac).**
11. **The variables nodes are broken.**
    - `Get` (`nodes/variables.js:28-45`) has no `getFields`, so `node_N_output_0` is never declared ("cannot find symbol"). It also has no EXEC input, so nothing would call it.
    - `Set` has no EXEC output, so execution stops after a Set.
    - Two `Set` nodes with the same name each declare the field: "variable last is already defined" (SP/p4/gen/getvar, dupset).

    **M, confirmed (javac).**
12. **Unlinked inputs on native nodes produce invalid code.** `StringFormat` without Variable gives `String.format(fmt, );` (`nodes/misc.js` getMethodBody, `[null].join(",")`). `Switch` without Condition gives `boolean val = null;` (SP/p4/gen/strformat, switchnocond). **L, confirmed (javac).**
13. **FlipFlop starts with B, and `isA` is stale.** `getExecBefore` branches on the initial `false` before the body toggles it (`nodes/flow.js:80-89`, run order at `codeGenerator.js:684-697`). That contradicts its description, "starting with A". **L, confirmed from generated code (SP/p4/gen/flipflop).**
14. **`onCommand` ignores the graph's return value.** `return true;` is hard-coded (`codeGenerator.js:109`), so the abstract node's RETURN input does nothing and the `usage:` message never shows. **L, confirmed (evidence hello-command.java).**
15. **Debug is on by default in shipped jars.** `main.js:345` `debug: true` plus `codeGenerator.js:806` add a synchronous log call per node execution. **M (perf and log spam on hot events), confirmed (evidence files).**
16. **Deprecated methods still appear in node Outputs menus.** `addClassIO` (`nodeGenerator.js:573-614`) has no `isDeprecated` check: 141 of `Player`'s 831 optional outputs are deprecated, against the batch.md goal of hiding them. `@ApiStatus.Internal` isn't recorded at all (`InternalAPIBridge`, `minimessage.internal.*` are listed). **L, confirmed (harness, javap).**
17. **`Object` parameters reject interfaces; no boxing or widening.** `getAllImplementingAndExtendingClasses("java.lang.Object")` walks only the class tree, so `String#equals(Object)` refuses a `Player`. `int → Integer` and `int → long` are refused too (SP/p4/t4.js). **M, confirmed (connect refused).**
18. **Trivia.**
    - `enumMethods.splice(0, objectMethods.length)` (`codeGenerator.js:155`) runs after `objectMethods` was emptied, so it never clears anything. Harmless today because nothing pushes to `enumMethods`.
    - `constructorName: constructor.name` (`nodeGenerator.js:834`) references an undeclared `constructor`, so it picks up the global's `.name` instead of the constructor's.
    - The compile classpath includes the Mojang-mapped server jar (`js/paper.js:54-55` visits `lib/versions`), so a free-text `Cast` to an internal class compiles.

    **L, read and confirmed by inspection.**

## Feature requests and changes (ranked)

1. **Per-invocation state instead of fields.** Emit each entry point (event handler, onEnable, command execute, lambda body) as straight-line code with `final` locals, inlining the exec chain. A node reachable from several entry points gets emitted once per entry point. Only explicit Set/Get variables and FlipFlop stay fields, optionally typed as per-player state (`Map<UUID,T>`, cleaned on `PlayerQuitEvent`). Target shape:
   ```java
   @EventHandler(priority = EventPriority.NORMAL, ignoreCancelled = true)
   public void onBlockBreak(BlockBreakEvent event) {           // node 2
       final Player player = event.getPlayer();                // node 3
       if (!player.isOp()) {                                   // node 4 Switch
           event.setCancelled(true);                           // node 5
           player.sendRichMessage("<red>Only operators…");     // node 7
       }
   }
   ```
   Why Jonas cares: it fixes re-entrancy, async races and stale values in one go, and it is the prerequisite for Folia and for readable output. Where: rewrite `js/codeGenerator.js`; native nodes' `getMethodBody`/`getExecAfter` contract in `js/nodes/*.js`. Effort: **L**.

2. **Static field and constant nodes, with registry-backed "pseudo-enums".** Show public static fields as outputs, or as a dropdown like enums. When every static field of a class has the class's own type (`Sound`, `NamedTextColor`, `Attribute`, `PotionEffectType`), render it exactly like an enum node. This unlocks `PersistentDataType.STRING`, `DataComponentTypes.MAX_STACK_SIZE`, `NamedTextColor.RED`, `Sound.ENTITY_PLAYER_LEVELUP`, `RegistryKey.ENCHANTMENT` and `LifecycleEvents.COMMANDS`. Codegen is `Class.FIELD`; the data is already there. Why: the cheapest fix that opens up most of modern Paper, and old v1 graphs that used the `Sound` enum need it. Where: `nodeGenerator.js` `addClassIO`, `codeGenerator.js` `generateCodeForEnumClassNode` (also fixes bug 6). Effort: **S–M**.

3. **Generics end to end.**
   - Change `JsonDoclet.java` `typeData` to emit structured `typeArguments`, including wildcards and bounds, for fields, parameters and returns.
   - In the editor, carry the type arguments on slots and resolve method type variables from what is connected. `get(key, PersistentDataType<String,String>)` should then give a RETURN of type `String`, and `ItemStack#getData(DataComponentType.Valued<Integer>)` should give `Integer`.
   - Fall back to the erased bound plus an explicit cast node, never a bare `T`.
   - Add assignability rules for boxing and unboxing, primitive widening, and `Object` accepting everything.

   Target: `String v = pdc.get(key, PersistentDataType.STRING);`. Why: PDC and data components are Jonas's bread and butter. Where: `tools/classdata/JsonDoclet.java`, `nodeGenerator.js` (`addMethodIO`, `addNodeInput`), `codeGenerator.js`, a custom `LiteGraph.isValidConnection`. Effort: **L**.

4. **Modern commands from the command editor via `JavaPlugin#registerCommand`.** First fix bug 1, then generate one `BasicCommand` per declared command and drop the plugin.yml `commands:` section and the `onCommand` dispatcher:
   ```java
   registerCommand("hello", "Say hi", List.of("hi"), new BasicCommand() {
       @Override public void execute(CommandSourceStack source, String[] args) { … }
       @Override public Collection<String> suggest(CommandSourceStack source, String[] args) { … }
       @Override public @Nullable String permission() { return "myplugin.hello"; }
   });
   ```
   Each command then gets its own entry node in the graph with `source`/`sender`/`args` outputs. Add permission fields in the editor and plugin.yml `permissions:` with defaults. A full Brigadier tree via `LifecycleEvents.COMMANDS` can come later, once Brigadier is in the class data. Why: per-command handlers, permissions and working suggestions, without asking non-coders to compare strings. Where: `main.js` `makePluginYml`, `pages/commandEditor.html`, `codeGenerator.js` template. Effort: **M**.

5. **Event handler options and a cancel shortcut.** Give event nodes `priority` (LOWEST…MONITOR) and `ignoreCancelled` properties that emit `@EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)`, plus a "Cancel event" node for `Cancellable`. Only list concrete events that have a HandlerList, classified by superclass rather than name (fixes bugs 7 and 8). Why: correct ordering and compatibility with other plugins is table stakes on public servers. Where: `nodeGenerator.js` `onEventAdd`, `classDataStore.js:43`, `codeGenerator.js:165-171`. Effort: **S**.

6. **Real lambdas for functional interfaces, with typed parameters.** When a constructor-node THIS feeds a parameter of type `Consumer<ScheduledTask>`, `Predicate<Player>`, `Runnable` and so on, emit a lambda with parameter types taken from the target's type arguments:
   ```java
   getServer().getGlobalRegionScheduler().runAtFixedRate(this, task -> { … task.cancel(); }, 1L, 20L);
   ```
   Expose `task` as a `ScheduledTask` output, not `Object`. Depends on 1 and 3. Why: Folia schedulers, `EntityScheduler`, the `BukkitRunnable` replacement and `Component.text(Consumer<Builder>)`. Where: `codeGenerator.js` `generateCodeForConstructorNode`, `nodeGenerator.js` `addConstructorIO`/`addAbstractMethodIO`. Effort: **M**.

7. **Reviewable artifacts for contributors.**
   - Save `.pbg` pretty-printed, with sorted keys, rounded positions, and without derived data (expanded type lists, colors, shapes). Store `type` as the declared type and recompute the subtype list on load.
   - Generate readable Java: imports, locals named after the node or method (`player`, `isOp`), and a `// node 7` comment per statement so reviewers can map Java back to the graph.
   - Add an "Export as Listener" target: `public final class JoinGreeter implements Listener { JoinGreeter(Plugin plugin) {…} }`. Jonas can then drop a contributor's graph into their real plugin and review the Java in a PR.

   Why: this is the whole "non-coders contribute" story. Where: `pages/graph.html` save/serialize, `codeGenerator.js`. Effort: **M–L**.

8. **Golden codegen tests plus javac in CI.** Jonas's harness (SP/p4/harness.js: a `Module._load` stub for `electron`, litegraph loaded directly) runs both generators headless in about 1 s. Check in a test that:
   - builds each `docs/examples/*.pbs` plus the 21 repro graphs above,
   - snapshots the Java,
   - compiles it against paper-api with `--release 25` on the existing 3-OS workflow.

   Why: most bugs above would have failed such a test on the first run. Where: `test/`, `.github/workflows/build.yml`. Effort: **S–M**.

9. **Class data quality.**
   - Record `throws`, `@ApiStatus.Internal`/`Experimental`/`ScheduledForRemoval`, and nullability (`@Nullable`/`@NotNull`/JSpecify) in `JsonDoclet.java`.
   - Hide Internal members everywhere and badge Experimental ones.
   - Hide deprecated members in node Outputs menus too.
   - Add `adventure-text-serializer-plain`/`-legacy` and `com.mojang.brigadier` to `generate.mjs`.

   Why: `PlainTextComponentSerializer` is required for any chat filter, and Internal classes are a trap. Where: `tools/classdata/*`, `nodeGenerator.js:573`. Effort: **S–M**.

10. **Exceptions and null safety.** For methods that declare checked exceptions, emit `try { … } catch (IOException e) { getLogger().log(Level.WARNING, "node 12 failed", e); }`, with an optional "On error" exec output. Add an "Is null?" branch node; Equal only takes primitives today. Warn when a `@Nullable` return such as `getKiller()` feeds a REF without a check. Where: `codeGenerator.js` method emission, `js/nodes/flow.js`. Effort: **M**.

11. **Collections and control flow.** Add `ForEach` over any `Iterable`/array, with a typed element output once generics land (`for (Player p : getServer().getOnlinePlayers())`). Add Return/Break nodes, an inclusive or clearly labelled ForLoop bound, and working typed Get/Set variables with EXEC pass-through (bug 11). Where: `js/nodes/flow.js`, `js/nodes/variables.js`. Effort: **M**.

12. **Debug as a runtime flag, not a build mode.** Generate `private static final boolean PB_DEBUG = Boolean.getBoolean("pluginblueprint.debug");` and `if (PB_DEBUG) getLogger().info("pb_debug_exec=7");`. Have `serverStarter.js` pass `-Dpluginblueprint.debug=true` to the test server, and decouple the `-bN` version suffix. The same jar is then safe to publish. Where: `codeGenerator.js:806`, `js/serverStarter.js`, `main.js:703`. Effort: **S**.

13. **Validate the graph before compiling.** Before codegen, flag:
    - required inputs left unlinked on overloaded methods (or emit `(Component) null`),
    - a missing REF,
    - type-variable slots,
    - abstract events,
    - duplicate variable names.

    Show the problems on the nodes instead of javac errors about `node_7_output_1`. Where: new `js/graphValidator.js`, hooked in `pages/graph.html` `generateCode`. Effort: **M**.

14. **plugin.yml completeness, then optional paper-plugin.yml.** Add `permissions:`, `depend`/`loadbefore`, `website` and `prefix` now. Only emit `folia-supported: true` once item 1 and Folia-safe scheduler nodes exist. Later, offer a paper-plugin.yml target with a generated `PluginBootstrap` for lifecycle Brigadier commands. Where: `main.js:699-722`, `pages/infoEditor.html`. Effort: **M**.

15. **Narrow the compile classpath to the API.** Compile against paper-api and its declared API dependencies, not `lib/versions/**` (the server jar), so generated plugins can't silently depend on internals. Where: `js/paper.js:44-57`, `js/javaCompiler.js`. Effort: **S**.

## Would Jonas keep using it?

Not yet, for either job. As a prototyping tool it is slower than an IDE for Jonas. The APIs they actually prototype with (PDC, data components, registries, lifecycle commands, Folia schedulers) are blocked by missing generics and missing static-field nodes. The state model would also put a race into anything that touches async chat or login. For onboarding contributors, the graph files can't be diffed, and the generated Java is unreadable by design, so Jonas couldn't review a contributor's work. The fundamentals are still promising: the class data is accurate and reproducible, codegen runs headless and is easy to test, and the anonymous-class machinery already produces a correct `BasicCommand`. If the maintainer fixes bugs 1–3, adds static-field nodes, and moves to per-invocation locals with readable output (features 1, 2, 4, 7 and 8), Jonas would try again. They would use it to let their community build small `Listener` modules that Jonas reviews as Java in a PR, which is a niche no other tool fills.
