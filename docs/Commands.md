# Commands

Add a **Command** node to register a command and run its connected nodes.
You don't need to add this command to Project Information.

## Add a command

1. Add a node from **commands → Command**.
2. Open the node's **Properties** menu and set **name**, without the `/`.
3. Connect **EXEC** to the nodes the command should run.
4. Build and test the plugin, then enter `/<name>` in the server console or chat.

The node title shows `/<name>`. Names and aliases become lowercase and keep
only letters `a-z`, digits, `_`, and `-`. An empty name becomes `mycommand`.

Use **description** for help text and **aliases** for alternate names separated
by commas. Set **permission** to require a permission such as `myplugin.heal`.
Permission names become lowercase and keep only `a-z`, digits, `.`, `_`, and `-`.
If the sender lacks permission, the command sends **permissionMessage** and stops.
This message supports MiniMessage formatting, such as `<red>`.

Set **playersOnly** to `true` to reject console use with a message.
The **sender** output is the player or console that ran the command.
The **player** output is that player, or `null` for a console sender.
The **args** output contains the raw arguments as a string array.

## Add arguments

Open **Add argument**, choose a type, and enter a name.
Each argument adds an output with its parsed value. All arguments are required,
in the order you add them. The command sends usage text if an argument is missing
or a number or boolean cannot be parsed.

The argument types accept these values:

| Menu label | Accepted value |
| --- | --- |
| Word | One word |
| Rest of text | All remaining words, joined with spaces; must be last |
| Whole number | A Java `int`, such as `3` or `-2` |
| Number | A Java `double`, such as `1.5` |
| True/false | `true` or `false`, ignoring case |
| Player | The exact name of an online player; sends a message if none matches |

Argument names keep letters `A-Z` and `a-z`, digits, `_`, and `-`.
An empty name becomes `arg1`, `arg2`, and so on.
To remove an argument, open its output's menu and choose **Remove Slot**.
After **Rest of text**, **Add argument** is disabled until you remove that argument.

Player arguments suggest online player names. Boolean arguments suggest `true`
and `false`. Suggestions match the text entered so far, ignoring case.

## Return values and older commands

The Command node uses Paper's `BasicCommand.execute`, which returns `void`.
There is no RETURN input: failed checks send their own message and stop execution.
A Command node with no EXEC connection still registers and runs no connected action.

Keep the older JavaPlugin `onCommand` path when you need its boolean return value
or already have commands declared in Project Information. Those commands use
the generated `plugin.yml` command list. Don't declare the same command there
and on a Command node.
