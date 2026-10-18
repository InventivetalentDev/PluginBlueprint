# PluginBlueprint 2.0 (`codex/modernize`): persona review

Date: 2026-10-18. Five personas reviewed the branch. June drove the running app on macOS over CDP. The other four read the code and compiled real codegen output with javac against the Paper 26.3 classpath. Three of them (Tomás, Jonas, Ren) ran `nodeGenerator.js` and `codeGenerator.js` headless in plain Node. Ren also ran a separate Paper 26.3 test server for runtime checks.

Full persona reports are in this folder: [june.md](june.md), [tomas.md](tomas.md), [priya.md](priya.md), [jonas.md](jonas.md), [ren.md](ren.md).
The headless codegen scripts the personas wrote are in [`tools/codegen-harness/`](../../../tools/codegen-harness/). The scripts that drive the running app are in [`tools/app-driver/`](../../../tools/app-driver/).
The Java the app generated for the five docs examples on that day is in [`evidence/`](evidence/). A selection of June's screenshots is in [`images/`](images/).
The ranked items below are tracked in [`dev/roadmap.md`](../../roadmap.md).

## 1. Personas at a glance

| Persona | Profile | Verdict | Biggest like | Biggest dislike |
|---|---|---|---|---|
| **June Alvarez**, 15 | Never coded. Wants "cake + welcome on join" and "/spawn" | Not today. On a Mac they hit a wall within 10 minutes | Double-click `getPlayer` and a connected Player node appears | Everything speaks Java (`THIS`, `REF`, `en`, `castTo`), and nothing can be found |
| **Tomás Reyes**, 24 | Server admin who writes Skript and wants plugins without code | Keeps Skript for the real server. Uses PB as a Paper-API explorer | Zero-fuss toolchain, verified recipes | 1 of 8 ideas works directly, 6 need tricks found by reading the generator's source, 1 is impossible |
| **Priya Natarajan**, 29 | Has shipped 2 plugins with IntelliJ + Gradle, tired of boilerplate | Not for real plugins. OK for one-evening prototypes | Zero-config build, 0.5 s compile, live execution trace | No escape hatch: `src/` is wiped, there is no code node and no Gradle export |
| **Jonas Weber**, 32 | Maintains public Paper plugins (~10k servers) | Not yet, either for prototyping or for onboarding contributors | Accurate class data, codegen that runs headless | Shared-field state, no generics or static constants, so modern Paper is unreachable |
| **Ren Ishikawa**, 35 | NMS / internals expert, Paper contributor | Would show it to beginners, not recommend it for production | The toolchain already compiles *and runs* NMS code (probe passed) | Field-based state is unsafe for async and re-entrant events |

### Consensus likes (4–5 personas)
1. **The toolchain**: JDK detection with a checksummed Temurin fallback, sha256-checked Paper download from Fill v3, argfile classpath, `--release 25`, about a 0.5 s compile, and a 2.3 KB jar with a correct `api-version`.
2. **Node ↔ error mapping and a live trace.** `node_N` links in the compile-error window jump to the node, runtime stack traces light up nodes in orange, and debug mode animates the exec path.
3. **Docs and examples.** The recipes are verified, with snippets, screenshots and real output. This is a huge step up from the v1 wiki.
4. **The whole real Paper API.** 2,380 classes are generated from the real 26.3 sources by a reproducible pipeline, with Adventure/MiniMessage included.
5. **A built-in test server.** It starts in about 7 s, has a console box, and "reload" is stop → copy → start, not `/reload`.

### Consensus dislikes (4–5 personas)
1. **Silent or cryptic failures.** A missing input becomes `null`, a missing REF silently drops the node, and errors arrive as raw javac text about `node_7_output_1`.
2. **Generics and static constants are missing.** PDC, data components, registries, `Sound`, `NamedTextColor`, `Attribute`, `PotionEffectType`, `LifecycleEvents` and every `Map`/`List` getter are blocked.
3. **Commands are half done.** One shared `onCommand` that always returns true, no permissions, and tab completion breaks the build.
4. **Search is a firehose.** About 50k raw qualified names, no ranking, every method listed twice, deprecated and internal members mixed in, and 831 unsorted Outputs on `Player`.
5. **Generated code** stores every value in a plugin-wide field (async races, re-entrancy, stale references) and is unreadable on purpose. The banner says "do NOT use this code as a starting point".

