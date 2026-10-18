/// <reference types="materialize-css" />
import {ipcRenderer} from "electron";
import {getCurrentWindow} from "@electron/remote";
import setWindowMenu = require("../lib/windowMenu");
const prompt = require('electron-prompt') as typeof import('electron-prompt');
import $ = require("jquery");
import {makeConfigYml} from "../lib/configYml";

import type {ConfigEntry, ProjectInfo, ProjectCommand, ProjectPermission} from "../types/project";

let projectInfo: Partial<ProjectInfo> = {};
let commands: ProjectCommand[] = [];
let permissions: ProjectPermission[] = [];
let config: ConfigEntry[] = [];
let configAdded = false;

M.Tabs.init(document.querySelectorAll(".tabs"));

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

    projectInfo.depend = commaList("depend");
    projectInfo.loadbefore = commaList("loadbefore");
    projectInfo.authors = commaList("authors");
    let load = $("#load").val();
    projectInfo.load = load === "STARTUP" || load === "POSTWORLD" ? load : undefined;
    projectInfo.website = ($("#website").val() as string).trim();
    projectInfo.prefix = ($("#prefix").val() as string).trim();
    projectInfo.libraries = ($("#libraries").val() as string).split(/\r?\n/).map(value => value.trim()).filter(Boolean);
    projectInfo.permissions = permissions.filter(permission => permission.name);
    projectInfo.commands = commands || [];
    if (projectInfo.config !== undefined || configAdded) projectInfo.config = config.filter(entry => entry.key);

    ipcRenderer.send("updateProjectInfo", projectInfo);
}

function commaList(id: string) {
    return ($("#" + id).val() as string).split(",").map(value => value.trim()).filter(Boolean);
}

ipcRenderer.send("getProjectInfo");

ipcRenderer.on("projectInfo", function (event, arg: ProjectInfo) {
    console.log("projectInfo");
    console.log(arg);
    projectInfo = arg;

    if (arg.name !== undefined)
        $("#name").val(arg.name);
    if (arg.description !== undefined)
        $("#description").val(arg.description);
    if (arg.version !== undefined)
        $("#version").val(arg.version);
    if (arg.author !== undefined)
        $("#author").val(arg.author);
    if (arg.package !== undefined)
        $("#package").val(arg.package);
    if (arg.debug !== undefined)
        $("#debug").prop("checked", arg.debug);
    if (arg.softdepend)
        $("#softdepend").val(arg.softdepend.join(","));
    if (arg.commands) {
        commands = arg.commands;
        updateCommandList();
    }

    for (let key of ["depend", "loadbefore", "authors"] as const) {
        $("#" + key).val((arg[key] || []).join(","));
    }
    $("#load").val(arg.load || "");
    $("#website").val(arg.website ?? "");
    $("#prefix").val(arg.prefix ?? "");
    $("#libraries").val((arg.libraries || []).join("\n"));
    permissions = arg.permissions || [];
    updatePermissionList();
    config = arg.config || [];
    configAdded = false;
    updateConfigList();
    M.FormSelect.init(document.querySelectorAll("#load"));
    M.textareaAutoResize($("#libraries"));
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


function updatePermissionList() {
    $("#permissionList").empty();
    for (let i = 0; i < permissions.length; i++) {
        let permission = permissions[i];
        let item = $('<li class="collection-item"><div class="row"><div class="input-field col s12"><input class="permission-name" type="text"><label>Name</label></div><div class="input-field col s12"><input class="permission-description" type="text"><label>Description</label></div><div class="input-field col s10"><select class="permission-default"><option value="">None</option><option value="true">true</option><option value="false">false</option><option value="op">op</option><option value="not op">not op</option></select><label>Default</label></div><div class="col s2"><a href="#!" class="delete-permission" aria-label="Delete permission"><i class="material-icons">delete</i></a></div></div></li>');
        item.find("input, select").each(function (index) {
            let id = "permission-" + i + "-" + index;
            $(this).attr("id", id).next("label").attr("for", id);
        });
        item.find(".permission-name").val(permission.name).on("input", function () {
            permission.name = ($(this).val() as string).trim();
        });
        item.find(".permission-description").val(permission.description ?? "").on("input", function () {
            permission.description = $(this).val() as string;
        });
        item.find(".permission-default").val(permission.default ?? "").on("change", function () {
            let value = $(this).val();
            permission.default = value === "true" || value === "false" || value === "op" || value === "not op" ? value : undefined;
        });
        item.find(".delete-permission").on("click", function (event) {
            event.preventDefault();
            permissions.splice(i, 1);
            updatePermissionList();
        });
        item.appendTo($("#permissionList"));
    }
    M.FormSelect.init(document.querySelectorAll(".permission-default"));
    M.updateTextFields();
}

$("#addPermission").on("click", function (event) {
    event.preventDefault();
    permissions.push({name: ""});
    updatePermissionList();
});

function validateConfigKeys() {
    let accepted: ConfigEntry[] = [];
    $("#configList tr").each(function (i) {
        let message = "";
        if (config[i].key) {
            try {
                makeConfigYml([...accepted, config[i]]);
                accepted.push(config[i]);
            } catch (error) {
                message = error instanceof Error ? error.message : String(error);
            }
        }
        $(this).find(".config-key").toggleClass("invalid", !!message).attr("aria-invalid", String(!!message));
        $(this).find(".helper-text").text(message);
    });
}

function updateConfigList() {
    $("#configList").empty();
    for (let i = 0; i < config.length; i++) {
        let entry = config[i];
        let row = $('<tr><td><div class="input-field"><input class="config-key" type="text" aria-label="Key path"><span class="helper-text"></span></div></td><td><select class="config-type" aria-label="Type"><option value="string">Text</option><option value="int">Whole number</option><option value="double">Number</option><option value="boolean">True/false</option><option value="list">List</option></select></td><td><input class="config-default" type="text" aria-label="Default"></td><td><a href="#!" class="delete-config" aria-label="Delete key"><i class="material-icons">delete</i></a></td></tr>');
        row.find(".helper-text").attr("id", "config-error-" + i);
        row.find(".config-key").val(entry.key).attr("aria-describedby", "config-error-" + i).on("input", function () {
            entry.key = ($(this).val() as string).trim();
            validateConfigKeys();
        });
        row.find(".config-default").val(entry.default).attr("placeholder", entry.type === "list" ? "a, b, c" : "").on("input", function () {
            entry.default = $(this).val() as string;
        });
        row.find(".config-type").val(entry.type).on("change", function () {
            let value = $(this).val();
            entry.type = value === "int" || value === "double" || value === "boolean" || value === "list" ? value : "string";
            row.find(".config-default").attr("placeholder", entry.type === "list" ? "a, b, c" : "");
        });
        row.find(".delete-config").on("click", function (event) {
            event.preventDefault();
            config.splice(i, 1);
            updateConfigList();
        });
        row.appendTo($("#configList"));
    }
    M.FormSelect.init(document.querySelectorAll(".config-type"));
    validateConfigKeys();
}

$("#addConfigKey").on("click", function () {
    configAdded = true;
    config.push({key: "", type: "string", default: ""});
    updateConfigList();
});
