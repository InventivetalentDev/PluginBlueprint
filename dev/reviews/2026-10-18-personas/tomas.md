# Tomás Reyes — admin who wants to build without code

> Written on 2026-10-18 against `codex/modernize` at `6700653`. Paths that start with `SP/` point to the review session's scratch folder, which no longer exists. The headless codegen scripts are now in `tools/codegen-harness/`, the app-driving scripts are in `tools/app-driver/`, the generated examples are in `evidence/`, and a selection of June's screenshots is in `images/`.

Tomás is 24 and runs a ~30-player community survival server: EssentialsX, LuckPerms, WorldGuard, a handful of their own Skript scripts and some datapack / command-block contraptions.
They read plugin source on GitHub to see how things work but don't really read Java, and they want to make their own plugins without code.

## Walkthrough

**How I checked (outside the persona).** Everything below comes from the `codex/modernize` code, `data/classes/paper.json` + `java.json`, the docs, the evidence pack and read-only queries against the running editor window. For the codegen claims I also built small graphs with the app's own `js/nodeGenerator.js` + `js/codeGenerator.js` in plain Node. I compiled the output with `javac --release 25` against the evidence project's Paper 26.3 classpath. The probe script is `SP/p2/harness.js`, with outputs in `SP/p2/gen/*/src/t/GeneratedPlugin.java` (SP = the session scratchpad). I never clicked in the app.

### 1. Docs first

Tomás opens `docs/Home.md` and `Getting-Started.md`. The install part is honest and easy to follow. It explains the unsigned-app dance on macOS and Windows and quotes the Java prompt word for word ("PluginBlueprint needs Java 25 to build plugins. Download it now (about 200 MB)?"). It also says where the downloads live. Compared to the v1 wiki (96 lines total in `.codex-handoff/modernize/docs/old-wiki/`), this is a different product.

"Learn the editor basics" gives a node-type table (event = purple megaphone, class = brown, method = `#`, `Class{method()}` implements a method). It also says: "`EXEC` links are orange arrows. They set the order in which nodes run." That sentence is the whole explanation of execution flow. Nothing tells Tomás the thing they need most: a class node like `Player` only reads its getters when an EXEC wire runs through it. Every recipe says something like "Connect the EXEC outputs ... in this order: `PlayerJoinEvent` → `Player` → `StringFormat` → `sendRichMessage`". None says *why* `Player` has to be in the chain. If Tomás skips it, the plugin compiles and throws a NullPointerException on the server: `node_3` is never assigned in `join-message.java`.

`Examples.md` has five recipes: join message, /hello, block protection, starter kit and timed broadcast. Each one has a snippet, numbered build steps, "Try it" and "How it works", and the "verified on Paper 26.3" note builds trust. As recipes they work. As teaching they stop at the recipe:

- The hello-command "How it works" says: "If you add more than one command, compare `command` → `getName` with `String#equalsIgnoreCase` and branch with a `Switch` node." In practice that is a `java.lang.String` class node, a method node, a constant and a Switch. `java.lang.String` is in none of the right-click menus, because `isApiClass` (`js/nodeGenerator.js:79`) only lets `org.bukkit`, `io.papermc.paper`, `com.destroystokyo.paper` and `net.kyori.adventure` through. In search, typing `java.lang.String` matches 4,579 node types. Tomás would not get there alone.
- The docs mention 3 of the 31 built-in nodes: `Switch`, `StringFormat` and `MakeArray`. `Cast`, `InstanceOf`, `ForLoop`, `Set`/`Get`, `GetIndex`, `Length`, `ConsoleLog`, the logic gates and the operators are never explained. In my experiments `Cast` turned out to be the most important node in the app.
- The starter kit is 10 nodes and 15 links (`docs/images/starter-kit.png`). In Skript it's `on first join: give player 16 bread`. That's fine for a visual tool, but the docs should own the trade-off: you get the whole Paper API, and you pay for it in wiring.

### 2. What the palette can express

