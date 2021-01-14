import yargs from 'yargs/yargs';

const argv = yargs(process.argv.slice(2)).argv;
let targetHttpPort = 80;
if (Number.isInteger(argv['http-port'])) {
    targetHttpPort = <number> argv['http-port'];
}
let targetSshPort = 22;
if (Number.isInteger(argv['ssh-port'])) {
    targetSshPort = <number> argv['ssh-port'];
}

export const httpHost = "0.0.0.0";
export const httpPort = targetHttpPort;
export const httpsHost = "0.0.0.0";
export const httpsPort = 443;
export const sshHost = "0.0.0.0";
export const sshPort = targetSshPort;