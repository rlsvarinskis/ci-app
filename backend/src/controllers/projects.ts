import { all, run } from "database";
import { errors } from "errors";
import express, { Express, json } from "express";
import { bool, dict, num, str, TypeChecker, union } from "type-builder";
import git, { Blob, Tree, TreeEntry } from 'nodegit';
import { lengthStr } from "utils";
import fs from 'fs';
import path from 'path';
import { parse } from "url";
import { getUser, User } from "controllers/users";
import * as mime from 'mime-types';
import { sshPort } from "ports";

declare global {
    namespace Express {
        interface Request {
            project?: Project;
        }
    }
}

const CREATE_TABLES = [
[
`CREATE TABLE "projects" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    "parent" INTEGER NULL,
    "owner" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" VARCHAR(65535) NOT NULL,
    "private" TINYINT NOT NULL,
    "default_branch" VARCHAR(65535) NULL,
    "default_branch_permissions" TINYINT NOT NULL,

    FOREIGN KEY ("parent") REFERENCES "projects"("id"),
    FOREIGN KEY ("owner") REFERENCES "users"("id"),
    UNIQUE("parent", "name")
)`,
`CREATE TABLE "pushes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "project_id" INTEGER NOT NULL,
    "processing" TINYINT NOT NULL,
    "time" BIGINT NOT NULL,

    FOREIGN KEY ("user_id") REFERENCES "users"("id"),
    FOREIGN KEY ("project_id") REFERENCES "projects"("id")
)`,
`CREATE TABLE "project_members" (
    "project_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "mod" TINYINT NOT NULL,
    "make_branches" TINYINT NOT NULL,
    "make_tags" TINYINT NOT NULL,
    "delete_tags" TINYINT NOT NULL,
    "make_subprojects" TINYINT NOT NULL,

    PRIMARY KEY ("project_id", "user_id"),
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
)`,
`CREATE TABLE "project_branches" (
    "name" VARCHAR(65535) NOT NULL,
    "project_id" INTEGER NOT NULL,
    "push_id" INTEGER NOT NULL,
    "owner" INTEGER NOT NULL,
    "branch_permission" TINYINT NOT NULL,

    PRIMARY KEY ("name", "project_id"),
    FOREIGN KEY ("project_id") REFERENCES "projects"("id"),
    FOREIGN KEY ("owner") REFERENCES "users"("id")
)`,
`CREATE TABLE "project_branch_allowed" (
    "project_id" INTEGER NOT NULL,
    "branch_name" VARCHAR(65535) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "writable" TINYINT NOT NULL,

    PRIMARY KEY ("project_id", "branch_name", "user_id"),
    FOREIGN KEY ("project_id", "branch_name") REFERENCES "project_branches"("project_id", "name"),
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
)`,
`CREATE TABLE "project_tags" (
    "name" VARCHAR(65535) NOT NULL,
    "project_id" INTEGER NOT NULL,
    "push_id" INTEGER NOT NULL,

    PRIMARY KEY ("name", "project_id"),
    FOREIGN KEY ("project_id") REFERENCES "projects"("id")
)`,
`INSERT INTO "projects" ("id", "parent", "owner", "name", "description", "private", "default_branch", "default_branch_permissions") VALUES (0, NULL, 0, "main", "The root project, which enforces unique project names", TRUE, NULL, 0)`
],
];

export interface Project {
    id: number;
    parent: number;
    owner: number;
    name: string;
    description: string;
    private: boolean;
    default_branch_permissions: "NONE" | "READ" | "WRITE";
};

interface ProjectMember {
    username: string;
    mod: boolean;
    make_branches: boolean;
    make_subprojects: boolean;
};

const INSERT_PUSH_SQL = `INSERT INTO "pushes" ("user_id", "project_id", "processing", "time") VALUES (?, ?, TRUE, ?)`;
const UPDATE_PUSH_SQL = `UPDATE "pushes" SET "processing"=FALSE WHERE "id"=?`;
const DELETE_ALL_PUSHES_SQL = `DELETE FROM "pushes" WHERE "project_id"=?`;

