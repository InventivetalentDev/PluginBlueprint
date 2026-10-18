# June Alvarez — never coded before

> Written on 2026-10-18 against `codex/modernize` at `6700653`. Paths that start with `SP/` point to the review session's scratch folder, which no longer exists. The headless codegen scripts are now in `tools/codegen-harness/`, the app-driving scripts are in `tools/app-driver/`, the generated examples are in `evidence/`, and a selection of June's screenshots is in `images/`.

June is 15 and plays survival on a friend's Paper server. They have never written code and don't know what Java, a JDK, an "event" or a "class" is. They found PluginBlueprint by searching "make minecraft plugin without coding". They want two things: "when someone joins, give them a cake and say welcome in chat" and "a /spawn command that teleports you to spawn".

Tested on branch `codex/modernize` (app 2.0.0), macOS on Apple Silicon, Electron 44.9.0 / Chrome 152, 2026-10-18. Screenshots are linked by full path below.

**How this was tested:** I sent real clicks, double-clicks, right-clicks, drags, mouse-wheel input and typing over CDP. I used `H.link`, `H.dbl`, `H.prop` or a direct JS call in these places only:
- the remaining link drags in the cake chain (six) and the Material → `type` restore;
- spawning `sendRichMessage`;
- the whole `/spawn` graph (June could not have found the nodes without help);
- picking `CAKE` in a native `<select>`, which CDP can't drive;
- focusing an off-screen property text field;
- the menu-bar actions (Save, Compile, Run, Edit Project Information). On macOS those don't exist in the menu bar (Bug 1), so I triggered the editor's own menu object, which is what a Windows or Linux user would click.

Real drags did work when I tried them: the EXEC link, Material → `type` (second try), getDescription → REF, and getPlayer → REF.

**Limits:** Java and Paper were already cached, so the "Download Java 25" prompt and the downloads never appeared. I could not join from a Minecraft client, so the cake-on-join plugin was compiled and loaded but never triggered in game.

## Walkthrough

**Start page** (`images/start.jpg`). It looks friendly: "Hi! Welcome to the PluginBlueprint Editor!" and big green buttons. June notices that the "Recent Projects" heading is almost black on dark grey. The recent list shows long `/private/tmp/...` paths and a "+" icon with no label (it is a second "Create new project"). Nothing on the page says what a plugin is, what they will need (Java, a Minecraft account), or where to start.

**Creating the project.** June clicked **CREATE NEW PROJECT** and a folder picker appeared. Then a tiny "Project Name" box came up, pre-filled with the folder name (`SP/p1/prompt-name.png`). June clicked OK. A progress window ("Creating Project...") flashed for about 4 seconds and the editor opened. There were no popups because Java and Paper were cached; on a fresh machine June would face a 200 MB Java download and a 55 MB Paper download here. The new folder is **223 MB** (`du -sh`), because every project gets its own copy of `paper.jar` and its libraries.

**The editor** (`images/editor-first.jpg`). There is a starter group, "Print plugin version to console!", with six nodes: `JavaPlugin`, `JavaPlugin{onEnable()}`, `PluginDescriptionFile`, `StringConstant "Enabled %s version %s!"`, `StringFormat` and `ConsoleLog`. June doesn't know what any of these words mean. Debug text sits in the top-left corner ("T: 0.00s I: 0 N: 6 [0] V: 13 FPS:2500.00"). A hint bar at the bottom shows mouse icons: "x2 Search / Auto-Link", "Menu", "Ctrl + Select".

**Following Getting-Started exactly, on a Mac.** The docs say "Choose **File → Save**", "**Edit → Edit Project Information**", "**Compile → Generate Code, Compile, Package**" and "**Run → Start Server**". June's menu bar only has Electron's default menus: `File` holds only "Close Window"; `Edit` has Undo, Redo, Cut, Copy and so on; then `View` and `Window`. There is no Save, no Compile, no Run, no Import Snippet and no Project Information. I dumped `Menu.getApplicationMenu()` from the running app to confirm this (Bug 1). A Mac user is stuck right here, with no way to save, compile or test. To continue the review I triggered the editor's own menu items, as a Windows user would click them.

