import { findProject, notGitRepo } from "git_receive_pack";
import { canReadProject, getNonReadBranches } from "controllers/projects";
import { ServerChannel } from "ssh2";
import cp from 'child_process';
import path from 'path';

export async function run(userId: number | null, project: string, env: {[key: string]: string}, channel: ServerChannel) {
    const p = await findProject(project);
    if (p == null) {
        return notGitRepo(project, channel);
    }
    if (p.private && userId == null) {
        return notGitRepo(project, channel);
    }

    if (userId !== p.owner && !canReadProject(p.id, userId)) {
        return notGitRepo(project, channel);
    }

    const hiddenRefs = (await getNonReadBranches(p.id, userId)).flatMap(x => ["-c", "uploadpack.hideRefs=refs/heads/" + x]);

    return await new Promise<void>(resolve => {
        const process = cp.spawn("git", [...hiddenRefs, "-c", "uploadpack.allowFilter", "upload-pack", path.resolve("repo", p.id + ".git")], {
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
            resolve();
        });
        process.on("close", (code) => {
            channel.exit(code);
            resolve();
        });
    });
}