const INSERT_PROJECT_SQL = `INSERT INTO "projects" ("parent", "owner", "name", "description", "private", "default_branch_permissions") VALUES (?, ?, ?, ?, ?, ?)`;
const UPDATE_PROJECT_PRIVATE_SQL = `UPDATE "projects" SET "private"=? WHERE "id"=?`;
const UPDATE_PROJECT_PERMISSION_SQL = `UPDATE "projects" SET "default_branch_permissions"=? WHERE "id"=?`;
const UPDATE_PROJECT_DESCRIPTION_SQL = `UPDATE "projects" SET "description"=? WHERE "id"=?`;
const UPDATE_PROJECT_OWNER_SQL = `UPDATE "projects" SET "owner"=?1 WHERE "id"=?2`;
const DELETE_PROJECT_MEMBERS_SQL = `DELETE "project_members" WHERE "project_id"=?`;
const DELETE_PROJECT_BRANCHES_SQL = `DELETE "project_branches" WHERE "project_id"=?`;
const DELETE_PROJECT_BRANCH_ALLOWED_SQL = `DELETE "project_branch_allowed" WHERE "project_id"=?`;
const DELETE_PROJECT_SQL = `DELETE "projects" WHERE "projects"."id"=?`;
const COUNT_CHILD_PROJECTS_SQL = `SELECT COUNT(*) AS "count" FROM "projects" WHERE "parent"=?`;
const SELECT_PROJECT_SQL = `SELECT "id", "parent", "owner", "name", "description", "private", "default_branch_permissions" FROM "projects" WHERE "name"=? AND "parent"=?`;
const GET_PROJECTS_SQL = `SELECT "id", "name", "description" FROM "projects" LEFT JOIN "project_members" ON "project_members"."project_id"="projects"."id" WHERE "projects"."parent"=?1 AND ("projects"."private"=0 OR "project_members"."user_id"=?2 OR "projects"."owner"=?2) AND "projects"."name">? ORDER BY "projects"."name" ASC LIMIT 20`;
const SELECT_PROJECT_OWNER_SQL = `SELECT "projects"."id", "projects"."parent", "projects"."owner", "projects"."name", "projects"."description", "projects"."private", "projects"."default_branch_permissions", "users"."username"
FROM "projects"
JOIN "users" ON "users"."id"="projects"."owner"
WHERE "projects"."id"=?`;

const GET_PROJECT_MEMBERS_SQL = `SELECT "username", "mod", "make_branches", "make_subprojects", "make_tags", "delete_tags" FROM "project_members" LEFT JOIN "users" ON "user_id"="id" WHERE "project_id"=?`;
const INSERT_PROJECT_MEMBER_SQL = `INSERT INTO "project_members" ("project_id", "user_id", "mod", "make_branches", "make_tags", "delete_tags", "make_subprojects") VALUES (?, ?, ?, ?, ?, ?, ?)`;
const UPDATE_PROJECT_MEMBER_SQL = `UPDATE "project_members" SET "mod"=?, "make_branches"=?, "make_tags"=?, "delete_tags"=?, "make_subprojects"=? WHERE "project_id"=? AND "user_id"=?`;
const TRANSFER_PROJECT_MEMBER_BRANCHES_SQL = `UPDATE "project_branches" SET "owner"=? WHERE "project_id"=? AND "owner" IN (SELECT "id" FROM "users" WHERE "username"=?)`;
const DELETE_PROJECT_MEMBER_SQL = `DELETE FROM "project_members" WHERE "project_id"=? AND "user_id" IN (SELECT "id" FROM "users" WHERE "username"=?)`;
const CAN_READ_PROJECT_SQL = `SELECT COUNT(*) AS "count" FROM (
    SELECT "user_id" FROM "project_members" WHERE "user_id"=?1 AND "project_id"=?2
    UNION
    SELECT "owner" AS "user_id" FROM "projects" WHERE "owner"=?1 AND "id"=?2
)`;
const CAN_MAKE_SUBPROJECT_SQL = `SELECT COUNT(*) AS "count" FROM (
    SELECT "user_id" FROM "project_members" WHERE "user_id"=?1 AND "project_id"=?2 AND "make_subprojects"=TRUE
    UNION
    SELECT "owner" AS "user_id" FROM "projects" WHERE "owner"=?1 AND "id"=?2
)`;
const CAN_MAKE_BRANCHES_SQL = `SELECT COUNT(*) AS "count" FROM (
    SELECT "user_id" FROM "project_members" WHERE "user_id"=?1 AND "project_id"=?2 AND "make_branches"=TRUE
    UNION
    SELECT "owner" AS "user_id" FROM "projects" WHERE "owner"=?1 AND "id"=?2
)`;
const CAN_MAKE_TAGS_SQL = `SELECT COUNT(*) AS "count" FROM (
    SELECT "user_id" FROM "project_members" WHERE "user_id"=?1 AND "project_id"=?2 AND "make_tags"=TRUE
    UNION
    SELECT "owner" AS "user_id" FROM "projects" WHERE "owner"=?1 AND "id"=?2
)`;
const CAN_DELETE_TAGS_SQL = `SELECT COUNT(*) AS "count" FROM (
    SELECT "user_id" FROM "project_members" WHERE "user_id"=?1 AND "project_id"=?2 AND "delete_tags"=TRUE
    UNION
    SELECT "owner" AS "user_id" FROM "projects" WHERE "owner"=?1 AND "id"=?2
)`;

const INSERT_PROJECT_TAG_SQL = `INSERT INTO "project_tags" ("name", "project_id", "push_id") VALUES (?, ?, ?)`;
const UPDATE_PROJECT_TAG_SQL = `UPDATE "project_tags" SET "push_id"=? WHERE "project_id"=? AND "name"=?`;
const DELETE_PROJECT_TAG_SQL = `DELETE FROM "project_tags" WHERE "project_id"=? AND "name"=?`;
const DELETE_ALL_PROJECT_TAGS_SQL = `DELETE FROM "project_tags" WHERE "project_id"=?`;

