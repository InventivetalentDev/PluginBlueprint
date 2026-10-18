# Roadmap

This roadmap turns the [2026-10-18 persona review](reviews/2026-10-18-personas/README.md) into phases. Item IDs A1–C5 match the review's ranked list, so each item links back to the personas who asked for it and the evidence behind it. D items are the review's "later" list, numbered here. L1, T1 and E1 were added after the review.

Effort is for one maintainer working with Codex: **S** = hours, **M** = 1–3 days, **L** = a week or more.
Status: `[ ]` open, `[~]` in progress, `[x]` done.

## Order at a glance

| Phase | Goal | Size |
|---|---|---|
| 1 | Fix the release blockers and add golden codegen tests | about 1 week |
| 2 | Upgrade litegraph and migrate to TypeScript | 2–3 weeks |
| 3 | Cheap wins and the core plugin features (commands, validation, config) | 2–3 weeks |
| 4 | Search, generics, code node, storage, simple blocks | 3–4 weeks |
| 5 | Rewrite codegen to local variables, then export and library jars | 4+ weeks |
| Later | Power-user and housekeeping items | as needed |

Phase 1 comes first because 2.0 can't ship with these bugs, and its golden tests are the safety net for Phase 2. The TypeScript migration and the litegraph upgrade come before feature work, so new features are written once, in TypeScript, on the new graph library.

## Phase 1: release blockers and a safety net

Codex batch `phase1`, three parallel tracks. The files of each track don't overlap. Done on 2026-10-18 and merged into `codex/phase1`.

### Track `editor` (pages and litegraph)

- [x] **macOS menus.** Save, Compile, Run, Git and Edit Project Information are missing on macOS, because `BrowserWindow.setMenu` works only on Windows and Linux. Use `Menu.setApplicationMenu` for the focused window on macOS, with an app menu and working Cut/Copy/Paste.
- [x] **Link-ID collision after a snippet import.** This includes every new project's starter graph. `pages/graph.html:574` uses `++graph.last_link_id`, but litegraph uses `last_link_id++`.
- [x] **Context menus and property dialogs open at (0,0).** Electron 44 sends `PointerEvent`, and `litegraph.js:8095` rejects anything that isn't exactly a `MouseEvent`.
- [x] **Property edits are not tracked.** Edits get no unsaved marker and no undo step, and they are lost on close.
- [x] Context-menu wheel scrolling goes the wrong way at 0.1× speed; long menus run off-screen.
- [x] The error window doesn't wrap lines (`pages/error.html:47`).
- [x] SAVE buttons sit below the window edge in the info editor and the command editor.
- [x] Snippet export includes links whose other end isn't selected (`pages/graph.html:501`).
- [x] An empty Soft-Depend field writes `softdepend: [""]`.
- [x] The Debug checkbox label matches its new meaning (see A4).

### Track `codegen` (generators, nodes, tests)

- [x] **A1 Golden codegen tests.** Snapshot the Java for the five docs examples and one graph per fixed bug. Compile the snapshots with javac in CI on Linux.
- [x] **JavaPlugin method nodes generate broken syntax**: `node_2.saveDefaultConfig(}` (`js/codeGenerator.js:481-506`).
- [x] **Variables:** `Get` never compiles, two `Set` nodes declare the same field twice, and `Set` has no EXEC out.
- [x] **Type variables:** method parameters and RETURN typed `T`/`V` are emitted as `private V …`. Erase them to `java.lang.Object`, and let `Object` inputs accept any value.
- [x] **onTabComplete:** the RETURN field gets a comma-joined type list, and the override is never emitted.
- [x] **onCommand** always returns `true`. Return the graph's RETURN value.
- [x] **Unconnected parameters** emit a bare `null`/`0`. Emit a typed default such as `(org.bukkit.Location) null`.
- [x] **Enum nodes:** getters emit `Material.undefined`, and instance methods are called statically.
- [x] **Event classification:** abstract events without a handler list, and classes that aren't Bukkit events (`ClickEvent`), are offered as events and break plugin enable.
- [x] `StringFormat` and `Switch` with an unlinked input produce invalid Java. FlipFlop starts on B.
- [x] Double-clicking a method output doesn't connect EXEC.
- [x] Module-level code arrays are reset at the start of a run, so a failed run can't leak into the next one.
- [x] **A4 Debug as a runtime flag:** every trace call is guarded by `PB_DEBUG = Boolean.getBoolean("pluginblueprint.debug")`.

