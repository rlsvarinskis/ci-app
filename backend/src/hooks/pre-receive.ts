import LineReader from "utils/linereader";
import fs from 'fs/promises';
import path from 'path';
import { canDeleteTags, canMakeBranches, canMakeTags, getOwnedBranches, getChangeableBranches } from "controllers/projects";
import { openDb } from "database";
import { BranchFolder, DatabaseFile, OutputDirFile, ProjectIdFile, TagFolder, UserIdFile } from "./folders";

const BRANCHES: {
    oldHex: Buffer | null;
    newHex: Buffer | null;
    refName: string;
    refType: "tag" | "branch";
    accept: boolean;
}[] = [];
const BRANCH_MAPPING: {[refName: string]: number} = {};
const DELETED_BRANCHES: string[] = [];
const CHANGED_BRANCHES: string[] = [];

async function start() {
    console.log(process.env);

    const HOME = process.env["HOME"];
    if (HOME == null) {
        process.exit(-1);
    }
    const OUTPUT_FOLDER = (await fs.readFile(OutputDirFile(HOME))).toString("ascii");
    const TAG_FOLDER = TagFolder(OUTPUT_FOLDER);
    const BRANCH_FOLDER = BranchFolder(OUTPUT_FOLDER);

    await fs.mkdir(TAG_FOLDER, {
        recursive: true
    });
    await fs.mkdir(BRANCH_FOLDER, {
        recursive: true
    });

    const userId = Number.parseInt((await fs.readFile(UserIdFile(HOME))).toString("ascii"));
    const projectId = Number.parseInt((await fs.readFile(ProjectIdFile(HOME))).toString("ascii"));
    const databaseFile = (await fs.readFile(DatabaseFile(HOME))).toString("ascii");

    const lr = new LineReader(process.stdin);

    let txt: string | null = null;
    while ((txt = await lr.readLine()) != null) {
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
            continue;
        }

        BRANCHES.push({
            oldHex: oldId.every(x => x === 0) ? null : oldId,
            newHex: newId.every(x => x === 0) ? null : newId,
            refName: name,
            refType: type,
            accept: false,
        });
    }

    await openDb(databaseFile);

    const canMakeB = await canMakeBranches(projectId, userId);
    const canMakeT = await canMakeTags(projectId, userId);
    const canDeleteT = await canDeleteTags(projectId, userId);

    for (let i = 0; i < BRANCHES.length; i++) {
        if (BRANCHES[i].refType === "branch") {
            BRANCH_MAPPING[BRANCHES[i].refName] = i;
        }
        if (BRANCHES[i].oldHex == null) {
            if (BRANCHES[i].newHex == null) {
                BRANCHES[i].accept = false;
            } else {
                BRANCHES[i].accept = BRANCHES[i].refType === "branch" ? canMakeB : canMakeT;
            }
        } else {
            if (BRANCHES[i].newHex == null) {
                if (BRANCHES[i].refType === "branch") {
                    DELETED_BRANCHES.push(BRANCHES[i].refName);
                } else if (BRANCHES[i].refType === "tag") {
                    BRANCHES[i].accept = canDeleteT;
                }
            } else {
                if (BRANCHES[i].refType === "branch") {
                    CHANGED_BRANCHES.push(BRANCHES[i].refName);
                } else {
                    BRANCHES[i].accept = canMakeT && canDeleteT;
                }
            }
        }
    }

    const CAN_DELETE = await getOwnedBranches(projectId, userId, DELETED_BRANCHES);
    for (let i = 0; i < CAN_DELETE.length; i++) {
        BRANCHES[BRANCH_MAPPING[CAN_DELETE[i]]].accept = true;
    }

    const CAN_CHANGE = await getChangeableBranches(projectId, userId, CHANGED_BRANCHES);
    for (let i = 0; i < CAN_CHANGE.length; i++) {
        BRANCHES[BRANCH_MAPPING[CAN_CHANGE[i]]].accept = true;
    }

    for (let i = 0; i < BRANCHES.length; i++) {
        if (BRANCHES[i].accept) {
            switch (BRANCHES[i].refType) {
                case "branch":
                    await fs.mkdir(path.join(BRANCH_FOLDER, BRANCHES[i].refName));
                    break;
                case "tag":
                    await fs.mkdir(path.join(TAG_FOLDER, BRANCHES[i].refName));
                    break;
                default:
                    throw "error";
            }
        }
    }
}

start();