**Where Getting-Started assumes knowledge June lacks:** "Type part of a class name, such as `PlayerJoin`" (what is a class?); "`EXEC` links are orange arrows. They set the order in which nodes run" (run? order?); "To open a node's Javadoc, hold Shift and click the node" (Javadoc?); "Nodes represent events, objects, method calls, and fixed values"; and the install section's "A JDK is the Java Development Kit" (June still doesn't know why they need it). Nothing explains what `THIS`, `REF` or `RETURN` mean, though every node shows them.

**"Add and connect nodes", steps 1–4.** June double-clicked empty canvas and a "Search" box appeared, which felt good. They typed `PlayerJoin` (`images/search-playerjoin.jpg`). The results read `org.bukkit.event.player.PlayerJoinEvent`, `org.bukkit.event.player.PlayerJoinEvent{getHandlerList()}`, `...#getHandlerList()` and so on. The box runs off the right edge of the window. June picked the first result and got a purple **PlayerJoinEvent** node with only `THIS` and `EXEC` outputs.

Step 3 says to right-click and choose **Outputs**. The Outputs list opened in the **top-left corner of the window**, far from the node (`images/node-outputs.jpg`; Bug 4). June chose `getPlayer`, then double-clicked it as in step 4, and a brown **Player** node appeared, already connected. This felt like the first real success.

**Then something strange happened** (`images/player-node.jpg`). The green line from `getPlayer` now also ran down into the starter group, into `PluginDescriptionFile.REF`. The starter link from `JavaPlugin.getDescription` was gone. June had not touched that group. This is a link-ID collision (Bug 2). Following the docs' first exercise corrupts the starter graph.

**June's cake idea, without docs.** Searching in plain words went badly:
- `welcome` → **0 results**.
- `cake` → `org.bukkit.block.data.type.Cake{getBites()}` and similar (block data, not the item).
- `give` → `io.papermc.paper.entity.PlayerGiveResult` first.
- `ItemStack` → 102 results, and **the ItemStack class itself is not among them**.
- `Bukkit` → doesn't find `org.bukkit.Bukkit`.

The right-click canvas menu offers "Add Generic Node / Add Bukkit Event / Add Bukkit Object / Add Bukkit Method / Add Group", not "Add Node" as the docs say. "Add Bukkit Event" then lists 37 Java package names, such as `com.destroystokyo.paper.event.player`, `io.papermc.paper.event.player` and `org.bukkit.event.player`.

June tried right-click → Outputs on **Player**. It is a flat list of **831 entries**, 17,037 px tall, starting at "abandonConversation(Conversation)" and "ban(String, Date, String)", with some duplicates (`asHoverEvent(UnaryOperator)` appears twice) (`images/player-outputs.jpg`). `give(ItemStack...)` is entry ~340 and `teleport(Location)` is near the end. The mouse wheel moves the menu the wrong way and very slowly (Bug 5). June gave up on finding things alone and opened Examples → "Give a starter kit" (16 bread on first join), which is close to their idea.

**Building it from the recipe:**
- `ItemStack#of` found `ItemStack.of(Material)`.
- `Material` found `org.bukkit.Material`, but only after scrolling to result 57. The node defaults to `ABANDONED_CAMP_MAP`.
- Properties → `en` opened a dialog half above the top edge of the window (left −18 px, top −18 px), holding a dropdown of **2,278** materials (`images/material-enum.jpg`). The label `en` means nothing to June. After choosing CAKE the node read `[CAKE]` (`SP/p1/material-cake.png`).
- `MakeArray` needed its `type` property typed by hand as `org.bukkit.inventory.ItemStack`. The text field was again off-screen and not focused (`images/prop-dialog.jpg`).
- Double-clicking `Player.give`'s `items` input did nothing (arrays aren't handled).
- The welcome message used `sendRichMessage` plus a constant `<gold>Welcome to the server! Here is a cake :)`.

At 70% zoom the slots are tiny; two drags and one double-click missed on the first try. Final graph: `SP/p1/before-const.png` and `SP/p1/const.png`.

**Saving.** On the Mac, Cmd+S can't work because the editor's menu (which holds the accelerator) is never installed. After about an hour of editing (`graph.pbg` mtime 11:24 to 12:29), the file was still the 2-byte `{}` until I triggered Save through the editor's menu object. There is no autosave.

**Compiling** (`images/compile-error.jpg`). The window said "Oh noes! Looks like there is an error in your Blueprint! Please make sure you didn't forget to connect any of the nodes…". Then came `Command failed: javac @/private/tmp/.../lib/javac.args` and `GeneratedPlugin.java:78: error: incompat`, with the line **cut off at the right edge** (Bug 6). The full text is "incompatible types: Player cannot be converted to PluginDescriptionFile". The `node_3` / `node_8` links work: clicking one zooms the editor to that node and selects it. The culprit node was the starter's `PluginDescriptionFile`, which June never touched.

