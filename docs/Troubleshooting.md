# Troubleshooting

Find the symptom below, then follow its fix.
For the full setup procedure, see [Getting started](Getting-Started.md).

## Launch and setup

### The app cannot be opened or Windows protected your PC

Cause: the release apps are unsigned.

1. On macOS, open **System Settings → Privacy & Security** and click **Open Anyway**.
2. On Windows, when **Windows protected your PC** appears, click **More info**,
   then **Run anyway**.

### Java 25 is required to compile plugins.

Cause: you clicked **Cancel** on the Java download prompt and the app could
not find a suitable JDK.

1. Choose **Compile → Generate Code, Compile, Package** again.
2. When the Java prompt appears, click **Download**.

If you install Java yourself instead, use a JDK 25 or newer and set `JAVA_HOME`
to that JDK. The app checks `JAVA_HOME`, Java on `PATH`, and its downloaded copy.

### The first project takes a long time to create

Cause: the first project downloads Paper, about 55 MB, and Java if needed,
about 200 MB. It then unpacks Paper's libraries.

1. Check that you have internet access for the initial downloads.
2. Wait for the downloads and unpacking to finish.

Later projects reuse the cached Paper download.
They still need internet to check Paper's download metadata during setup.
See [Getting started](Getting-Started.md#find-the-apps-downloaded-files)
for the cache location.

## Compiling and opening projects

### The compile error window opens

Cause: the Java compiler found an error in the generated plugin.
An unconnected input that a method needs is a common cause.

1. Read the first `error:` line in the window.
2. Click its `node_<id>` link to highlight the related node.
3. If a required input is unconnected, connect a value to it.
4. Choose **Compile → Generate Code, Compile, Package** again.

### Nodes are red after opening an old project

Cause: those methods no longer exist in Paper 26.3.

1. Replace or delete the affected nodes.
2. Follow [Updating from version 1](Updating-from-Version-1.md) to check the
   rest of the graph.
3. Compile again.

## Running your plugin

### The server runs an old version of my plugin

Cause: **Run → Start Server** and **Run → Reload Plugin** use the last
compiled jar. Neither compiles your changes.

1. Choose **Compile → Generate Code, Compile, Package**.
2. If the server is running, choose **Run → Reload Plugin**.
   Otherwise, choose **Run → Start Server**.

### `/mycommand` says "Unknown command"

Cause: the command is missing from the project information, or you have not
compiled since adding it.

1. Open **Edit → Edit Project Information** and check **Commands**.
2. If the command is missing, click **+** and enter its details.
3. Click **Save** in each information window you opened.
4. Compile, then start the server or choose **Run → Reload Plugin**.

### The server does not start or stops right away

Cause: another server may already be using port `25565`.
The log window shows the server error.

1. If another server is using port `25565`, stop that server.
2. Check the log window for the error.
3. Choose **Run → Start Server** again.

### `pb_debug_exec=` lines appear in the server log

Cause: **Debug** is on. The generated plugin writes a line for each executed
node. The built-in log window uses these lines for highlighting and hides them.

1. Open **Edit → Edit Project Information** and turn **Debug** off.
2. Click **Save**, then choose **Compile → Generate Code, Compile, Package**.
3. If the test server is running, choose **Run → Reload Plugin**.
