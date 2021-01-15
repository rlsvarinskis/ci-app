import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import child_process from 'child_process';
import { BranchFolder, TagFolder } from "./folders";
import { completePush } from "controllers/projects";
import crypto from 'crypto';

export function md5(data: string) {
    return crypto.createHash("md5").update(data).digest().toString("hex");
}

export function exec(command: string, parameters: string[]) {
    return new Promise((resolve, reject) => {
        const process = child_process.spawn(command, parameters);
        process.stdin.end();
        process.stderr.addListener("data", function(chunk) {
            //console.error(chunk.toString());
        });
        process.stdout.addListener("data", function(chunk) {
            //console.info(chunk.toString());
        });
        process.stderr.resume();
        process.stdout.resume();
        process.addListener("error", function(error) {
            reject(error);
        });
        process.addListener("close", function(code, signal) {
            resolve(code);
        });
    });
}

//States:
//No stream folder - branch isn't being run yet
//Streams folder - branch is being run
//  Script folder is empty: script is not running
//  Script folder has out: script is running
//  Script folder has file res: script is done
//Final folder - branch has finished running

export async function start(projectId: number, pushId: number, PUSH_FOLDER: string) {
    const TAG_FOLDER = TagFolder(PUSH_FOLDER);
    const BRANCH_FOLDER = BranchFolder(PUSH_FOLDER);

    const tagP = fs.readdir(TAG_FOLDER);
    const branchP = fs.readdir(BRANCH_FOLDER);

    try {
        const branches = await branchP;
        for (let i = 0; i < branches.length; i++) {
            const name = branches[i];
            try {
                await runScripts(name, "refs/heads/" + name, path.join(BRANCH_FOLDER, name), projectId);
            } catch (e) {
                console.error(e);
            }
        }
    } catch (e) {
        console.error(e);
    }

    try {
        const tags = await tagP;
        for (let i = 0; i < tags.length; i++) {
            const name = tags[i];
            try {
                await runScripts(name, "refs/tags/" + name, path.join(TAG_FOLDER, name), projectId);
            } catch (e) {
                console.error(e);
            }
        }
    } catch (e) {
        console.error(e);
    }

    try {
        await completePush(pushId);
    } catch (e) {
        console.error(e);
    }
}

async function runScripts(name: string, refName: string, refFolder: string, projectId: number) {
    //Prepare folders that will contain script output
    const PROJECT_FOLDER = path.join(refFolder, "project");
    const OUTPUT_FOLDER = path.join(refFolder, "output");
    const FINAL_FOLDER = path.join(refFolder, "final");
    //Put streams in a temporary folder, so the system is never in an inconsistent state.
    //Either branch isn't being run yet, or it is already populated with each script, so the user knows every script that will run.
    let STREAM_FOLDER = path.join(refFolder, "streams_tmp");

    await fs.mkdir(STREAM_FOLDER, {
        recursive: true
    });

    const SCRIPTS_FOLDER = path.join(PROJECT_FOLDER, ".ci", "scripts");

    let dirs: string[];
    try {
        //Find all script files and create a folder for each script
        dirs = (await fs.readdir(SCRIPTS_FOLDER)).sort();
        for (let i = 0; i < dirs.length; i++) {
            const s = await fs.lstat(path.join(SCRIPTS_FOLDER, dirs[i]));
            //If the entry is file with the executable bit (7th bit) set
            if (s.isFile() && (s.mode & (1 << 6)) != 0) {
                const SCRIPT_FOLDER = path.join(STREAM_FOLDER, dirs[i]);
                await fs.mkdir(SCRIPT_FOLDER);
            } else {
                dirs.splice(i, 1);
                i--;
            }
        }
        //Now that every script is in the streams folder, we can expose this to the user.
        let NEW_STREAM_FOLDER = path.join(refFolder, "streams");
        await fs.rename(STREAM_FOLDER, NEW_STREAM_FOLDER);
        STREAM_FOLDER = NEW_STREAM_FOLDER;
    } catch (e) {
        console.warn(e);
        return;
    }

    //Hash to prevent container name collisions
    const containerName = "ci-app-post-receive-" + projectId + "-" + md5(refName);
    await exec("lxc", ["launch", "ubuntu:20.04", containerName]);
    try {
        //Upload project and output folder to the container
        await exec("lxc", ["file", "push", "-r", "-p", PROJECT_FOLDER, containerName + "/root"]);
        await exec("lxc", ["file", "push", "-r", "-p", OUTPUT_FOLDER, containerName + "/root"]);
        //Output folder no longer needed
        await fs.rm(OUTPUT_FOLDER, {
            recursive: true
        });

        for (let i = 0; i < dirs.length; i++) {
            const ex = child_process.spawn("lxc", ["exec", containerName, "--cwd", "/root/project", "--", "/root/project/.ci/scripts/" + dirs[i], refName]);
            const OUT = createWriteStream(path.join(STREAM_FOLDER, dirs[i], "out"), "binary");
            function lengthAsBytes(length: number) {
                const int = length & 0xFFFFFFFF;
                return Uint8Array.from([(length >> 24) & 0xFF, (length >> 16) & 0xFF, (length >> 8) & 0xFF, length & 0xFF]);
            }
            //Stream the outputs of the process into the out and err files
            ex.stderr.on("data", (data: Buffer) => {
                console.log("err", data);
                //Writes should be atomic, so the output file will end up being an interleaved log of <STREAM ID> <CHUNK LENGTH> <CHUNK>
                if (OUT.write(Buffer.concat([Uint8Array.from([0x01]), lengthAsBytes(data.length), data])) === false) {
                    ex.stdout.pause();
                    ex.stderr.pause();
                }
            });
            ex.stdout.on("data", (data: Buffer) => {
                console.log("out", data);
                //Writes should be atomic, so the output file will end up being an interleaved log of <STREAM ID> <CHUNK LENGTH> <CHUNK>
                if (OUT.write(Buffer.concat([Uint8Array.from([0x00]), lengthAsBytes(data.length), data])) === false) {
                    ex.stdout.pause();
                    ex.stderr.pause();
                }
            });
            ex.stderr.resume();
            ex.stdout.resume();

            OUT.on("drain", () => {
                ex.stdout.resume();
                ex.stderr.resume();
            })
            //ex.stdin.write([oldHex, newHex, refName].join(" ") + "\n");
            ex.stdin.end();
            await new Promise<number>((resolve, reject) => {
                ex.addListener("error", function(error) {
                    OUT.close();
                    //Internal failure, set the script's status to "err"
                    console.log("Error: ", error);
                    fs.writeFile(path.join(STREAM_FOLDER, dirs[i], "res"), "err");
                    resolve(-1);
                });
                ex.addListener("close", function(code, signal) {
                    OUT.close();
                    //Script succeeded, write the exit code to file
                    fs.writeFile(path.join(STREAM_FOLDER, dirs[i], "res"), code.toString());
                    resolve(code);
                });
            });
        }

        try {
            await exec("lxc", ["file", "pull", "-r", "-p", containerName + "/root/output", refFolder]);
            await fs.rename(OUTPUT_FOLDER, FINAL_FOLDER);
        } catch (e) {
            console.warn(e);
            //Script probably deleted the output folder. No problem
            try {
                await fs.mkdir(FINAL_FOLDER);
            } catch (e) {
                console.warn(e);
            }
        }
    } catch (e) {
        console.error(e);
    }
    await exec("lxc", ["stop", containerName]);
    await exec("lxc", ["delete", containerName]);
    //Cloned repository is no longer needed
    await fs.rm(PROJECT_FOLDER, {
        recursive: true
    });
}
