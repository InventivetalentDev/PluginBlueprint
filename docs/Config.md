# Config

Use the **Config** tab in **Project Information** to define the defaults that
your plugin ships in `config.yml`.

## Define keys

1. Open **Project Information → Config**.
2. Select **Add key**.
3. Enter a **Key path**, choose a **Type**, and enter a **Default**.
4. Select **Save**.

Use dots for nested keys, such as `welcome.message`. Each part between dots
can contain letters, digits, `_`, and `-`. Keys must be unique. A key cannot
hold a value and contain other keys: use `welcome.message` or `welcome`, not both.
Invalid keys show a message in the table. You can save them, but the build fails
until you fix them. Rows with an empty key are dropped when you save.

The types write these defaults:

| Type | Default |
| --- | --- |
| Text | Quoted text |
| Whole number | An integer; invalid values become `0` |
| Number | A finite number; invalid values become `0.0` |
| True/false | `true`, ignoring case; other values become `false` |
| List | Items separated by commas; surrounding spaces and empty items are removed |

The build puts the generated file in the plugin JAR. If the table contains keys,
it replaces a hand-written `resources/config.yml` in that JAR. The plugin calls
`saveDefaultConfig()` when it enables, which creates its config file if it is missing.
It preserves an existing file in the server's plugin folder.

## Read and reload values

Add **config → Config value** and choose a key in its **key** dropdown.
Connect its output to the node that needs the value. The output type follows
the key's type. Choosing a key with a different type disconnects existing links.
List values use Java's `List` type and contain strings.

Config value nodes read the config when their connected code uses the value.
To load edits from the server's config file, add **config → Reload config**
and connect its EXEC input and output into your action. You can connect it to
a Command node to make your own reload command.

## Use a hand-written file

When the table is empty, `resources/config.yml` ships unchanged. Add a JavaPlugin
`saveDefaultConfig` node yourself to copy its defaults into the server's plugin
folder. The empty table does not add that call for you.