### Track `server` (main process and test server)

- [x] **Start Server deletes every other jar in `lib/plugins`.** Replace only this plugin's jar.
- [x] **A4 (server half):** pass `-Dpluginblueprint.debug=true` when the project's Debug option is on, and drop the `-bN` version suffix.
- [x] Stop, window close and quit stop the server gracefully (`stop`, then wait, then kill). Answering "No" to the unsaved-changes prompt no longer kills the server.
- [x] Start Server while a server is running waits for it to stop instead of showing an error.
- [x] Remove the dead `-DIReallyKnowWhatIAmDoingISwear` flag, and parse server output by complete lines.
- [x] Recent Projects has no duplicates. The editor-version warning compares major and minor versions. `getProjectInfo` no longer writes `isNewProject` into `project.pbp`. Creating a project in a folder that already has `src/` or `lib/` no longer hangs.

## Phase 2: foundations

### L1 Upgrade litegraph (M)

**Where we are.** `assets/lib/litegraph/litegraph.js` is jagenjo/litegraph.js master from 2019-02-13 (commit `24a4f3a`, through your fork), with no local changes. Three lines of development exist today:

| Option | State | What it brings | Cost |
|---|---|---|---|
| **jagenjo/litegraph.js master** (npm `litegraph.js` 0.7.18) | 507 commits newer than ours. Last commit January 2024; quiet since | Pointer events (2021), multi-level context menus, search-box fixes, sorted menus, combo and multiline widgets, a maintained `litegraph.d.ts`, deferred events | Low. Same API lineage; our patches (`getMenuOptions`, drawing hooks, the search filter) need rechecking |
| **Comfy-Org fork**, `@comfyorg/litegraph` 0.17.2 | Written in TypeScript. Archived on 2025-08-05 and folded into the ComfyUI frontend monorepo (`src/lib/litegraph`); the npm package is no longer updated | Native TypeScript types, many canvas fixes from ComfyUI's use, newer features such as reroutes | Medium to high. The README calls it "largely incompatible with the original". Pinning 0.17.2 freezes us; vendoring from the monorepo means manual syncs |
| **Another node editor** (Rete.js, xyflow, Baklava) | Actively maintained | HTML nodes, which make the Phase 4 pickers, plain-language blocks and accessibility easier | High. It amounts to an editor rewrite |

**Recommendation.** Move to jagenjo master now. It is the smallest step, it fixes the pointer-event class of bugs at the source, and its `.d.ts` gives the TypeScript migration types for the graph API. Decide between the Comfy fork and a different editor after Phase 4's search and picker work shows how much of litegraph's built-in UI the app still uses.

**Done when** the golden tests pass, and an app-driver smoke run (create a project, add nodes, connect, compile, start the server) works on macOS.

### T1 Migrate to TypeScript (L)

Do this right after L1, while Phase 1's golden tests guard behaviour.

- Move the inline page scripts (`pages/*.html`, `index.html`) into modules, so all code is type-checkable.
- Compile with `tsc` to CommonJS. Keep `nodeIntegration` for now so the migration changes types, not architecture.
- Add types for the class-data JSON (`data/classes/*.json`) and for the node contract (`getFields`, `getMethodBody`, `getExecBefore`/`After`) used by `js/nodes/*.js`.
- Run tests through the TypeScript build. Snapshots must stay identical.
- Plan it as one setup track (tooling and shared types), then parallel tracks by area: main process, generators, built-in nodes, renderer pages.

### E1 Electron hardening (M, optional here)

Context isolation with a preload script, no `@electron/remote`, a Content Security Policy, and navigation guards. T1 already restructures the renderer code, so this is cheaper alongside it than later. If T1 runs long, move E1 to Later.

## Phase 3: cheap wins and core features

