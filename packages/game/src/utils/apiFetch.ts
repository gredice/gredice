export function apiFetch(
    input: string | URL | globalThis.Request,
    init?: RequestInit,
): Promise<Response> {
    const token = localStorage.getItem('gredice-token');

    if (token) {
        if (!init) {
            init = {};
        }
        if (!init.headers) {
            init.headers = {};
        }
        (init.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    if (window.location.hostname === 'localhost') {
        if (typeof input === 'string') {
            input = `${window.location.protocol}//localhost:3005${input}`;
        } else if (input instanceof URL) {
            input = new URL(`${window.location.protocol}//localhost:3005${input.pathname}`, input);
        } else {
            input = new globalThis.Request(
                `${window.location.protocol}//localhost:3005${input.url}`,
                input,
            );
        }
    } else {
        if (typeof input === 'string') {
            input = `https://api.gredice.com${input}`;
        } else if (input instanceof URL) {
            input = new URL(`https://api.gredice.com${input.pathname}`, input);
        } else {
            input = new globalThis.Request(
                `https://api.gredice.com${input.url}`,
                input,
            );
        }
    }

    return fetch(input, init);
}