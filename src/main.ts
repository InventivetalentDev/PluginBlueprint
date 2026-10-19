import {app, BrowserWindow, ipcMain, dialog, Notification, shell, type IpcMainEvent, type JumpListItem} from 'electron';
import paper = require("./lib/paper");
import {findJdk, downloadJdk} from "./lib/jdk";
import javaCompiler = require("./lib/javaCompiler");
import {makePluginYml} from "./lib/pluginYml";
import {nestedNodes} from "./lib/sourceChecks";
import {makeConfigYml} from "./lib/configYml";
import {defaultAuthor, defaultPackage} from "./lib/projectDefaults";
import {getSetting, setSetting, type AppSettings} from "./lib/settings";
import serverStarter = require("./lib/serverStarter");
import versionControl = require("./lib/versionControl");
import prompt = require("electron-prompt");
import path = require("path");
import fs = require("fs-extra");
import ProgressBar = require('electron-progressbar');
import {copyFile} from "./lib/util";
import type {serializedLGraph} from "../assets/lib/litegraph/litegraph";
import type {ProjectInfo, ProjectCommand, Snippet} from "./types/project";
import AdmZip = require("adm-zip");

require("@electron/remote/main").initialize();

const DEFAULT_TITLE = "PluginBlueprint Editor";
const APP_MODEL_ID = "inventivetalent.PluginBlueprint";
const jdkDir = path.join(app.getPath("userData"), "jdk");
const paperCacheDir = path.join(app.getPath("userData"), "paper");
let jdk: Awaited<ReturnType<typeof findJdk>> | undefined;

async function ensureJdk(progressBar?: Pick<ProgressBar, "detail">) {
    if (jdk) return jdk;
    let major = paper.getDataMeta().javaVersion;
    jdk = await findJdk(major, jdkDir);
    if (!jdk) {
        let {response} = await dialog.showMessageBox({
            type: "question",
            message: "PluginBlueprint needs Java " + major + " to build plugins. Download it now (about 200 MB)?",
            buttons: ["Download", "Cancel"]
        });
        if (response !== 0) throw new Error("Java " + major + " is required to compile plugins.");
        jdk = await downloadJdk(major, jdkDir, fraction => {
            if (progressBar) progressBar.detail = "Downloading Java " + major + ": " + Math.round(fraction * 100) + "%";
        });
    }
    return jdk;
}

async function ensureProjectServer(progressBar?: Pick<ProgressBar, "detail">) {
    await ensureJdk(progressBar);
    await paper.ensureServer({
        libDir: path.join(currentProjectPath!, "lib"),
        cacheDir: paperCacheDir,
        minecraftVersion: currentProject!.minecraftVersion,
        java: jdk!.java,
        onProgress: text => { if (progressBar) progressBar.detail = text; }
    });
}

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win: BrowserWindow | null | undefined;
let logWin: BrowserWindow | null | undefined;
let errWin: BrowserWindow | null | undefined;
let editorWin: BrowserWindow | null | undefined;
let commandWin: BrowserWindow | null | undefined;

let debug = false;
let quitting = false;
let unsavedChanges = 0;
let uncompiledChanges = 0;

interface ChangeState {
    unsaved?: number;
    uncompiled?: number;
}

ipcMain.on("setChangeState", function (event: IpcMainEvent, arg: ChangeState) {
    if (arg.unsaved !== undefined) unsavedChanges = arg.unsaved;
    if (arg.uncompiled !== undefined) uncompiledChanges = arg.uncompiled;
});

let currentProject: ProjectInfo | null | undefined;
let currentProjectPath: string | null | undefined;
let isNewProject: boolean | undefined;

interface RecentProject {
    path: string;
    name: string;
    editorVersion: string;
    thumbnail?: string;
}

let recentProjects: RecentProject[] = [];

function init() {
    console.log("" +
        "PluginBlueprint, Version " + app.getVersion() + "\n" +
        "Copyright (c) 2018, Haylee Schaefer\n" +
        "All rights reserved.\n");

    console.log(process.argv);
    process.argv.forEach((val, index) => {
        if (val === "--devtools") {
            debug = true;
            console.log("Debugging enabled");
        }
    });

    // Create the browser window.
    win = new BrowserWindow({
        webPreferences: {nodeIntegration: true, contextIsolation: false, sandbox: false},
        title: DEFAULT_TITLE + " " + app.getVersion(),
        width: 1200,
        height: 800,
        show: false,
        icon: path.join(__dirname, '../build/icon.png'),
        backgroundColor: "#373737",
    });
    require("@electron/remote/main").enable(win.webContents);

    showWindow();
}

function showWindow() {
    unsavedChanges = 0;
    uncompiledChanges = 0;

    // and load the index.html of the app.
    win!.loadFile('index.html');
    win!.once('ready-to-show', () => {
        win!.show();

        // Open the DevTools.
        if (debug) {
            win!.webContents.openDevTools({
                mode: "detach"
            });
        }

        checkFileAssociation();
    });

    win!.on("close", function (e) {
        if (unsavedChanges > 0) {
            let c = dialog.showMessageBoxSync({
                type: "question",
                message: "You have " + unsavedChanges + " unsaved changes. Are you sure you want to exit?",
                buttons: ["Yes", "No"],
                icon: path.join(__dirname, '../assets/images/logo-x64.png')
            });
            if (c === 1) {
                e.preventDefault();
            }
        }
    });

    // Emitted when the window is closed.
    win!.on('closed', () => {
        serverStarter.stopServer();
        logWin = null;
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        win = null
    });

    readRecentProjects();
}


// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', init);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit()
    }
});

app.on("before-quit", async (event) => {
    if (quitting || !serverStarter.isRunning()) return;
    event.preventDefault();
    try {
        await serverStarter.stopServer();
    } catch (err) {
        serverStarter.killInstance();
    }
    quitting = true;
    app.quit();
});

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) {
        init()
    }
});

process.on('uncaughtException', function (error) {
    console.error(error);
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

function checkFileAssociation() {
    app.setAppUserModelId(APP_MODEL_ID);
    if (process.platform === 'win32' && process.argv.length >= 2) {
        let p = process.argv[1];
        if (p && p.length > 1) {
            openProject(path.dirname(p));
        }
    }
}

function readRecentProjects() {
    let recentProjectFile = path.join(app.getPath("userData"), "recentProjects.pbd");
    if (!fs.existsSync(recentProjectFile)) {
        return;
    }
    fs.readFile(recentProjectFile, function (err, buffer) {
        if (err) {
            console.warn(err);
            return;
        }
        let data: string[] = JSON.parse(buffer.toString());

        let promises: Promise<Partial<RecentProject>>[] = [];
        for (let i = 0; i < data.length; i++) {
            promises.push(new Promise(resolve => {
                fs.readFile(path.join(data[i], "project.pbp"), function (err, buffer) {
                    if (err) {
                        console.warn(err);
                        resolve({});
                        return;
                    }
                    let projectData: ProjectInfo = JSON.parse(buffer.toString());

                    fs.readFile(path.join(data[i], "thumb.pbt"), "base64", function (err, thumb) {
                        if (err) console.warn(err);
                        resolve({
                            path: data[i],
                            name: projectData.name,
                            editorVersion: projectData.editorVersion,
                            thumbnail: thumb
                        })
                    })
                })
            }));
        }

        Promise.all(promises).then((projects) => {
            projects = projects || [];
            recentProjects = projects.filter(p => p && p.path) as RecentProject[];

            if (win) {
                win.webContents.send("recentProjects", recentProjects);
            }
            updateJumpList();
        })
    });
}

function writeRecentProjects() {
    if (recentProjects.length > 10) {
        recentProjects.pop();
    }
    let paths = [];
    for (let i = 0; i < recentProjects.length; i++) {
        paths.push(recentProjects[i].path);
    }
    fs.writeFile(path.join(app.getPath("userData"), "recentProjects.pbd"), JSON.stringify(paths), "utf-8", function (err) {
        if (err) {
            console.warn(err);
        }
    });
}

ipcMain.on("getRecentProjects", function (event: IpcMainEvent, arg: undefined) {
    event.sender.send("recentProjects", recentProjects || []);
});

function updateJumpList() {
    if (!app.isPackaged || process.platform !== 'win32') return;// Won't recent projects won't work properly if the app is running from the electron.exe wrapper
    let recentProjectItems: JumpListItem[] = [];
    for (let i = 0; i < recentProjects.length; i++) {
        recentProjectItems.push({
            type: "task",
            title: recentProjects[i].name,
            description: "Open " + recentProjects[i].name,
            program: process.execPath,
            args: path.join(recentProjects[i].path, "project.pbp")
        })
    }
    app.setJumpList([
        {
            type: "custom",
            name: "Recent Projects",
            items: recentProjectItems
        }
    ])
}

ipcMain.on("openGraph", function (event: IpcMainEvent, arg: undefined) {
    if (win) {
        win.loadFile('pages/graph.html');
    }
});

ipcMain.on("showCreateNewProject", function (event: IpcMainEvent, arg: undefined) {
    let projectPath: string | string[] | undefined = dialog.showOpenDialogSync({
        properties: ["openDirectory"]
    });
    console.log(projectPath);

    if (!projectPath || projectPath.length === 0) {
        return;
    }
    if (Array.isArray(projectPath)) {
        projectPath = projectPath[0];
        if (!projectPath || projectPath.length === 0) {
            return;
        }
    }
    let name = path.basename(projectPath);
    prompt({
        title: "Give your project a name",
        label: "Project Name",
        value: name,
        height: 150
    }).then((r) => {
        if (r) {
            name = r;
            console.log(name);

            createNewProject({path: projectPath, name: name});
        }
    })
});

async function createNewProject(arg: {path: string; name: string}) {
    let projectFilePath = path.join(arg.path, "project.pbp");
    if (fs.existsSync(projectFilePath)) {
        dialog.showErrorBox("Project exists", "There is already a PluginBlueprint project in that directory");
        return;
    }

    let author = await defaultAuthor();
    let progressBar = new ProgressBar({
        indeterminate: false,
        text: "Creating Project...",
        detail: "Creating Project...",
        maxValue: 5
    });

    let projectInfo = {
        name: arg.name,
        creationTime: Date.now(),
        description: "My Awesome Plugin!!",
        author: author,
        package: defaultPackage(author, arg.name),
        version: "0.0.0",
        type: "paper",
        minecraftVersion: paper.getDataMeta().minecraftVersion,
        lastSave: 0,
        lastCompile: 0,
        editorVersion: app.getVersion(),
        buildNumber: 0,
        debug: true
    };

    progressBar.on("ready", function () {
        progressBar.detail = "Creating project files...";

        setTimeout(function () {
            fs.writeFile(projectFilePath, JSON.stringify(projectInfo), "utf-8", async (err) => {
                progressBar.value++;
                if (err) {
                    console.error("Failed to create project file");
                    console.error(err);
                    dialog.showErrorBox("Error", "Failed to create PluginBlueprint project in that directory");
                    return;
                }
                currentProjectPath = arg.path;
                currentProject = projectInfo;
                isNewProject = true;

                // Create dummy file with project name
                // (symlink would be nicer but requires admin perms)
                fs.writeFileSync(path.join(currentProjectPath, currentProject.name + ".pbp"), projectFilePath, "utf-8");

                fs.ensureDirSync(path.join(arg.path, "src"));
                fs.ensureDirSync(path.join(arg.path, "resources"));
                fs.ensureDirSync(path.join(arg.path, "classes"));
                fs.ensureDirSync(path.join(arg.path, "output"));
                fs.ensureDirSync(path.join(arg.path, "lib"));

                try {
                    await ensureProjectServer(progressBar);
                } catch (err) {
                    console.error(err);
                    dialog.showErrorBox("Server setup failed", (err as Error).message);
                }
                progressBar.value++;
                progressBar.detail = "Setting up graph file...";

                fs.writeFile(path.join(arg.path, "graph.pbg"), JSON.stringify({}), "utf-8", (err) => {
                    progressBar.value++;
                    if (err) {
                        console.error("Failed to create graph file");
                        console.error(err);
                        return;
                    }

                    let i = recentProjects.map(function (e) {
                        return e.path;
                    }).indexOf(currentProjectPath!);
                    if (i !== -1) {
                        recentProjects.splice(i, 1);
                    }
                    recentProjects.unshift({
                        path: currentProjectPath!,
                        name: currentProject!.name,
                        editorVersion: currentProject!.editorVersion
                    });
                    writeRecentProjects();

                    app.addRecentDocument(path.join(currentProjectPath!, currentProject!.name + ".pbp"));
                    updateJumpList();

                    progressBar.detail = "Creating initial commit...";

                    versionControl.init(currentProjectPath!).then(repo => {
                        progressBar.value++;
                        console.log(repo);

                        progressBar.detail = "Done!";

                        if (win) {
                            win.loadFile('pages/graph.html');
                            win!.setTitle(DEFAULT_TITLE + " [" + currentProject!.name + "]");
                            progressBar.value++;
                        }
                    }).catch(err => {
                        console.error(err);
                    })
                })

            });
        }, 500);
    });
}


ipcMain.on("showOpenProject", function (event: IpcMainEvent, arg: undefined) {
    let p: string | string[] | undefined = dialog.showOpenDialogSync({
        properties: ["openFile"],
        filters: [
            {name: 'Plugin Blueprint Projects', extensions: ['pbp']}
        ]
    });
    console.log(p);

    if (!p || p.length === 0) {
        return;
    }
    if (Array.isArray(p)) {
        p = p[0];
        if (!p || p.length === 0) {
            return;
        }
    }
    p = path.dirname(p);

    openProject(p);
});

function openProject(arg: string) {
    console.log("openProject", arg);
    if (!arg || arg.length === 0) return;
    let projectFilePath = path.join(arg, "project.pbp");
    if (!fs.existsSync(projectFilePath)) {
        console.error("No project file found");
        dialog.showErrorBox("Not found", "Could not find a PluginBlueprint project in that directory");
        return;
    }
    fs.readFile(projectFilePath, "utf-8", function (err, json) {
        if (err) {
            console.error("Failed to read project file");
            console.error(err);
            return;
        }
        let data: ProjectInfo = JSON.parse(json);


        function doOpen() {
            currentProjectPath = arg;
            currentProject = data;
            isNewProject = false;

            let i = recentProjects.map(function (e) {
                return e.path;
            }).indexOf(currentProjectPath);
            if (i !== -1) {
                recentProjects.splice(i, 1);
            }
            recentProjects.unshift({
                path: currentProjectPath,
                name: currentProject.name,
                editorVersion: currentProject.editorVersion
            });
            writeRecentProjects();

            app.addRecentDocument(path.join(currentProjectPath, currentProject.name + ".pbp"));
            updateJumpList();

            versionControl.openOrInit(currentProjectPath).then(repo => {
                console.log(repo);

                if (win) {
                    win.loadFile('pages/graph.html');
                    win!.setTitle(DEFAULT_TITLE + " [" + currentProject!.name + "]");
                }
            }).catch(err => {
                console.error(err);
            })
        }

        async function updateAndOpen() {
            let meta = paper.getDataMeta();
            if (data.type !== "paper" || data.minecraftVersion !== meta.minecraftVersion) {
                let {response} = await dialog.showMessageBox({
                    type: "question",
                    message: `This project targets ${data.type === "paper" ? "Paper " + data.minecraftVersion : "Spigot"}. PluginBlueprint now builds plugins for Paper ${meta.minecraftVersion}.`,
                    detail: "Update the project? The server files in lib/ are replaced on the next compile. Nodes for methods that no longer exist are marked as errors.",
                    buttons: ["Update and open", "Cancel"]
                });
                if (response !== 0) return;
                data.type = "paper";
                data.minecraftVersion = meta.minecraftVersion;
                await fs.writeFile(projectFilePath, JSON.stringify(data), "utf-8");
            }
            doOpen();
        }

        let appVersion = app.getVersion() || "x.x.x";
        let appVersionSplit = appVersion.split(".");
        let fileVersion = data.editorVersion || "y.y.y";
        let fileVersionSplit = fileVersion.split(".");
        if (appVersionSplit[0] !== fileVersionSplit[0] || isNewerVersion(fileVersion, appVersion)) {
            dialog.showMessageBox({
                type: "warning",
                title: "Different Editor Version",
                message: "The project you're trying to open was created using a different PluginBlueprint version.",
                detail: "It might not be compatible with the current version, so please proceed carefully and create a backup first. (Project Version: " + fileVersion + ", Editor Version: " + appVersion + ")",
                buttons: ["Proceed Anyway", "Open Project Directory to create backup", "Cancel"],
                defaultId: 1
            }).then(({response: r}) => {
                console.log(r);
                if (r === 0) {// Proceed Anyway
                    updateAndOpen().catch(err => dialog.showErrorBox("Error", err.message));
                } else if (r === 1) {// Open directory
                    shell.openPath(arg);
                } else {// cancel
                }
            });
        } else {
            updateAndOpen().catch(err => dialog.showErrorBox("Error", err.message));
        }

    })
}

ipcMain.on("openProject", function (event: IpcMainEvent, arg: string) {
    openProject(arg);
});

ipcMain.on("getProjectInfo", function (event: IpcMainEvent, arg: undefined) {
    let proj = Object.assign({}, currentProject || {}, {isNewProject});
    event.sender.send("projectInfo", proj);
});

ipcMain.on("updateProjectInfo", function (event: IpcMainEvent, arg: ProjectInfo | null | undefined) {
    if (!arg) return;
    let {isNewProject: editorOnly, ...project} = arg;
    currentProject = project;

    if (win) {
        win.setTitle(DEFAULT_TITLE + " [" + currentProject.name + "]");
        win.webContents.send("projectInfo", currentProject);
    }

    fs.writeFile(path.join(currentProjectPath!, "project.pbp"), JSON.stringify(currentProject!), "utf-8", function (err) {
        if (err) {
            console.error("Failed to write project file");
            console.error(err);
            return;
        }
    })
});

ipcMain.on("getGraphData", function (event: IpcMainEvent, arg: undefined) {
    if (!currentProject || !currentProjectPath) {
        return;
    }
    fs.readFile(path.join(currentProjectPath, "graph.pbg"), "utf-8", function (err, data) {
        if (err) {
            console.error("Failed to read graph file");
            console.error(err);
            return;
        }

        event.sender.send("graphData", JSON.parse(data.toString()));

        if (isNewProject) {
            importSnippet(path.join(__dirname, "..", "assets", "snippets", "onEnableLog.pbs"));
        }
    });
});

function saveGraphData(arg: serializedLGraph & {autosave?: boolean}, cb?: () => void) {
    if (!currentProject || !currentProjectPath) {
        return;
    }
    let {autosave, ...graph} = arg;
    // backup
    let backup = autosave ? Promise.resolve() : copyFile(path.join(currentProjectPath, 'graph.pbg'), path.join(currentProjectPath, 'graph.pbg.old'));
    backup.then(() => {
        // write data
        fs.writeFile(path.join(currentProjectPath!, "graph.pbg"), JSON.stringify(graph), "utf-8", function (err) {
            if (err) {
                console.error("Failed to save graph file");
                console.error(err);
                return;
            }

            saveProject(cb);
        })
    });
}

function saveProject(cb?: () => void) {
    currentProject!.lastSave = Date.now();
    fs.writeFile(path.join(currentProjectPath!, "project.pbp"), JSON.stringify(currentProject!), "utf-8", function (err) {
        if (err) {
            console.error("Failed to write project file");
            console.error(err);
            return;
        }
        if (cb) cb();
    });
}

ipcMain.on("saveGraphData", function (event: IpcMainEvent, arg: serializedLGraph & {autosave?: boolean}) {
    console.log("saveGraphData");
    saveGraphData(arg, function () {
        event.sender.send("graphDataSaved")
    });
});


ipcMain.on("saveGraphDataAndClose", function (event: IpcMainEvent, arg: serializedLGraph) {
    console.log("saveGraphData");
    saveGraphData(arg, function () {
        win!.loadFile('index.html');
        win!.setTitle(DEFAULT_TITLE);
        currentProject = null;
        currentProjectPath = null;
        unsavedChanges = 0;
        uncompiledChanges = 0;
    });
});

ipcMain.on("saveThumbnail", function (event: IpcMainEvent, arg: string) {
    if (!currentProject || !currentProjectPath) {
        return;
    }
    let data = arg.replace(/^data:image\/\w+;base64,/, '');

    fs.writeFile(path.join(currentProjectPath, "thumb.pbt"), data, "base64", function (err) {
        let i = recentProjects.map(function (e) {
            return e.path;
        }).indexOf(currentProjectPath!);
        if (i !== -1) {
            recentProjects[i].thumbnail = data;
        }
    });
});

async function saveCodeToFile(code: string) {
    console.log("saveCode: " + Date.now());
    if (!currentProject || !currentProjectPath || !code) throw new Error("No project or generated code to save.");

    let srcDir = path.join(currentProjectPath, "src");
    await fs.ensureDir(srcDir);
    for (let file of await javaCompiler.listJavaSources(srcDir)) {
        if (path.basename(file) === "GeneratedPlugin.java" && (await fs.readFile(file, "utf-8")).includes("Generated by PluginBlueprint")) {
            await fs.remove(file);
        }
    }
    let oldManifest = path.join(srcDir, "manifest");
    if (await fs.pathExists(oldManifest) && (await fs.readFile(oldManifest, "utf-8")).startsWith("Generated-By: PluginBlueprint")) {
        await fs.remove(oldManifest);
    }
    await fs.outputFile(path.join(srcDir, ...currentProject.package.split("."), "GeneratedPlugin.java"), code, "utf-8");
    await fs.outputFile(path.join(currentProjectPath, "lib", "build", "manifest"), "Generated-By: PluginBlueprint " + app.getVersion() + "\n", "utf-8");
    console.log("savedCode: " + Date.now());
}

async function compile(progressBar: ProgressBar) {
    await ensureProjectServer(progressBar);
    console.log("compile: " + Date.now());
    await fs.emptyDir(path.join(currentProjectPath!, "classes"));
    await javaCompiler.compile(currentProjectPath!, currentProject!, jdk!, paper.getDataMeta().javaVersion,
        paper.getClasspath(path.join(currentProjectPath!, "lib")));
    let resourcesDir = path.join(currentProjectPath!, "resources");
    if (await fs.pathExists(resourcesDir)) {
        await fs.copy(resourcesDir, path.join(currentProjectPath!, "classes"));
        if (await fs.pathExists(path.join(resourcesDir, "plugin.yml"))) {
            console.log("resources/plugin.yml is replaced by the generated plugin.yml.");
            progressBar.detail = "resources/plugin.yml is replaced by the generated plugin.yml.";
        }
    }
    await fs.writeFile(path.join(currentProjectPath!, "classes", "plugin.yml"), makePluginYml(currentProject!, app.getVersion()));
    if (currentProject!.config?.length) {
        if (await fs.pathExists(path.join(resourcesDir, "config.yml"))) {
            console.log("resources/config.yml is replaced by the config table.");
            progressBar.detail = "resources/config.yml is replaced by the config table.";
        }
        await fs.writeFile(path.join(currentProjectPath!, "classes", "config.yml"), makeConfigYml(currentProject!.config));
    }
    console.log("compiled: " + Date.now());
    currentProject!.lastCompile = Date.now();
}

async function pack(progressBar: ProgressBar) {
    await ensureJdk(progressBar);
    console.log("package: " + Date.now());
    await fs.outputFile(path.join(currentProjectPath!, "lib", "build", "manifest"), "Generated-By: PluginBlueprint " + app.getVersion() + "\n", "utf-8");
    await fs.emptyDir(path.join(currentProjectPath!, "output"));
    await javaCompiler.package(currentProjectPath!, currentProject!, jdk!);
    console.log("packaged: " + Date.now());
}

function showCustomErrorDialog(error: string | {message?: string; msg?: string}, title?: string, message?: string) {
    if (errWin) errWin.destroy();
    errWin = null;

    errWin = new BrowserWindow({
        webPreferences: {nodeIntegration: true, contextIsolation: false, sandbox: false},
        parent: win!,
        width: 1000,
        height: 600,
        modal: false,
        show: false,
        resizable: true,
        backgroundColor: "#373737",
        icon: path.join(__dirname, '../build/icon.png')
    });
    require("@electron/remote/main").enable(errWin.webContents);
    errWin.setMenu(null);
    errWin.setTitle(title || "An Error occurred!");
    errWin.loadFile('pages/error.html', {query: {
        error: typeof error === "string" ? error : (error.message || error.msg)!,
        message: message || ""
    }});
    errWin.show();
    // Open the DevTools.
    if (debug) {
        errWin.webContents.openDevTools({
            mode: "detach"
        });
    }
}

interface GeneratedCode {
    code: string | null;
    compile: boolean;
    pack: boolean;
    reload?: "ifRunning" | "start";
}

ipcMain.on("codeGenerated", function (event: IpcMainEvent, arg: GeneratedCode) {
    let max = 0;
    if (arg.code) max++;
    if (arg.compile) max++;
    if (arg.pack) max++;
    let progressBar = new ProgressBar({
        indeterminate: false,
        maxValue: max,
        text: "Generating/Compiling/Packaging...",
        detail: "Waiting..."
    });

    progressBar.on("ready", function () {
        setTimeout(function () {
            generateCompilePackage(arg, progressBar).then(() => {
                progressBar.detail = "Done!";
                console.log("Done!");
                showNotification("Done!");
                event.sender.send("generateDone");
            }).catch((err) => {
                progressBar.detail = "Error";
                event.sender.send("generateError", err);
                showCustomErrorDialog(err, "Compilation Error");
                progressBar.close();
            })
        }, 500);
    });
});

// async/await to preserve execution order
async function generateCompilePackage(arg: GeneratedCode, progressBar: ProgressBar) {
    if (arg.code) {
        progressBar.detail = "Generating code...";
        await saveCodeToFile(arg.code);
        progressBar.value++;
    }
    if (arg.compile) {
        progressBar.detail = "Compiling...";
        await compile(progressBar);
        progressBar.value++;
    }
    if (arg.pack) {
        progressBar.detail = "Packaging...";
        await pack(progressBar);
        progressBar.value++;
    }
    if (arg.compile && arg.pack && arg.reload) {
        if (serverStarter.isRunning()) await reloadPlugin();
        else if (arg.reload === "start") await startServer();
    }
}

ipcMain.on("openOutputDir", function (event: IpcMainEvent, arg: undefined) {
    shell.openPath(path.join(currentProjectPath!, "output"));
});

ipcMain.on("openProjectInfoEditor", function (event: IpcMainEvent, arg: undefined) {
    console.log("openProjectInfoEditor");
    let child = new BrowserWindow({
        webPreferences: {nodeIntegration: true, contextIsolation: false, sandbox: false},
        parent: win!,
        title: DEFAULT_TITLE,
        width: 600,
        height: 800,
        modal: true,
        show: false,
        resizable: false,
        backgroundColor: "#373737",
        icon: path.join(__dirname, '../build/icon.png')
    });
    require("@electron/remote/main").enable(child.webContents);
    editorWin = child;
    child.on("close", () => {
        editorWin = null;
    });
    child.loadFile('pages/infoEditor.html');
    child.show();
});

interface CommandEditor {
    command: Partial<ProjectCommand>;
    index: number;
}

ipcMain.on("openCommandEditor", function (event: IpcMainEvent, arg: CommandEditor) {
    console.log("openCommandEditor");
    let child = new BrowserWindow({
        webPreferences: {nodeIntegration: true, contextIsolation: false, sandbox: false},
        parent: win!,
        title: DEFAULT_TITLE,
        width: 600,
        height: 500,
        modal: true,
        show: false,
        resizable: false,
        backgroundColor: "#373737",
        icon: path.join(__dirname, '../build/icon.png')
    });
    require("@electron/remote/main").enable(child.webContents);
    commandWin = child;
    child.on("close", () => {
        commandWin = null;
    });
    child.loadFile('pages/commandEditor.html', {query: {custom: JSON.stringify({
        command: arg.command,
        index: arg.index
    })}});
    child.show();
});

interface SavedCommand extends CommandEditor {
    command: ProjectCommand;
    isNew: boolean;
}

ipcMain.on("saveCommand", function (event: IpcMainEvent, arg: SavedCommand) {
    if (editorWin) {
        if (arg.isNew) {
            editorWin.webContents.send("commandAdded", arg.command);
        } else {
            editorWin.webContents.send("commandUpdated", {
                command: arg.command,
                index: arg.index
            })
        }
    }
});

ipcMain.on("startServer", function (event: IpcMainEvent, arg: undefined) {
    startServer().catch(err => showCustomErrorDialog(err, "Server Error"));
});

async function ensureEulaConsent() {
    while (getSetting("eulaAccepted") !== true) {
        let {response} = await dialog.showMessageBox({
            type: "question",
            message: "Do you agree to the Minecraft EULA to run the test server?",
            detail: "Read the Minecraft EULA at https://aka.ms/MinecraftEULA. Your agreement is remembered for future starts.",
            buttons: ["I agree", "Open EULA", "Cancel"],
            defaultId: 2,
            cancelId: 2
        });
        if (response === 0) setSetting("eulaAccepted", true);
        else if (response === 1) await shell.openExternal("https://aka.ms/MinecraftEULA");
        else return false;
    }
    return true;
}

async function startServer() {
    if (!currentProject || !currentProjectPath) {
        return;
    }
    if (!fs.existsSync(path.join(currentProjectPath, "output", currentProject.name + ".jar"))) {
        dialog.showErrorBox("Error", "Please compile your plugin first!");
        return;
    }

    if (!await ensureEulaConsent()) return;
    if (serverStarter.isRunning()) {
        await serverStarter.stopServer();
    }
    if (logWin) logWin.destroy();
    logWin = null;

    logWin = new BrowserWindow({
        webPreferences: {nodeIntegration: true, contextIsolation: false, sandbox: false},
        parent: win!,
        width: 800,
        height: 1000,
        modal: false,
        show: false,
        resizable: true,
        backgroundColor: "#373737",
        icon: path.join(__dirname, '../build/icon.png')
    });
    require("@electron/remote/main").enable(logWin.webContents);
    logWin.setMenu(null);
    logWin.setTitle("PluginBlueprint Test Server");
    logWin.loadFile('pages/log.html');
    logWin.show();
    // Open the DevTools.
    if (debug) {
        logWin.webContents.openDevTools({
            mode: "detach"
        });
    }
    try {
        await ensureProjectServer({set detail(text: string) {
            if (logWin) logWin.webContents.send("log", {type: "out", content: text});
        }});
        await serverStarter.copyPlugin(currentProjectPath, currentProject);
        startProjectServer();
    } catch (err) {
        logServerError((err as Error).message);
        showCustomErrorDialog(err as Error, "Server Error");
    }
}

function startProjectServer() {
    let port = "";
    serverStarter.startServer(currentProjectPath!, jdk!.java, !!currentProject!.debug,
        (log) => {
            if (logWin) {
                if (log.indexOf("Starting Minecraft server on") !== -1) {
                    port = log.substr(24/* strip timestamp & start of string */).split(":")[1];
                }
                if (log.indexOf("Done (") !== -1 && log.indexOf("For help, type") !== -1) {
                    showNotification("Test Server running on port " + port);
                }


                if (log.indexOf("pb_debug_exec") !== -1) {
                    if (win) win.webContents.send("debugCall", {
                        type: "exec",
                        node: parseInt(log.split("pb_debug_exec=")[1])
                    });
                    return;
                }

                let logData: {type: string; content: string; href?: string; hasNode?: boolean} = {
                    type: "out",
                    content: log
                };
                if (log.indexOf("Caused by:") === 0) {
                    logData.href = "https://www.google.com/search?q=" + log;
                }
                if (log.indexOf(currentProject!.package) !== -1) {
                    if (log.indexOf("node_") !== -1) {
                        logData.hasNode = true;

                        if (win) win.webContents.send("logError", log);
                    }
                }

                logWin.webContents.send("log", logData);
            }
        }, logServerError, sendServerState);
}

function sendServerState(running: boolean) {
    if (win && !win.isDestroyed()) win.webContents.send("serverState", {running});
}

ipcMain.on("getServerState", function (event: IpcMainEvent, arg: undefined) {
    event.sender.send("serverState", {running: serverStarter.isRunning()});
});

ipcMain.handle("getSetting", (event, key: keyof AppSettings) => {
    if (key !== "eulaAccepted" && key !== "checklistHidden") throw new Error("Unknown setting");
    return getSetting(key);
});

ipcMain.handle("setSetting", (event, arg: {key: keyof AppSettings; value: boolean}) => {
    if ((arg.key !== "eulaAccepted" && arg.key !== "checklistHidden") || typeof arg.value !== "boolean") throw new Error("Invalid setting");
    setSetting(arg.key, arg.value);
});

function logServerError(err: string) {
    if (logWin) {
        logWin.webContents.send("log", {
            type: "err",
            content: err
        })
    }
}

ipcMain.on("sendServerCommand", function (event: IpcMainEvent, arg: string) {
    serverStarter.sendCommandToInstance(arg);
});

ipcMain.on("stopServer", async function (event: IpcMainEvent, arg: undefined) {
    if (logWin) logWin.destroy();
    logWin = null;
    await serverStarter.stopServer();
});

ipcMain.on("reloadPlugin", function (event: IpcMainEvent, arg: undefined) {
    reloadPlugin().catch(err => showCustomErrorDialog(err, "Server Error"));
});

async function reloadPlugin() {
    if (!currentProject || !serverStarter.isRunning()) return;
    console.log("Reloading plugin...");
    await serverStarter.stopServer();
    await serverStarter.copyPlugin(currentProjectPath!, currentProject!);
    startProjectServer();
    console.log("Plugin reloaded!");
    showNotification("Plugin reloaded!");
}

interface HighlightNode {
    node: number;
}

ipcMain.on("highlightNode", function (event: IpcMainEvent, arg: HighlightNode) {
    if (win) {
        win.webContents.send("highlightNode", arg);
    }
});

ipcMain.on("showExportDialog", function (event: IpcMainEvent, arg: undefined) {
    console.log("showExportDialog");
    showExportDialog();
});

function showExportDialog() {
    if (!currentProject || !currentProjectPath) return;
    dialog.showSaveDialog(win!, {
        defaultPath: path.join(currentProjectPath, currentProject.name + ".zip"),
        filters: [{
            name: "ZIP File",
            extensions: ["zip"]
        }]
    }).then(({canceled, filePath: file}) => {
        if (canceled || !file) return;
        exportProject(file);
    })
}

function exportProject(output: string) {
    if (!currentProject || !currentProjectPath) return;
    let zip = new AdmZip();
    zip.addLocalFile(path.join(currentProjectPath, "project.pbp"));
    zip.addLocalFile(path.join(currentProjectPath, "graph.pbg"));
    for (let directory of ["src", "resources"]) {
        let folder = path.join(currentProjectPath, directory);
        if (fs.existsSync(folder)) zip.addLocalFolder(folder, directory);
    }
    zip.writeZip(output);
}

ipcMain.on("exportSnippet", function (event: IpcMainEvent, arg: Snippet) {
    dialog.showSaveDialog(win!, {
        defaultPath: path.join(currentProjectPath!, currentProject!.name + "-snippet.pbs"),
        filters: [{
            name: "PluginBlueprint Snippet",
            extensions: ["pbs"]
        }]
    }).then(({canceled, filePath: file}) => {
        if (canceled || !file) return;
        fs.writeFile(file, JSON.stringify(arg), function (err) {
            if (err) throw err;
        })
    })
});

ipcMain.on("showImportSnippet", function (event: IpcMainEvent, arg: undefined) {
    dialog.showOpenDialog(win!, {
        defaultPath: currentProjectPath!,
        filters: [{
            name: "PluginBlueprint Snippet",
            extensions: ["pbs"]
        }]
    }).then(({canceled, filePaths: files}) => {
        if (canceled || !files || files.length === 0) return;
        importSnippet(files[0]);
    });
});

function importSnippet(file: string) {
    if (!file) {
        return;
    }
    fs.readFile(file, async function (err, data) {
        if (err) throw err;
        if (!win) return;
        const snippet = JSON.parse(data.toString());
        const codeNodes = nestedNodes<any>(snippet.nodes).filter((node: {type: string}) => node.type === "code/JavaCode");
        if (codeNodes.length) {
            const preview = codeNodes.map((node: {properties?: {code?: unknown}}) => typeof node.properties?.code === "string" ? node.properties.code.split("\n").slice(0, 10).join("\n") : "").join("\n\n");
            const {response} = await dialog.showMessageBox(win, {
                type: "warning",
                buttons: ["Cancel", "Add snippet"],
                defaultId: 0,
                cancelId: 0,
                message: `This snippet contains ${codeNodes.length} Java code ${codeNodes.length === 1 ? "node" : "nodes"}.`,
                detail: "Java code nodes run whatever code they contain on your server. Only add this snippet if you trust where it came from.\n\n" + preview
            });
            if (response !== 1) return;
        }
        win.webContents.send("importSnippet", snippet);
    });
}

ipcMain.on("gitAddAndCommit", function (event: IpcMainEvent, arg: undefined) {
    if (!currentProjectPath || !currentProject) return;
    versionControl.openOrInit(currentProjectPath).then(() => {
        prompt({
            title: "Enter a commit message",
            label: "Commit Message",
            height: 150,
            value: "Update things!"
        }).then((r) => {
            if (r) {
                versionControl.addAllAndCommit(currentProjectPath!, currentProject!, r).then(repo => {
                    showNotification("Committed '" + r + "'");
                    event.sender.send("committed");
                }).catch((err) => {
                    console.error(err);
                    dialog.showErrorBox("Error", err ? err.message : err);
                    event.sender.send("committed");//TODO: might need a different channel
                })
            } else {
                event.sender.send("committed");//TODO: might need a different channel
            }
        });
    })
});

ipcMain.on("gitPush", function (event: IpcMainEvent, arg: undefined) {
    if (!currentProjectPath || !currentProject) return;
    versionControl.openOrInit(currentProjectPath).then(() => {
        versionControl.listRemotes(currentProjectPath!).then(remotes => {
            if (!remotes || remotes.length === 0) {
                dialog.showErrorBox("Missing Remote", "Please configure a remote first");
            } else {
                saveProject(() => {
                    versionControl.push(currentProjectPath!, currentProject!).then((pushResponse) => {
                        console.log(pushResponse);
                        showNotification("Pushed to origin");
                        event.sender.send("pushed");//TODO: different event
                    }).catch(err => {
                        console.error(err);
                        dialog.showErrorBox("Error", err ? err.message : err);
                        event.sender.send("pushed");//TODO: different event
                    });

                })
            }
        });
    });
});

ipcMain.on("gitChangeRemote", function (event: IpcMainEvent, arg: undefined) {
    if (!currentProjectPath || !currentProject) return;
    versionControl.openOrInit(currentProjectPath).then(() => {
        versionControl.listRemotes(currentProjectPath!).then(remotes => {
            prompt({
                title: "Change Remote",
                label: "Remote URL",
                height: 150,
                value: remotes && remotes.length > 0 ? remotes[0].url : null
            }).then((r) => {
                if (r) {
                    versionControl.setRemote(currentProjectPath!, r).then(() => {
                        showNotification("Remote changed to " + r);
                        event.sender.send("remoteChanged");
                    }).catch((err) => {
                        console.error(err);
                        dialog.showErrorBox("Error", err ? err.message : err);
                        event.sender.send("remoteChanged");// TODO: different event
                    });
                } else {
                    event.sender.send("remoteChanged");
                }
            });
        });
    });
});

ipcMain.on("checkUpdate", function (event: IpcMainEvent) {
    checkUpdate().then(u => {
        event.sender.send("updateInfo", u);
    })
});

function checkUpdate() {
    return fetch("https://pluginblueprint.net/api/latest", {
        headers: {"User-Agent": "PluginBlueprint/" + app.getVersion()}
    }).then(response => {
        if (response.status !== 200) return {hasUpdate: false};
        return response.json().then((latest: {version: string}) => {
            let currentVersion = app.getVersion();
            let updateVersion = latest.version;
            return {hasUpdate: isNewerVersion(updateVersion, currentVersion), appVersion: currentVersion, updateVersion};
        });
    }).catch(e => {
        console.error(e);
        return {hasUpdate: false};
    });
}

function isNewerVersion(version: string, than: string): boolean {
    let versionParts = version.split(".").map(Number);
    let thanParts = than.split(".").map(Number);
    for (let i = 0; i < Math.max(versionParts.length, thanParts.length); i++) {
        let part = versionParts[i] || 0;
        let thanPart = thanParts[i] || 0;
        if (part !== thanPart) return part > thanPart;
    }
    return false;
}

function showNotification(body: string, title?: string) {
    let notification = new Notification({
        title: title || "PluginBlueprint",
        body: body || "-message-",
        icon: path.join(__dirname, "../build/icon.png")
    });
    notification.show();
    return notification;
}
