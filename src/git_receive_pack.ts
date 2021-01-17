import { ServerChannel } from "ssh2";
import * as cp from "child_process";
import { Project, getProject, isValidRepositoryName, isProjectMember, createPush } from "controllers/projects";
import fs from 'fs';
import path from 'path';
import { BranchFolder, ProjectIdFile, PushIdFile, RemoteRepoFile, TagFolder, UserIdFile, OutputDirFile, DatabaseFile, PushFolder } from "hooks/folders";
import { start } from 'hooks/post-receive';

//This function turns a hierarchical project name into the ID of the project. The project ID is used to store the project.
export async function findProject(project: string) {
    //Both relative and absolute paths refer to the same folder.
    if (project[0] === '/') {
        project = project.substring(1);
    }
    const paths = project.split("/");
    //All parts of the path must be valid repository names.
    if (paths.some(x => !isValidRepositoryName(x))) {
        return null;
    }
    var p: Project = {
        id: 0,
        parent: 0,
        owner: 0,
        name: "",
        description: "",
        private: false,
        default_branch_permissions: "NONE",
    };
    for (let i = 0; i < paths.length; i++) {
        const newProject = await getProject(paths[i], p.id);
        if (newProject == null) {
            return null;
        }
        p = newProject;
    }
    return p;
}

export function notGitRepo(project: string, channel: ServerChannel) {
    channel.stderr.write("fatal: '" + project + "' does not appear to be a git repository\n");
    channel.stderr.end();
    channel.stdout.end();
    channel.stdin.end();
    channel.exit(128);
}

//Prepare a folder with information about the push, who is doing it, etc.
async function prepareHookDir(userId: number, projectId: number, pushId: number, remoteRepo: string, outputDir: string, databaseFile: string) {
    const hook_dir = path.join("/tmp", "ci-app-push-" + pushId);
    await fs.promises.mkdir(hook_dir);
    await fs.promises.writeFile(UserIdFile(hook_dir), userId.toString());
    await fs.promises.writeFile(ProjectIdFile(hook_dir), projectId.toString());
    await fs.promises.writeFile(PushIdFile(hook_dir), pushId.toString());
    await fs.promises.writeFile(RemoteRepoFile(hook_dir), remoteRepo);
    await fs.promises.writeFile(OutputDirFile(hook_dir), outputDir);
    await fs.promises.writeFile(DatabaseFile(hook_dir), databaseFile);

    return hook_dir;
}

export async function run(userId: number | null, project: string, env: {[key: string]: string}, channel: ServerChannel) {
    if (userId == null) {
        return notGitRepo(project, channel);
    }
    const p = await findProject(project);
    if (p == null) {
        return notGitRepo(project, channel);
    }

    //Check if the user can read the project.
    if (userId !== p.owner && !isProjectMember(p.id, userId)) {
        return notGitRepo(project, channel);
    }

    console.log("Pushing...");
    const pushId = await createPush(userId, p.id, BigInt(Date.now()));
    console.log("Push id: " + pushId);
    const targetDir = path.resolve("repo", p.id + ".git");
    const outputDir = PushFolder(p.id, pushId);
    await fs.promises.mkdir(outputDir);
    const dbFile = path.resolve("database.db");
    env["HOME"] = await prepareHookDir(userId, p.id, pushId, targetDir, outputDir, dbFile);

    return await new Promise<void>(resolve => {
        const process = cp.spawn("git-receive-pack", [targetDir], {
            env: env
        });
    
        channel.stdin.pipe(process.stdin);
        process.stdout.pipe(channel.stdout);
        process.stderr.pipe(channel.stderr);
    
        process.on("error", (error) => {
            channel.stderr.write("fatal: could not spawn child process\n");
            channel.stderr.end();
            channel.stdout.end();
            channel.stdin.end();
            channel.exit(128);
            fs.rm(env["HOME"], {
                recursive: true
            }, (err) => {
                resolve();
            });
        });
        process.on("close", (code) => {
            channel.stderr.end();
            channel.stdout.end();
            channel.stdin.end();
            channel.exit(code);
            fs.rm(env["HOME"], {
                recursive: true
            }, (err) => {
                resolve();
            });
            start(p.id, pushId, outputDir).catch(e => {
                console.error(e);
            });
        });
    });
}