# Codegen harness

These scripts run `js/nodeGenerator.js` and `js/codeGenerator.js` in plain Node, without Electron. They build graphs through the same litegraph `connect()` path the editor uses, generate the Java, and optionally compile it with `javac`. A run takes about a second.

They were written during the [2026-10-18 persona review](../../dev/reviews/2026-10-18-personas/README.md) to reproduce code-generation bugs. Phase 1 of the [roadmap](../../dev/roadmap.md) turns them into golden tests under `test/`. Until then, use them to reproduce a bug before fixing it.

## Files

- `harness.js`: shared helpers. `setup()` returns a fresh `LGraph`; `add`, `link`, `addOptOut`, `addOptIn` build the graph; `gen(graph, debug)` returns the Java source. It stubs `electron` and `@electron/remote`.
- `repros/jonas-1.js`, `repros/jonas-2.js`: about 25 small graphs (generics, enum outputs, JavaPlugin methods, onTabComplete, async events, Folia scheduler, checked exceptions, unconnected parameters, variables, FlipFlop). Pass test names as arguments to run a subset.
- `repros/tomas.js`: graphs for the admin use cases (variables, generic `Map#get`, onTabComplete, onCommand return value, command arguments). It also compiles each result.
- `repros/tomas-snippet.js`: re-runs the snippet export and import logic from `pages/graph.html` on a partial selection of `docs/examples/join-message.pbs`.
- `repros/ren.js`: graphs for `Variables → Get`, type-variable returns, and the property-injection bug.

## Run

Run from the repository root after `npm ci`:

```sh
node tools/codegen-harness/repros/jonas-1.js              # all graphs
node tools/codegen-harness/repros/jonas-1.js generic      # one graph
node tools/codegen-harness/repros/ren.js tools/codegen-harness/out/ren
node tools/codegen-harness/repros/tomas-snippet.js
```

Generated sources go to `tools/codegen-harness/out/`, which git ignores. Set `PB_VERBOSE=1` to see the generators' own console output.

## Compile the output

The generated code compiles against the Paper classpath that the app writes for every project. Create and compile any project in the app once, then use its argfile:

```sh
PB_JAVAC_ARGS=/path/to/project/lib/javac.args node tools/codegen-harness/repros/tomas.js
```

For the other scripts, compile a generated file by hand. Copy the `-cp` line from `lib/javac.args` into your own argfile, and do not reuse the project's `-d` or source arguments:

```sh
javac @my.args -d /tmp/pb-out tools/codegen-harness/out/jonas/generic/my/awesome/plugin/GeneratedPlugin.java
```
