import { Express, json, NextFunction, Request, Response } from 'express';
import argon2 from 'argon2';
import { all, run } from 'database';
import { alphanumeric, base64, email, lengthStr, randomBytes } from 'utils';
import { errors } from 'errors';
import { bool, dict, intersection, str } from 'type-builder';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import im from 'jimp';
import { raw } from 'body-parser';

const ADMIN_SALT = randomBytes(16);

const CREATE_TABLES = [
    [
`CREATE TABLE "users" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    "username" VARCHAR(255) UNIQUE NOT NULL,
    "email" VARCHAR(255) UNIQUE NOT NULL,
    "password_argon2" BINARY(64) NOT NULL,
    "salt" BINARY(16) NOT NULL,
    "active" BINARY(16) NULL
)
`,
`CREATE TABLE "user_recovery" (
    "recovery" BINARY(16) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "time" BIGINT NOT NULL,
    PRIMARY KEY ("recovery"),
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
)`,
`CREATE TABLE "user_keys" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "algorithm" VARCHAR(255) NOT NULL,
    "key" BINARY(2048) NOT NULL,
    "comment" VARCHAR(256) NOT NULL,
    UNIQUE("algorithm", "key"),
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
)`,
`INSERT INTO "users" ("id", "username", "email", "password_argon2", "salt", "active") VALUES (0, "admin", "admin", ?, ?, true)`
],
];
const GET_PARAMETERS = [
    [() => Promise.resolve([]), () => Promise.resolve([]), async function() {
        const salt = await randomBytes(16);
        const pw = await hash(Buffer.from("admin"), salt);
        return [pw, salt];
    }]
];

export interface User {
    id: number;
    username: string;
    email: string;
    password_argon2: Buffer;
    salt: Buffer;
    active: Buffer | null;
}

const CREATE_USER_SQL = `INSERT INTO "users" ("username", "email", "password_argon2", "salt", "active") VALUES (?, ?, ?, ?, ?)`;
const SELECT_USER_SQL = `SELECT "id", "username", "email", "password_argon2", "salt", "active" FROM "users" WHERE "username"=? AND (? OR "active" IS NULL)`;
const ACTIVATE_USER = `UPDATE "users" SET "active"=NULL WHERE "username"=?`;
const UPDATE_PASSWORD_SQL = `UPDATE "users" SET "password_argon2"=? WHERE "id"=?`;

const LIST_USER_SSH_KEYS = `SELECT "id", "algorithm", "key", "comment" FROM "user_keys" WHERE "user_id"=?`;
const CREATE_USER_SSH_KEY = `INSERT INTO "user_keys" ("user_id", "algorithm", "key", "comment") VALUES (?, ?, ?, ?)`;
const DELETE_USER_SSH_KEY = `DELETE FROM "user_keys" WHERE "user_id"=? AND "id"=?`;
const FIND_SSH_KEY = `SELECT "user_id" FROM "user_keys" WHERE "algorithm"=? AND "key"=?`;

const FIND_USER_PROJECTS = `SELECT "projects"."id", "projects"."name", "projects"."private" FROM "users"
INNER JOIN "project_members" ON "project_members"."user_id"="users"."id"
INNER JOIN "projects" ON "projects"."id"="project_members"."project_id"
WHERE "users"."username"=? AND "projects"."private"=0`;
const FIND_COMMON_PROJECTS = `SELECT "projects"."id", "projects"."name", "projects"."private" FROM "users"
INNER JOIN "project_members" AS "m1" ON "m1"."user_id"="users"."id"
INNER JOIN "project_members" AS "m2" ON "m1"."project_id"="m2"."project_id"
INNER JOIN "projects" ON "projects"."id"="m1"."project_id"
WHERE "users"."username"=? AND "m2"."user_id"=?`;

async function hash(password: Buffer, salt: Buffer) {
    return await argon2.hash(password, {
        salt: salt,
        saltLength: 16,
        raw: true,
        version: 0x13,
        type: argon2.argon2id,
        parallelism: 1,
        memoryCost: 4096,
        timeCost: 4,
        hashLength: 32,
    });
}

declare global {
    namespace Express {
        interface Request {
            user_session?: User;
        }
    }

    namespace CookieSessionInterfaces {
        interface CookieSessionObject {
            username?: string;
            longSession?: boolean;
            time?: number;
        }
    }
}

export async function getUser(username: string) {
    var users: User[];
    users = await all(SELECT_USER_SQL, username, false);
    if (users.length === 0) {
        return null;
    }
    return users[0];
}

export async function findSSHKey(algorithm: string, key: Buffer) {
    const res: {user_id: number}[] = await all(FIND_SSH_KEY, algorithm, key);
    if (res.length == 0) {
        return null;
    } else {
        return res[0].user_id;
    }
}

