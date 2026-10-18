# App driver

These scripts drive the running app over the Chrome DevTools Protocol (CDP). Use them to take screenshots for the docs, to check a GUI fix, or to generate code from a snippet without clicking through the editor. They were used to make the docs screenshots and in the [2026-10-18 persona review](../../dev/reviews/2026-10-18-personas/README.md).

## Start the app with debugging ports

Run from the repository root. Do not add `--debug`: `npm start` passes it, and Electron refuses to start when `--debug` and `--inspect` are combined.

```sh
npx electron . --inspect=9271 --remote-debugging-port=9471
```

Port 9471 serves the renderer windows, and port 9271 serves the main process. The scripts expect these ports.

The app uses your normal app data folder. Projects you create while testing appear in the start page's Recent Projects list. The test server listens on port 25565.

## Scripts

Run them from this folder.

- `node cdp.mjs <url-part> "<expression>" [shot.png]`: evaluates JavaScript in the window whose URL contains `<url-part>` (`index.html`, `graph.html`, `infoEditor.html`, `commandEditor.html`, `log.html`, `prompt.html`) and prints the result. With a third argument it also saves a screenshot. Set `CLIP='{"x":0,"y":0,"width":800,"height":600}'` to crop.
- `node input.mjs <url-part> click|dblclick|rclick <x> <y>`, `type <text>`, `key <Key> [mods]`, `drag <x1> <y1> <x2> <y2>`, `move <x> <y>`, `wheel <x> <y> <dy>`: sends real mouse and keyboard input. Coordinates are CSS pixels.
- `node main-eval.mjs "<expression>"`: evaluates JavaScript in the main process.
- `curl -s http://127.0.0.1:9471/json/list | grep url`: lists the open windows.

## Native dialogs

Native file and message dialogs block the main process and are not visible over CDP. Replace them before you click anything that opens one:

```sh
node main-eval.mjs "$(cat stub-dialogs.js)"
```

After that, every dialog call is recorded in `global.__dialogLog`, and answers come from the `global.__answers` queue. Queue the answer before the action that opens the dialog. For example, to create a project:

```sh
mkdir -p /tmp/pb-test
node main-eval.mjs "global.__answers.push(['/tmp/pb-test']); 'ok'"
node cdp.mjs index.html "require('electron').ipcRenderer.send('showCreateNewProject'), 'ok'"
node cdp.mjs prompt.html "(() => { const i = document.querySelector('input'); i.value = 'TestPlugin'; document.querySelector('#ok').click(); })()"
```

Read what the user would have seen with `node main-eval.mjs "JSON.stringify(global.__dialogLog)"`. Run the stub again after every app restart.

## Editor helpers

`helpers.js` adds an `H` object to the editor window:

```sh
node cdp.mjs graph.html "$(cat helpers.js)"
```

- `H.add(type, x, y)` adds a node, `H.link(a, outName, b, inName)` connects two nodes, and `H.dbl(node, outName)` does what double-clicking an output does.
- `H.prop(node, key, value)` sets a property, and `H.summary()` lists the nodes and their links.
- `H.fit()`, `H.rect()` and `H.snippet()` frame the graph, return its screen rectangle, and serialize it as a `.pbs` snippet.

To generate the Java for a snippet without compiling:

```sh
node cdp.mjs graph.html "(async () => { H.clear(); configureSnippet($(cat ../../docs/examples/join-message.pbs)); return await CodeGenerator.generateClassCode(graph, projectInfo); })()"
```
