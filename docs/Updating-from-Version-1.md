# Updating from version 1

Back up your project before opening it in PluginBlueprint 2.0.
The editor builds for Paper 26.3, so a 1.x Spigot graph may need replacement nodes.

## Back up and open your project

1. Copy the project folder as a backup, or use **Git → Commit** before updating.
2. On the start page, click **Open Project** and select your project's `.pbp` file.
3. If the editor version warning appears, check your backup before proceeding.
4. In the Paper update dialog, click **Update and open** to update the target.
   To leave without updating, click **Cancel**.

## Read the two dialogs

### Different editor version

If the project was saved by a different editor version, the app may show this warning first:

> The project you're trying to open was created using a different PluginBlueprint version.

Its detail text is:

> It might not be compatible with the current version, so please proceed carefully and create a backup first. (Project Version: …, Editor Version: …)

The app replaces the ellipses with the project and editor versions.
The buttons are **Proceed Anyway**, **Open Project Directory to create backup**,
and **Cancel**. After you have a backup, click **Proceed Anyway** to continue.

### Paper target update

For a Spigot project, the next dialog says:

> This project targets Spigot. PluginBlueprint now builds plugins for Paper 26.3.

Its detail text is:

> Update the project? The server files in lib/ are replaced on the next compile. Nodes for methods that no longer exist are marked as errors.

The buttons are **Update and open** and **Cancel**.

**Update and open** sets the project target to Paper 26.3.
The Spigot jar is no longer used. Paper is downloaded on the next compile,
when the server files in `lib/` are replaced.

## Check and update the graph

1. Find nodes marked as errors. If their methods no longer exist in Paper 26.3,
   replace or delete them.
2. Choose **File → Save**.
3. Choose **Compile → Generate Code, Compile, Package**.
4. Follow [Testing your plugin](Testing-your-Plugin.md) to check your updated graph.

Deprecated methods still work in old graphs. The method-browsing menu hides
them, but a class node's **Outputs** can still list them.
Deprecation alone does not mean a node's method has been removed.
`sendMessage(String)` still works in Paper 26.3. To use colors and formatting,
you can replace it with `sendRichMessage(String)`, which reads MiniMessage tags.
See the
[hello command example](Examples.md#create-a-hello-command) for a replacement pattern.

Updating the project target does not restore methods that Paper no longer has.
If compilation fails, use the `node_<id>` links in the error window and follow
[Troubleshooting](Troubleshooting.md#the-compile-error-window-opens).
