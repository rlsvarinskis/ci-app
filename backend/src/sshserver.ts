import { Server } from 'ssh2';
import { findSSHKey } from 'controllers/users';
import fs from 'fs';
import { performance } from 'perf_hooks';
import stringArgv from 'string-argv';
import * as upload_pack from 'git_upload_pack';
import * as receive_pack from 'git_receive_pack';

var bestTime = 1;

function sleep(time: number) {
    return new Promise<void>((resolve, reject) => {
        setTimeout(() => {
            resolve();
        }, time);
    });
}

function handleGitUploadPack(userId: number) {

}

var sessions = 0;

export async function sshServer(sshHost: string, sshPort: number) {
    if (sshPort == 0) {
        return null;
    }
    var key = await fs.promises.readFile("./key");
    var server = new Server({
        hostKeys: [{
            key: key,
        }],
        ident: "ci-app-ssh-server",
    }, (client, info) => {
        var userId: number | null = null;
        const sId = sessions++;
        let wasLastPK = false;
        var ss = 0;
        console.info("[SSH] New client " + sId);
        client.on('authentication', async context => {
            if (context.username !== "git") {
            //    context.reject();
            //    console.warn("[SSH][" + sId + "] Bad username: " + context.username);
            //    return;
            }

            switch (context.method) {
                case "publickey":
                    wasLastPK = true;
                    try {
                        const startTime = performance.now();
                        userId = await findSSHKey(context.key.algo, context.key.data);
                        var reject = userId == null;
                        console.info("[SSH][" + sId + "] Found user of SSH key: " + userId);
                        const totalTime = performance.now() - startTime;
                        console.info("[SSH][" + sId + "] Took " + totalTime + " ms");
                        while (totalTime > bestTime) {
                            bestTime += 1;
                        }
                        await sleep(bestTime - totalTime);
                        if (reject) {
                            context.reject();
                        } else {
                            context.accept();
                        }
                    } catch (e) {
                        console.warn("Database error", e);
                        context.reject();
                    }
                    break;
                default:
                    if (wasLastPK) {
                        context.accept();
                    }
                    console.warn("[SSH][" + sId + "] Bad authentication method: " + context.method);
                    context.reject();
                    break;
            }
        });
        client.on('session', (a, r) => {
            const ssId = ss++;
            console.info("[SSH][" + sId + "] Establishing session " + ssId);
            //if (userId == null) {
            //    console.warn("[SSH][" + sId + "][" + ssId + "] Attempt to establish session despite failed authentication");
            //    r();
            //    return;
            //}
            //const uid = userId;
            const session = a();
            const setEnv: {[key: string]: string} = {};
            session.on("exec", (a, r, i) => {
                const cmd = stringArgv(i.command);
                if (cmd.length !== 2) {
                    if (r == null) {
                        console.warn("[SSH][" + sId + "][" + ssId + "] Reject function is null!");
                    } else {
                        r();
                    }
                } else {
                    switch (cmd[0].toLowerCase()) {
                        case "git-upload-pack":
                            console.info("[SSH][" + sId + "][" + ssId + "] Running upload-pack on " + cmd[1]);
                            upload_pack.run(userId, cmd[1], setEnv, a()).catch(e => {
                                console.error(e);
                                //TODO:
                            });
                            break;
                        case "git-receive-pack":
                            console.info("[SSH][" + sId + "][" + ssId + "] Running receive-pack on " + cmd[1]);
                            receive_pack.run(userId, cmd[1], setEnv, a()).catch(e => {
                                console.error(e);
                                //TODO:
                            });
                            break;
                        default:
                            if (r == null) {
                                console.warn("[SSH][" + sId + "][" + ssId + "] Reject function is null!");
                            } else {
                                r();
                            }
                            console.warn("[SSH][" + sId + "][" + ssId + "] Invalid program: " + cmd[0]);
                            client.end();
                            break;
                    }
                }
            });
            session.on("env", (a, r, i) => {
                switch (i.key.toUpperCase()) {
                    case "HOME":
                    case "GIT_DIR":
                        console.warn("[SSH][" + sId + "][" + ssId + "] Ignoring env \"" + i.key + "\": \"" + i.value + "\"");
                        if (r != null) {
                            r();
                        } else {
                            console.warn("[SSH][" + sId + "][" + ssId + "] Reject function is null!");
                        }
                        break;
                    default:
                        console.info("[SSH][" + sId + "][" + ssId + "] env \"" + i.key + "\": \"" + i.value + "\"");
                        setEnv[i.key] = i.value;
                        if (a != null) {
                            a();
                        } else {
                            console.warn("[SSH][" + sId + "][" + ssId + "] Accept function is null!");
                        }
                        break;
                }
            });
            session.on('close', () => {
                console.info("[SSH][" + sId + "][" + ssId + "] Session closed");
            });
        });
        client.on("end", () => {
            console.info("[SSH][" + sId + "] Client ended");
            //Lost connection
        });
        client.on("close", () => {
            console.info("[SSH][" + sId + "] Client closed");
            //Client closed connection
        });
    }).listen(sshPort, sshHost, () => {
        console.log("SSH server is listening on " + sshPort)
    });
    return server;
}