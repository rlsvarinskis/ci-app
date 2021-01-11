import crypto from 'crypto';
import { str, TypeChecker } from 'type-builder';

export function randomBytes(length: number): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
        crypto.randomBytes(length, (err, buf) => {
            if (err != null) {
                reject(err);
            } else {
                resolve(buf);
            }
        });
    });
}

export const alphanumeric: TypeChecker<string> = <TypeChecker<string>> (function(data: any): data is string {
    if (typeof data !== 'string') {
        return false;
    }
    for (var i = 0; i < data.length; i++) {
        var code = data.charCodeAt(i);
        if (!(code > 47 && code < 58) && // numeric (0-9)
            !(code > 64 && code < 91) && // upper alpha (A-Z)
            !(code > 96 && code < 123) && // lower alpha (a-z)
            !(i > 0 && (data[i] === '-' || data[i] === '_'))) {
            return false;
        }
    }
    return true;
});

export function lengthStr(min: number, max?: number) {
    return <TypeChecker<string>> function(data: any): data is string {
        return str(data) && data.length >= min && (max == null || data.length <= max);
    };
}

const B64Reg = /[A-Za-z0-9+/]+[=]*/;
export function base64(min: number, max?: number) {
    return <TypeChecker<string>> function(data: any): data is string {
        if (!str(data)) {
            return false;
        }
        B64Reg.lastIndex = 0;
        const res = B64Reg.exec(data);
        return res != null && res[0].length == data.length;
    };
}

export const email = <TypeChecker<string>> function(data: any): data is string {
    return str(data) && data.includes("@") && data.indexOf("@") == data.lastIndexOf("@");
}