## 2. Per-persona overview

### June Alvarez: never coded before
**Experience.** The start page looked friendly. Creating a project took about 4 s with everything cached (a fresh machine would also download 200 MB of Java and 55 MB of Paper), and the project folder is 223 MB. On macOS the editor has **no Save/Compile/Run/Git menus**, which every doc step tells June to use. Following Getting-Started exactly, the first link June made **silently overwrote a link in the starter graph** (link-ID collision). The first compile error then blamed a node June never touched, and the error text was cut off at the window edge. Fixing it deleted June's own wire, and the next compile *succeeded* with a Player that would be null at runtime.

Searching in plain words failed: "welcome" gave 0 results, "cake" found block data, and "ItemStack" returned 102 results without the class itself. The Outputs submenus and property dialogs open at the window corner, half off-screen. June got the cake working only by copying the starter-kit recipe and typing `org.bukkit.inventory.ItemStack` into a hidden text box. "/spawn" needed a Cast node June could never discover, and the console test printed a 30-line ClassCastException. On the good side, the test server started in 7 s and the broken node glowed orange.

**Likes:** double-click-to-spawn connected nodes; orange error highlighting and clickable `node_N` links; the starter-kit recipe was 90 % of the idea; a real server in 7 s; plain-ish tooltips.
**Dislikes:** Java jargon everywhere; finding anything (an 831-item Outputs menu, a 2,278-item material dropdown labelled `en`); menus and dialogs in the wrong place and SAVE buttons below the window edge; no Mac menus; broken graphs compile, and errors blame the wrong node.
**Top asks:** a plain-language "Simple" palette plus templates; friendly ranked search; a filterable Outputs picker; validation in June's words; a guide for putting the jar on a friend's server; a command wizard; an in-page toolbar with autosave.

### Tomás Reyes: admin who wants to build without code
**Experience.** The docs are honest and easy to follow, but they teach recipes, not concepts. Nothing explains that a class node only reads its getters when EXEC runs through it, and skipping that compiles fine and then throws an NPE. Only 3 of the 31 built-in nodes are documented, and `Cast` turned out to be the most important one. Their 8 ideas:

