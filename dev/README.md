# Developer notes

This folder is for maintainers. It is not part of the app build (see `build.files` in `package.json`) and is not synced to the wiki, which only mirrors `docs/`.

- [`roadmap.md`](roadmap.md): what to build next, in phases, with status.
- [`reviews/`](reviews/): product reviews that feed the roadmap. Each review folder has its own README.

Tools used by these reviews live next to the other dev tools:

- [`tools/codegen-harness/`](../tools/codegen-harness/): runs the node and code generators in plain Node, without Electron.
- [`tools/app-driver/`](../tools/app-driver/): drives the running app over the Chrome DevTools Protocol for screenshots and GUI checks.
