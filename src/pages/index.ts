import {ipcRenderer, shell} from "electron";
import {dialog, getCurrentWindow, app} from "@electron/remote";
import setWindowMenu = require("../lib/windowMenu");
const prompt = require("electron-prompt") as typeof import("electron-prompt");
import $ = require("jquery");


setWindowMenu([
    {
        label: "File",
        submenu: [
            {
                label: "New", click: () => {
                    ipcRenderer.send("showCreateNewProject");
                }
            },
            {
                label: "Open", click: () => {
                    ipcRenderer.send("showOpenProject");
                }
            },
            {
                type: "separator"
            },
            {
                role: "toggledevtools" as import("electron").MenuItemConstructorOptions["role"]
            },
        ]
    }
]);

$(document).ready(function () {
    console.log("" +
        "PluginBlueprint, Version " + app.getVersion() + "\n" +
        "Copyright (c) 2018, Haylee Schaefer\n" +
        "All rights reserved.\n");

    console.log("Checking for updates...");
    ipcRenderer.send("checkUpdate");
});

ipcRenderer.send("getRecentProjects");

$(".createNewProject").click(() => {
    ipcRenderer.send("showCreateNewProject");
});

$("#openProject").click(() => {
    ipcRenderer.send("showOpenProject");
});

ipcRenderer.on("recentProjects", function (event, arg: {path: string; name: string; editorVersion: string; thumbnail?: string}[]) {
    for (let i = 0; i < arg.length; i++) {
        if (!arg[i] || !arg[i].path) continue;
        let item = $('<li class="collection-item avatar">' + (arg[i].thumbnail ? '<div class="thumbnail" style="background-image: url(data:image/jpeg;base64,' + arg[i].thumbnail + ')"></div>' : '') + '<span class="title">' + arg[i].name + '</span><p>' + arg[i].path + '</p><span class="editorVersion">' + arg[i].editorVersion + '</span></li>');
        item.click(() => {
            ipcRenderer.send("openProject", arg[i].path);
        });
        item.appendTo($("#recentProjects"));
    }
    if (arg.length === 0) {
        $("#recentProjectRow").hide();
    }
});

// external links
$(document).on('click', 'a[href^="http"]', function (this: HTMLAnchorElement, event) {
    event.preventDefault();
    shell.openExternal(this.href);
});

ipcRenderer.on("updateInfo", function (event, arg: {hasUpdate: boolean; updateVersion?: string}) {
    $("#updateCheckContent").empty();
    if (arg.hasUpdate) {
        console.log("Update available!", arg);

        $("#updateCheckContent").append("<strong>Update available!</strong> (v" + arg.updateVersion + ") <a href='https://pluginblueprint.net/downloads'>Download</a>")
    } else {
        console.log("No update found", arg)
    }
});
