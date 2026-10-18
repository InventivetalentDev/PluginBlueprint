# Installing on your server

Use a Paper server that matches your project's Minecraft version.
Test your plugin before installing it on a server other people use.

## Install your plugin

1. Choose **Compile → Generate Code, Compile, Package** in PluginBlueprint.
2. Choose **Compile → Open output directory** to find `<project name>.jar`.
3. Copy the jar into your Paper server's `plugins/` folder.
4. Restart the server.
5. Run `/plugins` in Minecraft and check that your plugin appears enabled.
   In the server console, use `plugins` without the slash.

## Update your plugin

1. Build and [test the changed plugin](Testing-your-Plugin.md).
2. Stop your server.
3. Replace the old jar in `plugins/` with the jar from the output folder.
4. Start the server.
5. Run `/plugins` and test the action your graph handles.

## Fix an installation problem

1. If the plugin is missing or disabled, read the server log for its startup error.
2. If the log reports an incompatible Java or API version, check your project's
   Minecraft version against your server and Java versions.
3. If the log names a missing dependency, install that plugin in `plugins/`.
4. If the old behavior remains, check that you copied the jar from the last
   successful build and removed any older copy with a different filename.
5. Restart the server after fixing the cause. See [Troubleshooting](Troubleshooting.md)
   for build and test server problems.
