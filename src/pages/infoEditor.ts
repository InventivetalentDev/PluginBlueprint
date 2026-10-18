/// <reference types="materialize-css" />
import {ipcRenderer} from "electron";
import {getCurrentWindow} from "@electron/remote";
import setWindowMenu = require("../lib/windowMenu");
const prompt = require('electron-prompt') as typeof import('electron-prompt');
import $ = require("jquery");

import type {ProjectInfo, ProjectCommand} from "../types/project";

let projectInfo: Partial<ProjectInfo> = {};
let commands: ProjectCommand[] = [];

setWindowMenu([
    {
        label: "File",
        submenu: [
            {
                label: "Save", accelerator: "CommandOrControl+S", click: () => {
                    updateProjectInfo();
                }
            }
        ]
    }
]);

window.onbeforeunload = function (e) {
    updateProjectInfo();
};

$("#saveInfo").on("click", function () {
    getCurrentWindow().close();
});

function updateProjectInfo() {
    projectInfo.name = ($("#name").val() as string);
    projectInfo.description = ($("#description").val() as string);
    projectInfo.version = ($("#version").val() as string);
    projectInfo.author = ($("#author").val() as string);
    projectInfo.package = ($("#package").val() as string);
    projectInfo.debug = $("#debug").is(":checked");

    let softdepend = [];
    let softdependSplit = ($("#softdepend").val() as string).split(",");
    for (let i = 0; i < softdependSplit.length; i++) {
        let dependency = softdependSplit[i].trim();
        if (dependency) {
            softdepend.push(dependency);
        }
    }
    projectInfo.softdepend = softdepend || [];

    projectInfo.commands = commands || [];

    ipcRenderer.send("updateProjectInfo", projectInfo);
}

ipcRenderer.send("getProjectInfo");

ipcRenderer.on("projectInfo", function (event, arg: ProjectInfo) {
    console.log("projectInfo");
    console.log(arg);
    projectInfo = arg;

    if (arg.name)
        $("#name").val(arg.name);
    if (arg.description)
        $("#description").val(arg.description);
    if (arg.version)
        $("#version").val(arg.version);
    if (arg.author)
        $("#author").val(arg.author);
    if (arg.package)
        $("#package").val(arg.package);
    if (arg.debug)
        $("#debug").prop("checked", arg.debug);
    if (arg.softdepend)
        $("#softdepend").val(arg.softdepend.join(","));
    if (arg.commands) {
        commands = arg.commands;
        updateCommandList();
    }

    M.updateTextFields();

    $("#overlay").fadeOut();
});

function updateCommandList() {
    $("#commandList").empty();
    for (let i = 0; i < commands.length; i++) {
        let cmd = commands[i];
        let commandItem = $('<li class="collection-item"><div>' + cmd.name + '<a href="#!" class="secondary-content"><i class="material-icons delete-command">delete</i></a></div></li>');
        commandItem.find(".delete-command").on("click", function () {
            commands.splice(i, 1);
            updateCommandList();
        });
        commandItem.on("click", function () {
            ipcRenderer.send("openCommandEditor", {
                command: commands[i],
                index: i
            })
        });
        commandItem.appendTo($("#commandList"))
    }
}

$("#addCommand").click(function (e) {
    ipcRenderer.send("openCommandEditor", {
        command: {},
        index: -1
    })
});

ipcRenderer.on("commandAdded", function (event, arg: ProjectCommand) {
    commands.push(arg);
    updateCommandList();
});
ipcRenderer.on("commandUpdated", function (event, arg: {index: number; command: ProjectCommand}) {
    commands[arg.index] = arg.command;
    updateCommandList();
})