**Fixing it made things worse.** June re-dragged `getDescription → REF`. The app deleted link 10, which now belonged to `getPlayer → Player.REF`, so June's Player wire silently disappeared (`images/after-reconnect.jpg`). The next compile **succeeded**, but the generated `node_9_exec()` never assigns the player, so the plugin would crash on join. After re-dragging getPlayer → Player it compiled correctly.

**Deliberate mistake.** I disconnected Material from `ItemStack.of`'s `type` input and compiled. There was no error. It produced `ItemStack.of(null);` and a jar (Bug 3). This would fail when a player joins (not run). The error window's advice is "make sure you didn't forget to connect any of the nodes", yet that is exactly the mistake the app cannot detect.

**/spawn.** Edit Project Information (`images/info-editor.jpg`):
- Field values are near-black on dark grey.
- Author defaults to **"inventivetalent"** and Description to "My Awesome Plugin!!".
- "Package" is unexplained.
- **SAVE is below the bottom edge**: it sits at y=876 in a 768 px window, so June has to scroll to find it.

Clicking "+" by Commands opened a command window. Its **SAVE button is half cut off** at the bottom (y=469 in a 468 px viewport; `images/command-editor-filled.jpg`). June entered `spawn`, "Teleports you to spawn" and `/spawn`. After saving both windows, a command window showing the defaults ("MyCommand", "My Command!", "/<command>") was visible again (Bug 9). Building the graph needs `onCommand`, then `CommandSender`, a **Cast** node to `org.bukkit.entity.Player`, `Player.getWorld`, `World.getSpawnLocation` and `Entity#teleport(Location)`. June could never discover "Cast", so I built this part with helpers.

**Test server** (`images/server-log.jpg`). Run → Start Server opened "PluginBlueprint Test Server" in about 7 s:
- The log shows `[MyFirstPlugin] Enabled MyFirstPlugin version 0.0.0-b4!` and `Done (6.911s)!`.
- It also shows Paper's warning that the app agreed to Mojang's EULA through a flag on June's behalf. June was never asked.
- Long lines are clipped at the right.
- The command box is an unlabeled black bar.
- Nothing says how to join (`localhost`).

Typing `plugins` worked. After Run → Reload Plugin, typing `spawn` in the console printed a 30-line stack trace: "ClassCastException: class com.destroystokyo.paper.console.TerminalConsoleCommandSender cannot be cast to class org.bukkit.entity.Player…", then "An unexpected error occurred while trying to execute that command" (`images/spawn-console-error.jpg`). The editor did paint the onCommand → CommandSender → Cast chain orange (`images/runtime-error-graph.jpg`), which is useful. But nothing told June in plain words "this command only works for players". Run → Stop Server closed the log window. `pgrep -fl paper.jar` was empty afterwards, and File → Close Project returned to the start page.

## Likes (max 5)
1. Double-clicking an output to spawn the matching, already-connected node (`getPlayer` → Player) is magical when it works.
2. Runtime errors light up the guilty nodes in orange, and the `node_3` links in the compile-error window jump straight to the node.
3. The Examples page has real, verified recipes, and "Give a starter kit" was 90% of June's cake idea.
4. Starting a real Paper 26.3 test server from the editor in about 7 seconds, with a console box that accepts `plugins` or `spawn` without a slash.
5. Node tooltips in plain-ish English ("Called when a player joins a server and has been placed in loaded chunks", "Represents a player, connected or not").

## Dislikes (max 5)
1. Everything speaks Java: `org.bukkit.event.player.PlayerJoinEvent{getHandlerList()}`, `THIS`, `REF`, `EXEC`, `en`, `castTo`, `MakeArray type = org.bukkit.inventory.ItemStack`, "Add Bukkit Object".
2. Finding anything is a hunt: 0 results for "welcome", an 831-item Outputs menu, a 2,278-item material dropdown, and search results capped at 100 in alphabetical package order.
3. Menus and editors appear in the wrong place: submenus at the top-left corner, property dialogs half off-screen, SAVE buttons below the window edge.
4. On a Mac there is no way to save, compile or test from the menu bar, which is what every doc step tells June to use.
5. The app lets broken things through (a missing input becomes `null`) and blames June for things they didn't do (the starter-graph compile error).

