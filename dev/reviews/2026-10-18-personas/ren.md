# Ren Ishikawa — expert, NMS and server internals

> Written on 2026-10-18 against `codex/modernize` at `6700653`. Paths that start with `SP/` point to the review session's scratch folder, which no longer exists. The headless codegen scripts are now in `tools/codegen-harness/`, the app-driving scripts are in `tools/app-driver/`, the generated examples are in `evidence/`, and a selection of June's screenshots is in `images/`.

Ren is 35 and writes NMS code every day: packets, custom entities, world generation, chunk and tick internals. They use Mojang mappings, paperweight-userdev, MethodHandles, ASM and Mixin-style patching, and have had patches merged into Paper.
They reviewed `codex/modernize` (app 2.0.0, Paper 26.3) to decide whether to recommend PluginBlueprint and what power users would need. They read the code only and did not use the running app.

## Walkthrough

### 1. What the class data covers

`tools/classdata/generate.mjs` downloads the Paper server, runs paperclip in patch-only mode, and fetches the `paper-api` and Adventure (`adventure-api`, `-key`, `-text-minimessage`) **source jars**. It then runs `javadoc -protected` with a custom doclet (`JsonDoclet.java`) over those sources. `java.json` comes from `src.zip` of the JDK, limited to 16 `java.base` packages (`JsonDoclet.java:15-18`). Ren counted the shipped data with a node one-liner:

| Top-level package | Classes |
|---|---|
| `org.bukkit` | 1,404 (of which `org.bukkit.craftbukkit`: 0) |
| `io.papermc` | 577 |
| `net.kyori` | 247 |
| `com.destroystokyo` | 133 |
| `co.aikar` | 17 |
| `org.spigotmc` | 2 |
| `net.minecraft`, `com.mojang`, `io.netty`, `com.google`, `org.slf4j`, `org.apache` | **0** |
| `java.*` (java.json) | 721 |

`paper.json`: 2,380 classes, 13,796 methods (1,006 deprecated), 1,254 constructors, 14,152 fields. Meta: `minecraftVersion 26.3, paperBuild 204, javaVersion 25`.

Notable gaps in the data:
- Paper's own API signatures refer to 15 `com.mojang.brigadier.*` types (`LiteralArgumentBuilder`, `CommandContext`, `ArgumentType`, …) that have **no class data**. The Paper Brigadier command API is listed, but you cannot build anything with it.
- `java.lang.reflect` and `java.lang.invoke` are not included. `Class#forName` exists, but `Class#getMethod` returns a `java.lang.reflect.Method` that has no node. Reflection therefore stops at the first step.

**Member filtering.** The doclet keeps public and protected members of public types (`JsonDoclet.java:71-84`) and only *declared* members. `addClassIO` walks interfaces and the superclass to collect inherited methods (`nodeGenerator.js:621-640`). Type arguments are erased in slot types: `typeData` keeps only the raw `qualifiedName` (`JsonDoclet.java:186-201`), so `List<Player>` becomes a `java.util.List` slot. The context menus filter on `isApiClass` (`nodeGenerator.js:79-82`) and `isDeprecated` (`:91`, `:107`, `:138`, …). However, `ensureNodeRegistration` (`nodeGenerator.js:437-452`) registers **every** class, method (twice: as a call node and as an abstract node) and constructor from both files. That is about 50,454 LiteGraph node types (3,101 classes, 2 × 21,878 methods, 3,597 constructors). From reading the code (not tried in the app): the LiteGraph search box searches `Object.keys(LiteGraph.registered_node_types)` (`litegraph.js:7380`) and is not turned off (`graph.html:383-384` only sets `search_filter`/`search_limit`). Typing a name therefore reaches `java.*`, `co.aikar`, and the deprecated members that the menus hide.

**Fields are never nodes.** `addClassIO` iterates only `methodsBySignature` (`nodeGenerator.js:573`). Enum constants are the only exception. Neither generator reads `fieldsByName`. This leaves **13,844 non-deprecated public static fields** in the API with no node. Examples: `Sound` (an interface with 1,991 static fields), `Attribute` (40), `PotionEffectType` (40), `Enchantment` (43), `NamedTextColor` (17), `Biome` (68), and all 40 `Registry.*` constants. Without deprecated methods, `PotionEffectType` can only be obtained through `getById(int)`.

**Escape hatches.** There is no raw-Java node, no reflection node, no "class by name" node, no way to add library jars, and no other plugins' APIs. `softdepend` is written to plugin.yml (`main.js:706`), but there is no way to call a soft-dependency. `ClassDataStore.loadClassFile(name, external)` can still read `userData/jjdoc/*.json` (`classDataStore.js:29`), but `init()` loads only `java` and `paper` (`:110-118`). The only "hatches" are accidental ones: free-text node properties are inserted into the generated source (see Bugs, S1). `Cast.castTo` (`misc.js:23-26`) lets you write `(org.bukkit.craftbukkit.entity.CraftPlayer) x`, which compiles. But there is no node for `CraftPlayer#getHandle()`, so the cast leads nowhere.

