# Java code

Use a **Java code** node to run Java that you write yourself. Connect its **EXEC**
input and output to choose when it runs and which nodes run after it.

## Add inputs and outputs

Drop a link anywhere on the node to add a slot for it:

- Drag from another node's output and drop it on the Java code node. The node
  adds an input with that output's type and connects it. The input is named
  after the output, such as `player` for `getPlayer`.
- Drag from another node's input and drop it on the node to add a matching output.
- While you drag, the node shows **+ input** or **+ output** if it can add a slot.
  If it already has an unconnected input of the same type, or an output of the
  same type, the link connects to that slot instead.

EXEC links and **REF** inputs connect as usual.

To add a slot from the menu:

1. Open the node's menu and select **Add input…** or **Add output…**.
2. Type to filter the Java types, and choose one. Common types come first.
   For a type that isn't listed, such as an array, type its full name and
   choose it at the top of the list.
3. Accept the suggested name, or enter a Java name without spaces or Java keywords.

Each name must be unique across the node's inputs and outputs. To rename a slot,
right-click it and select **Rename…**. Renaming also changes the name everywhere
it appears in your code as a whole word, except after a `.`. This includes text
inside string literals, so check the code afterwards. To remove a slot,
right-click it and select **Remove Slot**.

Inputs and outputs are local variables inside your code. Inputs are `final`,
so you can read them but cannot assign a different value to them. Assign values
to output variables to pass them to connected nodes. Unconnected inputs and
outputs start as `false` for `boolean`, `0` for other primitive types, or `null`
for class and array types.

## Edit the code

Double-click the node, or select **Edit code…** from its menu. Enter Java
statements in the multiline prompt. The node previews the first four lines.

Use full class names, such as `java.lang.String` or `org.bukkit.entity.Player`,
in declarations and code. Do not add `import` lines. A Java compiler error in
your code points to this node in the build errors.

A `return;` stops the node immediately. It skips copying output variables to
the connected slots and skips the nodes after it.

## Log a greeting when a player joins

1. Add a **PlayerJoinEvent** node and a **Java code** node.
2. Drag the event's **getPlayer** output onto the Java code node. It adds an
   input named `player` with type `org.bukkit.entity.Player`.
3. Select **Add output…**, choose `String`, and accept or enter the name `greeting`.
4. Connect the event's **EXEC** output to the code node's **EXEC** input.
5. Open **Edit code…** and enter this statement:

   ```java
   greeting = "Hi " + player.getName();
   ```

Add a **ConsoleLog** node. Connect the code node's **EXEC** output to its
**EXEC** input, and **greeting** to its value input. When a player joins,
the server console logs a greeting with that player's name.

## Import a snippet with Java code

Importing a snippet with Java code nodes shows a warning and a preview of up to
10 lines from each code node. These nodes run whatever code they contain on
your server. Only select **Add snippet** if you trust where it came from.
Select **Cancel** to leave the snippet out of your graph.
