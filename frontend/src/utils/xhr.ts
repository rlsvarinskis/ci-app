export interface SuccessfulResponse<T> {
    type: "success";
    code: number;
    data: T;
};

export interface FailedResponse {
    type: "failed";
    code: number;
    result: string;
    message: string;
};

export interface ErrorResponse {
    type: "error";
    error: any;
};

export interface BadResponse {
    type: "bad";
    error: any;
};

export type FailResponses = FailedResponse | ErrorResponse | BadResponse;
export type Response<T> = SuccessfulResponse<T> | FailResponses;

export interface FileResponse {
    mimeType: string;
    data: Blob;
};

export async function load(method: string, url: string, body?: any, headers?: {[key: string]: string}) {
    return new Promise<Response<FileResponse>>(resolve => {
        var xhr = new XMLHttpRequest();
        xhr.open(method, url);
        if (headers != null) {
            for (let key in headers) {
                xhr.setRequestHeader(key, headers[key]);
            }
        }
        xhr.responseType = "blob";
        xhr.onreadystatechange = function(evt) {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve({
                        type: "success",
                        code: xhr.status,
                        data: {
                            mimeType: xhr.getResponseHeader("Content-type") || "*/*",
                            data: xhr.response
                        }
                    });
                } else {
                    (<Blob>xhr.response).text().then(res => {
                        try {
                            const dat = JSON.parse(res);
                            resolve({
                                type: "failed",
                                code: xhr.status,
                                result: dat.type,
                                message: dat.message
                            });
                        } catch (e) {
                            resolve({
                                type: "bad",
                                error: e
                            });
                        }
                    }, e => {
                        resolve({
                            type: "error",
                            error: e
                        });
                    });
                }
            }
        };
        xhr.send(body);
    });
}

export async function request<T>(method: string, url: string, body?: any, headers?: {[key: string]: string}) {
    return new Promise<Response<T>>(resolve => {
        var xhr = new XMLHttpRequest();
        xhr.open(method, url);
        if (headers != null) {
            for (let key in headers) {
                xhr.setRequestHeader(key, headers[key]);
            }
        }
        xhr.onreadystatechange = function(evt) {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                const res = xhr.responseText;
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const dat = JSON.parse(res);
                        resolve({
                            type: "success",
                            code: xhr.status,
                            data: dat.data
                        });
                    } catch (e) {
                        resolve({
                            type: "bad",
                            error: e
                        });
                    }
                } else {
                    try {
                        const dat = JSON.parse(res);
                        resolve({
                            type: "failed",
                            code: xhr.status,
                            result: dat.type,
                            message: dat.message
                        });
                    } catch (e) {
                        resolve({
                            type: "bad",
                            error: e
                        });
                    }
                }
            }
        };
        xhr.send(body);
    });
}

export async function post<T>(url: string, body: any) {
    return request<T>("POST", url, JSON.stringify(body), {"Content-type": "application/json"});
}

export async function put<T>(url: string, body: any) {
    return request<T>("PUT", url, JSON.stringify(body), {"Content-type": "application/json"});
}

export async function del<T>(url: string) {
    return request<T>("DELETE", url);
}
