import { run } from "database";
import { Express } from "express";

const CREATE_TABLES = [
[
`CREATE TABLE "blobs" (
    "id" BLOB(20) NOT NULL,
    "project_id" INTEGER NOT NULL,
    "data" BLOB NOT NULL,

    PRIMARY KEY ("id", "project_id"),
    FOREIGN KEY ("project_id") REFERENCES "projects"("id")
)`,
`CREATE TABLE "trees" (
    "id" BLOB(20) NOT NULL,
    "project_id" INTEGER NOT NULL,

    PRIMARY KEY ("id", "project_id"),
    FOREIGN KEY ("project_id") REFERENCES "projects"("id")
)`,
`CREATE TABLE "tree_blobs" (
    "tree_id" BLOB(20) NOT NULL,
    "project_id" INTEGER NOT NULL,

    "file_mode" INTEGER NOT NULL,
    "name" VARCHAR(65535) NOT NULL,
    "child_id" BLOB(20) NOT NULL,

    PRIMARY KEY ("tree_id", "project_id"),
    UNIQUE KEY ("tree_id", "project_id", "name"),
    FOREIGN KEY ("tree_id", "project_id") REFERENCES "trees"("id", "project_id"),
    FOREIGN KEY ("child_id", "project_id") REFERENCES "blobs"("id", "project_id")
)`,
`CREATE TABLE "tree_trees" (
    "tree_id" BLOB(20) NOT NULL,
    "project_id" INTEGER NOT NULL,

    "file_mode" INTEGER NOT NULL,
    "name" VARCHAR(65535) NOT NULL,
    "child_id" BLOB(20) NOT NULL,

    PRIMARY KEY ("tree_id", "project_id"),
    UNIQUE KEY ("tree_id", "project_id", "name"),
    FOREIGN KEY ("tree_id", "project_id") REFERENCES "trees"("id", "project_id"),
    FOREIGN KEY ("child_id", "project_id") REFERENCES "trees"("id", "project_id")
)`,
`CREATE TABLE "commits" (
    "id" BLOB(20) NOT NULL,
    "project_id" INTEGER NOT NULL,
    "tree_id" BLOB(20) NOT NULL,

    "author_name" VARCHAR(255) NOT NULL,
    "author_email" VARCHAR(255) NOT NULL,
    "author_time" VARCHAR(255) NOT NULL,
    "author_id" INTEGER NULL,

    "committer_name" VARCHAR(255) NOT NULL,
    "committer_email" VARCHAR(255) NOT NULL,
    "committer_time" VARCHAR(255) NOT NULL,
    "committer_id" INTEGER NULL,

    "gpgsig" BLOB NULL,
    "gpgsigner_id" INTEGER NULL,

    "push_id" INTEGER NOT NULL,

    "message" VARCHAR(65536) NOT NULL,

    PRIMARY KEY ("id", "project_id"),
    FOREIGN KEY ("project_id") REFERENCES "projects"("id"),
    FOREIGN KEY ("tree_id", "project_id") REFERENCES "trees"("id", "project_id"),
    FOREIGN KEY ("author_id") REFERENCES "users"("id"),
    FOREIGN KEY ("committer_id") REFERENCES "users"("id"),
    FOREIGN KEY ("gpgsigner_id") REFERENCES "users"("id"),
    FOREIGN KEY ("push_id") REFERENCES "pushes"("id")
)`,
`CREATE TABLE "commit_parents" (
    "commit_id" BLOB(20) NOT NULL,
    "project_id" INTEGER NOT NULL,
    "parent_id" BLOB(20) NOT NULL,

    PRIMARY KEY ("commit_id", "project_id", "parent_id"),
    FOREIGN KEY ("commit_id", "project_id") REFERENCES "commits"("id", "project_id"),
    FOREIGN KEY ("parent_id", "project_id") REFERENCES "commits"("id", "project_id")
)`,
`CREATE TABLE "annotated_tags" (
    "id" BLOB(20) NOT NULL,
    "project_id" INTEGER NOT NULL,
    "object_id" BLOB(20) NOT NULL,

    "tagger_name" VARCHAR(255) NOT NULL,
    "tagger_email" VARCHAR(255) NOT NULL,
    "tagger_time" VARCHAR(255) NOT NULL,
    "tagger_id" INTEGER NULL,

    "message" VARCHAR(65535) NOT NULL,

    PRIMARY KEY ("id", "project_id"),
    FOREIGN KEY ("project_id") REFERENCES "projects"("id"),
    FOREIGN KEY ("tagger_id") REFERENCES "users"("id")
)`, //TODO: think about how to apply a foreign key to the object_id
`CREATE TABLE "tags" (
    "name" VARCHAR(65535) NOT NULL,
    "project_id" INTEGER NOT NULL,
    "object_id" BLOB(20) NOT NULL,

    "push_id" INTEGER NOT NULL,

    "message" VARCHAR(65535) NOT NULL,

    PRIMARY KEY ("name", "project_id"),
    FOREIGN KEY ("project_id") REFERENCES "projects"("id"),
    FOREIGN KEY ("push_id") REFERENCES "pushes"("id")
)`, //TODO: think about how to apply a foreign key to the object id
]
];

export default async function Repository(app: Express, currentVersion: number): Promise<number> {
    while (currentVersion != CREATE_TABLES.length) {
        for (var i = 0; i < CREATE_TABLES[currentVersion].length; i++) {
            console.log("Running Repository v" + currentVersion + " script " + i);
            await run(CREATE_TABLES[currentVersion][i]);
        }
        currentVersion++;
    }

    return currentVersion;
}