const GET_PROJECT_BRANCHES_SQL = `SELECT "name" AS "branch_name", "username", "branch_permission" + 2 AS "branch_permission" FROM "project_branches" LEFT JOIN "users" ON "users"."id"="owner" WHERE "project_id"=?1
UNION SELECT "branch_name", "username", "writable" AS "branch_permission" FROM "project_branch_allowed" LEFT JOIN "users" ON "users"."id"="user_id" WHERE "project_id"=?1`;
const INSERT_PROJECT_BRANCH_SQL = `INSERT INTO "project_branches" ("name", "project_id", "push_id", "owner", "branch_permission")
SELECT ?1 AS "name", "projects"."id", ?3 AS "push_id", ?4 AS "owner", "default_branch_permissions" AS "branch_permission" FROM "projects" WHERE "projects"."id"=?2`;
const CHANGE_PROJECT_BRANCH_PUSH_SQL = `UPDATE "project_branches" SET "push_id"=? WHERE "project_id"=? AND "name"=?`;
const DELETE_PROJECT_BRANCH_MEMBERS_SQL = `DELETE FROM "project_branch_allowed" WHERE "project_id"=? AND "branch_name"=?`;
const DELETE_PROJECT_BRANCH_SQL = `DELETE FROM "project_branches" WHERE "project_id"=? AND "name"=?`;
const GET_NON_WRITABLE_PROJECT_BRANCHES_SQL = `SELECT DISTINCT "name" AS "branch_name" FROM "project_branches" LEFT JOIN "project_branch_allowed" ON "project_branch_allowed"."project_id"="project_branches"."project_id" AND "project_branch_allowed"."branch_name"="project_branches"."name" AND "project_branch_allowed"."user_id"=?2
WHERE "project_branches"."project_id"=?1 AND "project_branches"."branch_permission"<2 AND "project_branches"."owner"!=?2 AND "project_branch_allowed"."writable" IS NOT TRUE`;
const GET_NON_READABLE_PROJECT_BRANCHES_SQL = `SELECT DISTINCT "name" AS "branch_name" FROM "project_branches" LEFT JOIN "project_branch_allowed" ON "project_branch_allowed"."project_id"="project_branches"."project_id" AND "project_branch_allowed"."branch_name"="project_branches"."name" AND "project_branch_allowed"."user_id"=?2
WHERE "project_branches"."project_id"=?1 AND "project_branches"."branch_permission"<1 AND "project_branches"."owner"!=?2 AND "project_branch_allowed"."writable" IS NULL`;
const UPDATE_BRANCH_PERMISSION_SQL = `UPDATE "project_branches" SET "branch_permission"=? WHERE "project_id"=? AND "name"=?`;
const UPDATE_BRANCH_CREATOR_SQL = `UPDATE "project_branches" SET "owner"=(SELECT "id" FROM "users" WHERE "username"=?1) WHERE EXISTS (SELECT "id" FROM "users" WHERE "username"=?1) AND "project_id"=? AND "name"=?`;
const CAN_CHANGE_BRANCH_SQL = `SELECT "owner" AS "user_id" FROM "project_branches" WHERE "project_id"=? AND "name"=?`;
const INSERT_PROJECT_BRANCH_MEMBER_SQL = `INSERT INTO "project_branch_allowed" ("project_id", "branch_name", "user_id", "writable") VALUES (?, ?, ?, ?)`;
const UPDATE_BRANCH_MEMBER_SQL = `UPDATE "project_branch_allowed" SET "writable"=? WHERE "project_id"=? AND "branch_name"=? AND "user_id" IN (SELECT "id" FROM "users" WHERE "username"=?)`;
const DELETE_BRANCH_MEMBER_SQL = `DELETE FROM "project_branch_allowed" WHERE "project_id"=? AND "branch_name"=? AND "user_id"= IN (SELECT "id" FROM "users" WHERE "username"=?)`;

const permissions = union(["NONE", "READ", "WRITE"]);
type permissions = typeof permissions['type'];

function branchPermToText(perm: number): permissions {
    switch (perm) {
        case 0:
            return "NONE";
        case 1:
            return "READ";
        case 2:
            return "WRITE";
    }
    throw Error("Bad permission! " + perm);
}

function textToBranchPerm(perm: permissions): number {
    switch (perm) {
        case "NONE":
            return 0;
        case "READ":
            return 1;
        case "WRITE":
            return 2;
    }
    return -1;
}

export async function getProject(name: string, parent: number) {
    const projects: Project[] = (await all(SELECT_PROJECT_SQL, name, parent)).map(x => {
        x.default_branch_permissions = branchPermToText(x.default_branch_permissions);
        return x;
    });
    if (projects.length != 1) {
        return null;
    } else {
        return projects[0];
    }
}

export async function getProjects(parentProject: number, user: number, after: string) {
    const projects: Pick<Project, "id" | "name" | "description">[] = (await all(GET_PROJECTS_SQL, parentProject, user, after));
    return projects;
}

export async function createPush(userId: number, projectId: number, time: BigInt) {
    return (await run(INSERT_PUSH_SQL, userId, projectId, time.toString())).lastID;
}

export async function completePush(pushId: number) {
    await run(UPDATE_PUSH_SQL, pushId);
}

