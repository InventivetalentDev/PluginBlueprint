# Priya Natarajan — has shipped plugins, wants less boilerplate

> Written on 2026-10-18 against `codex/modernize` at `6700653`. Paths that start with `SP/` point to the review session's scratch folder, which no longer exists. The headless codegen scripts are now in `tools/codegen-harness/`, the app-driving scripts are in `tools/app-driver/`, the generated examples are in `evidence/`, and a selection of June's screenshots is in `images/`.

Priya is 29 and works as a backend developer (Kotlin, Python). They have shipped two small Paper plugins (a chat filter and a warps plugin) with IntelliJ and Gradle.
They know JavaPlugin, listeners, CommandExecutor, plugin.yml and BukkitRunnable. They want the ceremony gone, but they don't want to be locked in.

## Walkthrough

*Method: Priya read the code and docs on `codex/modernize` (app 2.0.0) and the evidence pack. They also ran javac experiments in a scratch folder. Another persona was driving the running app, so Priya didn't touch it.*

**1. Creating a project.** **Create New Project** asks for a folder, then a name (`main.js:287-316`). `createNewProject` writes this file (`main.js:329-346`):

```js
description: "My Awesome Plugin!!", author: "inventivetalent", package: "my.awesome.plugin",
version: "0.0.0", type: "paper", minecraftVersion: "26.3", buildNumber: 0, debug: true
```

