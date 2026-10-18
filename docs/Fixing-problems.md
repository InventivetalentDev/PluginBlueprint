# Fixing problems

Choose **Edit → Check for problems** (`CmdOrCtrl+Shift+K`) to check your graph.
The same check runs before generating code, compiling, or packaging, including **Build & Reload** and **Test**.

The problems panel lists errors and warnings. **Errors stop the build. Warnings let it continue.**
Click a problem to select and center its node. This keeps your zoom level.
A red circle with `!` marks an error; an amber circle marks a warning.
The panel also writes **Error** or **Warning** beside each message.

While the panel is open, it checks each graph change. Fixed problems disappear.
When you fix everything, it says **No problems found.**
Choose **Close** to hide the panel and clear its badges. Badges are not saved in your project.

## Fix a graph problem

Use the message to find the input, connection, or project setting to change.

| Problem | How to fix it |
|---|---|
| A connection points to a missing node or slot, or no longer matches its slots. | Delete the connection and connect it again. |
| Unknown node type. | Delete the node. It may come from a newer version of PluginBlueprint. |
| A method has no REF connection. | Connect **REF** to the object the method runs on, such as a Player. Static methods do not need REF. |
| A required native input is missing. | Connect the input named in the message. Arithmetic, comparisons, logic gates, loops, and array access need their values. **ConsoleLog** needs a value, and **StringFormat** needs its format string. Cast and Set require a value for primitive types such as `int`. |
| A method or constructor parameter gets a default value. | Connect it if you need a value. Missing reference inputs get `null`; boolean inputs get `false`; number inputs get zero. A char input gets the zero character. This warning does not stop the build, but the method may reject the default when it runs. |
| A node never runs. | Connect its **EXEC** input to an event or an earlier node. An object used only to access static methods does not need EXEC. |
| A linked slot has an unsupported generic type or a skipped method output. | Remove the connection. Use a method node or a method with a supported type. Legacy generic names such as `T` cannot be used directly. |
| An abstract event cannot be listened to. | Use a specific event such as **PlayerJoinEvent**. To use an abstract event as an existing object, connect its REF input. |
| A variable name is invalid, or one name has different types. | Use a Java identifier such as `count`, without spaces or Java keywords. Give Set and Get nodes with the same name the same type, or rename one. |
| Two Command nodes share a name, or the project also lists that command. | Rename one duplicate Command node. If the name also appears in **Project Information > Commands**, remove it from that list. The list conflict is a warning. |
| Config value has no key, or its key is missing from the config table. | Add the key in **Project Information > Config**, then select it on the node. |
| A config key is invalid, duplicated, or both a value and a parent. | Use letters, numbers, underscores, or hyphens between dots. Remove duplicate keys. Keep `messages.welcome` or a value named `messages`, not both. |

A missing input is allowed when the generated code handles it safely.
**Switch** defaults to false, **Cancel event** skips a missing event, and **StringFormat** ignores missing extra variables.
An object Cast or Set may use `null`. **SetIndex** may store `null` in a reference array, but needs a value for a primitive array.
**MakeArray** permits an empty array and a trailing empty input; connect empty inputs before the last input to avoid blank array elements.

If the panel says **Code generation failed**, read the message after the colon.
Fix the named node or setting, then build again.

## Read a compiler error

The Java compiler, called javac, checks the generated Java after graph validation.
The error window shows a plain-language explanation followed by the original diagnostic.
For example:

```text
Line 78 (node_3): You plugged a Player into a slot that needs a PluginDescriptionFile.
    javac: incompatible types: Player cannot be converted to PluginDescriptionFile
```

Click `node_3` to show that node in the editor. The editor marks every node named by an explained error.
For generated code, the node usually owns the method containing the failing line.
The original compiler output appears below **javac output:** for more detail.

| Explanation | What to check |
|---|---|
| You plugged one type into a slot that needs another. | Reconnect the input to a value of the required type. |
| A node is not generated because it is missing a connection. | Check its REF input first. |
| The code uses a symbol that does not exist. | Check the named variable, class, or method and the node's connections. |
| Two variables have the same name. | Rename one, or use the same type. |
| A method can fail with an exception. | Use a method that does not throw it. PluginBlueprint cannot catch exceptions yet. |
| Several versions of a method fit the inputs. | Connect inputs with more specific types. |
| A name or value is not valid Java. | Check the node's names and text. |
| A method got the wrong number or kind of inputs. | Check its parameter connections. |

Other compiler messages appear unchanged. An error in your own source file uses a location such as `MyHelper.java line 12` and has no node link.
If an error names no node, open the named source file at that line.
For `GeneratedPlugin.java`, check the nearby method and its graph connections, then rebuild.
Include the explanation and the original javac output when asking for help.
