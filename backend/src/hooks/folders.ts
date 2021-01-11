import path from 'path';

export function TagFolder(outputDir: string) {
    return path.join(outputDir, "tags");
}

export function BranchFolder(outputDir: string) {
    return path.join(outputDir, "branches");
}

export function UserIdFile(home: string) {
    return path.join(home, "user_id");
}

export function ProjectIdFile(home: string) {
    return path.join(home, "project_id");
}

export function PushIdFile(home: string) {
    return path.join(home, "push_id");
}

export function RemoteRepoFile(home: string) {
    return path.join(home, "remote_repo");
}

export function OutputDirFile(home: string) {
    return path.join(home, "output_dir");
}

export function DatabaseFile(home: string) {
    return path.join(home, "database.db");
}

export function PushFolder(projectId: number, pushId: number) {
    return path.resolve("resources", projectId.toString(), pushId.toString());
}