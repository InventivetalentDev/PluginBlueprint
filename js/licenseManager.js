const {app} = require('electron');
const request = require("request");
const fs = require("fs");
const path = require("path");

const URL = "https://shop.inventivetalent.org/wp-admin/admin-ajax.php";
const STORE_CODE = "77o9Yl88U72X7Cv";

function activate(key) {
    return new Promise(((resolve, reject) => {
        request(URL + "?action=license_key_activate&store_code=" + STORE_CODE + "&sku=pluginblueprint&license_key=" + key, function (err, res, body) {
            console.log(body);
            body = JSON.parse(body);
            if (body.error) {
                reject(body.message);
            } else {
                fs.writeFile(path.join(app.getPath("userData"), "license"), Buffer.from(JSON.stringify(body.data)).toString("base64"),"utf8", function (err) {
                    if (err) {
                        console.error(err);
                    }
                    resolve(body.message);
                })
            }
        });
    }))
}

function validate() {
    return new Promise(((resolve, reject) => {
        let licenseFile = path.join(app.getPath("userData"), "license");
        if (!fs.existsSync(licenseFile)) {
            reject();
        } else {
            fs.readFile(licenseFile, "utf8", function (err, data) {
                if (err) {
                    console.error(err);
                    reject();
                    return;
                }
                data = JSON.parse(Buffer.from(data, "base64").toString("utf8"));
                console.log(data);

                request(URL + "?action=license_key_validate&store_code=" + STORE_CODE + "&sku=pluginblueprint&license_key=" + data.the_key + "&activation_id=" + data.activation_id, function (err, res, body) {
                    body = JSON.parse(body);
                    console.log(body);
                    if (body.error) {
                        reject(body.message);
                    } else {
                        resolve();
                    }
                });
            })
        }
    }))
}


module.exports = {activate, validate}