## Bugs found

1. **macOS: the editor's File/Edit/Git/Compile/Run menus are never shown.** Severity: **blocker on macOS** (docs list a macOS download).
   - Where: `pages/graph.html:310` calls `getCurrentWindow().setMenu(theMenu)`, which only works on Windows and Linux. The same pattern is used in `pages/infoEditor.html:126` (File → Save) and `pages/log.html:67` (Log → Follow Log, Server → Stop Server). Inherited from master (`master:pages/graph.html:317`).
   - Evidence: in the running app, `Menu.getApplicationMenu()` contains only Electron's defaults (`File: Close Window`, `Edit`, `View`, `Window`).
   - Effect: there is no Save, Compile, Run, Import Snippet or Edit Project Information. The editor's Cmd+S, Cmd+Z and Cmd+Y accelerators live in that menu, so they are not registered either.
   - Repro: open any project on macOS and look at the menu bar.
   - Fix: build a `Menu.setApplicationMenu()` template on darwin, swapped when the focused window changes.

2. **Link-ID collision after any snippet import, including the starter graph of every new project.** Severity: **high**.
   - Where: `configureSnippet` (`pages/graph.html:574`) assigns `++graph.last_link_id`, so after importing the 9-link starter `last_link_id === 10` and ID 10 is in use. LiteGraph's `connect` (`assets/lib/litegraph/litegraph.js:2937`) uses `last_link_id++`, so the next link the user makes reuses ID 10 and overwrites the starter's `getDescription → PluginDescriptionFile.REF` link.
   - Evidence: `PluginDescriptionFile.inputs.REF.link === 10` and `Player.inputs.REF.link === 10` at the same time.
   - Repro: new project, then Getting-Started "Add and connect nodes" steps 1–4 exactly (PlayerJoinEvent, Outputs → getPlayer, double-click getPlayer), then compile. Result: "GeneratedPlugin.java:78: error: incompatible types: Player cannot be converted to PluginDescriptionFile".
   - Knock-on: re-dragging the starter link deletes link 10, which removes June's getPlayer → Player wire. The next compile **succeeds** with a Player that is never assigned (`node_9_exec()` has no assignment) and would crash on join.
   - Fix: use `graph.last_link_id++` in configureSnippet, or set `last_link_id = max(id) + 1`.
   - The same collision follows any **File → Import Snippet** (it uses the same function), so every docs example imported into a project is exposed.

3. **Unconnected inputs silently become `null` (and a missing REF silently drops the node), so "you forgot to connect a node" never produces an error.** Severity: **high** for beginners.
   - Where: `js/codeGenerator.js:472-474` (`params.push(getNullForType(...))`) and `js/codeGenerator.js:439-442` (missing REF on a non-static method only calls `console.warn` and returns).
   - Repro: disconnect Material from `ItemStack.of(Material).type`, then compile. It succeeds and `GeneratedPlugin.java` contains `ItemStack.of(null);`.
   - The error page (`pages/error.html`) tells users to check exactly this.
   - Fix: refuse to compile and highlight the node when a non-optional input or REF is unconnected.

4. **Submenus and property dialogs open at the window corner, half off-screen and unfocused.** Severity: **medium-high**.
   - Where: `assets/lib/litegraph/litegraph.js:8095-8097` rejects any event whose constructor isn't `MouseEvent` or `CustomEvent`. Electron 44 delivers clicks as `PointerEvent` (I checked the click event's constructor in this app), so the position is dropped.
   - Effect: Outputs, Inputs and Properties submenus open at (0,0). The property editor opens at `left:-18px; top:-18px`, with its input mostly above the window and `document.activeElement` still `BODY` (`images/prop-dialog.jpg`, `images/material-enum.jpg`).
   - Fix: accept `PointerEvent`, or use `instanceof MouseEvent`, since PointerEvent extends MouseEvent.

5. **The 831-entry Outputs menu is practically unreachable.** Severity: **medium**.
   - Where: `litegraph.js:8129-8141` scrolls context menus by `top += deltaY * 0.1`, registered for both `wheel` and `mousewheel`. Wheel-down moves the menu **down** (away from lower entries) and slowly. The menu has `overflow: visible` and is 17,037 px tall in a 768 px window.
   - Repro: Player → right-click → Outputs, then send five wheel events of deltaY 500 over the menu. `give(ItemStack...)` moves from y=7084 to y=7675 instead of up.

