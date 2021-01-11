import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import child_process from 'child_process';
import { BranchFolder, TagFolder } from "./folders";
import { completePush } from "controllers/projects";
import crypto from 'crypto';

export function sha256(data: string) {
    return crypto.createHash("sha256").update(data).digest().toString("hex");
}

export function exec(command: string, parameters: string[]) {
    return new Promise((resolve, reject) => {
        const process = child_process.spawn(command, parameters);
        process.stderr.addListener("data", function(chunk) {
            console.error(chunk);
        });
        process.stdout.addListener("data", function(chunk) {
            console.info(chunk);
        });
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
//  Script folder has out and err: script is running
//  Script folder has file res: script is done
//Final folder - branch has finished running

export async function start(projectId: number, pushId: number, PUSH_FOLDER: string) {
    const TAG_FOLDER = TagFolder(PUSH_FOLDER);
    const BRANCH_FOLDER = BranchFolder(PUSH_FOLDER);

    const [tags, branches] = await Promise.all([fs.readdir(TAG_FOLDER), fs.readdir(BRANCH_FOLDER)]);

    for (let i = 0; i < branches.length; i++) {
        const name = branches[i];
        try {
            await runScripts(name, "refs/heads/" + name, path.join(BRANCH_FOLDER, name), projectId);
        } catch (e) {
            console.error(e);
        }
    }

    for (let i = 0; i < tags.length; i++) {
        const name = tags[i];
        try {
            await runScripts(name, "refs/tags/" + name, path.join(TAG_FOLDER, name), projectId);
        } catch (e) {
            console.error(e);
        }
    }

    try {
        await completePush(pushId);
    } catch (e) {
        console.error(e);
    }
}

async function runScripts(name: string, refName: string, refFolder: string, projectId: number) {
    const PROJECT_FOLDER = path.join(refFolder, "project");
    const OUTPUT_FOLDER = path.join(refFolder, "output");
    const FINAL_FOLDER = path.join(refFolder, "final");
    let STREAM_FOLDER = path.join(refFolder, "streams_tmp");

    await fs.mkdir(STREAM_FOLDER, {
        recursive: true
    });

    const SCRIPTS_FOLDER = path.join(PROJECT_FOLDER, ".ci", "scripts");

    let dirs: string[];
    try {
        dirs = (await fs.readdir(SCRIPTS_FOLDER)).sort();
        for (let i = 0; i < dirs.length; i++) {
            const s = await fs.lstat(path.join(SCRIPTS_FOLDER, dirs[i]));
            if (s.isFile()) {
                const SCRIPT_FOLDER = path.join(STREAM_FOLDER, dirs[i]);
                await fs.mkdir(SCRIPT_FOLDER);
            } else {
                dirs.splice(i, 1);
                i--;
            }
        }
        let NEW_STREAM_FOLDER = path.join(refFolder, "streams");
        await fs.rename(STREAM_FOLDER, NEW_STREAM_FOLDER);
        STREAM_FOLDER = NEW_STREAM_FOLDER;
    } catch (e) {
        console.warn(e);
        return;
    }

    const containerName = "ci-app-post-receive-" + projectId + "-" + sha256(refName);
    await exec("lxc", ["launch", "ubuntu:20.04", containerName]);
    try {
        await exec("lxc", ["start", containerName]);
        await exec("lxc", ["file", "push", "-r", "-p", PROJECT_FOLDER, containerName + "/root/project"]);
        await exec("lxc", ["file", "push", "-r", "-p", OUTPUT_FOLDER, containerName + "/root/output"]);
        await fs.rm(OUTPUT_FOLDER, {
            recursive: true
        });

        for (let i = 0; i < dirs.length; i++) {
            const ex = child_process.spawn("lxc", ["exec", "--cwd", "/root/project", "/root/project/.ci/scripts/" + dirs[i]]);
            const OUT = createWriteStream(path.join(STREAM_FOLDER, dirs[i], "out"), "w");
            const ERR = createWriteStream(path.join(STREAM_FOLDER, dirs[i], "err"), "w");
            ex.stderr.pipe(ERR);
            ex.stdout.pipe(OUT);
            //ex.stdin.write([oldHex, newHex, refName].join(" ") + "\n");
            ex.stdin.end();
            await new Promise<number>((resolve, reject) => {
                ex.addListener("error", function(error) {
                    OUT.close();
                    ERR.close();
                    fs.writeFile(path.join(STREAM_FOLDER, dirs[i], "res"), "err");
                    resolve(-1);
                });
                ex.addListener("close", function(code, signal) {
                    fs.writeFile(path.join(STREAM_FOLDER, dirs[i], "res"), code.toString());
                    resolve(code);
                });
            });
        }

        await exec("lxc", ["file", "pull", "-r", "-p", containerName + "/root/output", FINAL_FOLDER]);
    } catch (e) {
        console.error(e);
    }
    await exec("lxc", ["delete", containerName]);
}
