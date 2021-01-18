import argon2 from 'argon2';
import { all, run } from 'database';
import { randomBytes } from "utils";

export const CREATE_USER_TABLES = [
    `CREATE TABLE "users" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "username" VARCHAR(255) UNIQUE NOT NULL,
        "email" VARCHAR(255) UNIQUE NOT NULL,
        "password_argon2" BINARY(64) NOT NULL,
        "salt" BINARY(16) NOT NULL,
        "active" BINARY(16) NULL
    )`,
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
    `INSERT INTO "users" ("id", "username", "email", "password_argon2", "salt", "active") VALUES (0, "admin", "admin", ?, ?, NULL)`
];
export const GET_USER_PARAMETERS = [
    [() => Promise.resolve([]), () => Promise.resolve([]), () => Promise.resolve([]), async function() {
        const salt = await randomBytes(16);
        const pw = await hash(Buffer.from("admin"), salt);
        return [pw, salt];
    }]
];

export const CREATE_USER_SQL = `INSERT INTO "users" ("username", "email", "password_argon2", "salt", "active") VALUES (?, ?, ?, ?, ?)`;
export const SELECT_USER_SQL = `SELECT "id", "username", "email", "password_argon2", "salt", "active" FROM "users" WHERE "username"=? AND (? OR "active" IS NULL)`;
export const ACTIVATE_USER = `UPDATE "users" SET "active"=NULL WHERE "username"=?`;
export const UPDATE_PASSWORD_SQL = `UPDATE "users" SET "password_argon2"=? WHERE "id"=?`;

const FIND_SSH_KEY = `SELECT "user_id" FROM "user_keys" WHERE "algorithm"=? AND "key"=?`;

export interface User {
    id: number;
    username: string;
    email: string;
    password_argon2: Buffer;
    salt: Buffer;
    active: Buffer | null;
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

export async function createUser(username: string, email: string, password: Buffer, salt: Buffer, active: Buffer) {
    return run(CREATE_USER_SQL, username, email, password, salt, active);
}

export async function selectUser(username: string | undefined, inactive: boolean): Promise<User | undefined> {
    const res: User[] = await all(SELECT_USER_SQL, username, inactive);
    if (res.length != 1) {
        return undefined;
    } else {
        return res[0];
    }
}

export async function hash(password: Buffer, salt: Buffer) {
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