- **Size:** the running editor has 50,485 registered node types (`Object.keys(LiteGraph.registered_node_types).length`). That's 2,380 Paper classes and 721 Java classes. Every method is registered twice, as `Class#method` (call it) and `Class{method}` (implement it), and constructors are registered too. Only 31 node types are built in.
- **Menus vs. search:** the right-click "Add Bukkit Event / Object / Method" menus are package trees that hide deprecated classes and members (`nodeGenerator.js:85-252`). The documented way in is the search box, and that is stock litegraph: plain substring match on raw type keys, capped at about 100 results, no ranking, no descriptions and no deprecated filter (`assets/lib/litegraph/litegraph.js:7381`; `canvas.onSearchBox` is not set). Live examples:
  - `heal` → the first hit is `org.bukkit.Raid{getTotalHealth()}`.
  - `getConfig` → the first four hits are `io.papermc.paper.plugin.bootstrap.PluginProviderContext{getConfiguration()}` and friends, then the deprecated `org.bukkit.Server.Spigot#getConfig()`.
  - The docs' own `search-box.png` shows `PlayerJoinEvent{getHandlerList()}` as the second result.
- **Outputs menu:** right-click → **Outputs** on a `Player` node lists 831 members alphabetically. 140 of them are deprecated and not marked, for example `banPlayer(String)` and `addPotionEffect(PotionEffect, boolean)`. On `PlayerJoinEvent`, the deprecated `setJoinMessage(String)` sits next to `joinMessage(Component)`, and a newcomer will pick the String one.
- **Constants:** enums work. `Material` gets an `en` dropdown and `DisplaySlot.SIDEBAR` is fine. **Static fields are never turned into nodes.** `classDataStore.js` builds `fieldsByName`, but `nodeGenerator.js` never reads it. That leaves 14,112 static fields on 232 non-enum API classes out of reach, including `Attribute.MAX_HEALTH`, every `Sound`, every `PotionEffectType`, `PersistentDataType.INTEGER` and `Criteria.DUMMY`.
- **Type rules:** links need an exact type-token match (`litegraph.js:376-403`).
  - Inputs are widened to "the class plus all subclasses" (`nodeGenerator.js:894-899`). For `java.lang.Object` that list holds only 209 `java.*` classes. A `Player`, `Location` or `Inventory` can't plug into an `Object` parameter, and neither can an `int`.
  - Generic parameters are typed literally `K` / `V` (`HashMap#put(K, V)`), so a `UUID` can't plug in (`isValidConnection("java.util.UUID","K") === false`).
  - The escape hatch is the untyped `Cast` node. Its slots are `null`-typed, so it connects to anything, and `(java.lang.Object) x` autoboxes. That's how I got almost every idea below to work.
- **Codegen:**
  - Every node becomes a class field plus a `private void node_N_exec()`.
  - Supported: `Switch` (if/else), `ForLoop` (int range with an exclusive "LastIndex"), `FlipFlop`, arrays, and anonymous classes through constructor nodes of abstract types (the `Runnable()` broadcast works).
  - Not supported: foreach over collections, while, break, return values from events, and lambdas.
  - `onCommand` always ends in `return true;`, and `onTabComplete` is never generated (bugs below).
- **A useful accident:** because everything is a field, an output computed in one chain (say `onEnable`) can be wired into another chain (a command or an event). That's the only "global variable" that works, because the real `Variables` nodes don't compile (bug B1).

### 3. My eight plugin ideas

I checked each member against `paper.json` and each pattern against the codegen. The ones marked *compiled* went through javac in my probe. The rest are wired on paper only.

