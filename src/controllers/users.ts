import { Express, json, NextFunction, Request, Response } from 'express';
import { all, run } from 'database';
import { alphanumeric, base64, email, lengthStr, randomBytes } from 'utils';
import { errors } from 'errors';
import { bool, dict, intersection, str } from 'type-builder';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import im from 'jimp';
import { raw } from 'body-parser';
import { CREATE_USER_TABLES, GET_USER_PARAMETERS, hash, User, createUser, selectUser, getUser, ACTIVATE_USER, UPDATE_PASSWORD_SQL } from 'models/user';

const CREATE_TABLES = [
    CREATE_USER_TABLES[0]
];

const GET_PARAMETERS = [
    GET_USER_PARAMETERS[0]
];

const LIST_USER_SSH_KEYS = `SELECT "id", "algorithm", "key", "comment" FROM "user_keys" WHERE "user_id"=?`;
const CREATE_USER_SSH_KEY = `INSERT INTO "user_keys" ("user_id", "algorithm", "key", "comment") VALUES (?, ?, ?, ?)`;
const DELETE_USER_SSH_KEY = `DELETE FROM "user_keys" WHERE "user_id"=? AND "id"=?`;

const FIND_USER_PROJECTS = `SELECT "projects"."id", "projects"."name", "projects"."private" FROM "users"
INNER JOIN "project_members" ON "project_members"."user_id"="users"."id"
INNER JOIN "projects" ON "projects"."id"="project_members"."project_id"
WHERE "users"."username"=? AND "projects"."private"=0`;
const FIND_COMMON_PROJECTS = `SELECT "projects"."id", "projects"."name", "projects"."private" FROM "users"
INNER JOIN "project_members" AS "m1" ON "m1"."user_id"="users"."id"
INNER JOIN "project_members" AS "m2" ON "m1"."project_id"="m2"."project_id"
INNER JOIN "projects" ON "projects"."id"="m1"."project_id"
WHERE "users"."username"=? AND "m2"."user_id"=?`;

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

export function session(req: Request, res: Response, next: NextFunction) {
    if (req.session == null) {
        req.user_session = undefined;
        next();
        return;
    }
    selectUser(req.session.username, false).then(user => {
        req.user_session = user;
        next();
    }, err => {
        next(errors.database(err));
    });
}

export default async function Users(app: Express, currentVersion: number): Promise<number> {
    while (currentVersion != CREATE_TABLES.length) {
        for (var i = 0; i < CREATE_TABLES[currentVersion].length; i++) {
            const params = await GET_PARAMETERS[currentVersion][i]();
            console.log("Running Users v" + currentVersion + " script " + i + " with ", params);
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
        var users: User | undefined;
        try {
            users = await selectUser(req.body.username, true);
        } catch (e) {
            next(errors.database(e));
            return;
        }

        if (users == null) {
            next(errors.bad_credentials());
            return;
        }

        const user = users;
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
            await createUser(req.body.username, req.body.email, h, salt, active);
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
        var users: User | undefined;
        try {
            users = await selectUser(req.params.username, false);
        } catch (e) {
            next(errors.database(e));
            return;
        }

        if (users == null) {
            next(errors.not_found("User"));
            return;
        }

        try {
            const res1 = await all(FIND_USER_PROJECTS, users.username);
            const res2 = req.user_session == null ? [] : await all(FIND_COMMON_PROJECTS, users.username, req.user_session.id);
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
        var users: User | undefined;
        try {
            users = await selectUser(req.params['username'], true);
        } catch (e) {
            next(errors.database(e));
            return;
        }

        if (users == null) {
            next(errors.not_found("User"));
            return;
        }

        const user = users;
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