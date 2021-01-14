import express, { ErrorRequestHandler } from 'express';
import expressWs from 'express-ws';
import { sshServer } from 'sshserver';
import Users, { session } from 'controllers/users';
import Projects from 'controllers/projects';
import { prepareDb, db } from 'database';
import process from 'process';
import http from 'http';
import https from 'https';
import cookieSession from 'cookie-session';
import crypto from 'crypto';
import path from 'path';
import ssh2 from 'ssh2';
import { httpHost, httpPort, httpsPort, sshHost, sshPort } from 'ports';

const app = express();
var ssh: ssh2.Server | null;
var server1: http.Server | null = null;
var server2: https.Server | null = null;

const secret = crypto.randomBytes(32);

//Still TODO:
// * Frontend
// * Command line arguments
// * Host frontend
// * Delete a project
// * View source code through REST api
// * Search users by name
// * Search projects by name
// * Create and view tags

async function start() {
    var api = express();
    var ws = expressWs(api);
    api.use(cookieSession({
        name: "sessionid",
        secret: secret.toString("hex"),
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: true,
        httpOnly: true,
    }));

    api.use(session);
    api.use(function(req, res, next) {
        next();
        if (req.session?.longSession) {
            req.sessionOptions.maxAge = 24 * 60 * 60 * 1000 * 30;
        }
    });
    api.use(function(req, res, next) {
        res.setHeader("Content-type", "application/json");
        next();
    });

    const modules = {
        "users": Users,
        "projects": Projects,
    };

    await prepareDb(api, modules);

    api.use(<ErrorRequestHandler> function(err, req, res, next) {
        try {
            if (err != null) {
                res.status(err.statusCode);
                res.end(JSON.stringify(err));
            } else {
                res.status(404);
                res.end(JSON.stringify({
                    type: "bad_endpoint",
                    message: "Unknown API endpoint was called",
                }));
            }
        } catch (e) {
            res.status(500);
            res.end(JSON.stringify({
                type: "error",
                message: "Website error",
            }));
        }
    });
    api.use(function (req, res, next) {
        res.status(404);
        res.end(JSON.stringify({
            type: "bad_endpoint",
            message: "Unknown API endpoint was called",
        }));
    });

    app.use("/api", api);
    app.use("/index.js", express.static("../frontend/dist/index.js"));
    app.use("/index.js.map", express.static("../frontend/dist/index.js.map"));
    app.use("/main.css", express.static("../frontend/dist/main.css"));
    app.use("/styles.css", express.static("../frontend/dist/styles.css"));
    app.use("/styles.css.map", express.static("../frontend/dist/styles.css.map"));
    app.use("/css", express.static("../frontend/dist/css"));
    app.use("/webfonts", express.static("../frontend/dist/webfonts"));
    app.use("/", (req, res, next) => {
        res.sendFile(path.resolve("../frontend/dist/main.html"))
    });

    if (httpPort as number != 0) {
        server1 = http.createServer(app).listen(httpPort, httpHost);
        console.log("Launched HTTP");
    }
    if (httpsPort as number != 0) {
        //server2 = https.createServer({
        //    //
        //}, app).listen(httpsPort, httpsHost);
    }

    if (sshPort as number != 0) {
        ssh = await sshServer(sshHost, sshPort);
        console.log("Launched SSH");
    }
}

start().then(() => {
    const close = () => {
        if (server1 != null) {
            server1.close();
            server1.unref();
            server1 = null;
        }
        if (server2 != null) {
            server2.close();
            server2.unref();
            server2 = null;
        }
        if (ssh != null) {
            ssh.close();
            ssh.unref();
            ssh = null;
        }
        db.close();
        console.log("Stopped");
        removeSignals();
    };
    const sigInt = () => {
        console.log('Received SIGINT, stopping server');
        close();
    }
    const sigTerm = () => {
        console.log('Received SIGTERM, stopping server');
        close();
    }
    const removeSignals = () => {
        process.removeListener('SIGINT', sigInt);
        process.removeListener('SIGTERM', sigTerm);
    };
    process.on('SIGINT', sigInt);
    process.on('SIGTERM', sigTerm);
}, error => {
    throw error;
});