| Idea | Buildable today? | What blocks it / what it takes |
|---|---|---|
| a. `/heal` + permission + 30 s per-player cooldown | With workarounds | The permission check is easy: `CommandSender` → `hasPermission(String)` → `Switch`. Healing: `InstanceOf` Player → `Cast` → `Player` → `setHealth(double)` with a constant 20.0, because `Attribute.MAX_HEALTH` is an unreachable static field. The obvious cooldown, a `HashMap<UUID,Long>`, fails twice: keys are typed `K`, and `get` returns `V`, which generates `private V node_6_output_1;` → javac "cannot find symbol class V" (*compiled*, B3). `Variables/Get` doesn't compile either (B1). What does work: use `getConfig()` as an in-memory map with `getLong(path)`, then `set(path, Cast→Object)`, with the path from `StringFormat("cooldown.%s", uuid)` and the time from a `java.lang.System` node's `currentTimeMillis` getter. That's about 25 nodes. Skript: `cooldown: 30 seconds` on the command. |
| b. Welcome message from config.yml + `/myplugin reload` | With workarounds | `getConfig` / `getString(path, default)` / `reloadConfig` all exist. You can't ship a default `config.yml`: the jar is built only from `classes/` (`js/javaCompiler.js:35-36`), and that folder is emptied on every compile (`main.js:727`). Defaults only work through `addDefault` + `options().copyDefaults(true)` + `saveConfig()` in `onEnable`. The "reload" subcommand needs `Length > 0` → `GetIndex(args, 0)` → `Cast(java.lang.String)` → String node → `equalsIgnoreCase` → `Switch`. The Cast is needed because `GetIndex` outputs `java.lang.Object`. Feeding it straight into a String parameter fails, e.g. `no suitable method found for getPlayer(Object)` in my args probe (*compiled*). |
| c. Per-player join count across restarts | With workarounds | PersistentDataContainer is out (`PersistentDataType.INTEGER` is a static field). The config route works: `StringFormat("players.%s.joins", getUniqueId)` → `getInt` → `Add` → `Cast` to `java.lang.Object` → `set` → `saveConfig`. Skript: `add 1 to {joins::%uuid of player%}`. Denizen: `flag player joins:++`. |
| d. Clickable chest GUI (cancel the click) | With workarounds | All the members exist: `Bukkit.createInventory(InventoryHolder, int, Component)` with a null holder, `Component.text(String)`, `Inventory#setItem`, `HumanEntity#openInventory`, and `setCancelled` / `getSlot` on `InventoryClickEvent`. The snag is telling "my" inventory apart. `Equal` only takes primitives (`js/nodes/relational.js:13-19`), so you need `Object#equals`, which needs a `Cast` on both sides plus the cross-chain field trick above. It works by accident. |
| e. Custom crafting recipe | With workarounds | `NamespacedKey(Plugin, String)` → `ShapedRecipe(NamespacedKey, ItemStack)`. That constructor is only reachable from search, because double-clicking `REF` only creates `Name()` constructors (`nodeGenerator.js:965`). Then `shape(String...)` through `MakeArray`, `setIngredient(char, Material)` and `Bukkit.addRecipe`. The `char` comes from a NumberConstant, so Tomás has to type `68` to mean `'D'`. |
| f. Sidebar scoreboard / tab-list header | Tab header: yes. Sidebar: with workarounds | Tab header: `sendPlayerListHeader(Component)` on `Player` (inherited from Audience) plus `Component.text(String)`. The MiniMessage route is harder. The one-argument `deserialize(String)` is inherited from `ComponentDecoder<S, O>`, so its input is typed `S` and its return `O`, and it hits B3. The overloads `MiniMessage` declares itself all take a second argument. Sidebar: `getScoreboardManager` → `getNewScoreboard` → `registerNewObjective(String, Criteria, Component)` (every other overload is deprecated). `Criteria.create("dummy")` stands in for the unreachable `Criteria.DUMMY`. Then `setDisplaySlot(SIDEBAR)` → `getScore(String).setScore(int)`, plus a `Runnable` timer to refresh it. |
| g. `/gift <player> <item>` with tab completion | Arguments: with workarounds. Tab completion: **no** | Arguments: `GetIndex` + `Cast(String)` → `Bukkit.getPlayer(String)` / `Material.matchMaterial(String)`, null-checked with `InstanceOf` because `Equal` can't compare objects to null. Tab completion: adding a `JavaPlugin{onTabComplete(...)}` node breaks the build (*compiled*, B4). |
| h. Use Vault / PlaceholderAPI / LuckPerms | **No** | There's no class data or jar for any third-party API. `ServicesManager.load(Class<T>)` would need a class-literal node, which doesn't exist. The Soft-Depend field exists, but there's nothing to call. LuckPerms only helps indirectly, through `hasPermission`. |

Score: one idea fully buildable (the tab header), six with workarounds that mostly lean on `Cast` and on abusing `getConfig()`, and one not at all. Tab completion, the second half of (g), is also out. Skript does all eight, (h) through addons.

### 4. "Learn how plugins work"