- [ ] **A2 Static field and constant nodes** (S–M). Pseudo-enums for `Sound`, `NamedTextColor`, `Attribute` and `PotionEffectType`; constants such as `PersistentDataType.STRING`, `DataComponentTypes.*`, `RegistryKey.*` and `LifecycleEvents.COMMANDS`.
- [ ] **A3 Event options** (S). `priority` and `ignoreCancelled` on event nodes, and a "Cancel event" node.
- [ ] **A5 Editor toolbar and ergonomics** (S). In-page Save / Build & Reload / Test / Stop buttons, autosave, shortcuts, undo for node moves, find-in-graph, note nodes and titles, and no stats overlay.
- [ ] **B1 Validate before compiling** (M). Plain-language problems shown on the nodes, translated javac errors, and javac line numbers mapped to nodes through a line map recorded during codegen.
- [ ] **B2 Commands done right** (M). One entry node per command, typed arguments, players-only, permissions, return value and tab completion, generated through `registerCommand(BasicCommand)`. Brigadier later.
- [ ] **B5a Keep `src/` and add resources** (S). Generate only `GeneratedPlugin.java`, compile everything in `src/`, and pack `resources/` into the jar.
- [ ] **B7 config.yml** (M). A Config tab, automatic `saveDefaultConfig()`, a typed "Config value" node, and a reload subcommand.
- [ ] **D2 Onboarding and defaults** (S). No `inventivetalent` default author, a package derived from the plugin name, a first-run checklist, EULA consent, and an "Install on your server" guide.
- [ ] **D3 plugin.yml completeness** (S–M). `permissions:`, `depend`, `loadbefore`, `libraries`, `website`, `authors`, `prefix`.

## Phase 4: search, types and building blocks

- [ ] **B3 Search and pickers** (M). Exact matches first, readable rows with descriptions, keyword aliases, deprecated and internal members hidden everywhere, a filterable Outputs picker, and a type-to-filter enum picker.
- [ ] **B4 Generics** (M, then L). Phase 1 erases type variables. Next: automatic Cast insertion, boxing and widening rules, then structured `typeArguments` in the doclet.
- [ ] **B5b Java code node** (M). Typed inputs and outputs, a distinct look, a warning on snippet import. Validate every node property that reaches the source; this closes the property-injection hole found in the review.
- [ ] **B6 Variables and persistent storage** (M). Player values backed by PDC and global values backed by a data file.
- [ ] **C2 Simple palette and templates** (M for six blocks, L for more). Plain-language blocks that expand into normal nodes, a template gallery, and snippets that carry commands and permissions.
- [ ] **D4 Control flow** (M). ForEach, Return/Break, an "Is null?" branch, and try/catch for checked exceptions (needs `throws` in the class data).
- [ ] **D9 Class-data quality** (S–M). `throws`, `@ApiStatus`, nullability, the Adventure plain and legacy serializers, Brigadier, and a Paper build pinned to the class data.

## Phase 5: codegen rewrite and export

- [ ] **C1 Local variables instead of fields** (L). One method per entry point, `final` locals named after nodes, `// node N` markers and a line map so tracing keeps working. This fixes async races, re-entrancy and retained references, and makes the output readable.
- [ ] **D5 Typed lambdas** (M). Needs C1 and B4.
- [ ] **C3 Export** (M). A Gradle project, an "Export as Listener" class, and a headless `--build` CLI.
- [ ] **C4 Library jars and third-party APIs** (L). A bytecode class-data extractor, "Add dependency", and Vault, LuckPerms and PlaceholderAPI as first targets.

## Later

- [ ] **C5 Multiple graphs and functions** (L).
- [ ] **D1 Git-friendly project format** (S–M). Pretty, stable JSON without derived data, editor state moved out of `project.pbp`, better `.gitignore`, no nested `git init`.
- [ ] **D6 Thread awareness** (M). Async badges, full javadoc instead of the first sentence, a "Run on main thread" node.
- [ ] **D7 Test-server controls** (S–M). Port, heap, JVM arguments, JDWP, a pid file for orphans, a readable log.
- [ ] **D8 One shared Paper install per version** (M). Projects use 217–223 MB each today.
- [ ] **D10 Opt-in internals pack** (L). NMS nodes from the server jar with a curated allow-list and version warnings, and a packet-listener node inside the pack.
- [ ] **Compile classpath.** Compile against the API only by default; add the server jar when a project enables internals or contains a code node.

## Decisions made so far

- 2026-10-18: TypeScript migration and litegraph upgrade move up to Phase 2, before feature work.
- 2026-10-18: Phase 1 runs as three Codex tracks: `editor`, `codegen`, `server`.
- 2026-10-18: The Debug checkbox is a runtime trace flag. Every jar contains `if (PB_DEBUG)` trace calls, which log only when the server runs with `-Dpluginblueprint.debug=true`, so every jar is safe to publish. The plugin.yml `-bN` version suffix is gone.
