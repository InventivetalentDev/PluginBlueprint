import {ipcRenderer, shell} from "electron";
import $ = require("jquery");


String.prototype.replaceAll = function (this: string, search: string | RegExp, replacement: string) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
} as typeof String.prototype.replaceAll;

const params = new URLSearchParams(location.search);
let msg = params.get("message");
$("#message").text(msg || "Please make sure you didn't forget to connect any of the nodes - you can also click on the highlighted nodes below to check which might cause the problems.");

let error = params.get("error") as string | {message?: string; msg?: string};
let message = typeof error === "string" ? error : (error.message || error.msg)!;
message = message.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
message = message.replace(/node_([0-9]+)/gm, '<a class="node-ref" data-node="$1">node_$1</a>');

$("#content").append(message);

$(".node-ref").on("click", function (e) {
    e.preventDefault();
    ipcRenderer.send("highlightNode", {
        node: $(this).data("node")
    })
})