**The good parts:**
- Hovering a node shows the first sentence of its Javadoc plus "[shift-click for more]" (`js/util.js:179-188`). Shift-click opens the class page on jd.papermc.io or docs.oracle.com.
- With Debug on, nodes light up as they run.
- A runtime exception whose stack contains `node_N` highlights that node (`main.js:973-977`).
- Compile errors link `node_N` back to the graph (`pages/error.html:48`).
- `plugin.yml` is plain to read.

That's real "see how it works" value.

**The generated Java** is not a learning resource, and the generator says so in a banner at the top of every file: "If you're trying to get into *actual* programming, please do NOT use this code as a starting point!" The join message (`SP/evidence/generated/join-message.java`) comes out as six fields (`node_2`, `node_2_output_2`, `node_3_output_2` ...) plus four `node_N_exec()` methods chained by calls. A hand-written plugin is about eight readable lines:

```java
@EventHandler
public void onJoin(PlayerJoinEvent event) {
    Player player = event.getPlayer();
    player.sendRichMessage(String.format("<green>Welcome to the server, <bold>%s</bold>!", player.getName()));
}
```

It's also always `GeneratedPlugin` in the package `my.awesome.plugin`, with `author: "inventivetalent"` unless Tomás changes it (`main.js:335-337`). When Tomás opens real plugins on GitHub, nothing in the generated code helps them recognise the structure. MCreator, by contrast, shows readable Java for what you built.

### 5. Editing UX (from code)

