import express, { Express } from "express";
import expressWs from 'express-ws';
import { all, run } from "database";
import { errors } from "errors";
import { parse } from 'url';
import fs from 'fs';
import path from 'path';
import { BranchFolder, PushFolder, TagFolder } from "hooks/folders";

const CREATE_TABLES: string[][] = [
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

export default async function CI(app: Express, currentVersion: number): Promise<number> {
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
                data: res,
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
            ws.close(-1);
            return;
        }
        var after: string | null = null;

        let push: PushProcessing;
        try {
            const pushes = await isPushProcessing(req.project.id, req.params['push']);
            if (pushes.length !== 1) {
                ws.send(JSON.stringify(errors.not_found("Push")));
                ws.close(-1);
                return;
            }
            push = pushes[i];
        } catch (e) {
            ws.send(JSON.stringify(errors.database(e)));
            ws.close(-1);
            return;
        }

        const PUSH_FOLDER = PushFolder(req.project.id, push.id);
        const TAG_FOLDER = TagFolder(PUSH_FOLDER);
        const BRANCH_FOLDER = BranchFolder(PUSH_FOLDER);

        let tags: string[];
        let branches: string[];
        try {
            [tags, branches] = await Promise.all([fs.promises.readdir(TAG_FOLDER), fs.promises.readdir(BRANCH_FOLDER)]);
        } catch (e) {
            ws.send(JSON.stringify(errors.expired("Push")));
            ws.close(-1);
            return;
        }

        interface RefStatus {
            name: string;
            status: "done" | "running" | "waiting";
            scripts: string[] | null;
        };

        class RefWatcher {
            private refName: string;
            private targetFolder: string;
            private streamFolder: string;
            private finalFolder: string;
            private status: "waiting" | "running" | "done" = "waiting";
            private scripts: string[] = [];
            private watcher: fs.FSWatcher | null = null;

            constructor(refName: string, targetFolder: string) {
                this.refName = refName;
                this.targetFolder = targetFolder;
                this.streamFolder = path.join(targetFolder, "streams");
                this.finalFolder = path.join(targetFolder, "final");

                this.checkWaiting();
            }

            checkWaiting() {
                fs.readdir(this.streamFolder, (err, files) => {
                    if (err) {
                        this.status = "waiting";
                        if (this.watcher == null) {
                            fs.watch(this.targetFolder, (event, filename) => {
                                
                            });
                        }
                    } else {
                        this.status = "running";
                        this.scripts = files;
                    }
                });
            }

            checkRunning() {

            }
        };

        const tagWatchers = tags.map(x => {
            const TARGET_FOLDER = path.join(TAG_FOLDER, x);
            const STREAM_FOLDER = path.join(TAG_FOLDER, x, "streams");
            const FINAL_FOLDER = path.join(TAG_FOLDER, x, "final");
            fs.watch(TARGET_FOLDER);
        })

        const tagPromise = tags.map(async x => {
            const STREAM_FOLDER = path.join(TAG_FOLDER, x, "streams");
            const FINAL_FOLDER = path.join(TAG_FOLDER, x, "final");

            let streams: string[];
            try {
                streams = await fs.promises.readdir(STREAM_FOLDER);
            } catch (e) {
                return {
                    name: x,
                    status: "waiting",
                    scripts: null
                };
            }

            try {
                await fs.promises.access(FINAL_FOLDER);
                return {
                    name: x,
                    status: "done",
                    scripts: streams
                };
            } catch (e) {
                return {
                    name: x,
                    status: "running",
                    scripts: streams
                }
            }
        });

        try {
            const res = await getPushes(req.project.id, after);
            next({
                type: "success",
                statusCode: 200,
                data: res,
            });
            return;
        } catch (e) {
            next(errors.database(e));
            return;
        }
    });

    app.use("/pushes", ciApp);

    return currentVersion;
}