| Idea | Today |
|---|---|
| /heal + permission + cooldown | Workarounds (about 25 nodes, `getConfig()` used as a map; `HashMap#get` emits `private V`) |
| config.yml welcome + reload | Workarounds (can't ship a default config.yml) |
| Per-player join count | Workarounds (no PDC because the `PersistentDataType` constants are unreachable) |
| Chest GUI | Workarounds (`Equal` only takes primitives) |
| Crafting recipe | Workarounds (`char` entered as the number 68) |
| Scoreboard / tab header | Tab header works; sidebar needs workarounds |
| /gift with tab completion | Arguments need workarounds; **tab completion is impossible** |
| Vault / PAPI / LuckPerms | **Impossible** |

**Likes:** zero-fuss toolchain; the docs; the whole Paper API; errors that point at nodes; transparency (you can open the Java and plugin.yml).
**Dislikes:** a search firehose; a wiring tax with invisible rules; silent or cryptic failures; everyday building blocks out of reach (constants, generics, variables, config, tab completion); generated code that teaches the wrong structure.
**Top asks:** working variables plus persistent player data; commands as real nodes (arguments, permission, cooldown, tab completion); ranked search with descriptions; static constant nodes; generics plus automatic casts; config.yml.

### Priya Natarajan: has shipped plugins, wants less boilerplate
**Experience.** The build is genuinely good: a 0.46–0.57 s compile and a clean jar. Bad defaults ship, though: `author: inventivetalent`, `my.awesome.plugin.GeneratedPlugin`, and debug on (one log line per node, `-bN` versions). The tool removes the boilerplate Priya *doesn't* mind, like listener wiring and the build setup. It leaves the parts they hate: commands with permissions and tab completion, `config.yml`, and the restart loop. **Generate wipes `src/`** and javac gets exactly one file, so there's no helper class, no resources folder and no way out. Git is noisy: one-line JSON with float and color noise, a 125 KB thumbnail rewritten on every save, committed classes and jars, and a nested repo inside an existing one. Start Server **deletes other jars in `lib/plugins`**, so Priya can't test alongside LuckPerms or Vault.

**Likes:** zero-config build done right; live execution tracing; a built-in test server; no runtime lock-in (plain Java against the real API); honest docs.
**Dislikes:** no escape hatch; half-done commands and permissions; git noise and a project format that can't be diffed; slow iteration (no shortcuts, a full restart on reload, undo that skips moves and property edits); unsafe shipping defaults.
**Top asks:** keep `src/` and compile everything in it plus resources; a Java code node; per-command nodes with permissions and tab completion; complete plugin.yml and sane defaults; Gradle export plus a headless build; a git-friendly format.

### Jonas Weber: experienced Paper plugin developer
**Experience.** Jonas built 21 test graphs headless and compiled them all. Many easy graphs produce code that doesn't compile:
- Any regular JavaPlugin method node (`saveDefaultConfig`, `registerCommand`, `getCommand`) emits `node_2.saveDefaultConfig(}`.
- Type variables become `private C node_5_output_1` (259 API methods return a type variable, including `ItemStack#getData`).
- `onTabComplete` declares a field whose type is a comma-joined list of 14 classes.
- An unconnected overloaded parameter becomes an ambiguous `null`.
- Enum getters emit `Material.undefined`.
- Checked exceptions are never caught.

Event classification works by name, so abstract `PlayerEvent` and Adventure's `ClickEvent` are offered as events and break plugin enable. Modern Paper (PDC, data components, registries, lifecycle Brigadier, Folia) is unreachable, because there are no static-field nodes, no generics and no Brigadier class data. The anonymous-class machinery already generates a correct `BasicCommand`. Graph files can't be diffed, and one `CommandSender` REF type string is 6,697 characters long.

**Likes:** codegen is headless and deterministic (golden tests are cheap); accurate, reproducible class data; runtime errors map to nodes; a fully automated test loop; a happy path that compiles cleanly.
**Dislikes:** shared mutable fields; missing generics and constants; easy graphs that don't compile and no validation; 2012-style commands; nothing a reviewer can read.
**Top asks:** per-invocation locals; static constants and registry pseudo-enums; generics end to end; commands via `registerCommand(BasicCommand)`; event priority and `ignoreCancelled`; typed lambdas; reviewable artifacts plus "Export as Listener"; golden codegen tests in CI.

### Ren Ishikawa: expert, NMS and internals
**Experience.** The class data stops at the javadoc boundary: 0 `net.minecraft`, CraftBukkit, Brigadier, authlib or netty classes, and no `java.lang.reflect`. The **compile classpath already includes the unobfuscated, Mojang-named server jar** plus Brigadier, authlib and netty. Ren's NMS probe (CraftPlayer → ServerPlayer → send a packet, read the netty channel) compiled and ran on Paper 26.3. Only class data and a node model are missing.

Ren also found:
- Five node properties are pasted unchecked into the Java source, so a shared snippet can hide a `static {}` block (confirmed with javac and javap).
- `-DIReallyKnowWhatIAmDoingISwear` is a dead flag. No class in the server jar or its libraries reads it.
- Stop, close and quit hard-kill the server. On Windows that means no world save.
- The Paper build isn't pinned to the class data (b205 against b204).
- The class data is parsed three times, and about 50k node types are registered at startup.

**Likes:** a solid build pipeline; class data from source with CI; a single inspectable Java file; Paper-native behavior; real security work on this branch (telemetry removed, output escaped, `safeStorage` for credentials).
**Dislikes:** field-based state; a hard wall at the javadoc boundary; accidental escape hatches instead of an intentional one; an Event menu based on `endsWith("Event")`; a rigid test-server runner.
**Top asks:** locals instead of fields; an intentional code node with property validation; field nodes; generics-aware codegen; a correct event list; async badges and a "run on main thread" node; debug/release split; Brigadier; a bytecode extractor for library jars, then an opt-in internals pack.

## 3. Fix first: confirmed bugs that block the release

Each one is small. Together they take about 3–5 days.

| # | Bug | Where | Confirmed by | Effort |
|---|---|---|---|---|
| 1 | **macOS: no File/Compile/Run/Git menus.** You can't save, compile or test; Cmd+S/Z/Y are not registered. master has the same bug, but 2.0 ships a macOS `.dmg` | `pages/graph.html:310`, `infoEditor.html:126`, `log.html:67`, `index.html:99` (`setMenu` works on Windows and Linux only) | Live `Menu.getApplicationMenu()` dump | S–M: `Menu.setApplicationMenu` per focused window, or an in-page toolbar |
| 2 | **Link-ID collision after any snippet import, including every new project's starter graph.** The user's first link overwrites a starter link | `pages/graph.html:574` `++graph.last_link_id` against litegraph `last_link_id++` (`litegraph.js:2937`) | June live; code checked | S (one line) |
| 3 | **Context menus and property dialogs open at (0,0), off-screen and unfocused.** Electron 44 sends `PointerEvent` | `assets/lib/litegraph/litegraph.js:8095` (`constructor !== MouseEvent`) | June live; code checked | S (use `instanceof MouseEvent`) |
| 4 | **JavaPlugin method nodes emit broken syntax**: `node_2.saveDefaultConfig(}`. Affects `registerCommand`, `saveConfig`, `reloadConfig`, `getCommand` | `js/codeGenerator.js:481-506` | Jonas (javac) | S |
| 5 | **Property edits are not tracked.** No `*`, no undo, lost on close without a prompt | `pages/graph.html:325-375`, `main.js:122-133` | Priya, Tomás (code) | S |

### Other confirmed bugs, grouped

**Codegen produces code that doesn't compile.** Seen by Tomás, Jonas, Ren and Priya, all confirmed with javac.
- `Variables → Get` never declares its field, `Set` declares it again for each node, and `Set` has no EXEC out (`js/nodes/variables.js`).
- Type variables on method parameters and RETURN produce `private V …`. This affects 259 API methods by Jonas's count (Ren counted 792 with a broader filter). See `nodeGenerator.js:701/709/777`, `codeGenerator.js:418`. The batch.md fix landed only in the anonymous-class path.
- `onTabComplete` declares its RETURN with a comma-expanded type, and the override is never emitted (`codeGenerator.js:463`, `:504`).
- Unconnected object parameters become a bare `null` or `0`, which is ambiguous or the wrong type (`codeGenerator.js:474`). Emit `(Type) null`.
- Enum getters and instance methods: `Material.undefined`, and instance methods called statically (`codeGenerator.js:402`, `:454`).
- Checked exceptions are never caught (`FileConfiguration#save`). The class data has no `throws`.
- `StringFormat` without an input emits `String.format(fmt, )`; `Switch` without a condition emits `boolean val = null`.

**Code that compiles but is wrong at runtime.**
- The Event menu offers 18 abstract events (`PlayerEvent`, `Event`, …) plus 9 classes that aren't Bukkit events (`ClickEvent`, `HoverEvent`, lifecycle interfaces). The plugin is disabled on enable (Ren, live). See `classDataStore.js:43`.
- `onCommand` always returns `true`, so `usage:` never shows (`codeGenerator.js:109`).
- Shared-field state breaks async events (`AsyncChatEvent`, `AsyncPlayerPreLoginEvent`) and re-entrant ones. Inferred from the generated code.
- Unconnected inputs or REF compile silently into a null or a dropped node (`codeGenerator.js:439-442`, `:472-474`).
- FlipFlop starts on B; its description says A.

**Editor and app.**
- Start Server deletes every other jar in `lib/plugins` (`js/serverStarter.js:17-26`).
- Error-window text never wraps (`pages/error.html:47` uses `&nbsp;`).
- Auto-highlight picks the first `node_` in the javac text, not the node that owns the line (`graph.html:717-731`).
- Snippet export includes half-selected links, which import as `undefined` ends (`graph.html:501`).
- Search never shows the exact class for `ItemStack` or `Bukkit` (substring match, 100-result cap).
- The Outputs menu wheel scrolls the wrong way at 0.1× speed (`litegraph.js:8129`).
- The SAVE button sits below the window edge in the info editor (`main.js:833`) and the command editor (`main.js:856`).
- Double-clicking a method output never connects EXEC (`nodeGenerator.js:986` connects slot 0, which is THIS).
- Deprecated members are hidden only in the Add menus, not in search or Outputs. Internal API isn't marked at all.
- Duplicate entries in Recent Projects (`main.js:390`); `softdepend: [""]`; a stale screenshot; the editor-version check compares only the minor version.

**Server process.**
- Answering "No" to the unsaved-changes prompt still kills the server (`main.js:122-135`).
- Start while a server is running kills it, then shows an error (`main.js:893-903`).
- Stop, close and quit all use `child.kill()`. On Windows the world isn't saved.
- `-DIReallyKnowWhatIAmDoingISwear` is dead; `-Xmx2G` is hard-coded.
- The EULA is accepted by a flag without asking the user.
- Debug output is parsed from raw stdout chunks without line buffering.

**Project and git.**
- Creating a project in a folder that already has `src/`, `classes/`, `output/` or `lib/` hangs.
- `git init` runs inside an existing repo and overwrites `.gitignore`.
- Commit doesn't save first.
- Commit authors are fake ("PluginBlueprint", or `gitUser` used as the email too).

**Security.**
- Five node properties are pasted raw into the Java source. A shared snippet can hide arbitrary Java (Ren, javac and javap). See `constants.js:37/58`, `variables.js:20/23/43`, `misc.js:23/26/57`.
- Git credentials are keyed by `project.name` and `gitUser` from `project.pbp`, and are sent to whatever `origin` is set, including `http://`.
- Electron: `nodeIntegration` on, no `contextIsolation`, `@electron/remote` on every window, no CSP. Low risk today, but no defense in depth.

## 4. Features and changes, ranked across personas

Ranking: personas served × impact ÷ effort. Effort is for a solo maintainer: S = hours, M = 1–3 days, L = a week or more.

### A. Cheap, high-leverage (S to S–M)

| # | Change | Serves | Effort |
|---|---|---|---|
| A1 | **Golden codegen tests plus javac in CI.** Build each `docs/examples/*.pbs` plus the ~30 repro graphs the personas wrote, snapshot the Java, and compile against paper-api on the existing 3-OS workflow. The personas' headless scripts in `tools/codegen-harness/` are the starting point | Maintainer; would have caught most bugs above | S–M |
| A2 | **Static field / constant nodes.** Show `public static final` fields as outputs or a dropdown like enums. Treat classes whose static fields are all of their own type as pseudo-enums (`Sound`, `NamedTextColor`, `Attribute`, `PotionEffectType`). Unlocks `PersistentDataType.STRING`, `DataComponentTypes.*`, `RegistryKey.*` and `LifecycleEvents.COMMANDS` (~14k fields). The data is already loaded (`fieldsByName` is unused) | Tomás, Jonas, Ren, (June) | S–M |
| A3 | **Event options and a correct event list.** Add `priority` and `ignoreCancelled` properties on event nodes and a "Cancel event" node. Classify events by "extends `org.bukkit.event.Event` + concrete + has `getHandlerList`", not by name | Tomás, Priya, Jonas, Ren | S |
| A4 | **Debug as a runtime flag.** Emit `static final boolean PB_DEBUG = Boolean.getBoolean("pluginblueprint.debug")`; the test server passes `-D…=true`. The shipped jar is then always clean. Drop the `-bN` version coupling | All | S |
| A5 | **An in-page toolbar plus autosave plus ergonomics.** Save / Build & Reload / Test / Stop buttons in the page (also the macOS fallback). Autosave every 30 s with a visible Saved/Unsaved state. Cmd/Ctrl+B to build, Cmd+R to build and reload. Undo for moves and property edits, find-in-graph, note nodes and node titles. Hide the litegraph stats overlay | June, Priya, Tomás | S |

### B. Core capability (M)

| # | Change | Serves | Effort |
|---|---|---|---|
| B1 | **Validate the graph before compiling, in plain language.** Flag: an unconnected required input or REF, a node not on the EXEC chain, type-variable slots, abstract events, duplicate variables, dangling links. Highlight the node. Translate common javac errors ("You plugged a *Player* into a slot that needs a *PluginDescriptionFile*"). Map javac line numbers to nodes through a line→node table recorded during codegen | All 5 | M |
| B2 | **Commands done right.** One "Command /name" entry node per declared command, with typed argument outputs, a "players only" option, a permission and permission message, a working return value and tab completion. Generate `registerCommand(name, desc, aliases, new BasicCommand(){…})` (Jonas showed it already generates correctly once bug 4 is fixed). The command editor stays the simple UI; Brigadier via `LifecycleEvents.COMMANDS` can come later | All 5 | M |
| B3 | **Search and pickers overhaul.** Rank exact simple names first, show readable rows ("PlayerJoinEvent: when a player joins", package greyed out), add keyword aliases (welcome, give, spawn), hide `Class{method}` variants except where they make sense, and hide deprecated and `@ApiStatus.Internal` members everywhere. Replace the 831-item Outputs menu with a filterable picker ("Common" / "All"). Replace the `en` dropdown with a type-to-filter picker. Infer `MakeArray`'s type from its connections | June, Tomás, Jonas | M |
| B4 | **Generics, auto-cast and boxing.** Short term: erase type variables to their bound or `Object` and insert a Cast automatically; let `Object` accept everything; allow boxing and primitive widening; emit `(Type) null`. Long term: structured `typeArguments` in `JsonDoclet.java`, resolved from what's connected, so that `pdc.get(key, PersistentDataType.STRING)` → `String` | Tomás, Jonas, Ren | M (short) / L (full) |
| B5 | **An escape hatch.** (1) Generate only `GeneratedPlugin.java`, stop wiping `src/`, compile every `src/**/*.java`, and pack a `resources/` folder into the jar (S). (2) A **Java code node** with typed inputs and outputs, an EXEC pass-through, a distinct "custom code" look, and a warning when it appears in an imported snippet (M). At the same time, validate every property that reaches the source (closes the injection bug) | Priya, Ren, Jonas | S + M |
| B6 | **Working variables plus persistent storage.** Fix Get/Set, then add "player value" nodes (backed by PDC) and "global value" nodes (backed by a data file) with key, type and default | Tomás, Jonas, June | M |
| B7 | **config.yml.** A Config tab in Project Information that writes the default `config.yml` into resources, `saveDefaultConfig()` emitted automatically, a typed "Config value" node, and an optional built-in `reload` subcommand. Depends on B5(1) | Priya, Tomás | M |

### C. Big bets (L)

| # | Change | Serves | Effort |
|---|---|---|---|
| C1 | **Per-invocation locals and readable codegen.** One method per entry point with the exec chain inlined into `final` locals named after nodes, and `// node 7` comments plus a line map so debug highlighting still works. Fields only for explicit state (variables, FlipFlop). Fixes async races, re-entrancy and stale references, makes the output readable and reviewable, and opens the way to Folia. Prerequisite for C3 being worth much | Ren, Jonas, Priya, Tomás | L |
| C2 | **A "Simple" palette plus a templates gallery.** Plain-language blocks ("When a player joins", "Give item [picker] × n", "Send chat message", "Teleport to spawn", "Only players") that expand into the existing node chains. "New from template" with the 5 examples plus /heal-with-cooldown, a GUI menu, a sidebar and a crafting recipe. Snippets also carry commands and permissions | June, Tomás | M (6 blocks) / L |
| C3 | **Export.** A Gradle project (`build.gradle.kts` with paper-api, run-paper, src/main/java, resources), "Export as Listener" (a class that Jonas can drop into a real plugin and review as Java), and a headless `--build` CLI for CI | Priya, Jonas, Ren | M |
| C4 | **Library jars and third-party APIs.** A bytecode class-data extractor (ASM is already in `lib/libraries`, or the JDK ClassFile API) that writes the same JSON schema per jar, loaded lazily. "Add dependency" puts the jar on the classpath, fills the menus and writes `depend`/`softdepend`/`libraries:`. First targets: Vault, LuckPerms, PlaceholderAPI. Needs a class-literal node for `ServicesManager.load` | Tomás, Priya, Ren | L |
| C5 | **Multiple graphs and functions.** Several `.pbg` files per project (one class each), plus "Make function from selection" with typed parameters | Priya, Tomás | L |

### D. Later, or for power users

- **Git-friendly format (S–M):** pretty-printed `.pbg` with stable keys and rounded positions, no derived data (the expanded type lists, colors, shapes), editor state moved out of `project.pbp`, `.gitignore` for `classes/`, `output/`, `thumb.pbt` and `<Name>.pbp`, no nested `git init`, the git config identity used for commits, save before commit. *Priya, Jonas.*
- **Onboarding and defaults (S):** author from the OS or git user instead of `inventivetalent`, package derived from the name, a configurable main class name, Package and Soft-Depend under "Advanced", a first-run checklist (downloads, Minecraft 26.3), one EULA consent prompt, an "Install on your friend's server" doc and button. *June, Priya, Tomás.*
- **plugin.yml completeness (S–M):** `permissions:` editor, `depend`, `loadbefore`, `libraries`, `website`, `authors`, `prefix`; later a paper-plugin.yml target with a bootstrapper. *Priya, Jonas.*
- **Control flow (M):** ForEach over Iterable and arrays, Return/Break, an "Is null?" branch, try/catch with an "On error" exec for checked exceptions (needs `throws` in the doclet). *Tomás, Jonas, Priya.*
- **Typed lambdas (M):** `task -> {…}` with typed parameters for `Consumer<ScheduledTask>` and friends. Depends on C1 and B4. *Jonas.*
- **Thread awareness (M):** async badges on events and scheduler callbacks, full javadoc instead of the first sentence (the "this event is asynchronous" warning is cut today), a "Run on main thread" node. *Ren.*
- **Test-server controls (S–M):** port, heap, JVM args, an optional JDWP agent, graceful stop everywhere, a pid file for orphans, line-buffered parsing, a readable log (wrapping, collapsed stack traces, "join at localhost"). *Ren, June.*
- **One shared Paper install per version (M):** 217–223 MB per project today. *Priya, June.*
- **Class-data quality (S–M):** `throws`, `@ApiStatus.*`, nullability; add `adventure-text-serializer-plain`/`-legacy` (no chat filter is possible without `PlainTextComponentSerializer`) and Brigadier; pin the Paper build to the class data. *Jonas, Ren.*
- **Opt-in internals pack (L):** the bytecode extractor run over the server jar with a curated allow-list, lazy loading, a distinct node color, a "version-specific" badge, and warnings on Minecraft upgrades. A packet-listener node only inside this pack. Mixins are out of scope. *Ren.*
- **Electron hardening (M):** contextIsolation plus a preload, no `@electron/remote`, a CSP, navigation guards. *Ren.*

## 5. Where personas disagree, and the proposed resolution

1. **The compile classpath.** Jonas wants API-only compiles so plugins can't silently depend on internals. Ren values the server jar being on the classpath (NMS already works). → Compile against API only by default. Add the server jar only when the project enables "internals" or contains a code node.
2. **Friendly names or the full API.** June needs Java hidden; Tomás and Jonas need the whole API. → The "Simple" palette (C2) generates normal nodes and the full API stays one click away. Keep both.
3. **Readable code or the live trace.** C1 removes the `node_N_exec` structure the debug trace depends on. → Keep `// node N` markers and a line→node map, and generate the trace calls from those.
4. **Brigadier or plugin.yml commands.** → `registerCommand(BasicCommand)` keeps the simple command-editor UI, gives per-command handlers, permissions and suggestions, and needs no Brigadier class data. Brigadier trees can come later.

## 6. Suggested order

1. **Phase 1, about 1 week:** the 5 release blockers plus the grouped compile-breaking codegen bugs, then A1 golden tests so they stay fixed. Also A4 (debug flag), since it's tiny. This makes a good codex-handoff batch: small, independent fixes, each with a repro graph.
2. **Phase 2, about 2–3 weeks:** A2 constants, A3 events, A5 toolbar/autosave, B1 validation, B2 commands, B5(1) keep `src/` + resources, B7 config.yml.
3. **Phase 3, about 3–4 weeks:** B3 search and pickers, B4 generics (short form), B5(2) code node with property validation, B6 variables and storage, C2 first 6 simple blocks plus templates.
4. **Phase 4:** C1 codegen rewrite to locals, then C3 export (it pays off once the code is readable), then C4 library jars.
5. **Later:** C5 multiple graphs, git format, shared Paper install, the internals pack, Electron hardening.
