// Evaluate in the Electron MAIN process:  node main-eval.mjs "$(cat stub-dialogs.js)"
// Replaces native dialogs (which block the main process and cannot be driven over CDP).
// Every call is recorded in global.__dialogLog (read it with: node main-eval.mjs "JSON.stringify(global.__dialogLog)").
// Answers are taken from global.__answers (an array, consumed front-first); set them before the click that opens a dialog, e.g.
//   node main-eval.mjs "global.__answers.push(['/path/to/empty/dir']); 'ok'"          // showOpenDialogSync -> folder
//   node main-eval.mjs "global.__answers.push({response: 0}); 'ok'"                  // showMessageBox -> first button
// With no queued answer: open/save dialogs return "cancelled", message boxes pick button 0, error boxes just log.
(() => {
    const {dialog} = process.mainModule.require('electron');
    global.__dialogLog = global.__dialogLog || [];
    global.__answers = global.__answers || [];
    const next = (fallback) => (global.__answers.length ? global.__answers.shift() : fallback);
    const log = (kind, args) => global.__dialogLog.push({kind, t: new Date().toISOString(), args: JSON.parse(JSON.stringify(args.filter(a => a && typeof a === 'object' && !a.webContents || typeof a === 'string')))});
    dialog.showOpenDialogSync = (...a) => { log('openSync', a); return next(undefined); };
    dialog.showOpenDialog = async (...a) => { log('open', a); const r = next(null); return r ? {canceled: false, filePaths: r} : {canceled: true, filePaths: []}; };
    dialog.showSaveDialogSync = (...a) => { log('saveSync', a); return next(undefined); };
    dialog.showSaveDialog = async (...a) => { log('save', a); const r = next(null); return r ? {canceled: false, filePath: r} : {canceled: true, filePath: undefined}; };
    dialog.showMessageBoxSync = (...a) => { log('messageSync', a); const r = next({response: 0}); return r.response; };
    dialog.showMessageBox = async (...a) => { log('message', a); return next({response: 0, checkboxChecked: false}); };
    dialog.showErrorBox = (...a) => { log('error', a); };
    return 'dialogs stubbed';
})()