6. **The compile error's key text runs off-screen.** Severity: **medium**.
   - Where: `pages/error.html:47` replaces every space with `&nbsp;`, so lines never wrap. "error: incompatible types…" is cut at "incompat" in a 1000 px window (`images/compile-error.jpg`). The window also shows full `javac @/…/lib/javac.args` and source paths.

7. **Search never shows the exact class for common names.** Severity: **medium**.
   - Where: `pages/graph.html:383-384` sets `search_filter = true` and `search_limit = 100`. Results are substring matches in alphabetical package order with no exact-name ranking.
   - Repro: search `ItemStack` → 102 results without `org.bukkit.inventory.ItemStack`. Search `Bukkit` → no `org.bukkit.Bukkit`.

8. **SAVE buttons are below the visible area.** Severity: **low-medium**.
   - Info editor: SAVE at y=876 in a 768 px window (`main.js:833` creates it 800 px tall).
   - Command editor: SAVE at y=469 in a 468 px viewport, half visible (`main.js:856`, `height: 500`, `resizable: false`).

9. **A command window with default values reappears after saving.** Severity: **low**. This was observed, but I couldn't pin down the cause.
   - Repro: Edit Project Information → "+" → fill in → SAVE → SAVE in project info. Window 16 (`commandEditor.html`, values "MyCommand / My Command! / /<command>") becomes visible again.

10. **Double-clicking a method output never connects EXEC.** Severity: **low**.
    - Where: `js/nodeGenerator.js:986` calls `node.connect(0, n, 0) // 0 = EXEC`, but class nodes have `THIS` at output 0 (Player outputs: `THIS, EXEC, give(...)`), so the connection is rejected.
    - Repro: Player → double-click `give(ItemStack...)` → the new node's EXEC input is unlinked.
    - Also, double-clicking an array or object input (e.g. `items: ItemStack[]`) does nothing (`js/nodeGenerator.js:962-972`).

11. **The "Different Editor Version" warning compares only the minor version.** Severity: **low**.
    - Where: `main.js:519` (`appVersionSplit[1] !== fileVersionSplit[1]`). A 1.0.x project opened in 2.0.0 gets no warning.

12. **Docs and app disagree.** Severity: **low**.
    - The canvas right-click menu is "Add Generic Node / Add Bukkit Event / Add Bukkit Object / Add Bukkit Method", not **Add Node** (Getting-Started, "Add and connect nodes").
    - `docs/images/project-info.png` shows "Soft-Depend (command-separated)"; the app shows "(comma-separated)".
    - On macOS, Redo is Shift+Cmd+Z (Electron default role), not Cmd+Y.

## Feature requests and changes (ranked)

1. **Plain-language starter blocks and templates.** Add a "Simple" palette that hides Java names: "When a player joins", "When a player types /command", "Give item [picker] × [n] to player", "Send chat message", "Teleport player to world spawn", "Broadcast". Each block generates the existing node chains (`ItemStack.of` → `MakeArray` → `give`). Offer "New from template" with the five Examples plus "join + item + welcome" and "/spawn".
   - Why June cares: their two ideas become 3–4 blocks instead of an afternoon of guessing.
   - Where: new `js/nodes/simple.js`, `js/nodeGenerator.js` registration, a template picker in `index.html` / `main.js` `createNewProject`, reusing `docs/examples/*.pbs`.
   - Effort: **L** (an M first cut with 6 blocks).

