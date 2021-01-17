import { Express } from 'express';
import sqlite3, { RunResult } from 'sqlite3';

export var db: sqlite3.Database;

const CREATE_DATABASE_VERSION_SQL = `
CREATE TABLE IF NOT EXISTS "versions" (
    "module" VARCHAR(255) NOT NULL UNIQUE,
    "version" INT NOT NULL
)`;

const SELECT_VERSIONS_SQL = `
SELECT "module", "version" FROM "versions"
`;

const UPDATE_VERSION_SQL = `
UPDATE "versions" SET "version"=? WHERE "module"=?
`;

const INSERT_MODULE_SQL = `
INSERT INTO "versions" ("module", "version") VALUES (?, ?)
`;

interface ModuleVersion {
    module: string;
    version: number;
};

interface Module {
    (app: Express, currentVersion: number): Promise<number>;
};

export function run(sql: string, ...params: any[]): Promise<RunResult> {
    return new Promise<RunResult>((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err != null) {
                reject(err);
            } else {
                resolve(this);
            }
        });
    });
}

export function all(sql: string, ...params: any[]): Promise<any[]> {
    return new Promise<any[]>((resolve, reject) => {
        db.all(sql, params, function(err, rows) {
            if (err != null) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

//Open the database file.
export function openDb(dbFile: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        db = new sqlite3.Database(dbFile, err => {
            if (err != null) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

export async function prepareDb(app: Express, modules: {[key: string]: Module}): Promise<void> {
    await openDb("./database.db");

    //Create the module version table if it doesn't exist.
    await run(CREATE_DATABASE_VERSION_SQL);
    const modulesCV: {[key: string]: number} = {};
    //Find all existing module versions in the database.
    (<ModuleVersion[]> await all(SELECT_VERSIONS_SQL)).forEach(v => {
        modulesCV[v.module] = v.version;
    });
    for (const key in modules) {
        //Tell the module to update the module's database tables from the current version to its latest version.
        if (modulesCV[key] != null) {
            modulesCV[key] = await modules[key](app, modulesCV[key]);
        } else {
            modulesCV[key] = await modules[key](app, 0);
        }
        //Update the version of the module in the database.
        await run(INSERT_MODULE_SQL, key, modulesCV[key]);
    }
}