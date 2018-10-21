const {exec} = require('child_process');
const path = require("path");

function compile(rootDir) {
  return new Promise((resolve, reject) => {
      //TODO: variable classpath
      let cl = "javac -cp \"" + path.join(rootDir, "lib", "spigot.jar") + "\" -d \"" + path.join(rootDir, "classes") + "\" \"" + path.join(rootDir, "src", "org", "inventivetalent", "pluginblueprint", "generated", "GeneratedPlugin.java") + "\"";
      console.log("Running \"" + cl + "\"...");
      exec(cl, (err, stdout, stderr) => {
          if (err) {
              console.error(err);
              reject(err);
              return;
          }

          // the *entire* stdout and stderr (buffered)
          console.log(`stdout: ${stdout}`);
          console.log(`stderr: ${stderr}`);

          resolve({
              out:stdout,
              err:stderr
          })
      });
  })
}

function package(rootDir, projectInfo) {
   return new Promise((resolve, reject) => {
       let cl = "jar cf \"" + path.join(rootDir, "output", projectInfo.name + ".jar") + "\" -C \"" + path.join(rootDir,"classes") + "\" .";
       console.log("Running \"" + cl + "\"...");
       exec(cl, (err, stdout, stderr) => {
           if (err) {
               console.error(err);
               reject(err);
               return;
           }

           // the *entire* stdout and stderr (buffered)
           console.log(`stdout: ${stdout}`);
           console.log(`stderr: ${stderr}`);

           resolve({
               out:stdout,
               err:stderr
           })
       });
   })
}

module.exports = {
    compile: compile,
    package: package
}