export async function createBranch(projectId: number, pushId: number, userId: number, branchName: string) {
    await run(INSERT_PROJECT_BRANCH_SQL, branchName, projectId, pushId, userId);
}

export async function updateBranchPush(projectId: number, branchName: string, pushId: number) {
    await run(CHANGE_PROJECT_BRANCH_PUSH_SQL, pushId, projectId, branchName);
}

export async function deleteBranch(projectId: number, branchName: string) {
    await run(DELETE_PROJECT_BRANCH_MEMBERS_SQL, projectId, branchName);
    await run(DELETE_PROJECT_BRANCH_SQL, projectId, branchName);
}

export async function createTag(projectId: number, pushId: number, name: string) {
    await run(INSERT_PROJECT_TAG_SQL, name, projectId, pushId);
}

export async function changeTag(projectId: number, pushId: number, name: string) {
    await run(UPDATE_PROJECT_TAG_SQL, pushId, projectId, name);
}

export async function deleteTag(projectId: number, name: string) {
    await run(DELETE_PROJECT_TAG_SQL, projectId, name);
}

export async function getOwnedBranches(project: number, user: number, names: string[]) {
    return (await all(`SELECT "name" FROM "project_branches" WHERE "owner"=? AND "project_id"=? AND "name" IN (` + names.map(x => "?").join(",") + `)`, user, project, ...names)).map(x => <string> x.name);
}

export async function getChangeableBranches(project: number, user: number, names: string[]) {
    return (await all(`SELECT "name" FROM "project_branches"
LEFT JOIN "project_branch_allowed" ON
    "project_branch_allowed"."project_id"="project_branches"."project_id" AND
    "project_branch_allowed"."branch_name"="project_branches"."name" AND
    "project_branch_allowed"."user_id"=?1
WHERE ("project_branches"."owner"=?1 OR "project_branch_allowed"."writable" IS TRUE) AND "project_branches"."project_id"=?2 AND "project_branches"."name" IN (` + names.map((x, i) => "?" + (i + 3)).join(",") + `)`, user, project, ...names)).map(x => <string> x.name);
}

export async function canMakeBranches(project: number, user: number) {
    return (await all(CAN_MAKE_BRANCHES_SQL, user, project))[0].count > 0;
}

export async function canMakeTags(project: number, user: number) {
    return (await all(CAN_MAKE_TAGS_SQL, user, project))[0].count > 0;
}

export async function canDeleteTags(project: number, user: number) {
    return (await all(CAN_DELETE_TAGS_SQL, user, project))[0].count > 0;
}

export async function canReadProject(project: number, user: number | null) {
    return (await all(CAN_READ_PROJECT_SQL, user, project))[0].count > 0;
}

export async function getNonWriteBranches(project: number, user: number) {
    return (await all(GET_NON_WRITABLE_PROJECT_BRANCHES_SQL, project, user)).map(x => <string> x.branch_name);
}

export async function getNonReadBranches(project: number, user: number | null) {
    return (await all(GET_NON_READABLE_PROJECT_BRANCHES_SQL, project, user)).map(x => <string> x.branch_name);
}

async function getMembers(project: number): Promise<ProjectMember[]> {
    return (await all(GET_PROJECT_MEMBERS_SQL, project)).map(x => ({
        username: x.username,
        mod: x.mod == 1,
        make_branches: x.make_branches == 1,
        make_subprojects: x.make_subprojects == 1,
        make_tags: x.make_tags == 1,
        delete_tags: x.delete_tags == 1,
    }));
}

const FORBIDDEN_CHARACTERS = "\\/:*\"<>|";

export function isValidRepositoryName(name: string) {
    if (name.length === 0) {
        return false;
    }
    if (name[0] === ' ' || name[name.length - 1] === ' ') {
        return false;
    }
    for (let i = 0; i < name.length; i++) {
        if (name.charCodeAt(i) < 32 || name.charCodeAt(i) === 127) {
            return false;
        }
        if (FORBIDDEN_CHARACTERS.includes(name[i])) {
            return false;
        }
    }
    if (name[name.length - 1] === ".") {
        return false;
    }
    return true;
}

export const validRepositoryName = <TypeChecker<string>> function(data: any): data is string {
    if (typeof data !== 'string') {
        return false;
    }
    return isValidRepositoryName(data);
};

