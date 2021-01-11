import LineReader from "utils/linereader";
import fs from 'fs/promises';
import { Stats } from 'fs';
import path from 'path';
import child_process from 'child_process';
import { BranchFolder, DatabaseFile, OutputDirFile, ProjectIdFile, PushIdFile, RemoteRepoFile, TagFolder, UserIdFile } from "./folders";
import { changeTag, createBranch, createTag, deleteBranch, deleteTag, updateBranchPush } from "controllers/projects";
import { openDb } from "database";
import { sha256 } from "./post-receive";

async function start() {
    console.log(process.env);

    const HOME = process.env["HOME"];
    if (HOME == null) {
        process.exit(-1);
    }
    const PUSH_FOLDER = (await fs.readFile(OutputDirFile(HOME))).toString("ascii");
    const TAG_FOLDER = TagFolder(PUSH_FOLDER);
    const BRANCH_FOLDER = BranchFolder(PUSH_FOLDER);

    if (!(await fs.lstat(TAG_FOLDER)).isDirectory()) {
        process.exit(-1);
    }
    if (!(await fs.lstat(BRANCH_FOLDER)).isDirectory()) {
        process.exit(-1);
    }
    const userId = Number.parseInt((await fs.readFile(UserIdFile(HOME))).toString("ascii"));
    const projectId = Number.parseInt((await fs.readFile(ProjectIdFile(HOME))).toString("ascii"));
    const pushId = Number.parseInt((await fs.readFile(PushIdFile(HOME))).toString("ascii"));
    const remoteRepo = (await fs.readFile(RemoteRepoFile(HOME))).toString("ascii");
    const databaseFile = (await fs.readFile(DatabaseFile(HOME))).toString("ascii");

    const lr = new LineReader(process.stdin);

    let txt: string | null = await lr.readLine();
    if (txt == null) {
        process.exit(-1);
    }

    const [oldHex, newHex, refName] = txt.split(" ", 3);

    if (oldHex == null || newHex == null || refName == null) {
        process.stderr.write("Internal error, bad line: " + txt);
        process.stdin.end();
        process.stdout.end();
        process.stderr.end();
        process.exit(-1);
        return;
    }

    const oldId = Buffer.from(oldHex, "hex");
    const newId = Buffer.from(newHex, "hex");

    if (oldId.length !== 20 || newId.length !== 20) {
        process.stderr.write("Invalid object ids: " + oldHex + " " + newHex);
        process.stdin.end();
        process.stdout.end();
        process.stderr.end();
        process.exit(-1);
        return;
    }

    const BRANCH = "refs/heads/";
    const TAG = "refs/tags/";
    let type: "tag" | "branch";
    let name: string;
    if (refName.startsWith(BRANCH)) {
        type = "branch";
        name = refName.substring(BRANCH.length);
    } else if (refName.startsWith(TAG)) {
        type = "tag";
        name = refName.substring(TAG.length);
    } else {
        process.exit(0);
    }

    let operation: "creating" | "changing" | "deleting";

    if (oldId.every(x => x === 0)) {
        if (newId.every(x => x === 0)) {
            throw "Cannot change ref from null to null";
        } else {
            operation = "creating";
        }
    } else {
        if (newId.every(x => x === 0)) {
            operation = "deleting";
        } else {
            operation = "changing";
        }
    }

    let REF_FOLDER: string;

    switch (type) {
        case "branch":
            REF_FOLDER = path.join(BRANCH_FOLDER, name);
            break;
        case "tag":
            REF_FOLDER = path.join(TAG_FOLDER, name);
            break;
    }

    try {
        if (!(await fs.lstat(REF_FOLDER)).isDirectory()) {
            process.stderr.write("Forbidden");
            process.exit(-1);
        }
    } catch (e) {
        process.stderr.write("Forbidden");
        process.exit(-1);
    }

    const PROJECT_FOLDER = path.join(REF_FOLDER, "project");
    const OUTPUT_FOLDER = path.join(REF_FOLDER, "output");
    await fs.mkdir(PROJECT_FOLDER, {
        recursive: true
    });
    await fs.mkdir(OUTPUT_FOLDER, {
        recursive: true
    });

    try {
        if (operation !== "deleting") {
            child_process.execSync("git init . && git remote add origin \"" + remoteRepo + "\" && git fetch origin " + newHex + " && git fetch origin " + oldHex + " && git reset --hard " + newHex, {
                cwd: PROJECT_FOLDER
            });
            let SCRIPTS_FOLDER = path.join(PROJECT_FOLDER, ".ci", "checks");

            let stats: Stats | null = null;
            try {
                stats = await fs.lstat(SCRIPTS_FOLDER);
            } catch (e) {
            }
    
            if (stats != null && stats.isDirectory()) {
                const containerName = "ci-app-update-" + projectId + "-" + sha256(name);
                child_process.spawnSync("lxc", ["launch", "ubuntu:20.04", containerName]);
                try {
                    child_process.spawnSync("lxc", ["start", containerName]);
                    child_process.spawnSync("lxc", ["file", "push", "-r", "-p", PROJECT_FOLDER, containerName + "/root/project"]);
                    child_process.spawnSync("lxc", ["file", "push", "-r", "-p", OUTPUT_FOLDER, containerName + "/root/output"]);
                    await fs.rm(OUTPUT_FOLDER, {
                        recursive: true
                    });
    
                    const dir = (await fs.readdir(SCRIPTS_FOLDER)).sort();
                    for (let i = 0; i < dir.length; i++) {
                        const s = await fs.lstat(path.join(SCRIPTS_FOLDER, dir[i]));
                        if (s.isFile()) {
                            const ex = child_process.spawn("lxc", ["exec", "--cwd", "/root/project", "/root/project/.ci/checks/" + dir[i]]);
                            ex.stderr.pipe(process.stderr);
                            ex.stdout.pipe(process.stdout);
                            ex.stdin.write([oldHex, newHex, refName].join(" ") + "\n");
                            ex.stdin.end();
                            const exitCode = await new Promise<number>((resolve, reject) => {
                                ex.addListener("close", function() {
                                    resolve(ex.exitCode || -1);
                                });
                            });
    
                            if (exitCode !== 0) {
                                throw exitCode;
                            }
                        }
                    }

                    child_process.spawnSync("lxc", ["file", "pull", "-r", "-p", containerName + "/root/output", OUTPUT_FOLDER]);
                } catch (e) {
                    child_process.spawnSync("lxc", ["delete", containerName]);
                    throw e;
                }
                child_process.spawnSync("lxc", ["delete", containerName]);
            }
        }

        await openDb(databaseFile);

        if (type === "branch") {
            switch (operation) {
                case "creating":
                    await createBranch(projectId, pushId, userId, name);
                    break;
                case "changing":
                    await updateBranchPush(projectId, name, pushId);
                    break;
                case "deleting":
                    await deleteBranch(projectId, name);
                    break;
            }
        } else if (type === "tag") {
            switch (operation) {
                case "creating":
                    await createTag(projectId, pushId, name);
                    break;
                case "changing":
                    await changeTag(projectId, pushId, name);
                    break;
                case "deleting":
                    await deleteTag(projectId, name);
                    break;
            }
        }
    } catch (e) {
        await fs.rm(REF_FOLDER, {
            recursive: true
        });
        if (typeof e === 'number') {
            process.exit(e);
        }
        process.exit(-1);
    }
}

start();