2. **Searchable, friendly node search.** Rank exact simple-name matches first (`ItemStack` → `org.bukkit.inventory.ItemStack`). Show `PlayerJoinEvent — when a player joins` with the package greyed out. Add keyword aliases (welcome → sendRichMessage/PlayerJoinEvent, give → Player#give, spawn → getSpawnLocation/teleport). Remove the 100-result cap or show a count.
   - Why June cares: "welcome" and "ItemStack" both failed.
   - Where: `pages/graph.html:383-384` and LiteGraph's `showSearchBox`; aliases from class-data descriptions in `data/classes/paper.json`.
   - Effort: **M**.

3. **Filterable Outputs/Inputs picker instead of the 831-item menu.** Open a small panel with a filter box, plus "Common" (getName, getInventory, give, sendRichMessage, teleport, getWorld, getLocation) and "All". Group overloads together.
   - Why June cares: `give` and `teleport` were effectively unreachable.
   - Where: the `optional_outputs` menu in `js/nodeGenerator.js`, the context menu in `litegraph.js`.
   - Effort: **M**.

4. **Validate the graph before compiling, in June's words.** Before `javac`, list problems: "**Give item** has nothing plugged into **items**", "**Teleport** is not connected to the chain (orange arrows)", "A **/spawn** command uses a Player — it will fail from the console; add 'only players'". Click to jump to the node. Translate the common javac errors ("incompatible types: X cannot be converted to Y" → "You plugged a *Player* into a slot that needs a *PluginDescriptionFile*").
   - Why June cares: the only errors they saw were raw javac or silent nulls.
   - Where: `js/codeGenerator.js` (a validation pass), `pages/error.html` (wrap text, put the friendly summary first, hide the javac command line).
   - Effort: **M**.

5. **"Put it on your friend's server" guide and button.** Add Compile → "Show my plugin file" with text like "Copy `MyFirstPlugin.jar` into your server's `plugins/` folder and restart". Add a doc page for common hosts (file manager upload) with a warning to turn Debug off first.
   - Why June cares: the whole point is the friend's server, and the docs only cover `localhost`. A grep for "plugins folder" or "upload" finds nothing.
   - Where: `docs/Testing-your-Plugin.md` or a new `docs/Installing-on-a-server.md`, plus `openOutputDir` in `main.js`.
   - Effort: **S**.

6. **Command wizard that scaffolds the graph.** Adding `/spawn` in project info should offer to create `onCommand` → name check → "sender is a player?" (InstanceOf + Cast) → EXEC stub, and a branch per command when there are several (the docs currently say "compare `command` → `getName` with `String#equalsIgnoreCase` and branch with a `Switch`").
   - Why June cares: "Cast" and `equalsIgnoreCase` are invisible to a non-coder.
   - Where: `pages/infoEditor.html` / `commandEditor.html` (`saveCommand`), `main.js`, plus a generator helper in `js/nodeGenerator.js`.
   - Effort: **M**.

7. **Friendly pickers for enums and types.** Replace the 2,278-option `<select>` labeled `en` with a type-to-filter picker labeled "Item/Block" (with icons if possible). Infer `MakeArray`'s element type from what is connected instead of asking for `org.bukkit.inventory.ItemStack`.
   - Why June cares: "en" and Java class names stopped them cold.
   - Where: `js/nodeGenerator.js:536-547` (enum node), `js/nodes/array.js` (MakeArray `onConnectionsChange`).
   - Effort: **M**.

8. **Autosave and a visible "unsaved" marker.** Save the graph every 30 s or on every change, and show "Saved ✓ / Unsaved" in the editor. The title does gain a `*`, but June won't notice it.
   - Why June cares: about an hour of work was never written to disk on the Mac.
   - Where: `pages/graph.html` (`saveGraph`, `unsavedChanges`).
   - Effort: **S**.

9. **Toolbar buttons in the editor.** Add big **Save / Build / Test on server / Stop** buttons in the page itself, not only in the menu bar. They also act as the macOS escape hatch until Bug 1 is fixed.
   - Why June cares: these are the four things they do over and over.
   - Where: `pages/graph.html` (HTML overlay calling the existing `saveGraph`, `generateCodeCompilePackage` and the `startServer` / `stopServer` IPC).
   - Effort: **S**.

10. **First-run checklist and honest requirements.** On the start page, show "You'll need: about 300 MB of downloads, Minecraft Java 26.3 to test in-game". Ask for EULA consent once ("The test server runs Minecraft's server software; by starting it you accept the Minecraft EULA [link] — Accept"), instead of passing `-Dcom.mojang.eula.agree=true` silently.
    - Why June cares: surprise downloads, and an agreement made for them.
    - Where: `index.html`, `js/serverStarter.js:38`, `main.js` `startServer`.
    - Effort: **S**.

11. **Better defaults in project info.** Author defaults to an empty field or the OS user name (not "inventivetalent"). Package is generated from the name (e.g. `me.june.myfirstplugin`) and hidden under "Advanced", together with Soft-Depend. Validate the plugin name (Paper rejects characters such as `'`; not tested here).
    - Why June cares: the plugin otherwise ships saying it was written by someone else, and every PluginBlueprint plugin shares `my.awesome.plugin.GeneratedPlugin`.
    - Where: `main.js:333-347`, `pages/infoEditor.html`.
    - Effort: **S**.

12. **Readable log window.** Wrap long lines, collapse stack traces into "Your plugin hit an error in node *Cast* — click to show details", add a placeholder in the command box ("Type a server command, e.g. op June"), and add a "How to join: localhost" banner plus Stop and Reload buttons.
    - Why June cares: the ClassCastException wall of text was unreadable.
    - Where: `pages/log.html`, `main.js` (log parsing around `logError`).
    - Effort: **S–M**.

13. **Hide developer chrome by default.** Turn off the LiteGraph stats overlay ("T: … FPS:2500.00") and move the Git menu under "Advanced", so June doesn't see errors like "Missing Remote".
    - Why June cares: less scary noise.
    - Where: `pages/graph.html` (`canvas.render_info = false`), menu template.
    - Effort: **S**.

14. **Share one Paper copy across projects.** Point the classpath and test server at the cached Paper in userData (or hard-link it) instead of copying `paper.jar` and its libraries into each project.
    - Why June cares: 223 MB per experiment fills a school laptop fast.
    - Where: `js/paper.js` `ensureServer`, `getClasspath`; `js/serverStarter.js`.
    - Effort: **M**.

### Error strings, as June reads them (step 6)
- `main.js:29` "PluginBlueprint needs Java 25 to build plugins. Download it now (about 200 MB)?" is clear enough, but "Java 25" could be mistaken for the game's Java Edition. If June clicks Cancel, the box title is "Server setup failed" with "Java 25 is required to compile plugins." (thrown at `main.js:32`, shown at `:377`). It sounds like something broke, not that they said no. The editor then opens anyway (`main.js:374-380`) with no hint that the next compile will ask again.
- `js/jdk.js:46/48/55/69/74` "Unsupported JDK platform: win32/ia32", "JDK metadata: HTTP 404", "JDK download: HTTP 503", "JDK SHA-256 mismatch", "Expected one JDK folder in …": all jargon. June needs "Couldn't download Java (check your internet and try again)".
- `js/paper.js:22/32/34` "Paper metadata: HTTP …", "Paper SHA-256 mismatch": same problem. When offline, Node's raw "fetch failed" reaches the "Server setup failed" box.
- `main.js:321` "There is already a PluginBlueprint project in that directory" and `main.js:453` "Could not find a PluginBlueprint project in that directory" are understandable. "directory" → "folder" would be friendlier.
- `main.js:357` "Failed to create PluginBlueprint project in that directory" gives no reason (permissions? not empty?).
- `main.js:897` "Please compile your plugin first!" is clear. `main.js:902` "Please wait for the existing server to shut down and try again" is OK.
- `main.js:503` "This project targets Spigot. PluginBlueprint now builds plugins for Paper 26.3." and `main.js:523` "Different Editor Version … proceed carefully and create a backup first" are fine for upgraders. June would not know what Spigot is.
- `main.js:1122` "Missing Remote — Please configure a remote first" and the raw Git `err.message` boxes: June has no idea what a remote is.
- `pages/error.html` "Oh noes! Looks like there is an error in your Blueprint! Please make sure you didn't forget to connect any of the nodes…": the friendly tone works, but the hint is wrong for the errors that actually happen (Bug 3). It is followed by raw `Command failed: javac @…` text that doesn't wrap (Bug 6).

## Would June keep using it?

Probably not as it is today. On their Mac, June would have hit a wall within ten minutes: the docs say "Compile → Generate Code, Compile, Package" and that menu doesn't exist. Even with the menus, the first thing the tutorial has them do silently breaks the starter graph, and the first compile error blames a box they never touched. Searches for "welcome", "cake" and "ItemStack" didn't find what they meant, and the Outputs menu buried `give` among 831 Java method names. June only got the cake working by copying a recipe step by step and typing `org.bukkit.inventory.ItemStack` into a half-hidden box. "/spawn" was out of reach without someone who knows what "Cast" means. Still, the moments that worked felt great: double-click `getPlayer` and a connected Player node appears, start a real server in seven seconds, see the broken node glow orange. If the maintainer fixes the four big bugs (Mac menu, link IDs, silent nulls, off-screen menus) and adds a handful of plain-language blocks and templates, June would build their two ideas in an evening and show them off on their friend's server. That is exactly the "without coding" promise that brought them here.
