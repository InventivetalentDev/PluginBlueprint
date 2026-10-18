import {app} from "electron";
import fs = require("fs-extra");
import path = require("path");

export interface AppSettings {
    eulaAccepted?: boolean;
    checklistHidden?: boolean;
}

function readSettings(): AppSettings {
    let file = path.join(app.getPath("userData"), "settings.json");
    return fs.existsSync(file) ? fs.readJsonSync(file) : {};
}

export function getSetting(key: keyof AppSettings): boolean | undefined {
    return readSettings()[key];
}

export function setSetting(key: keyof AppSettings, value: boolean): void {
    let settings = readSettings();
    settings[key] = value;
    fs.outputJsonSync(path.join(app.getPath("userData"), "settings.json"), settings);
}