Every new plugin gets `author: inventivetalent` (the maintainer's handle) until the user changes it. Priya thinks git's `user.name` or the OS user would be a better default. The app then writes `<Name>.pbp`, which contains the absolute path to `project.pbp`, and creates `src/ classes/ output/ lib/` with `fs.mkdirSync` (`main.js:368-371`). Next it finds a JDK (JAVA_HOME, then PATH, then the managed Temurin) and downloads Paper from Fill v3 with a sha256 check. It runs `-Dpaperclip.patchonly=true` to unpack the libraries into `lib/`. Finally it runs `git init` and makes an "Initial commit" authored by `PluginBlueprint <git@pluginblueprint.net>`.

In the evidence project, `lib/` is **217 MB**: paper.jar 53 MB, libraries 74 MB, versions 30 MB and cache 60 MB. Another 53 MB copy sits in `~/Library/Application Support/PluginBlueprint/paper`. In Gradle, the `paper-api` dependency is cached once for all projects. Here every project carries its own server.

The project file is one line of JSON, and some editor state has leaked into it (evidence `project.pbp`):

```json
{"name":"EvidencePlugin",...,"lastSave":1792315175347,"lastCompile":1792315166483,"editorVersion":"2.0.0","buildNumber":1,"debug":true,"isNewProject":true}
```

**2. The editor.** You double-click the canvas to search 2,380 Paper, Adventure and Java classes. You enable hidden outputs from the right-click menu, and double-clicking a slot creates a connected node. Shift+click opens the Javadoc on jd.papermc.io. All of this is quick to learn. Priya likes that the nodes are the real API, such as `CommandSender#sendRichMessage(String)` with MiniMessage, and not a toy subset.

Then Priya looked for the menus. Every page installs its menu with `getCurrentWindow().setMenu(...)` (`pages/graph.html:310`, `index.html:99`, `pages/infoEditor.html:126`, `pages/log.html:67`). Electron 44's own typings mark `BrowserWindow.setMenu` as `@platform linux,win32`, and nothing in the repo calls `Menu.setApplicationMenu`. Priya is on a Mac, and on a Mac those File, Edit, Git, Compile and Run menus should never appear (see Bugs #1). The canvas context menu only adds nodes and groups, so no other control can save, compile or run. If this is confirmed, the macOS build cannot ship anything.

**3. Project info and commands.** `pages/infoEditor.html` has fields for Name, Description, Version, Author, Package, Soft-Depend, the commands list and a Debug checkbox. The command editor (`pages/commandEditor.html`) has name, description, usage and aliases. There is no `permission`, `permission-message` or tab-completion source. Both windows save from `onbeforeunload`, so closing a new command window always adds the command; there is no Cancel. `makePluginYml` (`main.js:699-722`) writes:

```yaml
name: "EvidencePlugin"
description: "My Awesome Plugin!!"
version: "0.0.0-b1"
main: "my.awesome.plugin.GeneratedPlugin"
author: "inventivetalent"
softdepend: []
generator: "PluginBlueprint 2.0.0"
api-version: '26.3'
```

That is the evidence `plugin.yml.hello-command`. The command section is missing because the snippet doesn't register `/hello`; the docs warn about this (`docs/Examples.md:10-12`). Values are quoted and `api-version` is correct. The aliases are trimmed and filtered. Several things are missing:

- No `permissions:` block, and no per-command `permission`.
- No `depend`, `loadbefore`, `load`, `website`, `authors` or `prefix`.
- No `libraries:` key, which Paper uses to download Maven libraries.
- No `paper-plugin.yml` option.

The `usage:` field is written, but `onCommand` is hard-coded to `return true;` (`js/codeGenerator.js:109`, `// TODO: variable return`). Bukkit therefore never shows the usage string.

**4. The generated Java.** In the evidence file `hello-command.java`, everything is in one class, `GeneratedPlugin extends JavaPlugin implements Listener`. Each node becomes a `node_N_exec()` method, and every value lives in an instance field:

```java
private org.bukkit.command.CommandSender  node_3_output_1;
...
public boolean onCommand(org.bukkit.command.CommandSender sender, ...) {
 node_3_output_1 = sender; ... node_3_exec();
return true;
}
private void node_5_exec() {
getLogger().info("pb_debug_exec=5");/** Debug call **/
 node_4.sendRichMessage( node_6_output_0);
}
```

The tool does remove some boilerplate:

- Listener registration (`registerEvents(this, this)` is always emitted).
- `onEnable`, `onDisable` and `onLoad` stubs.
- CommandExecutor wiring.
- The plugin.yml basics.
- The build itself.

It does not remove command dispatch. One `onCommand` runs for every command, so the graph has to branch on `command.getName()` with a Switch node (`docs/Examples.md:116-122`). The code has other problems:

- The class name is always `GeneratedPlugin`.
- The header comment says not to use the code as a starting point.
- Because all state lives in instance fields, nothing is re-entrant. An `AsyncChatEvent` handler (Priya's chat filter) would race across chat threads.
- No event priority and no `ignoreCancelled`; the generator only emits `@org.bukkit.event.EventHandler` (`codeGenerator.js:167`).
- `onTabComplete` nodes are collected (`codeGenerator.js:504`) but never emitted.

Priya tested two failure cases with javac against the evidence classpath. A `FileConfiguration.save(File)` node fails with `unreported exception IOException; must be caught or declared to be thrown`, because the class data has no thrown-exception field. Two `Set` nodes for the same variable fail with `variable myVariable is already defined`.

**5. Compiling.** `javaCompiler.compile` writes `lib/javac.args` with `-encoding UTF-8 --release 25 -cp <105 jars> -d classes src/.../GeneratedPlugin.java` (`js/javaCompiler.js:8-9`). That is neat: no command-line length problems, and `path.delimiter` handles Windows. Priya copied the args and timed it. javac 27 on PATH compiled `hello-command` in **0.46–0.57 s**, and `jar cfm` took **0.07 s**. The output jar is 2.3 KB with just the class, `plugin.yml` and a manifest. Speed is fine. Only `GeneratedPlugin.java` is ever passed to javac, though. `saveCodeToFile` runs `fs.emptyDir(src)` on every Generate (`main.js:665`), and the jar step only packs `classes/` (`javaCompiler.js:35-36`). That leaves no room for a hand-written helper class, a `config.yml` resource or a messages file.

**6. Testing.** **Run → Start Server** spawns `java -Xmx2G -DIReallyKnowWhatIAmDoingISwear -Dcom.mojang.eula.agree=true -jar paper.jar nogui` in `lib/` (`js/serverStarter.js:38`). It first empties `lib/plugins` (`serverStarter.js:17-26`, called from `main.js:932` without `skipEmpty`), so a LuckPerms or Vault jar Priya drops in is deleted on every start. **Reload Plugin** sends `stop`, waits up to 30 s, copies the jar and starts again (`main.js:1010-1018`). That is a full restart, about 5 s according to `docs/Testing-your-Plugin.md`. Version 1 hot-swapped the plugin with `livereload.jar` (`old-wiki/Testing-your-Plugin.md:8`). Compile and reload are separate menu items with no accelerators (`graph.html:254, 303`).

The log window links `node_N` in stack traces to the graph, which Priya loves. It has no command history, and the port is fixed at 25565.

**7. Debug mode.** `debug: true` by default puts `getLogger().info("pb_debug_exec=N")` at the top of every node method (`codeGenerator.js:806-808`). The main process turns those lines into `debugCall` IPC that lights up EXEC links (`main.js:958-964`), which is a great live trace. The flag is project state, not a build type, though. If you forget to untick it, the release jar logs one INFO line per node on a production server and carries the version `0.0.0-b17`.

**8. Iteration in the editor.**

- **Undo** only tracks node add/remove and connection changes (`graph.html:325, 348, 363`). Moving nodes and editing properties are not tracked. Property edits, such as a String constant's value, also don't increment `unsavedChanges`, so closing the window loses them silently.
- **Shortcuts:** Redo is Ctrl/Cmd+Y, not Cmd+Shift+Z. litegraph's select-all only reacts to `ctrlKey`. Copy and paste work.
- **Finding things:** search only adds nodes. You can't find a node in your own graph, and there are no comments, subgraphs or functions.

**9. Errors.** The compile error window links every `node_N` token. The auto-highlight in the canvas takes the first `node_` in the whole message (`graph.html:717-731`). Priya changed the evidence code so that node 5's call receives a wrong-typed value from node 6. javac reported `node_4.sendRichMessage( node_6_output_0)`, and the regex picked **node_4**, the CommandSender object node. Neither the faulty constant (node 6) nor the method node that contains the line (node 5) was highlighted.

**10. Git.** The template `.gitignore` is only `lib/*` and `*.old`, so these files get committed and churn:

- `classes/*.class` and `output/*.jar`.
- The generated `src/`.
- `thumb.pbt`: 125 KB of base64 JPEG, rewritten on every save.
- `<Name>.pbp`, which holds an absolute path.

`graph.pbg` is one line of JSON, 18.7 KB for 5 nodes. Every slot carries `color_on`, `color_off` and `shape`, and positions are floats like `64.39999961853027`. A diff or merge of that line is useless. Commits are authored as "PluginBlueprint" until the first push stores `gitUser`, which is then also used as the email (`js/versionControl.js:66-68`). Push uses an HTTPS user and password only. There is no pull, log or diff, and **Commit** doesn't save the graph first.

If the project folder sits inside an existing repo (Priya keeps plugins in one monorepo), creating the project always runs `git init` (`main.js:402`). Opening such a project runs it too, because isomorphic-git `listFiles` returns `[]` for a subfolder (Priya tested this). Either way the result is a nested `.git`. Priya would turn all of this off and use their own git.

**11. Snippets and export.** **Export Selection** writes JSON with positions relative to the viewport. It also includes links where only one end is selected (`graph.html:501`, `||`). On import those links get `origin_id: undefined` (`graph.html:578`). **Export Project** zips only `project.pbp` and `graph.pbg` (`main.js:1045-1050`). That is fine for sharing, but there's no Gradle or Maven export.

**12. Compared with IntelliJ, the Minecraft Development plugin and run-paper.**

PluginBlueprint wins on:
- Zero setup, with JDK and Paper fetched and checksummed.
- No build file.
- Discoverability of the API from the node search.
- Live execution tracing.
- A 0.5 s compile.

It loses on:
- Escape hatches: none, and hand edits are deleted.
- Commands and permissions: MC Dev templates and Paper's `registerCommand(String, BasicCommand)`/Brigadier (both in the class data) give tab completion and per-command permissions for free.
- Iteration: run-paper with JetBrains Runtime hotswap reloads method bodies in about 1–2 s without a restart. Here the loop is two menu clicks plus a 5 s restart, with no shortcuts.
- Tests: there's nothing to unit-test.
- Version control: the project format can't be diffed.
- Dependencies: there's no way to call another plugin's API.

## Likes (max 5)

1. **Zero-config build that is done right:** JDK detection with a checksummed Temurin fallback, a sha256-checked Paper download, an argfile classpath, `--release 25`, and a clean 2.3 KB jar with a correctly quoted `api-version: '26.3'`. Compiling takes about half a second.
2. **Live execution tracing:** `pb_debug_exec` drives link highlighting in the graph, and runtime stack traces in the log window link to nodes. IntelliJ can't show which branch ran without breakpoints.
3. **Built-in test server:** the EULA flag is set, the console has a command box, and reload is stop, copy, start. Priya doesn't have to set up run-paper.
4. **No runtime lock-in:** the output is plain Java against the real Paper API with fully qualified names. There is no runtime library to shade, and the jar runs anywhere.
5. **Honest docs and real class data:** the docs say which recipes ran and which were only compiled. Class data comes from Paper 26.3 sources, with Adventure/MiniMessage included and Javadoc on Shift+click.

## Dislikes (max 5)

1. **No escape hatch.** Generate wipes `src/`, javac gets exactly one file, there's no code node and no Gradle export. Priya can't drop to Java for the 10 % the graph can't express.
2. **Commands and permissions are half-done.** There is a single shared `onCommand` that always returns true, with no permission fields, no `permissions:` block and no tab completion.
3. **Git is noisy and the format can't be diffed.** Graph and project files are one-line JSON with float and colour noise. The binary thumbnail, classes and jar get committed, you get a nested repo inside an existing one, and commits are authored as "PluginBlueprint".
4. **Slow iteration.** There are no shortcuts for compile or run, and build and reload are separate steps. Reload is a full restart, and undo skips moves and property edits.
5. **Shipping defaults are unsafe.** Debug is on by default, so release jars log on every node and carry `-bN` versions. Other defaults are `author: inventivetalent`, the `GeneratedPlugin` class name, `my.awesome.plugin`, and state in instance fields.

## Bugs found

| # | Bug | Where | Repro | Severity |
|---|---|---|---|---|
| 1 | **macOS shows no File, Edit, View, Git, Compile or Run menu.** All menus are installed with `BrowserWindow.setMenu`, which Electron documents as `@platform linux,win32` (`node_modules/electron/electron.d.ts:3747`). Nothing calls `Menu.setApplicationMenu`. On macOS the default Electron menu should appear instead, so nothing can save (no Cmd+S), compile, run or open project info. | `pages/graph.html:310`, `index.html:99`, `pages/infoEditor.html:126`, `pages/log.html:67` | Launch the macOS build, open a project, look at the menu bar. Confirmed from the code and the API typings only; whoever is driving the app can check in seconds. | **Critical** if confirmed |
| 2 | **Property edits are not tracked.** Changing a constant's value, a variable's name or type, or a Cast target doesn't increment `unsavedChanges`. It isn't added to undo history and doesn't mark the title. Closing the window gives no unsaved-changes prompt. | `pages/graph.html:325-375` (only add, remove and connection hooks); `main.js:122-133` | Open a project, edit a StringConstant via Properties, close the window. No prompt appears, and the edit is lost. | High |
| 3 | **Start Server deletes every other jar in `lib/plugins`.** You can't test alongside dependencies such as LuckPerms or Vault. | `js/serverStarter.js:17-26`; `main.js:932` (no `skipEmpty`) | Copy any plugin jar into `<project>/lib/plugins`, then Run → Start Server. The jar is gone. | Medium |
| 4 | **Two `Set` nodes with the same variable name don't compile.** Each node declares the field again. | `js/nodes/variables.js:19-21`; `js/codeGenerator.js:675-678` | Add two Set nodes named `myVariable` (for example, one in onEnable and one in a command), then compile. Result: `variable myVariable is already defined in class GeneratedPlugin` (reproduced with javac). | Medium |
| 5 | **Methods that throw checked exceptions don't compile.** The generator emits a bare call, and the class data has no thrown types. | `js/codeGenerator.js:410-520`; the method JSON keys in `data/classes/paper.json` have no exceptions field | Wire `FileConfiguration#save(File)`, then compile. Result: `unreported exception IOException; must be caught or declared to be thrown` (reproduced with javac). | Medium |
| 6 | **`onTabComplete` is silently dead.** Nodes are pushed into `onTabCompleteMethods`, but the class template never emits an `onTabComplete` override. | `js/codeGenerator.js:504` (collected), `:81-145` (template has no override) | Implement `JavaPlugin{onTabComplete}` in the graph, compile, and grep the source. The node is never called. | Medium |
| 7 | **`onCommand` always returns true.** The abstract node's RETURN input is computed into `node_N_return` and then ignored, so `usage:` is never shown. | `js/codeGenerator.js:109`, `:461-468` | Connect `false` to the onCommand RETURN and run the command. No usage message appears. | Medium |
| 8 | **Event handlers share instance fields, so async events race.** `AsyncChatEvent` (in the class data) runs on several threads, and concurrent chats overwrite `node_N` and its outputs while a handler is still running. | `js/codeGenerator.js:166-176` (handler body assigns fields; no locals, no `synchronized`) | Build a chat filter on AsyncChatEvent that cancels by content, then have two clients chat at the same moment. The wrong message gets cancelled or replied to. Found by reading the code; not run. | Medium |
| 9 | **Error auto-highlight picks the wrong node.** It takes the first `node_\d+` in the whole javac text, not the node whose method contains the error line. At runtime every stack-trace line containing the package and `node_` marks a node, so the whole call chain turns red. | `pages/graph.html:717-731`; `main.js:973-978` | Priya's javac test: a type error in node 5's call (bad value from node 6) printed `node_4.sendRichMessage( node_6_output_0)`, and the regex returned `node_4`. | Medium |
| 10 | **Snippet export includes half-selected links.** Import then creates links with `origin_id` or `target_id` set to `undefined`. In codegen this causes either `node_undefined_*` compile errors (which the highlight regex can't match) or a `TypeError` on `sourceNode.classType`. `generateClassCode` has no try/catch, so the overlay spins forever, and the module arrays (`fields`, `methodCalls`, and so on) are not reset, so the next generate includes stale code. | `pages/graph.html:501` (`\|\|`), `:578`; `js/codeGenerator.js:29-160`, `:454` | Select only `sendRichMessage` and its constant (not its CommandSender), export, import into a project, then Generate. Found by reading the code; the shipped snippets have no dangling links (checked). | Medium |
| 11 | **Answering "No" to "exit with unsaved changes?" still kills the test server.** `preventDefault()` is followed by `killInstance()` and `logWin = null`. | `main.js:122-135` | Start the server, make an edit, close the window, click **No**. The server dies and the editor stays open. | Medium |
| 12 | **Creating a project in a folder that already has `src/`, `classes/`, `output/` or `lib/` hangs.** `mkdirSync` throws `EEXIST` inside an async callback after `project.pbp` and `<Name>.pbp` were written. The progress window stays stuck, and the half-created project can't be opened (there's no `graph.pbg`). | `main.js:352-371` | Create New Project, pick an existing Gradle plugin folder. | Low–Medium |
| 13 | **Nested git repo and overwritten `.gitignore`.** `init` always runs on create. `openOrInit` re-runs it when `listFiles` is empty, which happens inside an outer repo and in a repo with an empty index. Each run copies the template over `.gitignore`. Authors are fake: `PluginBlueprint <git@pluginblueprint.net>`, or `gitUser` used as both name and email. | `main.js:402`; `js/versionControl.js:9-48`, `:66-68` | Create a project inside an existing repo: a `.git` appears in the project folder. Priya ran `listFiles` in such a subfolder and got `[]`. | Low |
| 14 | **Git → Commit doesn't save first,** so it commits the stale graph on disk. | `pages/graph.html:228-231`; `main.js:1092-1117` | Edit the graph, then Git → Commit without saving. The commit doesn't contain the edit. | Low |
| 15 | **Start Server while a server is running** kills it, then immediately shows "Please wait for the existing server to shut down", because `isRunning()` only flips when the process exits. | `main.js:893-903` | Start Server twice. | Low |
| 16 | **Soft-Depend field writes `softdepend: [""]`.** The split has no empty filter, unlike aliases. Also, `getProjectInfo` mutates `currentProject`, so `"isNewProject":true` is saved into `project.pbp`. | `pages/infoEditor.html:155-160`; `main.js:549` | Open project info, Save with Soft-Depend empty, compile, check `plugin.yml`. The evidence `project.pbp` already shows `isNewProject`. | Low |

## Feature requests and changes (ranked)

1. **Stop deleting `src/` and compile everything in it**
   - What: Generate should only replace `GeneratedPlugin.java` (or a `generated/` subfolder). javac should get every `src/**/*.java`, and the jar should include `resources/**` such as `config.yml` and `messages.yml`. Document this as the official escape hatch.
   - Why Priya cares: a helper class or config resource is the minimum for a real plugin.
   - Where: `main.js:657-697` (`saveCodeToFile`), `js/javaCompiler.js:5-36`.
   - Effort: S.

2. **Add a Java code node**
   - What: a node with user-declared typed inputs and outputs, an EXEC in and out, and a code body (a statement block, or one expression for pure nodes). It emits into its own `node_N_exec()`. Add a "call static method" node for hand-written classes from item 1, using a lightweight scan of the `public static` signatures in `src/`.
   - Why Priya cares: it covers the 10 % the graph can't express without leaving the tool.
   - Where: new `js/nodes/code.js`, `js/codeGenerator.js:632-700` (native path), `js/nodeGenerator.js` registration.
   - Effort: M.

3. **Per-command nodes with permissions and tab completion**
   - What: replace the shared `onCommand` with a `Command /name` event node per declared command, exposing sender, args and label, with an EXEC branch per subcommand. Wire the RETURN value (`codeGenerator.js:109`). Emit `onTabComplete` (`:504`). Add `permission` and `permission-message` to the command editor and `makePluginYml`. Longer term, generate Paper `registerCommand(String, BasicCommand)` or Brigadier via `LifecycleEvents.COMMANDS`; both are already in the class data.
   - Why Priya cares: commands are half of every plugin, and a Switch on `getName()` is worse than a CommandExecutor.
   - Where: `js/codeGenerator.js`, `pages/commandEditor.html`, `main.js:699-722`.
   - Effort: M.

4. **Complete plugin.yml metadata and sane defaults**
   - What: add a `permissions:` editor (node, description, default op/true/false/not op, children), plus `depend`, `loadbefore`, `load`, `website`, `authors` list, `prefix` and `libraries` (Maven coordinates that Paper downloads). Let the user rename the main class instead of using `GeneratedPlugin`. Take the default author from `git config user.name` or the OS user, not `inventivetalent`. Validate the package and name (Java identifiers, Paper's name regex).
   - Why Priya cares: it's the plugin.yml Priya writes by hand today.
   - Where: `pages/infoEditor.html`, `main.js:329-346` and `:699-722`, `js/javaCompiler.js:9`.
   - Effort: S–M.

5. **Export as a Gradle project, plus a headless build**
   - What: write `build.gradle.kts` (`compileOnly("io.papermc.paper:paper-api:<paperApiVersion>")` from `meta`, with the run-paper plugin), `src/main/java/.../GeneratedPlugin.java`, `src/main/resources/plugin.yml`, and any hand-written sources and resources. Optionally keep the graph next to it so regenerating overwrites only the generated file. Add an `electron . --build <dir>` CLI mode for CI.
   - Why Priya cares: it is the exit door that makes trying the tool safe.
   - Where: `main.js` (new export handler next to `exportProject`, `:1045`), templates under `assets/`.
   - Effort: M.

6. **Make the project format work in git**
   - What: pretty-print `graph.pbg` and `project.pbp` with stable key order and rounded positions. Drop derived slot fields (`color_on`, `color_off`, `shape`, `size`), since they are recomputed on load. Move `lastSave`, `lastCompile`, `buildNumber` and `isNewProject` into an ignored `.pb/state.json`. Gitignore `classes/`, `output/`, `thumb.pbt` and `<Name>.pbp` (or remove that dummy file). Don't `git init` inside an existing repo, and don't overwrite `.gitignore`. Use the git config identity, and save before committing.
   - Why Priya cares: reviewable diffs and possible merges, or Priya won't put it in a repo.
   - Where: `main.js:553-618`, `assets/projectGitignore.txt`, `js/versionControl.js`, `pages/graph.html:434-449`.
   - Effort: S–M.

7. **A one-key build-and-reload loop and basic editor ergonomics**
   - What: a single **Build & Reload** action (generate, compile, package, then reload if the server is running). Add accelerators (Cmd/Ctrl+B to build, Cmd/Ctrl+R to build and reload, Shift+Cmd+Z to redo, Cmd+A to select all) and remove the 500 ms `setTimeout` delays. Track moves and property edits in history. Add find-in-graph (Ctrl+F by title or node id), command history in the log console, and a configurable server port.
   - Why Priya cares: the loop decides whether this feels faster than IntelliJ.
   - Where: `pages/graph.html:110-310` and `:325-375`, `main.js:774-820` (500 ms delay at `:787`), `pages/log.html:99-111`, `js/serverStarter.js:38`.
   - Effort: S.

8. **Debug and release builds instead of a Debug checkbox**
   - What: offer **Build (debug)** and **Build release** commands. Release builds never contain `pb_debug_exec` or a `-bN` suffix. Optionally log debug lines at FINE level, or gate them behind a system property so they never reach production logs.
   - Why Priya cares: forgetting one checkbox shouldn't spam a production server.
   - Where: `js/codeGenerator.js:27-31` and `:806-808`, `main.js:699-704`, `pages/infoEditor.html:96-104`.
   - Effort: S.

9. **Map javac errors to the right node by line number**
   - What: record a line-to-node map while generating (each `node_N_exec` block's start and end), parse javac's `file:line: error:` output, and highlight the node that owns the line. Show the message as a badge on that node. For runtime traces, use the top `node_N_exec` frame only.
   - Why Priya cares: a wrong highlight costs more than no highlight.
   - Where: `js/codeGenerator.js` (collect the ranges), `main.js:743-800`, `pages/graph.html:717-731`, `main.js:973-978`.
   - Effort: M.

10. **Re-entrant generated code and event options**
    - What, short term (S): add `priority` and `ignoreCancelled` properties on event nodes, and mark handlers for `Async*` events `synchronized`.
    - What, long term (L): generate locals per handler invocation (pass values as parameters, or use a per-invocation context object) instead of class fields.
    - Why Priya cares: it is a correctness problem for chat filters and anything async.
    - Where: `js/codeGenerator.js:165-245`, `js/nodeGenerator.js` (event node properties).

11. **Handle checked exceptions**
    - What: extend the doclet to output `thrownTypes`, then wrap those calls in try/catch with an **on error** EXEC output, plus a default handler that logs a warning.
    - Why Priya cares: file and config saving is everyday plugin work.
    - Where: `tools/classdata/JsonDoclet.java`, `js/classDataStore.js`, `js/codeGenerator.js:410-520`.
    - Effort: M.

12. **First-class `config.yml`**
    - What: a Config panel to edit default keys (copied into resources, with `saveDefaultConfig()` emitted in `onEnable`). Add typed **Config value** nodes (path, type, default) and a **Reload config** node.
    - Why Priya cares: every plugin Priya has shipped had a config.
    - Where: new panel, `js/codeGenerator.js`, `js/javaCompiler.js` (resources).
    - Effort: M. Depends on item 1.

13. **Call other plugins' APIs**
    - What: an **Add dependency** option (Maven coordinate or a local jar) that adds the jar to the classpath and `depend` or `softdepend`, generates class data so the search menu shows its classes (reuse the doclet, or an ASM scan when no sources are available), and keeps it in `lib/plugins` for testing. That last part needs Bugs #3 fixed.
    - Why Priya cares: Vault, LuckPerms and PlaceholderAPI hooks are standard.
    - Where: `js/classDataStore.js`, `js/paper.js:44-57`, `tools/classdata`.
    - Effort: L.

14. **One shared Paper install per version**
    - What: compile against the shared `paper-api` and libraries in userData. Keep only `server/` (worlds and plugins) per project, or make it optional and shared.
    - Why Priya cares: 217 MB per project adds up fast across ten experiments.
    - Where: `js/paper.js:16-42`, `main.js:40-49`, `js/serverStarter.js`.
    - Effort: M.

15. **Multiple graphs and reusable functions**
    - What: let a project hold several `.pbg` files, each generating its own class (for example `Commands`, `Listeners`), plus collapsible subgraph or function nodes with typed parameters.
    - Why Priya cares: one 200-node canvas is unmanageable, and the warps plugin would have 5–6 commands.
    - Where: `main.js` (graph IO), `pages/graph.html` (tabs), `js/codeGenerator.js`.
    - Effort: L.

## Would Priya keep using it?

Not for their real plugins yet. The build chain is genuinely good, and the live execution trace is something IntelliJ doesn't have. For a one-evening prototype (a join message, a timed broadcast, a block guard), PluginBlueprint beats creating a Gradle project. But it removes the wrong boilerplate. Priya can already generate the build and listener wiring from an MC Dev template in ten seconds. The parts they actually hate are commands with permissions and tab completion, `config.yml` handling and the restart loop, and those are the weakest areas here.

The bigger problem is that there is no way out. Hand-written code gets deleted, there's no code node, no Gradle export, and the project files can't be reviewed in git. Hitting the graph's limits means starting over in IntelliJ, so Priya won't start a plugin here that they expect to keep. On a Mac the menus may simply be missing (Bugs #1), and that would end the trial on day one.

Fix the macOS menus and ship items 1, 2 and 5 (keep `src/`, a code node, Gradle export), and Priya would happily use PluginBlueprint as a scaffolding tool for wiring events and commands. With items 3 and 6 as well, it could become their default for small plugins.
