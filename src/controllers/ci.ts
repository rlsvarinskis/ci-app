import express, { Express, Router } from "express";
import expressWs from 'express-ws';
import { all, run } from "database";
import { errors } from "errors";
import { parse } from 'url';
import fs from 'fs';
import path from 'path';
import { BranchFolder, PushFolder, TagFolder } from "hooks/folders";
import WebSocket from 'ws';

const CREATE_TABLES: string[][] = [
    []
];

const GET_PUSHES_SQL = `SELECT "pushes"."id", "users"."username", "pushes"."processing", "pushes"."time" FROM "pushes"
INNER JOIN "users" ON "users"."id"="pushes"."user_id"
WHERE "pushes"."project_id"=?1 AND ("pushes"."id"<?2 OR ?2 IS NULL)
ORDER BY "pushes"."id" DESC
LIMIT 20`;

const GET_PUSH_PROCESSING_SQL = `SELECT "pushes"."id", "pushes"."processing" FROM "pushes"
WHERE "pushes"."project_id"=?1 AND "pushes"."id"=?2`;

interface PushItem {
    id: number;
    username: string;
    processing: 0 | 1;
    time: BigInt;
};

interface PushProcessing {
    id: number;
    processing: 0 | 1;
};

async function getPushes(projectId: number, after: string | null): Promise<PushItem[]> {
    return (await all(GET_PUSHES_SQL, projectId, after));
}

async function isPushProcessing(projectId: number, pushId: any): Promise<PushProcessing[]> {
    return await all(GET_PUSH_PROCESSING_SQL, projectId, pushId);
}

