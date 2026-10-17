# Generate class data

Use Node 22 or later and the exact JDK major version reported by Paper. Set
`JAVA_HOME` to that JDK's home directory. The generator does not install a JDK.

1. Resolve the latest stable Paper version and required JDK:
   ```sh
   node tools/classdata/generate.mjs --resolve-only
   ```
2. Generate Paper, Adventure, and curated `java.base` class data from source:
   ```sh
   node tools/classdata/generate.mjs
   ```
3. Check schema and saved node compatibility:
   ```sh
   node --test tools/classdata/test/
   ```

Use `--version 26.3` to select a stable Paper version and `--out /path/to/output`
to change the output directory. Tests read the default `data/classes/` directory.
Downloads, unpacked sources, and compiled doclet classes stay in `.cache/`.
The server download is reused when its SHA-256 matches. Missing compile-time
dependencies come from the published Paper and Adventure metadata. These small
dependency jars are reused when the files exist.

The `Class data` workflow checks every Monday at 06:00 UTC. It opens a pull request
when the Minecraft version changes. Run it manually with `force` to refresh the
same version, or with `version` to select a release. Enable “Allow GitHub Actions
to create and approve pull requests” in the repository's Actions settings.