### 2. The compile classpath already contains server internals

`lib/javac.args` has 105 jars: everything under `lib/libraries` plus `lib/versions/26.3/paper-26.3.jar` (`paper.js:44-57`, `javaCompiler.js:8`). The server jar is **unobfuscated with Mojang names**. It contains `net/minecraft/server/level/ServerPlayer.class`, `org/bukkit/craftbukkit/entity/CraftPlayer.class` (in an unversioned package), and `ServerGamePacketListenerImpl.class`. `unzip -l` lists 7,801 `net/minecraft` classes, 954 `org/bukkit/craftbukkit` classes and 982 `ca/spottedleaf` classes. Brigadier 1.3.11, authlib 10.0.77, DFU 10.0.21 and netty 4.2.16 are also on the classpath. Ren found no plugin remapper in the jar (`grep -i pluginremap|reobf` found nothing).

Ren compiled a probe class against the app's exact classpath:

```java
ServerPlayer sp = ((CraftPlayer) p).getHandle();
sp.connection.send(new ClientboundSetTitleTextPacket(Component.literal("hi")));
Channel ch = sp.connection.connection.channel;
GameProfile gp = sp.getGameProfile();
LiteralArgumentBuilder<Object> b = LiteralArgumentBuilder.literal("x");
```
`javac @cp.args -d out NmsProbe.java` exits with code 0. Ren then started a separate Paper 26.3 build 205 (in `SP/p5/srv`, port 25599) with a plugin that calls `((CraftServer) getServer()).getServer()` and `((CraftWorld) w).getHandle()`:
```
[NmsRuntimeProbe] NMS OK: net.minecraft.server.dedicated.DedicatedServer level=ResourceKey[minecraft:dimension / minecraft:overworld] players=0 brigadier=com.mojang.brigadier.CommandDispatcher
```
**The toolchain can already build and run NMS code. Only class data and a node model are missing.**

**What a bytecode extractor could get from this jar.** `javap -v` shows generic `Signature` attributes, for example `Ljava/util/Set<…ThrownEnderpearl;>;`, and jspecify `@Nullable` type annotations. `javap -c -l` shows a `LocalVariableTable` on 251 of 253 `ServerPlayer` methods that have code, and on 607 of 610 such methods in `Entity`. For example, `teleportTo(double x, double y, double z)` has its parameter names. Abstract and interface methods have no Code attribute, and `MethodParameters` is absent (0 in `Entity`), so interface methods would get `arg0…`. A javadoc doclet cannot be used here: there is no sources jar for the server. ASM 9.9.1 is already in `lib/libraries`, and the JDK's ClassFile API (stable since JDK 24) would also work.

### 3. The generated code at runtime

Ren read the generated examples in `SP/evidence/generated/` (block-protect, hello-command, join-message, starter-kit, timed-broadcast). Then they ran the **real** `nodeGenerator` and `codeGenerator` in plain Node with LiteGraph and synthetic graphs (harness `SP/p5/cg/harness.js`) and compiled the output against `javac.args`.

**State model.** Every node output, and every object a node acts on, is a field of the plugin instance:
```java
private org.bukkit.event.block.BlockBreakEvent  node_2;
private org.bukkit.entity.Player node_2_output_2;
public void on2(org.bukkit.event.block.BlockBreakEvent event) {
getLogger().info("pb_debug_exec=2");/** Debug call **/
 node_2 = event;
 node_2_output_2 = event.getPlayer();
 node_3_exec();
```
(`block-protect.java`; emitted at `codeGenerator.js:170`, `193`, `201`, `295`, `418`, `677`.) This has three consequences:
- **Re-entrancy.** If a handler triggers the same event synchronously, the inner call overwrites `node_*`, and the outer handler then continues with the inner call's objects. Example: calling `damage()` inside an `EntityDamageEvent` graph.
- **Async events.** The Event menu offers 16 async or possibly-async events, including `AsyncChatEvent`, `AsyncPlayerPreLoginEvent`, `AsyncTabCompleteEvent` and `AsyncPlayerSpawnLocationEvent`. Their handlers write to the same non-volatile fields from chat or login executor threads at the same time. Ren's `asyncchat` scenario compiles cleanly to `node_2_output_2 = event.getPlayer();`. Two players chatting at once can cross-wire. The Bukkit scheduler's `runTask*Asynchronously` methods are also offered without any marking.
- **Retention.** Fields are never cleared, so the last `Player`, `World`, `Block` and event objects stay reachable after the handler returns. That includes a `CraftWorld` after the world unloads.

