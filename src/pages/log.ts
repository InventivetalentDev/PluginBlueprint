import {ipcRenderer, shell} from "electron";
import setWindowMenu = require("../lib/windowMenu");
import $ = require("jquery");


String.prototype.replaceAll = function (this: string, search: string | RegExp, replacement: string) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
} as typeof String.prototype.replaceAll;

let followLog = true;

setWindowMenu([
    {
        label: "Log",
        submenu: [
            {
                label: "Follow Log", type: "checkbox", checked: true, click: (item) => {
                    console.log(item);
                    // item.checked = !item.checked;
                    followLog = item.checked;
                }
            }
        ]
    },
    {
        label: "Server",
        submenu: [
            {
                label: "Stop Server", click: () => {
                    ipcRenderer.send("stopServer");
                }
            },
            {
                type: "separator"
            },
            {
                label: "Reload Plugin", click: () => {
                    ipcRenderer.send("reloadPlugin");
                }
            }
        ]
    }
]);

let cmdInput = $("#cmdInput");
cmdInput.on("keypress", function (e) {
    let key = e.which || e.keyCode;
    if (key === 13) { //  enter
        let val = cmdInput.val() as string;
        if (val.startsWith("/")) val = val.substr(1);
        if (val.length > 0) {
            ipcRenderer.send("sendServerCommand", val);
            cmdInput.val("");
        }
    }
});

ipcRenderer.on("log", function (event, arg: {content: string; type: string; hasNode?: boolean; href?: string}) {
    // Server output can contain player chat, so it must never be parsed as HTML
    let content = arg.content.replace(/\x1b\[[0-9;]*m/g, "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\n", "<br/>").replaceAll("\t", "&nbsp;&nbsp;&nbsp;&nbsp;").replaceAll(" ", "&nbsp;");
    if (arg.hasNode) {
        content = content.replace(/node_([0-9]+)/gm, '<a class="node-ref" data-node="$1">node_$1</a>');
    }
    let entry = $("<div class='entry " + arg.type + "'>" + content + "</div>");
    if (arg.type === "out") {
        if (content.indexOf("ERROR") !== -1) entry.addClass("err");
        if (content.indexOf("WARN") !== -1) entry.addClass("warn");
    }
    if (arg.href) {
        entry.addClass("has-href");
        entry.on("click", function (e) {
            e.preventDefault();
            shell.openExternal(arg.href!);
        })
    }
    if (arg.hasNode) {
        entry.addClass("has-node");
        entry.find(".node-ref").on("click", function (e) {
            e.preventDefault();
            ipcRenderer.send("highlightNode", {
                node: $(this).data("node")
            })
        })
    }
    entry.appendTo($("#log"));
    if (followLog) {
        window.scrollTo(0, document.body.scrollHeight);
    }
});

window.onbeforeunload = function (e) {
    ipcRenderer.send("stopServer");
};
