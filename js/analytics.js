const {app} = require('electron');
const path = require("path");
const fs = require("fs");
const uuidv4 = require('uuid/v4');
const ua = require('universal-analytics');

function init() {
    return new Promise(resolve => {
        getUserId().then((id) => {
            let visitor = ua("UA-43843691-19", id);
            global.analytics = visitor;
            resolve(visitor);
        });
    })
}

function getUserId() {
    return new Promise(resolve => {
        let idFile = path.join(app.getPath("userData"), "guid");
        if (!fs.existsSync(idFile)) {
            let id = uuidv4();
            fs.writeFile(idFile, id, "utf8", (err) => {
                resolve(id);
            });
        } else {
            fs.readFile(idFile, "utf8", (err, data) => {
                resolve(data);
            })
        }
    })
}

module.exports = {init};
