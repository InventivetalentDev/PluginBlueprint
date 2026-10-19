# Subgraphs

Use a **Subgraph** node to group part of your graph on its own canvas.
When you build, PluginBlueprint connects the nodes as one graph.
The grouping doesn't add a function or change what your plugin does.

## Add a subgraph

1. Open node search and search for **Subgraph**.
2. Add **graph → Subgraph**.
3. Open the node's menu and choose **Rename** to give the group a useful name.

To group existing nodes, select at least two nodes, open a selected node's
menu, and choose **Convert to subgraph**. Connections that cross the selection
become pins on the Subgraph node. You can't convert a selection that includes
Subgraph Input or Subgraph Output nodes.

Conversion can change EXEC call order when one source connects to selected
and unselected targets in an interleaved order. For example, connections in
the order selected B1, unselected T1, selected B2 become B1, B2, T1.
Check that order before converting nodes whose execution order matters.

## Open a subgraph and go back

Double-click the Subgraph node, click its title button, or choose
**Open subgraph** from its menu. The breadcrumb shows which group is open.
Add, connect, paste, or import nodes on this canvas as you would in the main graph.

Choose **‹ Back** or **Close subgraph** from the canvas menu to return.
Your previous zoom and position are restored. Undo and redo return to the main graph.

## Add input and output pins

1. Inside the subgraph, add a **Subgraph Input** or **Subgraph Output** node from search.
2. Open its **Properties** menu and set **name** to the pin label.
3. Set **type** to a Java type such as `int` or `java.lang.String`, or `@EXEC` for execution.
4. Connect the boundary node to the nodes inside the group.
5. Go back and connect the matching pin on the Subgraph node.

A Subgraph Input sends an outer connection to its inner targets.
A Subgraph Output sends an inner connection to its outer targets.
An empty type adopts the type of the slot you connect. Pins follow the boundary
nodes' creation order. Rename, retype, or delete the boundary node to update its pin.
Use different names so you can tell pins apart.

You can add another Subgraph inside a subgraph. Problems and Find results open
the matching group, and build errors point to the node inside it.
