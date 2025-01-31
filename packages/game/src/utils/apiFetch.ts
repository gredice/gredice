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

    console.log('window.location.hostname', window.location.hostname, typeof input, `http://localhost:3005${input}`);
    if (window.location.hostname === 'localhost') {
        if (typeof input === 'string') {
            input = `http://localhost:3005${input}`;
        } else if (input instanceof URL) {
            input = new URL(`http://localhost:3005${input.pathname}`, input);
        } else {
            input = new globalThis.Request(
                `http://localhost:3005${input.url}`,
                input,
            );
        }
    }
    else if (window.location.hostname === 'gredice.com') {
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