export default async function CI(app: Router, currentVersion: number): Promise<number> {
    while (currentVersion != CREATE_TABLES.length) {
        for (var i = 0; i < CREATE_TABLES[currentVersion].length; i++) {
            console.log("Running CI v" + currentVersion + " script " + i);
            await run(CREATE_TABLES[currentVersion][i]);
        }
        currentVersion++;
    }

    var ciApp = express.Router();

    ciApp.get("/", async (req, res, next) => {
        if (req.project == null) {
            next(errors.not_found("Project"));
            return;
        }
        var after: string | null = null;

        var q = parse(req.url, true).query;
        if (typeof q.after === 'string') {
            after = q.after;
        }

        try {
            const res = await getPushes(req.project.id, after);
            next({
                type: "success",
                statusCode: 200,
                data: res.map(x => ({
                    id: x.id,
                    username: x.username,
                    processing: x.processing == 1,
                    time: x.time.toString()
                })),
            });
            return;
        } catch (e) {
            next(errors.database(e));
            return;
        }
    });
    ciApp.ws("/:push", async (ws, req, next) => {
        if (req.project == null) {
            ws.send(JSON.stringify(errors.not_found("Project")));
            ws.close();
            return;
        }
        var after: string | null = null;

        //Find whether such a push even exists
        let push: PushProcessing;
        try {
            const pushes = await isPushProcessing(req.project.id, req.params['push']);
            if (pushes.length !== 1) {
                ws.send(JSON.stringify(errors.not_found("Push")));
                ws.close();
                return;
            }
            push = pushes[0];
        } catch (e) {
            ws.send(JSON.stringify(errors.database(e)));
            ws.close();
            return;
        }

        const PUSH_FOLDER = PushFolder(req.project.id, push.id);
        const TAG_FOLDER = TagFolder(PUSH_FOLDER);
        const BRANCH_FOLDER = BranchFolder(PUSH_FOLDER);

        //Find the list of tags and branches that were updated by the push
        let tags: string[];
        let branches: string[];
        try {
            [tags, branches] = await Promise.all([fs.promises.readdir(TAG_FOLDER), fs.promises.readdir(BRANCH_FOLDER)]);
        } catch (e) {
            //If the files don't exist anymore, the logs and outputs are forever gone.
            ws.send(JSON.stringify(errors.expired("Push")));
            ws.close();
            return;
        }

        class ScriptWatcher {
            private scriptName: string;
            private targetFolder: string;

            private status: "waiting" | "running" | "done" = "waiting";

            private watcher: fs.FSWatcher;

            private hasOut: boolean = false;
            private hasRes: boolean = false;

            onChange?: () => void;

            constructor(scriptName: string, targetFolder: string) {
                this.scriptName = scriptName;
                this.targetFolder = targetFolder;

                this.watcher = fs.watch(targetFolder, (action, file) => {
                    if (file === "out" || file === "err" || file === "res") {
                        this.getOut();
                    }
                });
            }

            async getOut() {
                try {
                    const files = await fs.promises.readdir(this.targetFolder);
                    if (files.filter(x => x === "out" || x === "err").length > 0) {
                        this.hasOut = true;
                    }
                    if (files.filter(x => x === "res").length > 0) {
                        this.hasRes = true;
                    }
                } catch (err) {
                    this.hasOut = false;
                    this.hasRes = false;
                }
                this.update();
            }

            update() {
                const oS = this.status;
                if (this.hasRes) {
                    this.status = "done";
                    this.close();
                } else if (this.hasOut) {
                    this.status = "running";
                } else {
                    this.status = "waiting";
                }
                if (this.status !== oS && this.onChange !=  null) {
                    this.onChange();
                }
            }

            close() {
                this.watcher.close();
                this.onChange = undefined;
            }

            serialize() {
                return {
                    name: this.scriptName,
                    status: this.status
                };
            }
        }

        class RefWatcher {
            private refName: string;
            private targetFolder: string;
            private streamFolder: string;
            private finalFolder: string;
            private status: "waiting" | "running" | "done" = "waiting";
            private scripts: ScriptWatcher[] = [];
            private watcher?: fs.FSWatcher;

            private hasStream: boolean = false;
            private hasFinal: boolean = false;

            onChange?: () => void;
            onComplete?: () => void;

            constructor(refName: string, targetFolder: string) {
                this.refName = refName;
                this.targetFolder = targetFolder;
                this.streamFolder = path.join(targetFolder, "streams");
                this.finalFolder = path.join(targetFolder, "final");

                this.watcher = fs.watch(this.targetFolder, (action, file) => {
                    if (file === "streams") {
                        this.getStreams();
                    } else if (file === "final") {
                        this.getFinal();
                    }
                });
            }

            async getStreams() {
                try {
                    const files = await fs.promises.readdir(this.streamFolder);
                    this.hasStream = true;
                    this.scripts = files.map(folder => new ScriptWatcher(folder, path.join(this.streamFolder, folder)));
                    for (let i = 0; i < this.scripts.length; i++) {
                        this.scripts[i].onChange = () => {
                            if (this.onChange != null) {
                                this.onChange();
                            }
                        };
                        await this.scripts[i].getOut();
                    }
                    await this.getFinal();
                } catch (err) {
                    this.hasStream = false;
                    //Destroy any scriptwtchers
                    this.scripts.forEach(s => {
                        s.close();
                        s.onChange = undefined;
                    });
                    this.scripts = [];
                    await this.update();
                }
            }

            async getFinal() {
                try {
                    const stat = await fs.promises.lstat(this.finalFolder);
                    this.hasFinal = true;
                } catch (err) {
                    this.hasFinal = false;
                }
                await this.update();
            }

            async update() {
                const oS = this.status;
                if (this.hasStream) {
                    if (this.hasFinal) {
                        this.status = "done";
                        this.close();
                    } else {
                        this.status = "running";
                    }
                } else {
                    this.status = "waiting";
                }
                if (oS !== this.status) {
                    if (this.onChange != null) {
                        this.onChange();
                    }
                    if (this.status === "done") {
                        if (this.onComplete != null) {
                            this.onComplete();
                        }
                    }
                }
            }

            onceDone() {
                if (this.status === "done") {
                    return Promise.resolve();
                } else {
                    return new Promise<void>((resolve) => {
                        this.onComplete = resolve;
                    });
                }
            }

            serialize() {
                return {
                    name: this.refName,
                    status: this.status,
                    scripts: this.scripts.map(x => x.serialize())
                };
            }

            close() {
                this.watcher?.close();
            }
        };

        let watchers = [...branches.map(x => new RefWatcher("refs/heads/" + x, path.join(BRANCH_FOLDER, x))), ...tags.map(x => new RefWatcher("refs/tags/" + x, path.join(TAG_FOLDER, x)))];
        const branchPromises = Promise.all(watchers.map(x => x.getStreams()));
        branchPromises.then(x => {
            let o: {[key: string]: {
                name: string,
                status: "waiting" | "running" | "done",
                scripts: {
                    name: string,
                    status: "waiting" | "running" | "done"
                }[]
            }} = {};

            function changeHandler(t: RefWatcher) {
                t.onChange = () => {
                    const s = t.serialize();
                    o[s.name] = s;
                    ws.send(JSON.stringify({
                        type: "success", 
                        statusCode: 200,
                        data: o
                    }));
                };
            }

            watchers.map(t => {
                changeHandler(t);
                return t.serialize();
            }).forEach(t => {
                o[t.name] = t;
            });
            ws.send(JSON.stringify({
                type: "success", 
                statusCode: 200,
                data: o
            }));
            Promise.race([Promise.all(watchers.map(x => x.onceDone())), new Promise<void>((resolve) => {
                ws.on("close", (code, reason) => {
                    console.info("Websocket closed: " + code + " " + reason);
                    resolve();
                });
            })]).then(() => {
                ws.close();
                watchers.forEach(x => {
                    x.onChange = undefined;
                    x.onComplete = undefined;
                    x.close();
                });
                watchers = [];
            });
        });
    });
    ciApp.ws("/:push/:reftype/:refname/:script", async (ws, req, next) => {
        if (req.project == null) {
            ws.send(JSON.stringify(errors.not_found("Project")));
            ws.close();
            return;
        }
        var after: string | null = null;

        //Find whether such a push even exists
        let push: PushProcessing;
        try {
            const pushes = await isPushProcessing(req.project.id, req.params['push']);
            if (pushes.length !== 1) {
                ws.send(JSON.stringify(errors.not_found("Push")));
                ws.close();
                return;
            }
            push = pushes[0];
        } catch (e) {
            ws.send(JSON.stringify(errors.database(e)));
            ws.close();
            return;
        }

        if (req.params.reftype !== "branch" && req.params.reftype !== "tag") {
            ws.send(JSON.stringify(errors.not_found("Reference type")));
            ws.close();
            return;
        }

        const PUSH_FOLDER = PushFolder(req.project.id, push.id);
        const REFTYPE_FOLDER = req.params.reftype === "branch" ? BranchFolder(PUSH_FOLDER) : TagFolder(PUSH_FOLDER);
        const TARGET_FOLDER = path.join(REFTYPE_FOLDER, req.params.refname, "streams", req.params.script);
        const OUTPUT_FILE = path.join(TARGET_FOLDER, "out");

        let hasEnd = false;

        try {
            const dir = await fs.promises.readdir(TARGET_FOLDER);
            if (!dir.some(x => x === "out")) {
                ws.send(JSON.stringify(errors.not_found("Running script")));
                ws.close();
                return;
            }
            hasEnd = dir.some(x => x === "res");
        } catch (e) {
            ws.send(JSON.stringify(errors.not_found("Script")));
            ws.close();
            return;
        }

        const headerBuffer = Buffer.alloc(5);
        const dataBuffer = Buffer.alloc(65536);

        class FR {
            file: fs.promises.FileHandle;
            active: boolean = false;
            shouldClose: boolean = false;
            header: boolean = true;
            headerRead: number = 0;
            bodyType: "out" | "err" = "out";
            bodyLength: number = 0;
            readLength: number = 0;

            constructor(file: fs.promises.FileHandle) {
                this.file = file;
            }

            setActive() {
                if (!this.active) {
                    this.active = true;
                    if (this.header) {
                        this.readHeader();
                    } else {
                        this.readBody();
                    }
                }
            }

            waitForMore() {
                this.active = false;
                if (this.shouldClose) {
                    this.shouldClose = false;
                    this.close();
                }
            }

            setDone() {
                if (!this.active) {
                    this.close();
                } else {
                    this.shouldClose = true;
                }
            }

            async readHeader() {
                try {
                    while (this.headerRead < 5) {
                        if (ws.readyState !== WebSocket.OPEN) {
                            this.waitForMore();
                            return;
                        }
                        const read = await this.file.read(headerBuffer, this.headerRead, 5 - this.headerRead);
                        if (read.bytesRead === 0) {
                            this.waitForMore();
                            return;
                        }
                        this.headerRead += read.bytesRead;
                    }

                    this.bodyType = headerBuffer[0] === 0x00 ? "out" : "err";
                    this.bodyLength = headerBuffer.readUInt32BE(1);
                    this.readLength = 0;
                    this.header = false;
                    await this.readBody();
                } catch (e) {
                    ws.send(JSON.stringify(errors.database(e)));
                    this.close();
                }
            }

            async readBody() {
                try {
                    while (this.bodyLength - this.readLength > 0) {
                        const read = await this.file.read(dataBuffer, 0, Math.min(65536, this.bodyLength - this.readLength));
                        if (read.bytesRead === 0) {
                            this.waitForMore();
                            return;
                        }
                        if (ws.readyState !== WebSocket.OPEN) {
                            this.waitForMore();
                            return;
                        }
                        ws.send(JSON.stringify({
                            type: this.bodyType,
                            data: dataBuffer.slice(0, read.bytesRead).toString("base64")
                        }));
                        this.readLength += read.bytesRead;
                    }

                    this.header = true;
                    this.headerRead = 0;
                    await this.readHeader();
                } catch (e) {
                    ws.send(JSON.stringify(errors.database(e)));
                    this.close();
                }
            }

            close() {
                ws.close();
                this.file.close();
                watcher.close();
            }
        }

        ws.on("close", () => {
            fr.setDone();
        });

        let fst: fs.promises.FileHandle;
        try {
            fst = await fs.promises.open(OUTPUT_FILE, "r");
        } catch (e) {
            ws.send(JSON.stringify(errors.database(e)));
            ws.close();
            return;
        }

        let fr = new FR(fst);
        fr.setActive();
        const watcher = fs.watch(TARGET_FOLDER, (action, file) => {
            if (action === "change" && file === "out") {
                fr.setActive();
            } else if (action === "rename" && file === "res") {
                fr.setDone();
            }
        });
        if (hasEnd) {
            fr.setDone();
        } 
    });

    app.use("/pushes", ciApp);

    return currentVersion;
}