export function session(req: Request, res: Response, next: NextFunction) {
    if (req.session == null) {
        req.user_session = undefined;
        next();
        return;
    }
    all(SELECT_USER_SQL, req.session.username, false).then((users: User[]) => {
        if (users.length != 1) {
            req.user_session = undefined;
        } else {
            req.user_session = users[0];
        }
        next();
    }, err => {
        next(errors.database(err));
    });
}

export default async function Users(app: Express, currentVersion: number): Promise<number> {
    while (currentVersion != CREATE_TABLES.length) {
        for (var i = 0; i < CREATE_TABLES[currentVersion].length; i++) {
            const params = await GET_PARAMETERS[currentVersion][i]();
            console.log("Running Users v" + currentVersion + " script " + i);
            await run(CREATE_TABLES[currentVersion][i], ...params);
        }
        currentVersion++;
    }
    await fs.promises.mkdir("profiles", {
        recursive: true,
    });

    const upload = multer({
        dest: "/tmp",
        limits: {
            fieldSize: 1024,
            fields: 0,
            fileSize: 1024 * 1024 * 2,
            files: 1,
        },
    });

    app.get('/login', function(req, res, next) {
        if (req.user_session == null) {
            next(errors.no_session());
        } else {
            next({
                type: "success",
                statusCode: 200,
                data: {
                    id: req.user_session.id,
                    username: req.user_session.username,
                    email: req.user_session.email,
                },
            });
        }
    });
    
    app.post('/login', json({
        limit: "1kb",
    }), async (req, res, next) => {
        const checker = dict({
            username: intersection([lengthStr(1), alphanumeric]),
            password: lengthStr(6),
            remember: bool,
        });
        if (!checker(req.body)) {
            next(errors.invalid_request());
            return;
        }
        var users: User[];
        try {
            users = await all(SELECT_USER_SQL, req.body.username, true);
        } catch (e) {
            next(errors.database(e));
            return;
        }

        if (users.length != 1) {
            next(errors.bad_credentials());
            return;
        }

        const user = users[0];
        if (user.active != null) {
            next(errors.unactivated_account());
            return;
        }
        const h = await hash(Buffer.from(req.body.password), user.salt);
        if (h.equals(user.password_argon2)) {
            if (req.session == null) {
                req.session = {};
            }
            req.session.longSession = req.body.remember;
            req.session.username = user.username;
            req.session.time = Date.now();
            next({
                type: "success",
                statusCode: 200,
            });
        } else {
            next(errors.bad_credentials());
        }
    });
    
    app.post('/logout', (req, res, next) => {
        req.session = null;
        next({
            type: "success",
            statusCode: 200,
        });
    });

    app.post('/users', json({
        limit: "1kb",
    }), async (req, res, next) => {
        const checker = dict({
            username: intersection([lengthStr(1), alphanumeric]),
            email: email,
            password: lengthStr(6),
        });
        if (!checker(req.body)) {
            next(errors.invalid_request());
            return;
        }
        const salt = await randomBytes(16);
        const active = await randomBytes(16);
        const h = await hash(Buffer.from(req.body.password), salt);

        try {
            await run(CREATE_USER_SQL, req.body.username, req.body.email, h, salt, active)
            await fs.promises.copyFile("profiles/default.jpeg", "profiles/" + req.body.username + ".jpg");
            console.log("Adding user to database with activation key: " + active.toString("base64"));
            next({
                type: "success",
                statusCode: 200,
            });
        } catch (e) {
            if (e.code == "SQLITE_CONSTRAINT") {
                next(errors.already_exists("User"));
            } else {
                next(errors.database(e));
            }
        }
    });

    app.get('/users/:username/projects', async (req, res, next) => {
        var users: User[];
        try {
            users = await all(SELECT_USER_SQL, req.params.username, false);
        } catch (e) {
            next(errors.database(e));
            return;
        }

        if (users.length != 1) {
            next(errors.not_found("User"));
            return;
        }

        try {
            const res1 = await all(FIND_USER_PROJECTS, users[0].username);
            const res2 = req.user_session == null ? [] : await all(FIND_COMMON_PROJECTS, users[0].username, req.user_session.id);
            next({
                type: "success",
                statusCode: 200,
                data: {
                    public: res1,
                    common: res2,
                },
            });
            return;
        } catch (e) {
            next(errors.database(e));
            return;
        }
    });

    app.post<Record<string, any>, any, any, Record<string, any>>('/users/:username/verify', raw({
        type: "text/plain"
    }), async (req, res, next) => {
        const checker = lengthStr(22, 24);
        if (!checker(req.body.toString("ascii"))) {
            next(errors.invalid_request());
            return;
        }
        var users: User[];
        try {
            users = await all(SELECT_USER_SQL, req.params['username'], true);
        } catch (e) {
            next(errors.database(e));
            return;
        }

        if (users.length != 1) {
            next(errors.not_found("User"));
            return;
        }

        const user = users[0];
        if (user.active != null && user.active.toString("base64").split("=").join("") === req.body.toString("ascii").split("=").join("")) {
            try {
                const result = await run(ACTIVATE_USER, req.params['username']);
                console.log("Activated " + req.params['username'] + ": " + result.changes + ", " + result.lastID);
                next({
                    type: "success",
                    statusCode: 200,
                });
                return;
            } catch (e) {
                next(errors.database(e));
                return;
            }
        } else {
            next(errors.bad_credentials());
            return;
        }
    });

    app.put('/users/:username/password', json({
        limit: "1kb",
    }), async (req, res, next) => {
        const checker = dict({
            old: str,
            new_password: lengthStr(6),
        });
        if (!checker(req.body)) {
            next(errors.invalid_request());
            return;
        }
        if (req.user_session == null || req.params.username != req.user_session.username) {
            next(errors.forbidden());
            return;
        }

        const h = await hash(Buffer.from(req.body.old), req.user_session.salt);
        const n = await hash(Buffer.from(req.body.new_password), req.user_session.salt);
        if (h.equals(req.user_session.password_argon2)) {
            try {
                await run(UPDATE_PASSWORD_SQL, n, req.user_session.id);
                next({
                    type: "success",
                    statusCode: 200,
                });
                return;
            } catch (e) {
                next(errors.database(e));
                return;
            }
        } else {
            next(errors.bad_credentials());
            return;
        }
    });

    //app.post('/users/:email/resend', (req, res) => {
    //    req.query['key'];
    //});

    app.get("/users/:username/avatar", async (req, res) => {
        res.sendFile(path.resolve("profiles", req.params.username + ".jpg"));
    });

    app.put("/users/:username/avatar", upload.single("picture"), async (req, res, next) => {
        if (req.user_session == null || req.params.username != req.user_session.username) {
            next(errors.forbidden());
            return;
        }

        try {
            const image = await new Promise<im>((resolve, reject) => {
                im.read(path.join(req.file.destination, req.file.filename), (err, val) => {
                    if (err != null) {
                        reject(err);
                    } else {
                        resolve(val);
                    }
                });
            });
            await image.writeAsync(path.join("profiles", req.params.username + ".jpg"));
        } catch (e) {
            next(errors.invalid_request());
            return;
        }

        next({
            type: "success",
            statusCode: 200,
        });
    });

    app.get('/users/:username/keys', async (req, res, next) => {
        if (req.user_session == null || req.params.username != req.user_session.username) {
            next(errors.forbidden());
            return;
        }

        try {
            const resl = (await all(LIST_USER_SSH_KEYS, req.user_session.id) as {
                id: number;
                algorithm: string;
                key: Buffer;
                comment: string;
            }[]).map(x => ({
                id: x.id,
                algorithm: x.algorithm,
                key: x.key.toString("base64"),
                comment: x.comment,
            }));
            next({
                type: "success",
                statusCode: 200,
                data: resl,
            });
            return;
        } catch (e) {
            next(errors.database(e));
            return;
        }
    });

    app.post('/users/:username/keys', json({
        limit: "4kb",
    }), async (req, res, next) => {
        const checker = dict({
            algorithm: lengthStr(1),
            key: base64(16),
            comment: str,
        });
        if (!checker(req.body)) {
            next(errors.invalid_request());
            return;
        }
        var based64: Buffer;
        try {
            based64 = Buffer.from(req.body.key, "base64");
        } catch (e) {
            next(errors.invalid_request());
            return;
        }
        if (req.user_session == null || req.params.username != req.user_session.username) {
            next(errors.forbidden());
            return;
        }

        try {
            const resl = await run(CREATE_USER_SSH_KEY, req.user_session.id, req.body.algorithm, based64, req.body.comment);
            next({
                type: "success",
                statusCode: 200,
                data: resl.lastID,
            });
            return;
        } catch (e) {
            if (e.code == "SQLITE_CONSTRAINT") {
                next(errors.already_exists("Key"));
            } else {
                next(errors.database(e));
            }
            return;
        }
    });
    app.delete('/users/:username/keys/:key', async (req, res, next) => {
        if (req.user_session == null || req.params.username != req.user_session.username) {
            next(errors.forbidden());
            return;
        }

        try {
            const resl = await run(DELETE_USER_SSH_KEY, req.user_session.id, req.params.key);
            if (resl.changes == 0) {
                next(errors.not_found("Key"));
            } else {
                next({
                    type: "success",
                    statusCode: 200,
                    data: resl.lastID,
                });
            }
            return;
        } catch (e) {
            next(errors.database(e));
            return;
        }
    });

    return currentVersion;
}