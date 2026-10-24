import { readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const imagePath = new URL(
    '../apps/www/public/assets/plants/placeholder.png',
    import.meta.url,
);
let imageBody;

export function isBlobHostname(hostname) {
    return (
        typeof hostname === 'string' &&
        hostname
            .toLowerCase()
            .replace(/\.$/, '')
            .endsWith('.blob.vercel-storage.com')
    );
}

export function isBlobUrl(value) {
    return isBlobHostname(new URL(value).hostname);
}

export function isCiEmojiUrl(value) {
    const url = new URL(value);
    return (
        url.hostname === 'cdn.jsdelivr.net' &&
        /^\/gh\/twitter\/twemoji@14\.0\.2\/assets\/svg\/[0-9a-f-]+\.svg$/i.test(
            url.pathname,
        )
    );
}

export function blobImageFixture(value, method = 'GET') {
    const url = new URL(value);
    if (!isBlobHostname(url.hostname) && url.hostname !== 'cdn.gredice.com') {
        throw new Error('Expected a Vercel Blob URL.');
    }
    if (
        !['GET', 'HEAD'].includes(method) ||
        (url.hostname !== 'cdn.gredice.com' &&
            !/\.(avif|gif|jpe?g|png|svg|webp)$/i.test(url.pathname))
    ) {
        throw new Error(
            `CI blocked an unmocked Blob request (${method}, ${url.hostname}). Add a local test fixture.`,
        );
    }
    imageBody ??= readFileSync(imagePath);
    return {
        status: 200,
        headers: {
            'content-type': 'image/png',
            'content-length': String(imageBody.length),
            'cache-control': 'public, max-age=3600',
            'access-control-allow-origin': '*',
        },
        body: method === 'HEAD' ? null : imageBody,
    };
}

export function createBlobFixtureFetch(fetch) {
    return async (input, init) => {
        const request =
            typeof input === 'object' && input !== null && 'url' in input
                ? input
                : null;
        const value = request ? request.url : String(input);
        let url;
        try {
            url = new URL(value);
        } catch {
            return fetch(input, init);
        }
        if (
            !isBlobHostname(url.hostname) &&
            url.hostname !== 'cdn.gredice.com'
        ) {
            if (
                process.env.GREDICE_CI_NETWORK_ISOLATION === '1' &&
                isCiEmojiUrl(url.href)
            ) {
                const method = (
                    init?.method ??
                    request?.method ??
                    'GET'
                ).toUpperCase();
                if (!['GET', 'HEAD'].includes(method))
                    throw new Error(
                        'CI emoji writes require a local test fixture.',
                    );
                return new Response(
                    method === 'HEAD'
                        ? null
                        : '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"><circle cx="18" cy="18" r="16" fill="#f4c542"/><circle cx="18" cy="18" r="8" fill="#6b4f2a"/></svg>',
                    { headers: { 'content-type': 'image/svg+xml' } },
                );
            }
            if (
                process.env.GREDICE_CI_NETWORK_ISOLATION === '1' &&
                ['www.gredice.com', 'vrt.gredice.com'].includes(url.hostname) &&
                url.pathname.startsWith('/assets/')
            ) {
                const app =
                    url.hostname === 'vrt.gredice.com' ? 'garden' : 'www';
                const root = resolve(
                    fileURLToPath(
                        new URL(`../apps/${app}/public/`, import.meta.url),
                    ),
                );
                const path = resolve(
                    root,
                    `.${decodeURIComponent(url.pathname)}`,
                );
                if (!path.startsWith(root + sep))
                    throw new Error('Invalid CI asset path.');
                const method = (
                    init?.method ??
                    request?.method ??
                    'GET'
                ).toUpperCase();
                if (!['GET', 'HEAD'].includes(method))
                    throw new Error(
                        'CI asset writes require a local test fixture.',
                    );
                const body = readFileSync(path);
                const types = {
                    png: 'image/png',
                    webp: 'image/webp',
                    jpg: 'image/jpeg',
                    svg: 'image/svg+xml',
                    glb: 'model/gltf-binary',
                };
                const type =
                    types[path.split('.').at(-1)] ?? 'application/octet-stream';
                return new Response(method === 'HEAD' ? null : body, {
                    headers: {
                        'content-type': type,
                        'access-control-allow-origin': '*',
                    },
                });
            }
            return fetch(input, init);
        }
        const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
        const fixture = blobImageFixture(value, method);
        return new Response(fixture.body, fixture);
    };
}

// Chromium's DNS guard is a backstop for tests that create their own contexts
// or bypass the WWW fixtures. No production Blob connection may leave CI.
export function blobGuardLaunchArgs() {
    if (process.env.GREDICE_CI_NETWORK_ISOLATION === '1') {
        return [
            '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1',
        ];
    }
    return process.env.GREDICE_CI_BLOB_FIXTURES === '1'
        ? ['--host-resolver-rules=MAP *.blob.vercel-storage.com ~NOTFOUND']
        : [];
}
