# Java code

Use a **Java code** node to run Java that you write yourself. Connect its **EXEC**
input and output to choose when it runs and which nodes run after it.

## Add inputs and outputs

1. Add a node from **code → Java code**.
2. Open its menu and select **Add input…** or **Add output…**.
3. Enter a Java name, such as `player` or `greeting`, without spaces or Java keywords.
4. Choose a type, or select **Other…** and enter a Java type.
5. Connect the slot to the node that supplies or uses its value.

Each name must be unique across the node's inputs and outputs. To remove a
declaration, open its slot's menu and select **Remove Slot**.

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
2. On the Java code node, add an input named `player` with type `org.bukkit.entity.Player`.
3. Add an output named `greeting` with type `java.lang.String`.
4. Connect the event's **EXEC** and **getPlayer** outputs to the code node's **EXEC** and **player** inputs.
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
