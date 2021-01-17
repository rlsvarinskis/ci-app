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
import { httpHost, httpPort, sshHost, sshPort } from 'ports';
import { errors } from 'errors';

const app = express();
var ssh: ssh2.Server | null;
var server1: http.Server | null = null;
var server2: https.Server | null = null;

//Generate a secret key to be used for encrypting and decrypting cookies
const secret = crypto.randomBytes(32);

async function start() {
    if (httpPort as number != 0) {
        server1 = http.createServer(app).listen(httpPort, httpHost);
        expressWs(app, server1);
        console.log("Launched HTTP");
    }

    //Set up express-js
    var api = express();
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
    //All responses will be in application/json unless otherwise stated
    api.use(function(req, res, next) {
        res.setHeader("Content-type", "application/json");
        next();
    });

    //The following code prepares some of the modules used by the system. The CI module will be prepared by the Projects module.
    const modules = {
        "users": Users,
        "projects": Projects,
    };
    await prepareDb(api, modules);

    //After all routes have been tried, check if some have responded.
    //The response is stored in "err", because usually express-js handles errors by passing them to next().
    //This code passes successful responses to next() too.
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
            res.end(errors.database(e));
        }
    });
    api.use(function (req, res, next) {
        res.status(404);
        res.end(JSON.stringify({
            type: "bad_endpoint",
            message: "Unknown API endpoint was called",
        }));
    });

    //Store the entire backend under /api, but route all other valid files to the files stored in ./frontend.
    app.use("/api", api);
    app.use("/index.js", express.static("frontend/index.js"));
    app.use("/index.js.map", express.static("frontend/index.js.map"));
    app.use("/main.css", express.static("frontend/main.css"));
    app.use("/styles.css", express.static("frontend/styles.css"));
    app.use("/styles.css.map", express.static("frontend/styles.css.map"));
    app.use("/css", express.static("frontend/css"));
    app.use("/webfonts", express.static("frontend/webfonts"));
    app.use("/", (req, res, next) => {
        res.sendFile(path.resolve("frontend/main.html"))
    });

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

    //Listen for SIGINT or SIGTERM and close the program when they are received.
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