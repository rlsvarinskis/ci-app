export function request(method: string, url: string, body?: any) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, url);
}