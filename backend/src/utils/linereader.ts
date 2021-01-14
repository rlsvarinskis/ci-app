import stream from 'stream';

const NEWLINE = 0x0a;

export default class LineReader {
    private input: stream.Readable;
    private buffer: Buffer[] = [];
    private lastBuffer: Buffer | null = null;

    constructor(input: stream.Readable) {
        this.input = input;
        this.input.pause();
    }

    private findNewline(): string | null {
        if (this.lastBuffer == null) {
            throw "Illegal state";
        }
        for (let i = 0; i < this.lastBuffer.length; i++) {
            if (this.lastBuffer[i] === NEWLINE) {
                const bufs = this.buffer.map(x => x.toString("utf8"));
                if (i > 0) {
                    bufs.push(this.lastBuffer.subarray(0, i).toString("utf8"));
                    if (i + 1 < this.lastBuffer.length) {
                        this.lastBuffer = this.lastBuffer.subarray(i + 1);
                    } else {
                        this.lastBuffer = null;
                    }
                }
                this.buffer = [];
                return bufs.join("");
            }
        }

        return null;
    }

    async readLine() {
        if (this.lastBuffer != null) {
            const res = this.findNewline();
            if (res != null) {
                return res;
            } else {
                this.buffer.push(this.lastBuffer);
                this.lastBuffer = null;
            }
        }
        if (!this.input.readable) {
            return null;
        }
        const p = new Promise<string | null>((resolve, reject) => {
            const readable = () => {
                this.lastBuffer = this.input.read();

                if (this.lastBuffer != null) {
                    const res = this.findNewline();
                    if (res != null) {
                        removeListeners();
                        resolve(res);
                    } else {
                        this.buffer.push(this.lastBuffer);
                        this.lastBuffer = null;
                    }
                }
            };
            const error = (err: Error) => {
                removeListeners();
                reject(err);
            };
            const end = () => {
                removeListeners();
                const result = this.buffer.map(x => x.toString("utf8")).join("");
                this.buffer = [];
                if (result.length === 0) {
                    resolve(null);
                } else {
                    resolve(result);
                }
            };

            const removeListeners = () => {
                this.input.removeListener("readable", readable);
                this.input.removeListener("error", error);
                this.input.removeListener("end", end);
                this.input.pause();
            };

            this.input.addListener("readable", readable);
            this.input.addListener("error", error);
            this.input.addListener("end", end);
            this.input.resume();
        });
        return await p;
    }
}