- **Search:** described above. It's the main way in, and it's the weakest part.
- **Node context menu:** reduced to Inputs / Outputs / Properties / Clone / Remove, because `LGraphNode.prototype.getMenuOptions` is overridden at `nodeGenerator.js:350-371`. Litegraph's Title, Collapse and Colors are gone, so Tomás can't rename a node to annotate it.
- **Comments:** "Add Group" (a titled, coloured box) is the only annotation tool. There's no comment or note node.
- **Reuse and structure:** there are no functions, macros or sub-graphs (litegraph supports subgraphs, but they aren't exposed). Each project has one graph (`graph.pbg`) and produces one class.
- **Copy/paste:** works (litegraph Ctrl/Cmd+C/V).
- **Undo/redo:** a full-graph snapshot stack (`js/history.js`), recorded only on node add, node remove and connection change (`pages/graph.html:326-375`). Editing a constant's value is invisible to it (B6).
- **Snippets:** they carry `nodes`, `links`, `groups` and `zoom` only. I checked all five `.pbs` files. No commands, permissions or soft-depends, so the hello-command plugin.yml from a fresh project has no `commands:` section. The docs warn about this, but it's still a trap. A partial selection exports broken links (B7).
- **Git menu:** Commit / Push / Change Remote. A nice touch for an admin who already keeps configs in git, though there's no pull and no history view.

## Likes (max 5)

1. **Zero-fuss toolchain.** The app finds or downloads Java 25, downloads Paper 26.3, and gives you a test server with a log window that has a command box. **Run → Reload Plugin** stops, copies and restarts. Tomás never touched a JDK.
2. **The docs.** They're verified recipes with snippets, screenshots, "Try it" steps and real console output, which is a huge step up from the v1 wiki.
3. **The whole Paper API is there.** 2,380 classes, Adventure/MiniMessage through `sendRichMessage`, and scheduler and anonymous `Runnable` support. Tomás isn't limited to what some Skript addon author chose to expose.
4. **Errors and execution point back at nodes.** Debug highlighting, `node_N` links in the compile-error window, and runtime stack traces that highlight the node.
5. **Transparency.** You can open the generated Java and `plugin.yml` and see exactly what will run, and there's built-in git.

## Dislikes (max 5)

1. **Search is a firehose.** 50,485 raw qualified names, no ranking, every method listed twice (`#` and `{}`), deprecated members mixed in, and no description in the results.
2. **Wiring tax with invisible rules.** Object nodes must sit in the EXEC chain or their getters stay null. Types must match exactly, so `Cast` is needed everywhere. A first-join bread kit is 10 nodes and 15 links.
3. **Failures are silent or cryptic.**
   - A missing EXEC compiles, then NPEs on the server.
   - A missing `REF` makes the generator drop the node quietly (`codeGenerator.js:439-442`), and javac then reports "cannot find symbol node_7_exec()".
   - Unconnected parameters quietly become `null` / `0` (`codeGenerator.js:474`).
4. **Everyday building blocks are out of reach.** Static constants (sounds, potion effects, max health, PDC types), generics (`Map`/`List`), working variables, config.yml shipping and tab completion are all missing.
5. **The generated code teaches the wrong structure**, and the banner says so. Tomás wanted to learn how real plugins are built.

## Bugs found

Severity is from Tomás's point of view. "Compiled" means I reproduced it with the app's own generators plus javac (outputs in `SP/p2/gen/`).

**B1. `Variables → Get` can never compile.** High.
- **Cause:** `Get` defines `getMethodBody` but no `getFields`, so the output field it assigns is never declared. It also has no EXEC input, so its `node_N_exec()` copy method is never called. See `js/nodes/variables.js:28-45` and `js/codeGenerator.js:677`, where fields come only from `getFields`.
- **Repro (compiled):** `JavaPlugin{onEnable()}` → `Set` (name `joinCount`, type `int`) ← NumberConstant 5. Then `Get` (`joinCount`, `int`) → `ConsoleLog`.
- **Result:** javac `error: cannot find symbol ... variable node_6_output_0`.

**B2. `Variables → Set` can only be used once per name, and it ends the chain.** Medium-High.
- **Cause:** each `Set` declares the field again (`getFields` at `js/nodes/variables.js:19-21`), and `Set` has no EXEC output (`variables.js:4-12`).
- **Repro (compiled):** two `Set joinCount` nodes in `onEnable`.
- **Result:** `error: variable joinCount is already defined in class GeneratedPlugin`.

**B3. Generic return types are emitted as Java types.** High: it blocks every Map, List and Optional getter.
- **Cause:** the `RETURN` slot type comes straight from `returnType.qualifiedName` (`nodeGenerator.js:709`), and the field is declared with that type (`codeGenerator.js:418`).
- **Repro (compiled):** `HashMap()` → `HashMap` → `get(Object)` with `RETURN` → `ConsoleLog`.
- **Result:** `private V node_6_output_1;` → `error: cannot find symbol ... class V`.
- **Related:** generic parameters are typed `K` / `V`, so only untyped outputs can connect to them. The same applies to `List#get` (`E`), `Optional#get` (`T`) and the one-argument `MiniMessage#deserialize(String)` (input `S`, return `O`, inherited from `ComponentDecoder`).

**B4. `onTabComplete` breaks the build, and is never generated anyway.** High: there's no way to get tab completion.
- **Repro (compiled):** `JavaPlugin` → `onTabComplete(...)` output → `JavaPlugin{onTabComplete(...)}` → `sender` → `CommandSender` → `sendRichMessage`.
- **Result:** `private java.util.List,java.util.AbstractList,...,java.util.concurrent.CopyOnWriteArrayList node_3_return;` → `error: <identifier> expected`.
- **Cause 1:** `addNodeInput` widens the abstract method's `RETURN` input type into a comma list (`nodeGenerator.js:777` → `:894-899`), and `codeGenerator.js:463` pastes it in as a Java type. This hits any `{method}` node whose return type has subclasses or sub-interfaces in the class data (`List`, `Collection`, `Object`, ...).
- **Cause 2:** even if it compiled, `onTabCompleteMethods` is filled (`codeGenerator.js:504`) but never joined into the class template (`:84-140` has no `onTabComplete` override).
- **Cause 3:** the `sender` / `args` fields are only declared for `onCommand` (`:491-497`).

**B5. The `onCommand` `RETURN` input is ignored.** Medium.
- **Cause:** the template hard-codes `return true;` with the comment `// TODO: variable return` (`codeGenerator.js:109`).
- **Repro (compiled):** wire a `false` BooleanConstant into `onCommand`'s `RETURN`.
- **Result:** the code assigns `node_3_return = node_4_output_0;` and still returns `true`, so Paper never prints the command's usage line.

**B6. Property edits aren't tracked: no unsaved marker, no undo, and they can be lost on close.** Medium. This comes from reading the code; I didn't click through it.
- **Cause:** litegraph's property editor (`litegraph.js:7532-7545`) only bumps `graph._version`. `pages/graph.html:326-375` records history and `unsavedChanges` only on node add, node remove and connection change. `main.js:122-126` only asks before closing when `unsavedChanges > 0`.
- **Repro:** Save. Right-click a String constant → Properties → change the text. The title gets no `*`, and Undo can't revert the edit; undoing an earlier step instead restores a snapshot from before the edit. Close the window with the close button: no prompt, and the edit is gone.

**B7. "Export Selection (Snippet)" with a partial selection produces broken links.** Medium-Low.
- **Cause:** links are exported if *either* end is selected (`pages/graph.html:501`, `||`). On import, the missing end maps to `undefined` (`graph.html:578`).
- **Repro (simulated with the same logic in `SP/p2/probe-snippet.js`):** the join-message example minus `PlayerJoinEvent`. It exports 2 boundary-crossing links.
- **Result:** codegen emits ` node_2 =  node_undefined_output_2;`, which javac rejects. The `node_N` link in the error window can't match `undefined` either.

**B8. Deprecated members are hidden only in the right-click Add menus.** Low-Medium.
- **Cause:** the search box lists every registered type (`nodeGenerator.js:437-450` registers everything; `litegraph.js:7381` filters by substring only). The Outputs menu is built by `addClassIO` (`nodeGenerator.js:573`), which has no `isDeprecated` check.
- **Repro:** right-click a `Player` node → Outputs. 140 of the 831 entries are deprecated and unmarked, for example `banPlayer(String)`. This half-meets the branch goal "Hide `isDeprecated` members from the menus" in `batch.md`.

**B9. FlipFlop starts with B, although its description says A.** Low.
- **Cause:** the description reads "...starting with A" (`js/nodes/flow.js:67`). The branch runs in `getExecBefore` (`flow.js:83-90`) *before* the toggle body (`codeGenerator.js:684-692`), and `flipflop_N` starts as `false`, so the first run takes B. The `isA` output also updates only after the branch has run.

**B10. An unconnected `REF` makes the node vanish silently.** Low-Medium (UX).
- **Cause:** `codeGenerator.js:439-442` logs a console warning and `return`s.
- **Result:** the user sees javac's `cannot find symbol node_N_exec()` instead of "connect REF on node N".

**B11. An empty Soft-Depend field writes `softdepend: [""]`.** Low.
- **Cause:** `pages/infoEditor.html:155-160` splits and trims without dropping empty entries, and the editor saves on every close (`:139-141`). `main.js:706` writes the result. I didn't test how Paper reacts.

**B12. Docs screenshot is stale.** Trivial. `docs/images/project-info.png` shows "Soft-Depend (command-separated)", but the UI and the docs say "comma-separated" (`infoEditor.html:84`).

**B13. Duplicate entries in Recent Projects.** Low.
- **Cause:** creating a project adds it to recents without removing an existing entry for the same path (`main.js:390`). Opening a project does remove it (`:470-474`).
- **Seen:** the start page in `SP/harness/start.png` lists "JoinGreeter …/newproj" twice.

## Feature requests and changes (ranked)

1. **Working variables plus persistent player data.**
   - **What:** fix `Get`/`Set` (B1, B2): declare each name once, add EXEC through `Set`, and make `Get` a pure read. Then add typed storage nodes: "Get / Set player value" (key, type, default) backed by PersistentDataContainer, and "Get / Set global value" backed by a data file, so values survive restarts without Tomás touching `PersistentDataType` or YAML.
   - **Why Tomás cares:** cooldowns, join counts, homes and toggles are half their ideas.
   - **Where:** `js/nodes/variables.js`, new `js/nodes/storage.js`, `js/codeGenerator.js`.
   - **Effort:** M.
   - **Competitors:** Skript `{joins::%uuid of player%}` persists automatically; Denizen `flag player joins:++`.

2. **Commands as real nodes: arguments, permission, cooldown, tab completion.**
   - **What:** one "Command /name" event node per declared command, with typed argument outputs (player, material, int, text). Generate dispatch in `onCommand` with the return value honoured (B5), and a working `onTabComplete` (B4) that suggests online players and materials for typed arguments. Add Permission and Permission-message fields to the command editor, and emit `permissions:` in plugin.yml.
   - **Why Tomás cares:** every admin plugin is mostly commands.
   - **Where:** `pages/commandEditor.html`, `main.js` `makePluginYml` (`698-721`), `js/codeGenerator.js` template (`84-140`, `491-505`), new node.
   - **Effort:** M for dispatch + tab completion, L with Brigadier.
   - **Competitor:** Skript's `command /gift <player> <item>:` has `permission:`, `cooldown:` and usage built in.

3. **A search box that ranks and explains.**
   - **What:** hook `canvas.onSearchBox` (`litegraph.js:7356`) and show readable rows like "Player › sendRichMessage(String) — Sends a message with the MiniMessage format". Rank exact class and event matches first, prefer the Paper API over `java.*`, and allow fuzzy words ("join event"). Hide `Class{method}` variants except for JavaPlugin, constructors and `Runnable`. Hide deprecated members, or strike them through behind a toggle, in search *and* in Outputs (B8).
   - **Why Tomás cares:** search is how they find everything, and today "heal" finds `Raid`.
   - **Where:** `js/nodeGenerator.js` (`79`, `437-450`, `573`), `pages/graph.html`.
   - **Effort:** M.
   - **Competitor:** MCreator's procedure blocks are categorised and written in plain English.

4. **Constant nodes for static fields.**
   - **What:** expose `public static final` fields the way enums already work: a node with a dropdown, for `Sound`, `Attribute`, `PotionEffectType`, `PersistentDataType`, `Criteria`, `Registry`, and so on.
   - **Why Tomás cares:** sounds, potion effects and max health are everyday plugin stuff, and 14,112 such fields are unreachable today.
   - **Where:** `nodeGenerator.js` `addClassIO` (the enum branch at `537-549`), `codeGenerator.js` `generateCodeForEnumClassNode` (`394-405`).
   - **Effort:** S–M.

5. **Generics and auto-adapters.**
   - **What:** erase type variables to their bound or `Object` in slot types and fields (B3). Let any reference type or primitive connect to an `Object` parameter, boxing in the generated code. When Tomás connects `Object` → `String`, insert a `Cast` automatically or offer one.
   - **Why Tomás cares:** Map, List and `config.set` stop being puzzles, and `Cast` stops being a secret handshake.
   - **Where:** `nodeGenerator.js` `688-712` and `874-905`, `codeGenerator.js:418`.
   - **Effort:** M.

6. **config.yml support.**
   - **What:** a "Config" tab in Project Information where Tomás writes the default `config.yml`. Pack it into the jar by adding a resources directory to `javaCompiler.js:35-36` and keeping it out of the wipe at `main.js:727`. Call `saveDefaultConfig()` in `onEnable` automatically. Add a "Config value" node (path, type, default) and an optional built-in `reload` subcommand.
   - **Why Tomás cares:** a configurable message is the most basic thing a server owner asks for.
   - **Effort:** M.
   - **Competitors:** Skript `options:`, Denizen data and YAML scripts.

7. **Plain-English validation before javac.**
   - **What:** walk the graph and flag, with highlighting:
     - "Player is never executed — connect an EXEC into it."
     - "REF on sendRichMessage is not connected."
     - "Required input `amount` is empty."
     - links whose ends no longer exist (B7).
   - **Why Tomás cares:** today the failures are server-side NPEs or javac jargon (B10).
   - **Where:** new `js/validator.js`, called from `generateCodeCompilePackage` in `pages/graph.html`.
   - **Effort:** M.

8. **Pure data nodes, so getters and constants don't need EXEC.**
   - **What:** evaluate getters, constants, arithmetic and `StringFormat` on demand, wherever an exec node reads them (like Unreal's "pure" nodes).
   - **Why Tomás cares:** fewer wires, and no NPE when they forget to route EXEC through `Player`. The starter kit would shrink from 15 links to about 8.
   - **Where:** `js/codeGenerator.js` (object class nodes `271-392`, native nodes `632-711`).
   - **Effort:** L.

9. **A readable "learn" mode for the generated Java.**
   - **What:** emit one method per event or command with local variables named after the nodes (`player`, `message`) and getters inlined. Keep `// node 7` comments so debug highlighting still maps back. Add a "Show code for selected nodes" side panel. Retire the "do NOT use this code" banner once the output is decent. Use the project name for the class and a package derived from the author.
   - **Why Tomás cares:** they want to recognise real plugin structure when they read GitHub.
   - **Where:** `js/codeGenerator.js`, `main.js:335-345`.
   - **Effort:** L.
   - **Competitor:** MCreator shows readable Java.

10. **Snippets that carry project settings, plus an in-app recipe gallery.**
    - **What:** include commands, permissions and soft-depends in `.pbs` files and offer to merge them on import. Ship the five docs recipes, plus /heal-with-cooldown, a GUI menu, a sidebar and a crafting recipe, as one-click templates on the start page.
    - **Why Tomás cares:** importing /hello and then hand-registering `hello` is a needless trap, and learning from complete examples beats reading.
    - **Where:** `pages/graph.html` `serializeSnippet` / `configureSnippet` (`484-636`), `main.js` export/import, `index.html`.
    - **Effort:** S–M.

11. **Comments, node titles and reusable functions.**
    - **What:** restore Title, Collapse and Colors in the node menu (`nodeGenerator.js:350-371`) and add a Note node. Later, add "Make function from selection", with inputs and outputs, that generates a private method.
    - **Why Tomás cares:** graphs past 30 nodes become unreadable, and they'll copy the same permission-check block into every command.
    - **Effort:** S for menus and notes, L for functions.

12. **Third-party API packs (Vault, PlaceholderAPI, LuckPerms).**
    - **What:**
      - Generate class data for these APIs with `tools/classdata`.
      - Load it through the `external` branch that already exists in `classDataStore.loadClassFile` (`js/classDataStore.js:29`; `init` never uses it).
      - Add the jars to the compile classpath, and write `depend:` / `softdepend:` automatically.
      - Add a "Class literal" node for `ServicesManager.load(Class)`.
    - **Why Tomás cares:** economy and placeholders are what make a server plugin feel native.
    - **Effort:** M–L.
    - **Competitor:** Skript addons and Denizen bridges do exactly this.

13. **Collection loops.**
    - **What:** a typed `ForEach` over collections and arrays (online players, inventory contents), plus `While` and `Break`. Rename `ForLoop`'s "LastIndex" to show that it's exclusive.
    - **Why Tomás cares:** "do X to every online player" is common, and today it needs `toArray` + `Length` + `ForLoop` + `GetIndex` + `Cast`.
    - **Where:** `js/nodes/flow.js`.
    - **Effort:** S–M.

14. **Event options.**
    - **What:** `priority` and `ignoreCancelled` properties on event nodes.
    - **Why Tomás cares:** they need to play nicely alongside WorldGuard and EssentialsX.
    - **Where:** `codeGenerator.js:165-168`.
    - **Effort:** S.

15. **Saner defaults and a debug warning on compile.**
    - **What:** a blank author, or one taken from the OS user, instead of `inventivetalent`, and a package derived from the plugin name instead of `my.awesome.plugin`. When Tomás compiles with Debug on, show "This jar logs every node execution — turn Debug off before putting it on your server".
    - **Why Tomás cares:** they *will* forget, and 30 players breaking blocks means a log full of `pb_debug_exec=`.
    - **Where:** `main.js:335-345`, `main.js` `codeGenerated` handler.
    - **Effort:** S.

## Would Tomás keep using it?

Not for the server yet. Tomás got the five recipes working and enjoyed watching the nodes light up on the test server. But of their own eight ideas, one tab header was straightforward, six needed tricks they only found by reading the generator's source (Cast everything to Object, abuse `getConfig()` as a map, reference fields across chains), and Vault/PAPI was impossible. Tab completion and variables simply don't compile. Skript does /heal with a permission and a 30-second cooldown in six lines that they can read back next month. So Tomás keeps PluginBlueprint installed as a Paper-API explorer and a "what does a plugin even look like" sandbox, and keeps writing Skript for the real server. If the next release fixes variables and commands, gives the search box real ranking, and ships config.yml and constants (items 1–6), Tomás would genuinely try moving their small scripts over. The toolchain and docs are already better than they expected.
