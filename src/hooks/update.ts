import LineReader from "utils/linereader";
import fs from 'fs/promises';
import { Stats } from 'fs';
import path from 'path';
import child_process from 'child_process';
import { BranchFolder, DatabaseFile, OutputDirFile, ProjectIdFile, PushIdFile, RemoteRepoFile, TagFolder, UserIdFile } from "./folders";
import { changeTag, createBranch, createTag, deleteBranch, deleteTag, updateBranchPush } from "controllers/projects";
import { openDb } from "database";
import { md5 } from "./post-receive";

function die(text: string): never {
    process.stderr.write(text + "\n");
    process.exit(-1);
}

async function start() {
    const HOME = process.env["HOME"];
    if (HOME == null) {
        die("Internal error");
    }
    //Since this hook is a separate process, it must load all information that the server prepared for it
    const PUSH_FOLDER = (await fs.readFile(OutputDirFile(HOME))).toString("ascii");
    const TAG_FOLDER = TagFolder(PUSH_FOLDER);
    const BRANCH_FOLDER = BranchFolder(PUSH_FOLDER);

    if (!(await fs.lstat(TAG_FOLDER)).isDirectory()) {
        die("Internal error");
    }
    if (!(await fs.lstat(BRANCH_FOLDER)).isDirectory()) {
        die("Internal error");
    }
    const userId = Number.parseInt((await fs.readFile(UserIdFile(HOME))).toString("ascii"));
    const projectId = Number.parseInt((await fs.readFile(ProjectIdFile(HOME))).toString("ascii"));
    const pushId = Number.parseInt((await fs.readFile(PushIdFile(HOME))).toString("ascii"));
    const remoteRepo = (await fs.readFile(RemoteRepoFile(HOME))).toString("ascii");
    const databaseFile = (await fs.readFile(DatabaseFile(HOME))).toString("ascii");

    //Get 3rd, 4th, and 5th command line arguments, which are the reference name, old hex, and new hex.
    const [refName, oldHex, newHex] = process.argv.slice(2);

    if (oldHex == null || newHex == null || refName == null) {
        die("Internal error, bad parameters " + process.argv.join(" "));
    }

    //Verify that they are correct
    const oldId = Buffer.from(oldHex, "hex");
    const newId = Buffer.from(newHex, "hex");

    if (oldId.length !== 20 || newId.length !== 20) {
        die("Invalid object ids: " + oldHex + " " + newHex);
    }

    //Determine whether we are dealing with a tag, a branch, or something else (e.g. a namespace)
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
        //Our server does not interfere with namespaces or other stuff
        process.exit(0);
    }

    let operation: "creating" | "changing" | "deleting";

    if (oldId.every(x => x === 0)) {
        if (newId.every(x => x === 0)) {
            die("Cannot change ref from null to null");
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

    //The pre-receive hook will have generated a folder for this reference if the user was allowed to manipulate it.
    //If the folder does not exist, the pre-receive hook did not allow the user to touch this reference.
    try {
        if (!(await fs.lstat(REF_FOLDER)).isDirectory()) {
            die("Forbidden");
        }
    } catch (e) {
        die("Forbidden");
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
            child_process.execSync("git init -q . && git remote add origin \"" + remoteRepo + "\" && git fetch -q origin " + newHex + (operation !== "creating" ? " && git fetch -q origin " + oldHex : "") + " && git reset --hard " + newHex, {
                cwd: PROJECT_FOLDER,
                env: {"GIT_DIR": undefined}
            });
            let SCRIPTS_FOLDER = path.join(PROJECT_FOLDER, ".ci", "checks");

            let stats: Stats | null = null;
            try {
                stats = await fs.lstat(SCRIPTS_FOLDER);
            } catch (e) {
            }
    
            //Check if the checks folder even exists. If it doesn't, we don't have to do anything.
            if (stats != null && stats.isDirectory()) {
                //Spawn the container
                const containerName = "ci-app-update-" + projectId + "-" + md5(name);
                //No problem with using sync, since this is a separate process anyways.
                child_process.spawnSync("lxc", ["init", "ubuntu:20.04", containerName]);
                try {
                    //Start the container and put the needed files in it.
                    child_process.spawnSync("lxc", ["start", containerName]);
                    child_process.spawnSync("lxc", ["file", "push", "-r", "-p", PROJECT_FOLDER, containerName + "/root"]);
                    child_process.spawnSync("lxc", ["file", "push", "-r", "-p", OUTPUT_FOLDER, containerName + "/root"]);
                    await fs.rm(OUTPUT_FOLDER, {
                        recursive: true
                    });
    
                    const dir = (await fs.readdir(SCRIPTS_FOLDER)).sort();
                    for (let i = 0; i < dir.length; i++) {
                        const s = await fs.lstat(path.join(SCRIPTS_FOLDER, dir[i]));
                        //If the entry is a file with the executable bit (7th bit) set
                        if (s.isFile() && (s.mode & (1 << 6)) != 0) {
                            const ex = child_process.spawn("lxc", ["exec", containerName, "--cwd", "/root/project", "--", "/root/project/.ci/checks/" + dir[i], oldHex, newHex, refName]);
                            //Send the output of each script to the hook output, so that git transfers the output to the user.
                            ex.stderr.pipe(process.stderr, {
                                end: false
                            });
                            ex.stdout.pipe(process.stdout, {
                                end: false
                            });
                            ex.stdin.write([oldHex, newHex, refName].join(" ") + "\n");
                            ex.stdin.end();
                            const exitCode = await new Promise<number>((resolve, reject) => {
                                ex.addListener("close", function(exit) {
                                    resolve(exit);
                                });
                            });
    
                            if (exitCode !== 0) {
                                throw exitCode;
                            }
                        }
                    }

                    child_process.spawnSync("lxc", ["file", "pull", "-r", "-p", containerName + "/root/output", REF_FOLDER]);
                } catch (e) {
                    child_process.spawnSync("lxc", ["stop", containerName]);
                    child_process.spawnSync("lxc", ["delete", containerName]);
                    throw e;
                }
                child_process.spawnSync("lxc", ["stop", containerName]);
                child_process.spawnSync("lxc", ["delete", containerName]);
            }
        }

        //This hook is a separate process, so it must open the database itself.
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
        //Clean up if there is an error, otherwise the resources folder will constantly clone repositories.
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