export default async function Projects(app: Express, currentVersion: number): Promise<number> {
    while (currentVersion != CREATE_TABLES.length) {
        for (var i = 0; i < CREATE_TABLES[currentVersion].length; i++) {
            console.log("Running Projects v" + currentVersion + " script " + i);
            await run(CREATE_TABLES[currentVersion][i]);
        }
        currentVersion++;
    }
    await fs.promises.mkdir("repo", {
        recursive: true,
    });
    await fs.promises.mkdir("resources", {
        recursive: true,
    });

    var projectsApp = express.Router();

    projectsApp.post('/', json({
        limit: "4kb"
    }), async (req, res, next) => {
        if (req.user_session == null) {
            next(errors.no_session());
            return;
        }

        const checker = dict({
            name: validRepositoryName,
            description: lengthStr(0),
            private: bool,
            default_branch_permissions: permissions,
        });
        if (!checker(req.body)) {
            next(errors.invalid_request());
            return;
        }

        var defP = 0;
        switch (req.body.default_branch_permissions) {
            case "NONE":
                defP = 0;
                break;
            case "READ":
                defP = 1;
                break;
            case "WRITE":
                defP = 2;
                break;
        }

        if (req.project != null && req.project.owner != req.user_session.id) {
            const res = await all(CAN_MAKE_SUBPROJECT_SQL, req.user_session.id, req.project.id);
            if (res.length != 1 || res[0].count != 1) {
                next(errors.forbidden());
                return;
            }
        }

        try {
            const res = await run(INSERT_PROJECT_SQL, req.project == null ? 0 : req.project.id, req.user_session.id, req.body.name, req.body.description, req.body.private, defP);
            const repoLocation = path.resolve("repo", res.lastID + ".git");
            await git.Repository.init(repoLocation, 1);
            await fs.promises.writeFile(path.join(repoLocation, "hooks", "pre-receive"),
`#!/bin/sh

exec node ../../dist/hook-pre-receive.js
`, {
    mode: 0o777
});
            await fs.promises.writeFile(path.join(repoLocation, "hooks", "update"),
`#!/bin/sh

exec node ../../dist/hook-update.js "$@"
`, {
mode: 0o777
});
            await fs.promises.mkdir("resources/" + res.lastID + "/", {
                recursive: true,
            });
            next({
                type: "success",
                statusCode: 200,
            });
        } catch (e) {
            if (e.code === "SQLITE_CONSTRAINT") {
                next(errors.already_exists("Project"));
            } else {
                next(errors.database(e));
            }
        }
    });

    projectsApp.get("/", async (req, res, next) => {
        var parentId: number;
        var userId: number;
        if (req.project == null) {
            parentId = 0;
        } else {
            parentId = req.project.id;
        }
        if (req.user_session == null) {
            userId = -1;
        } else {
            userId = req.user_session.id;
        }
        var after = "";

        var q = parse(req.url, true).query;
        if (typeof q.after === 'string') {
            after = q.after;
        }

        const projects = await getProjects(parentId, userId, after);
        next({
            type: "success",
            statusCode: 200,
            data: projects,
        });
    });

    projectsApp.use("/:project", async (req, res, next) => {
        var parentId = req.project?.id || 0;
        try {
            const project = await getProject(req.params['project'], parentId);
            if (project == null) {
                next(errors.not_found("Project"));
                return;
            }
            if (project.private) {
                if (req.user_session == null) {
                    next(errors.forbidden());
                    return;
                }
                try {
                    if (project.owner != req.user_session.id && !(await canReadProject(project.id, req.user_session.id))) {
                        next(errors.forbidden());
                        return;
                    }
                } catch (e) {
                    next(errors.database(e));
                    return;
                }
            }
            req.project = project;
            next();
        } catch (e) {
            next(errors.database(e));
        }
    });

    projectsApp.get("/:project", async (req, res, next) => {
        if (req.project == null) {
            next(errors.not_found("Project"));
            return;
        }

        try {
            const res: {
                id: number,
                name: string,
                description: string,
                owner: number;
                parent: number;
                private: number;
                default_branch_permissions: number;
                username: string;
            }[] = await all(SELECT_PROJECT_OWNER_SQL, req.project.id);
            if (res.length != 1) {
                next(errors.not_found("Project"));
                return;
            }
            const pr = res[0];
            next({
                type: "success",
                statusCode: 200,
                data: {
                    id: pr.id,
                    name: pr.name,
                    description: pr.description,
                    owner: pr.username,
                    parent: pr.parent,
                    private: pr.private === 1,
                    default_branch_permissions: branchPermToText(pr.default_branch_permissions),
                    sshPort: sshPort,
                },
            });
            return;
        } catch (e) {
            next(errors.database(e));
            return;
        }
    });

    projectsApp.delete("/:project", async (req, res, next) => {
        if (req.user_session == null) {
            next(errors.no_session());
            return;
        }

        if (req.user_session.id != req.project?.owner) {
            next(errors.forbidden());
            return;
        }

        try {
            const children = await all(COUNT_CHILD_PROJECTS_SQL, req.project.id);
            if (children.length === 0 || children[0].count > 0) {
                next(errors.has_children());
                return;
            }
            await run(DELETE_ALL_PROJECT_TAGS_SQL, req.project.id);
            await run(DELETE_PROJECT_BRANCH_ALLOWED_SQL, req.project.id);
            await run(DELETE_PROJECT_BRANCHES_SQL, req.project.id);
            await run(DELETE_ALL_PUSHES_SQL, req.project.id);
            await run(DELETE_PROJECT_MEMBERS_SQL, req.project.id);
            await run(DELETE_PROJECT_SQL, req.project.id);
            next({
                type: "success",
                statusCode: 200,
            });
            return;
        } catch (e) {
            next(errors.database(e));
            return;
        }
    });

    projectsApp.put("/:project/description", json({
        limit: "4kb",
        strict: false,
    }), async (req, res, next) => {
        if (req.user_session == null) {
            next(errors.no_session());
            return;
        }

        if (req.user_session.id != req.project?.owner) {
            next(errors.forbidden());
            return;
        }

        if (str(req.body)) {
            try {
                await run(UPDATE_PROJECT_DESCRIPTION_SQL, req.body, req.project.id);
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
            next(errors.invalid_request());
            return;
        }
    });

    projectsApp.put("/:project/private", json({
        limit: "1kb",
        strict: false,
    }), async (req, res, next) => {
        if (req.user_session == null) {
            next(errors.no_session());
            return;
        }

        if (req.user_session.id != req.project?.owner) {
            next(errors.forbidden());
            return;
        }

        if (bool(req.body)) {
            try {
                await run(UPDATE_PROJECT_PRIVATE_SQL, req.body, req.project.id);
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
            next(errors.invalid_request());
            return;
        }
    });

    projectsApp.put("/:project/default_branch_permissions", json({
        limit: "1kb",
        strict: false,
    }), async (req, res, next) => {
        if (req.user_session == null) {
            next(errors.no_session());
            return;
        }

        if (req.user_session.id != req.project?.owner) {
            next(errors.forbidden());
            return;
        }

        if (permissions(req.body)) {
            try {
                await run(UPDATE_PROJECT_PERMISSION_SQL, textToBranchPerm(req.body), req.project.id);
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
            next(errors.invalid_request());
            return;
        }
    });

    projectsApp.put("/:project/owner", json({
        limit: "1kb",
        strict: false,
    }), async (req, res, next) => {
        if (req.user_session == null) {
            next(errors.no_session());
            return;
        }

        if (req.user_session.id != req.project?.owner) {
            next(errors.forbidden());
            return;
        }

        if (str(req.body) && req.body !== req.user_session.username) {
            var us: User;
            try {
                const usr = await getUser(req.body);
                if (usr === null) {
                    next(errors.not_found("User"));
                    return;
                }
                us = usr;
            } catch (e) {
                next(errors.database(e));
                return;
            }

            try {
                const res = await run(UPDATE_PROJECT_OWNER_SQL, us.id, req.project.id);
                if (res.changes == 0) {
                    next(errors.not_found("User"));
                    return;
                }
            } catch (e) {
                if (e.code === "SQLITE_CONSTRAINT") {
                    next(errors.not_found("User"));
                } else {
                    next(errors.database(e));
                }
                return;
            }
            try {
                await run(INSERT_PROJECT_MEMBER_SQL, req.project.id, req.user_session.id, false, true, true, true, true);
                await run(DELETE_PROJECT_MEMBER_SQL, req.project.id, req.body);
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
            next(errors.invalid_request());
            return;
        }
    });

    projectsApp.get("/:project/members", async (req, res, next) => {
        if (req.project == null) {
            next(errors.not_found("Project"));
            return;
        }

        try {
            const members = await getMembers(req.project.id);
            next({
                type: "success",
                statusCode: 200,
                data: members,
            });
        } catch (e) {
            next(errors.database(e));
            return;
        }
    });

    projectsApp.post("/:project/members", json({
        limit: "1kb",
    }), async (req, res, next) => {
        if (req.project == null) {
            next(errors.not_found("Project"));
            return;
        }

        const checker = dict({
            username: str,
            //mod: bool,
            make_branches: bool,
            make_tags: bool,
            delete_tags: bool,
            make_subprojects: bool,
        });
        if (!checker(req.body)) {
            next(errors.invalid_request());
            return;
        }

        var us: User;
        try {
            const usr = await getUser(req.body.username);
            if (usr === null) {
                next(errors.not_found("User"));
                return;
            }
            us = usr;
        } catch (e) {
            next(errors.database(e));
            return;
        }

        try {
            await run(INSERT_PROJECT_MEMBER_SQL, req.project.id, us.id, /* req.body.mod */false, req.body.make_branches, req.body.make_tags, req.body.delete_tags, req.body.make_subprojects);
            next({
                type: "success",
                statusCode: 200,
            });
            return;
        } catch (e) {
            if (e.code === "SQLITE_CONSTRAINT") {
                next(errors.already_exists("Member"));
                return;
            } else {
                next(errors.database(e));
                return;
            }
        }
    });

    projectsApp.put("/:project/members/:user", json({
        limit: "1kb",
    }), async (req, res, next) => {
        if (req.project == null) {
            next(errors.not_found("Project"));
            return;
        }

        const checker = dict({
            //mod: bool,
            make_branches: bool,
            make_tags: bool,
            delete_tags: bool,
            make_subprojects: bool,
        });
        if (!checker(req.body)) {
            next(errors.invalid_request());
            return;
        }

        var us: User;
        try {
            const usr = await getUser(req.params.user);
            if (usr == null) {
                next(errors.not_found("User"));
                return;
            } else {
                us = usr;
            }
        } catch (e) {
            next(errors.database(e));
            return;
        }

        try {
            const rr = await run(UPDATE_PROJECT_MEMBER_SQL, /* req.body.mod */false, req.body.make_branches, req.body.make_tags, req.body.delete_tags, req.body.make_subprojects, req.project.id, us.id);
            if (rr.changes == 0) {
                next(errors.not_found("Member"));
                return;
            }
            next({
                type: "success",
                statusCode: 200,
            });
            return;
        } catch (e) {
            next(errors.database(e));
            return;
        }
    });

    projectsApp.delete("/:project/members/:user", async (req, res, next) => {
        if (req.project == null) {
            next(errors.not_found("Project"));
            return;
        }

        if (req.project.owner !== req.user_session?.id) {
            next(errors.forbidden());
            return;
        }

        try {
            await run(TRANSFER_PROJECT_MEMBER_BRANCHES_SQL, req.project.owner, req.project.id, req.params.user);
            await run(DELETE_PROJECT_MEMBER_SQL, req.project.id, req.params.user);
            next({
                type: "success",
                statusCode: 200,
            });
            return;
        } catch (e) {
            next(errors.database(e));
            return;
        }
    });

    projectsApp.get("/:project/branches", async (req, res, next) => {
        if (req.project == null) {
            next(errors.not_found("Project"));
            return;
        }

        try {
            //TODO: the user must have read access to each branch
            const branches: {branch_name: string, username: string, branch_permission: number}[] = await all(GET_PROJECT_BRANCHES_SQL, req.project.id);
            const result: {[key: string]: {
                name: string,
                default_permission: permissions,
                owner: string;
                users: {
                    username: string;
                    writable: boolean;
                }[],
            }} = {};
            branches.forEach(x => {
                if (result[x.branch_name] == null) {
                    result[x.branch_name] = {
                        name: x.branch_name,
                        default_permission: "WRITE",
                        owner: "",
                        users: [],
                    };
                }

                if (x.branch_permission > 1) {
                    result[x.branch_name].default_permission = branchPermToText(x.branch_permission - 2);
                    result[x.branch_name].owner = x.username;
                    x.branch_permission = 1;
                }
                result[x.branch_name].users.push({
                    username: x.username,
                    writable: x.branch_permission == 1,
                });
            });
            next({
                type: "success",
                statusCode: 200,
                data: result,
            });
            return;
        } catch (e) {
            next(errors.database(e));
            return;
        }
    });

    projectsApp.put("/:project/branches/:branch/permission", json({
        limit: "1kb",
        strict: false,
    }), async (req, res, next) => {
        if (req.project == null) {
            next(errors.not_found("Project"));
            return;
        }
        if (!permissions(req.body)) {
            next(errors.invalid_request());
            return;
        }

        if (req.project.owner != req.user_session?.id && (await getOwnedBranches(req.project.id, req.user_session?.id || -1, [req.params.branch])).length == 0) {
            next(errors.forbidden());
            return;
        }

        const target = textToBranchPerm(req.body);

        try {
            const branches = await run(UPDATE_BRANCH_PERMISSION_SQL, target, req.project.id, req.params.branch);
            if (branches.changes == 0) {
                next(errors.not_found("Branch"));
                return;
            } else {
                next({
                    type: "success",
                    statusCode: 200,
                });
                return;
            }
        } catch (e) {
            next(errors.database(e));
            return;
        }
    });

    projectsApp.put("/:project/branches/:branch/owner", json({
        limit: "1kb",
        strict: false,
    }), async (req, res, next) => {
        if (req.project == null) {
            next(errors.not_found("Project"));
            return;
        }

        if (!str(req.body)) {
            next(errors.invalid_request());
            return;
        }

        if (req.project.owner != req.user_session?.id && (await getOwnedBranches(req.project.id, req.user_session?.id || -1, [req.params.branch])).length == 0) {
            next(errors.forbidden());
            return;
        }

        try {
            const branches = await run(UPDATE_BRANCH_CREATOR_SQL, req.body, req.project.id, req.params.branch);
            if (branches.changes == 0) {
                next(errors.not_found("Branch"));
                return;
            } else {
                next({
                    type: "success",
                    statusCode: 200,
                });
                return;
            }
        } catch (e) {
            next(errors.database(e));
            return;
        }
    });

    projectsApp.post("/:project/branches/:branch/members", json({
        limit: "1kb",
        strict: false,
    }), async (req, res, next) => {
        if (req.project == null) {
            next(errors.not_found("Project"));
            return;
        }

        const checker = dict({
            writable: bool,
            username: str,
        });
        if (!checker(req.body)) {
            next(errors.invalid_request());
            return;
        }

        var us: User;
        try {
            const usr = await getUser(req.body.username);
            if (usr == null) {
                next(errors.not_found("User"));
                return;
            } else {
                us = usr;
            }
        } catch (e) {
            next(errors.database(e));
            return;
        }

        try {
            if (!canReadProject(req.project.id, us.id)) {
                next(errors.invalid_request());
                return;
            }
        } catch (e) {
            next(errors.database(e));
            return;
        }

        try {
            const branches: {user_id: number}[] = await all(CAN_CHANGE_BRANCH_SQL, req.project.id, req.params.branch);
            if (branches.length == 0) {
                next(errors.not_found("Branch"));
                return;
            } else if (branches[0].user_id != req.user_session?.id) {
                next(errors.forbidden());
                return;
            }
        } catch (e) {
            next(errors.database(e));
            return;
        }

        try {
            await run(INSERT_PROJECT_BRANCH_MEMBER_SQL, req.project.id, req.params.branch, us.id, req.body.writable);
            
            next({
                type: "success",
                statusCode: 200,
            });
            return;
        } catch (e) {
            if (e.code === "SQLITE_CONSTRAINT") {
                next(errors.already_exists("Member"));
                return;
            }
            next(errors.database(e));
            return;
        }
    });

    projectsApp.put("/:project/branches/:branch/member/:user", json({
        limit: "1kb",
        strict: false,
    }), async (req, res, next) => {
        if (req.project == null) {
            next(errors.not_found("Project"));
            return;
        }

        if (!bool(req.body)) {
            next(errors.invalid_request());
            return;
        }

        try {
            const branches: {user_id: number}[] = await all(CAN_CHANGE_BRANCH_SQL, req.project.id, req.params.branch);
            if (branches.length == 0) {
                next(errors.not_found("Branch"));
                return;
            } else if (branches[0].user_id != req.user_session?.id) {
                next(errors.forbidden());
                return;
            }
        } catch (e) {
            next(errors.database(e));
            return;
        }

        try {
            const result = await run(UPDATE_BRANCH_MEMBER_SQL, req.body, req.project.id, req.params.branch, req.params.user);
            
            if (result.changes == 0) {
                next(errors.not_found("Member"));
                return;
            } else {
                next({
                    type: "success",
                    statusCode: 200,
                });
                return;
            }
        } catch (e) {
            next(errors.database(e));
            return;
        }
    });

    projectsApp.delete("/:project/branches/:branch/member/:user", json({
        limit: "1kb",
        strict: false,
    }), async (req, res, next) => {
        if (req.project == null) {
            next(errors.not_found("Project"));
            return;
        }

        try {
            const branches: {user_id: number}[] = await all(CAN_CHANGE_BRANCH_SQL, req.project.id, req.params.branch);
            if (branches.length == 0) {
                next(errors.not_found("Branch"));
                return;
            } else if (branches[0].user_id != req.user_session?.id) {
                next(errors.forbidden());
                return;
            }
        } catch (e) {
            next(errors.database(e));
            return;
        }

        try {
            const result = await run(DELETE_BRANCH_MEMBER_SQL, req.project.id, req.params.branch, req.params.user);
            
            if (result.changes == 0) {
                next(errors.not_found("Member"));
                return;
            } else {
                next({
                    type: "success",
                    statusCode: 200,
                });
                return;
            }
        } catch (e) {
            next(errors.database(e));
            return;
        }
    });

    projectsApp.get("/:project/src/:ref/*", async (req, res, next) => {
        if (req.project == null) {
            next(errors.not_found("Project"));
            return;
        }

        //TODO: check for read permissions
        

        const target = req.params[0];

        var repo: git.Repository;
        try {
            repo = await git.Repository.openBare("repo/" + req.project.id + ".git");
        } catch (e) {
            next(errors.database(e));
            return;
        }

        var com: git.Commit;
        try {
            com = await repo.getReferenceCommit(req.params.ref);
        } catch (e) {
            next(errors.not_found("Reference"));
            return;
        }

        var file: Tree | Blob | null = null;
        if (target === "") {
            file = await com.getTree();
        } else {
            try {
                const entry = await com.getEntry(target);
                if (entry.isBlob()) {
                    file = await entry.getBlob();
                } else if (entry.isTree()) {
                    file = await entry.getTree();
                }
            } catch (e) {
                file = null;
            }
        }
        if (file instanceof Tree) {
            const trees = file.entries();
            res.setHeader("Content-type", "text/directory");
            res.status(200);
            res.send(trees.map(x => x.filemode().toString(8) + " " + (x.isFile() ? "blob" : x.isTree() ? "tree" : "unknown") + " " + x.name()).join("\r\n"));
        } else if (file instanceof Blob) {
            res.setHeader("Content-type", mime.lookup(target) || "application/octet-stream");
            res.status(200);
            res.send(file.content());
        } else {
            next(errors.not_found("File"));
        }
    });

    projectsApp.get("/:project/res/:ref/:resource", async (req, res, next) => {
        if (req.project == null) {
            next(errors.not_found("Project"));
            return;
        }

        //TODO: completely fix this
        const refs = await fs.promises.readdir("resources/" + req.project.id);
        const ref = refs.find(x => x === req.params.ref);
        if (ref == null) {
            next(errors.not_found("Reference"));
            return;
        }

        const resource = await fs.promises.readdir("resources/" + req.project.id + "/" + ref);
        const resr = resource.find(x => x === req.params.resource);

        if (resr == null) {
            next(errors.not_found("Resource"));
            return;
        }

        res.sendFile(path.resolve("resources/" + req.project.id + "/" + ref + "/" + resr));
    });

    projectsApp.use("/:project/sub/", (req, res, next) => {
        return projectsApp(req, res, next);
    });

    app.use("/projects", projectsApp);

    return currentVersion;
}
