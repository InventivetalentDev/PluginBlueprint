import {ipcRenderer, shell} from "electron";
import $ = require("jquery");


const params = new URLSearchParams(location.search);
let msg = params.get("message");
$("#message").text(msg || "Please make sure you didn't forget to connect any of the nodes - you can also click on the highlighted nodes below to check which might cause the problems.");

let message = params.get("error") || "";
if (message.startsWith("Line ") || message.includes("(node_")) {
    $("#heading").text("The build failed");
    $("#summary").text("Check the errors below.");
    $("#message").text("Click a node link to show it in the editor.");
}
const content = document.querySelector("#content")!;
let offset = 0;
for (const match of message.matchAll(/node_([0-9]+)/g)) {
    content.append(document.createTextNode(message.slice(offset, match.index)));
    const link = document.createElement("a");
    link.className = "node-ref";
    link.dataset.node = match[1];
    link.href = "#";
    link.textContent = match[0];
    content.append(link);
    offset = match.index + match[0].length;
}
content.append(document.createTextNode(message.slice(offset)));

$(".node-ref").on("click", function (e) {
    e.preventDefault();
    ipcRenderer.send("highlightNode", {
        node: $(this).data("node")
    })
})
