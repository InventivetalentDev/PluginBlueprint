/// <reference types="materialize-css" />
import {ipcRenderer} from "electron";
import {Menu, getCurrentWindow} from "@electron/remote";
const prompt = require('electron-prompt') as typeof import('electron-prompt');
import $ = require("jquery");

import type {ProjectCommand} from "../types/project";

let custom: {command: Partial<ProjectCommand>; index: number} = JSON.parse(new URLSearchParams(location.search).get("custom")!);
let commandInfo = custom.command;
let commandIndex = custom.index;
let isNew = commandIndex === -1;

window.onbeforeunload = function (e) {
    saveCommand();
};

$("#saveCommand").on("click", function () {
    getCurrentWindow().close();
});

function saveCommand() {
    commandInfo.name = ($("#name").val() as string);
    commandInfo.description = ($("#description").val() as string);
    commandInfo.usage = ($("#usage").val() as string);

    let aliases = [];
    let aliasSplit = ($("#aliases").val() as string).split(",");
    for (let i = 0; i < aliasSplit.length; i++) {
        aliases.push(aliasSplit[i].trim());
    }
    commandInfo.aliases = aliases || [];


    ipcRenderer.send("saveCommand", {
        command: commandInfo,
        isNew: isNew,
        index: commandIndex
    })
}


if (commandInfo) {
    if (commandInfo.name)
        $("#name").val(commandInfo.name);
    if (commandInfo.description)
        $("#description").val(commandInfo.description);
    if (commandInfo.usage)
        $("#usage").val(commandInfo.usage);
    if (commandInfo.aliases)
        $("#aliases").val((commandInfo.aliases as string[]).join(","));


    M.updateTextFields();

    $("#overlay").fadeOut();
}