**Lifecycle.** Ren checked this before complaining: `PaperPluginInstanceManager.disablePlugin` calls `BukkitScheduler.cancelTasks`, `GlobalRegionScheduler.cancelTasks`, `AsyncScheduler.cancelTasks`, `ServicesManager.unregisterAll` and `HandlerList.unregisterAll` (javap). The empty generated `onDisable` and the discarded `BukkitTask` from `runTaskTimer` (`timed-broadcast.java`) are therefore **not** leaks. "Reload plugin" is stop → copy → start (`main.js:1011-1018`), not `/reload`.

**Debug logging cost.** New projects have `debug: true` (`main.js:345`). Every node method starts with `getLogger().info("pb_debug_exec=N")` (`codeGenerator.js:806-807`). The string is a compile-time constant, so there is no concatenation cost. The cost is the JUL→Log4j path plus a LogEvent per node per invocation, delivered through Paper's `<Async>` appender (`log4j2.xml` in the server jar). Log4j's default queue blocks when full (Log4j default; Ren did not check the jar's setting). On a `PlayerMoveEvent` graph with 10 nodes, that is about 200 log lines per second per moving player. The app hides these lines from its own log window (`main.js:958-963`, `continue;// don't log`), so the user never sees the volume they are about to ship. The docs do say to turn Debug off before publishing (`Testing-your-Plugin.md:60`).

**Other runtime notes.** No reflection and no boxing beyond `String.format` varargs. Each `Runnable` node is an anonymous inner class (`timed-broadcast.java`), which is fine. `@EventHandler` is always emitted bare (`codeGenerator.js:167`): no `priority`, no `ignoreCancelled`. A protection plugin really wants `LOWEST` or `HIGHEST` with `ignoreCancelled = true`.

### 4. Harness results (compiled with `javac @javac.args`)

| Scenario | Result |
|---|---|
| Variables `Get` → `ConsoleLog` | `error: cannot find symbol … variable node_4_output_0` (×2) |
| `Bukkit#getBanList(BanListType<B>)` RETURN connected | `error: cannot find symbol … class B` and `reference to getBanList is ambiguous` |
| `PlayerEvent` (abstract) as event node | compiles; on Paper 26.3 b205: `Error occurred while enabling … IllegalPluginAccessException: Unable to find handler list for event org.bukkit.event.player.PlayerEvent` and the plugin is disabled |
| `net.kyori.adventure.text.event.ClickEvent` as event node | compiles; server: `attempted to register an invalid EventHandler method signature "public void …on2(net.kyori.adventure.text.event.ClickEvent)"` |
| `NumberConstant.number = "0; static { System.out.println(\"INJECTED…\"); } private int pbX = 0"` | **compiles**; `private int node_3_output_0 = 0; static { … } private int pbX = 0;` |
| `Get.name` payload | compiles; `javap` shows `static {}` running `System.out.println("INJECTED at class load")` |

### 5. Toolchain and process handling

- **Paper download** (`paper.js:16-42`): Fill v3, descriptive User-Agent, SHA-256 from the build metadata over TLS, and a cache keyed by build. Good. However, it downloads `builds/latest` with no channel check and no pin to the class-data build: the data says build 204, the evidence project has build 205.
- **JDK** (`jdk.js`): any JDK ≥ `javaVersion` is accepted (`:33`). On this machine, `findJdk` would pick the JDK 27 on PATH, so it would compile with `--release 25` and also run the test server on 27 (inferred; the server JDK is not pinned). Adoptium SHA-256 is checked (`:69`), no User-Agent is sent (`:47`), and archives are extracted with the system `tar` (`:72`). GNU tar and bsdtar both refuse `..` and absolute member paths by default (not tested here). Together with the checksum, Ren is fine with this.
- **Server JVM** (`serverStarter.js:38`): `-Xmx2G -DIReallyKnowWhatIAmDoingISwear -Dcom.mojang.eula.agree=true -jar paper.jar nogui`. `/usr/bin/grep -a` over the fully extracted 26.3 server jar, the paperclip jar and all 104 library jars found **no class that reads `IReallyKnowWhatIAmDoingISwear`**: it is a dead CraftBukkit-era flag. `com.mojang.eula.agree` is read by `net.minecraft.server.Main` (bytecode offset 407, which logs "You have used the Paper command line EULA agreement flag"). The docs mention it, but the app never asks for consent. Heap, JVM arguments, port and a JDWP agent are not configurable.
- **Stopping**: `stopServer()` sends `stop` and kills after 30 s (`serverStarter.js:64-75`), but only Reload uses it. The Stop menu item, closing the log window, closing the main window and `will-quit` all call `killInstance()`, which is `child.kill()` (`serverStarter.js:85-91`, `main.js:134`, `165`, `1003`). On POSIX, SIGTERM triggers Minecraft's shutdown hook. On Windows, Node's `kill()` is TerminateProcess, so the world is not saved.
- **Per-project disk use**: 217 MB in `lib/` (paper.jar 53 MB, libraries 74 MB, versions 30 MB, paperclip cache 60 MB).
- **Electron**: all five windows use `nodeIntegration: true, contextIsolation: false, sandbox: false` with `@electron/remote` enabled (`main.js:90/98, 748/758, 829/840, 852/863, 907/917`). There is no CSP and no `will-navigate` or `setWindowOpenHandler` guard. The branch *does* escape server output and javac output before inserting them as HTML (`log.html:115`, `error.html:44`), and Ren found no remote content loaded. The posture is acceptable today, but there is no defense in depth.
- **Git** (`versionControl.js`): credentials are encrypted with `safeStorage` (good), but they are keyed by `"pluginblueprint-git-" + project.name` and `project.gitUser`, both read from `project.pbp` (`:101-111`). `setRemote` accepts any URL, including `http://` (`:84`).

## Likes (max 5)

1. **The build pipeline is solid.** Fill v3 with SHA-256 and a User-Agent, paperclip `patchonly`, an argfile classpath with `--release`, and the full unobfuscated server jar on the classpath. Ren's NMS probe compiled and ran on the first try.
2. **Class data comes from source and can be reproduced.** A 272-line doclet, a weekly CI job that opens a PR, and schema tests (`tools/classdata/test`). Building from Paper's own sources is the right design.
3. **The generated code is a single, inspectable Java file.** `node_N` names map javac and runtime errors back to the graph (`error.html:45`, `log.html:116`).
4. **It is Paper-native.** Adventure and MiniMessage (`sendRichMessage`), a quoted `api-version`, stop/copy/start instead of `/reload`, and the server's own `disablePlugin` cleanup covers tasks and listeners.
5. **The security work on this branch is real.** Telemetry is gone, output is HTML-escaped, and git credentials use `safeStorage`.

## Dislikes (max 5)

1. **Storing every node output in a field.** Every value lives in a plugin-instance field, which is wrong for async events, re-entrant events and object lifetime. This is the main thing standing between this tool and "safe to recommend".
2. **A hard wall at the javadoc boundary**, even though NMS, Brigadier, authlib and netty are already on the classpath. There are no field nodes (13,844 constants unreachable), no generics (792 methods return a bare type variable and fail to compile), no code node and no external jars.
3. **Accidental escape hatches instead of an intentional one.** Five text or number properties are inserted raw into the Java source.
4. **The Event menu is built on `name.endsWith("Event")`** (`classDataStore.js:43`). It offers 18 abstract events that make `onEnable` throw, and 9 classes that are not Bukkit events at all.
5. **The test-server runner is rigid.** It uses a dead flag, a hard-coded `-Xmx2G`, no JVM arguments, port setting or debug agent, and Stop is a hard kill on Windows.

## Bugs found

### Correctness

- **C1. The Variables `Get` node never compiles.** Confirmed with javac.
  - **Where:** `js/nodes/variables.js:28-45`. `Get` has `getMethodBody` but no `getFields`, so `generateCodeForNativeNode` (`codeGenerator.js:669`, `677`) never declares `node_N_output_0`. `Get` also has no EXEC input, so `node_N_exec()` would never run anyway.
  - **Repro:** add Set(name=x) and Get(name=x), connect Get to ConsoleLog, compile. javac reports `cannot find symbol: variable node_4_output_0`.
  - **Severity:** High. The Variables category does not work.
- **C2. Methods that return a type variable produce `private T node_…`.** Confirmed with javac.
  - **Where:** `codeGenerator.js:418` (also `201` and `295` for getter outputs). The doclet stores the type variable's simple name as `qualifiedName` (`JsonDoclet.java:219`). This affects 792 non-deprecated methods, including `Registry#get`/`getOrThrow`, `World#spawn(…, Class<T>, …)`, `ServicesManager#load`, `JavaPlugin#getPlugin` and `Bukkit#getBanList`.
  - **Repro:** a `Bukkit#getBanList(BanListType<B>)` node with RETURN connected gives `cannot find symbol: class B`.
  - **Severity:** High for anyone beyond the basics.
- **C3. Unconnected object parameters become a bare `null`.** For overloaded methods this gives `reference to X is ambiguous`. Confirmed with javac.
  - **Where:** `codeGenerator.js:474`, `util.js:25-41`. The fix is to emit `(fully.qualified.Type) null`.
  - **Severity:** Medium.
- **C4. The Event menu offers classes that break the plugin.** Confirmed on a live Paper 26.3 b205.
  - **Where:** `classDataStore.js:43` with `nodeGenerator.js:84-128`.
  - **Abstract events (18):** events without a `getHandlerList` in their superclass chain, such as `PlayerEvent`, `EntityEvent`, `BlockEvent`, `AbstractChatEvent`, `WorldEvent` and `Event` itself. `PaperEventManager.registerEvents` has no try/catch around `getRegistrationClass` (javap), so `IllegalPluginAccessException` aborts `onEnable` and the server disables the plugin. Every other handler in the graph dies with it.
  - **Not Bukkit events (9):** `ClickEvent`, `HoverEvent`, `GameEvent`, and the six interfaces `LifecycleEvent`, `RegistrarEvent`, `ReloadableRegistrarEvent`, `RegistryEvent`, `RegistryEntryAddEvent` and `RegistryComposeEvent`. Using one produces an "invalid EventHandler method signature" error. Because these classes are classified as events, `ClickEvent` and `HoverEvent` cannot be used as objects either: a RETURN of `ClickEvent.runCommand(...)` double-clicks into a bogus listener.
  - **Severity:** Medium-High.
- **C5. `onTabComplete` graphs are never emitted.** Confirmed by reading the code.
  - **Where:** the nodes are collected in `onTabCompleteMethods` (`codeGenerator.js:503-504`), but the class template (`:60-140`) never adds an `onTabComplete` override.
  - **Severity:** Medium. The feature fails silently.
- **C6. `onCommand` always returns `true`, and every command graph runs for every command.** Confirmed by reading the code.
  - **Where:** `codeGenerator.js:109` (`// TODO: variable return`). `node_N_return` is computed and then ignored (`hello-command.java`). All onCommand nodes run for any of the plugin's commands; there is no routing by `command.getName()`.
  - **Severity:** Low-Medium.
- **C7. Shared-field state breaks async and re-entrant execution.** Inferred: this follows from the code structure and was not reproduced with players.
  - **Where:** `codeGenerator.js:170` and the other field emissions listed in Walkthrough §3. Concurrent `AsyncChatEvent` and `AsyncPlayerPreLoginEvent` handlers race on the same fields, and a synchronously nested event overwrites the outer handler's values.
  - **Severity:** High for async events, Medium for re-entrancy.
- **C8. Retained references.** Inferred. Fields hold the last event, `Player`, `World` and so on indefinitely, which keeps unloaded worlds and quit players reachable.
  - **Severity:** Medium on servers that load and unload worlds (minigames).
- **C9. Javadoc descriptions are cut at the first `.`.** Confirmed.
  - **Where:** `classDataStore.js:47`. This drops thread-safety notes. `AsyncPlayerPreLoginEvent` becomes "Stores details for players attempting to log in", and the sentence "This event is asynchronous, and not run using main thread" is lost. Raw `{@link …}` text is also shown.
  - **Severity:** Low, but it matters for safety.
- **C10. Latent bugs that are harmless today.**
  - `enumMethods.splice(0, objectMethods.length)` runs after `objectMethods` has been emptied (`codeGenerator.js:155`), but nothing pushes to `enumMethods`.
  - `constructorName: constructor.name` refers to an undefined local, so the free identifier resolves to the global object's `constructor` (`Window` in the renderer) (`nodeGenerator.js:834`). `constructorName` is never read.
  - **Severity:** Trivial.

### Security

- **S1. Node properties are inserted into Java source unchecked.** Confirmed: the injected code compiled, and `javap` shows the `static {}` initializer.
  - **Where:**
    - `NumberConstant.number` and `.type` (`constants.js:37`)
    - `BooleanConstant.value` (`:58`)
    - `Set`/`Get` `name` (`variables.js:20`, `23`, `43`)
    - `Cast.castTo` (`misc.js:23`, `26`)
    - `InstanceOf.type` (`misc.js:57`)
  - **How it reaches the build:** these values come straight from `.pbg` or `.pbs` JSON (`main.js:1080-1088` → `graph.html:699-703 configureSnippet`).
  - **What the canvas shows:** `Get`, `Set` and `Cast` rebuild their labels from the property in `onDrawBackground`, so a payload there is visible, but as a long label that is easy to miss. `NumberConstant` and `BooleanConstant` update their label only in `onPropertyChanged`, and the global `onConfigure` only recomputes size (`nodeGenerator.js:372-374`). A loaded snippet therefore keeps whatever output label it was saved with, for example `int 5`, while the build contains a static initializer. This last point is inferred from the code; Ren did not render it.
  - **Impact:** a shared snippet or project can hide arbitrary Java. That code runs on the local test server with the user's privileges, and later on production servers.
  - **Severity:** Medium. It requires importing an untrusted graph, but users reasonably expect a graph to do only what its nodes show.
- **S2. Git credentials can be sent to a project-controlled remote.** Inferred scenario; the code path is confirmed.
  - **Where:** `versionControl.js:99-113` looks up the stored password by `project.name` and `project.gitUser` from `project.pbp`. `push` sends it as HTTP Basic auth to whatever `origin` is in `.git/config`, and `setRemote` accepts `http://` (`:84`).
  - **Scenario:** a cloned project with the same name and user and a foreign remote receives the password on Push without a prompt.
  - **Severity:** Low-Medium.
- **S3. The Electron setup has no defense in depth.** Confirmed by reading the configuration.
  - **Where:** `nodeIntegration`, no `contextIsolation`, no sandbox, and `@electron/remote` on every window (`main.js:90`, `748`, `829`, `852`, `907`). There is no CSP and no navigation guard.
  - **Severity:** Low. It is mitigated today by escaping (`log.html:115`, `error.html:44`), but any future HTML-injection bug becomes code execution on the machine.
- **S4. The class-data CI downloads some files without checksums.** Confirmed by reading the code.
  - **Where:** Gradle `.module` metadata and dependency jars (`generate.mjs:114`, `128`, `download(url, target)` without a checksum). These files are only used as javadoc classpath, not shipped.
  - **Severity:** Low.

### Robustness

- **R1. Stopping the server on Windows does not save the world.** Inferred from Node's documented `kill()` behaviour on Windows.
  - **Where:** Stop, window close and quit all call `child.kill()` (`serverStarter.js:85-91`, `main.js:134`, `165`, `1003`). On Windows this is TerminateProcess, so there is no shutdown hook and no world save, and `session.lock` is left behind. `stopServer()`, which sends `stop`, exists but is used only by Reload.
  - **Severity:** Medium on Windows.
- **R2. "Start server" while a server is running kills it and then shows an error.** Confirmed by reading the code.
  - **Where:** `main.js:894` calls `killInstance()` and then `:901` checks `isRunning()`, which is still `true` until `exit` fires. The user sees "Please wait for the existing server to shut down".
  - **Severity:** Low.
- **R3. The server is orphaned if Electron crashes.** Inferred. The child is not tied to the parent's lifetime. EOF on stdin does not stop Minecraft, so port 25565 stays in use.
  - **Severity:** Low-Medium.
- **R4. Debug lines are parsed from raw stdout chunks without line buffering.** Inferred.
  - **Where:** `main.js:949-963`. `pb_debug_exec=12` split across two chunks highlights node 1, or leaks the fragment into the log.
  - **Severity:** Low.
- **R5. The server JVM flags are dead or fixed.** Confirmed.
  - **Where:** `serverStarter.js:38`. `-DIReallyKnowWhatIAmDoingISwear` is dead (see Walkthrough §5), `-Xmx2G` is hard-coded, and there are no JVM arguments, port setting or JDWP agent. The EULA is accepted by flag with no consent prompt in the app.
  - **Severity:** Low.
- **R6. The Paper build is not pinned to the class data.** Confirmed.
  - **Where:** `paper.js:19` downloads `builds/latest` (b205 in the evidence project) while the class data is from b204, and there is no `STABLE` channel check. The CI also refreshes the data only when the Minecraft version changes (`class-data.yml`), so API added during a version is missed.
  - **Severity:** Low.
- **R7. The class data is parsed three times, and every node type is registered at startup.** Confirmed.
  - **Where:** separate `ClassDataStore` instances in `nodeGenerator.js:30` and `codeGenerator.js:7` (28.6 MB of JSON each), plus `paper.js:12`, which parses all of the 17.8 MB `paper.json` in the main process just to read `meta`. About 50k node types are registered eagerly (`nodeGenerator.js:437-452`).
  - **Severity:** Low today. It blocks any expansion to NMS.
- **R8. Debug is on by default, and its output is hidden in the app.** Confirmed.
  - **Where:** `main.js:345`, `958-963`. The jar you test is the jar you ship.
  - **Severity:** Low-Medium.

## Feature requests and changes (ranked)

1. **Generate local variables per call instead of instance fields.**
   - **What:** Generate each event handler, command and Runnable as one method in which the exec chain is inlined and node outputs are **local variables**. Keep fields only for state the user explicitly marks as persistent (the Set and Get variables, FlipFlop). This fixes C7 and C8, removes one method call per node, and makes the code readable.
   - **Why Ren cares:** without this, Ren cannot recommend the tool for anything that touches async events.
   - **Where:** `js/codeGenerator.js` (most of it); the native nodes' `getFields`/`getMethodBody` contract in `js/nodes/*.js`.
   - **Effort:** L.
   - **Risk for beginners:** none; it is invisible to them.
2. **An intentional "Java code" node, and closing the accidental hatches.**
   - **What:** A node with user-declared typed inputs and outputs, a code body, optional imports, javac errors mapped back to the node, and a clearly distinct look (for example a red "custom code" header). At the same time, validate every property that reaches the source: identifiers (`^[A-Za-z_$][\w$]*$`), finite numbers, class names that exist in the class data, and the enum values in `NumberConstant.type`. Re-validate when loading `.pbg`/`.pbs` files. This node is the single biggest step toward power-user credibility, and it covers NMS calls today, because the server jar is already on the classpath.
   - **Why Ren cares:** today the only way to write NMS code is to abuse S1.
   - **Where:** new `js/nodes/code.js`, `codeGenerator.js` (`generateCodeForNativeNode`), `constants.js`, `variables.js`, `misc.js`, `pages/graph.html` (`configureSnippet`).
   - **Effort:** M.
   - **Risk for beginners:** low. Show the node only under "Advanced", and warn when importing a snippet that contains code nodes.
3. **Field nodes, starting with static constants.**
   - **What:** Expose static `final` fields as output-only nodes, and instance fields as getters/setters. Make `Registry.*`, `Sound.*`, `NamedTextColor.*`, `PotionEffectType.*` and `Attribute.*` available from a node's output menu, the way enum constants already are.
   - **Why Ren cares:** 13,844 constants are unreachable, and modern Paper uses registry constants, not enums.
   - **Where:** `nodeGenerator.js` (`addClassIO`, the menus), `codeGenerator.js` (a field-read generator), `classDataStore.js` (the data is already loaded).
   - **Effort:** S–M.
   - **Risk for beginners:** this helps beginners too. Group the constants under a submenu so `Sound`'s 1,991 entries stay out of the way.
4. **Generics-aware code generation.**
   - **What:**
     - Resolve a returned type variable from a `Class<T>` argument where possible; otherwise use its bound, or `java.lang.Object` and an automatic Cast node.
     - Cast unconnected parameters: `(Type) null`.
     - Keep the formatted generic signature in the class data. The doclet already has `format()`.
     - Show `List<Player>` on slots.
   - **Why Ren cares:** fixes C2 and C3 and unlocks 792 methods.
   - **Where:** `JsonDoclet.java:186-201`, `codeGenerator.js:418/474`, `util.js:getNullForType`.
   - **Effort:** M.
   - **Risk for beginners:** none.
5. **Correct event handling.**
   - **What:** Build the Event menu from the class hierarchy. List only classes that extend `org.bukkit.event.Event`, are concrete, and have a static `getHandlerList` in their chain (derive this from the class data; Ren's checker is 30 lines). Add `priority` and `ignoreCancelled` as node properties.
   - **Why Ren cares:** fixes C4, and protection plugins need priority and `ignoreCancelled`.
   - **Where:** `classDataStore.js:43`, `nodeGenerator.js:84-128`, `codeGenerator.js:166-167`.
   - **Effort:** S.
   - **Risk for beginners:** none if the defaults stay `NORMAL` and `false`.
6. **Thread awareness in the editor.**
   - **What:** Badge async events and async scheduler callbacks. Keep the full javadoc, not the first sentence (C9). Add a "Run on main thread" node (`Bukkit.getScheduler().runTask(plugin, …)`). Warn when a world-mutating API call can be reached from an async root.
   - **Why Ren cares:** async misuse is the classic beginner crash or corruption, and Paper is unforgiving about it.
   - **Where:** `classDataStore.js:47`, `nodeGenerator.js` (node colours/badges), a new native node.
   - **Effort:** M.
   - **Risk for beginners:** low. It is a warning, not a block.
7. **Separate debug and release builds, and cheaper debug tracing.**
   - **What:** Add a "Build release jar" action that always compiles without trace calls. For debug builds, guard the trace with a `static final boolean`, or log at `FINE` behind `isLoggable`. Show the trace rate in the log window instead of hiding it completely.
   - **Why Ren cares:** today the shipped jar is the debug jar unless the user remembers to change a project setting.
   - **Where:** `main.js:345`, `698-725`, `958-963`, `codeGenerator.js:806`.
   - **Effort:** S.
   - **Risk for beginners:** none.
8. **Commands done properly with Brigadier.**
   - **What:** Add class data for `brigadier-1.3.11.jar` (54 classes, already in `lib/libraries`). Add a "Command" node that generates `getLifecycleManager().registerEventHandler(LifecycleEvents.COMMANDS, …)` with typed arguments (`ArgumentTypes`) and suggestions. Fix C5 and C6 for legacy commands: emit `onTabComplete` and route by `command.getName()`.
   - **Why Ren cares:** Brigadier is the modern Paper command API, and today it is blocked twice: the brigadier types have no class data, and `LifecycleEvents.COMMANDS` is a static field (Ren checked `paper.json`: `COMMANDS`, `DATAPACK_DISCOVERY`, `TAGS`), so it has no node either (see #3).
   - **Where:** `tools/classdata/generate.mjs` (add brigadier sources or the bytecode extractor), `codeGenerator.js`, `main.js:makePluginYml`.
   - **Effort:** M.
   - **Risk for beginners:** medium. Keep the plugin.yml command editor as the simple path.
9. **A bytecode-based class-data extractor, used for external library jars first.**
   - **What:** A second generator based on ASM or the JDK ClassFile API. It reads class files, `Signature` attributes, the LVT (for parameter names where present) and jspecify nullness. It writes the same JSON schema, one file per jar, loaded on demand. Use it first for "Add library jar" (Vault, LuckPerms, PlaceholderAPI, PacketEvents, …): the jar goes on the javac classpath, its classes into the menus, and `depend`, `softdepend` or `libraries:` into plugin.yml.
   - **Why Ren cares:** real plugins integrate with other plugins, and today `softdepend` does nothing useful.
   - **Where:** new `tools/classdata/bytecode/`, `classDataStore.js` (load several files lazily), `javaCompiler.js` (extra classpath), the project info editor.
   - **Effort:** L.
   - **Risk for beginners:** low, because it is opt-in per project.
10. **An opt-in "Server internals" pack (NMS and CraftBukkit).**
    - **What:** Run the same extractor over `lib/versions/<mc>/paper-<mc>.jar`, filtered to a curated allow-list (`net.minecraft.server.level`, `world.entity`, `world.level`, `network.protocol.game`, `org.bukkit.craftbukkit.entity`, …). Store it as a separate, lazily loaded JSON per Minecraft version. Nodes get a distinct colour and a "version-specific" badge, and the project is marked internals-dependent, so the app warns before a Minecraft version bump and saved nodes turn into error placeholders.
    - **Trade-offs:**
      - **Size:** 7,801 `net.minecraft` classes, against 2,380 API classes today.
      - **Startup:** node types must be registered lazily, never eagerly (R7).
      - **Parameter names:** missing on abstract and interface methods (no LVT, no `MethodParameters`).
      - **Churn:** these signatures change every release, so graphs will break where API graphs would not.
    - **Why Ren cares:** this is what would make Ren use the tool for prototyping.
    - **Where:** extractor from #9, `classDataStore.js`, `nodeGenerator.js` (lazy registration, menu), project info.
    - **Effort:** L.
    - **Risk for beginners:** high if it is visible by default. Hide it behind a project setting with a warning, and never show it in the default menus.
11. **Test-server controls.**
    - **What:**
      - Configurable heap, JVM arguments and port.
      - Remove the dead `-DIReallyKnowWhatIAmDoingISwear` flag.
      - Graceful stop everywhere: `stop`, wait, then kill (R1, R2).
      - A pid file to clean up orphans (R3).
      - An optional `-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=5005`, so power users can attach IntelliJ to the test server and step through `GeneratedPlugin`.
      - Line-buffered stdout parsing (R4).
      - A one-time EULA consent dialog.
    - **Why Ren cares:** debugging NMS without a debugger is painful.
    - **Where:** `js/serverStarter.js`, `main.js:888-1018`, the project info editor.
    - **Effort:** S–M.
    - **Risk for beginners:** none if hidden under "Advanced".
12. **Export to a Gradle project.**
    - **What:** Write a `build.gradle.kts` (paper-api, or paperweight-userdev when internals are used), `src/main/java/…` with the generated code, and `plugin.yml`, so a user can continue in an IDE. This is much more valuable once #1 makes the generated code readable.
    - **Why Ren cares:** it is the honest exit path, and it makes the tool safe to recommend to someone who will outgrow it.
    - **Where:** `main.js` (new export), templates in `assets/`.
    - **Effort:** M.
    - **Risk for beginners:** none.
13. **A packet listener node (internals pack only).**
    - **What:** On `PlayerJoinEvent`, inject a netty `ChannelDuplexHandler` into `((CraftPlayer) p).getHandle().connection.connection.channel` before `packet_handler`, filtered by packet class, and remove it on quit. The `packet_handler` name string is present in `net/minecraft/network/HandlerNames.class` and `Connection.class` in 26.3; the pipeline order was not checked. Callbacks run on the netty event loop, so the node must be badged async (#6). Alternatively, integrate PacketEvents through #9. Mixins and bytecode patching are **out of scope**: as far as Ren knows, Paper ships no supported Mixin loader (not checked here), and maintaining one is not a job for a solo maintainer.
    - **Why Ren cares:** packets are the most common reason people reach for NMS.
    - **Where:** new native node, internals pack.
    - **Effort:** L.
    - **Risk for beginners:** high, so it stays inside the opt-in pack.

## Would Ren keep using it or recommend it?

Not yet, for anything they would put on a real server. Ren respects the modernization: a reproducible class-data pipeline, a verified Paper download, the whole unobfuscated server on the javac classpath, and HTML-escaped logs. The NMS probe compiling and running on the first try shows that the foundation can support power-user features. But the generated code stores every value in a plugin-wide field. That is unsafe for async and re-entrant events and keeps references to players and worlds. The Event menu offers classes that make `onEnable` throw. Variables Get never compiles. Large parts of the modern API cannot be reached: 792 generic-return methods fail to compile, and 13,844 constants, including every `Registry.*`, have no node. Ren would show it to a curious beginner for a join message or a timed broadcast, with "turn Debug off" written on a sticky note. They would recommend it seriously once #1–#5 land. They would use it themselves, as a prototyping layer over NMS, only after the code node, external jars and the opt-in internals pack (#2, #9, #10) exist, and an export to Gradle (#12) gives them a way out.
