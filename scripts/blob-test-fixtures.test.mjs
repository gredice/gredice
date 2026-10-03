import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    createBlobFixtureFetch,
    isBlobHostname,
} from './blob-test-fixtures.mjs';

const imageUrl =
    'https://ci-fixture.public.blob.vercel-storage.com/photo.jpg?download=1';

test('all Blob tenants match without matching lookalike hosts', () => {
    assert.equal(
        isBlobHostname('new-store.public.blob.vercel-storage.com'),
        true,
    );
    assert.equal(
        isBlobHostname('NEW-STORE.PRIVATE.BLOB.VERCEL-STORAGE.COM.'),
        true,
    );
    assert.equal(isBlobHostname('blob.vercel-storage.com.evil.example'), false);
    assert.equal(isBlobHostname('example.com'), false);
});

test('image reads never call the real fetch and return a decodable local PNG', async () => {
    let upstream = 0;
    const fetch = createBlobFixtureFetch(async () => {
        upstream++;
        throw new Error('Unexpected upstream request');
    });
    const response = await fetch(new Request(imageUrl));
    const body = Buffer.from(await response.arrayBuffer());
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/png');
    assert.equal(body.subarray(1, 4).toString(), 'PNG');
    assert.equal(body.length, Number(response.headers.get('content-length')));
    assert.equal((await fetch(imageUrl, { method: 'HEAD' })).body, null);
    assert.equal(upstream, 0);
});

test('Blob writes and non-image downloads fail before touching the network', async () => {
    let upstream = 0;
    const fetch = createBlobFixtureFetch(async () => {
        upstream++;
    });
    for (const method of ['POST', 'PUT', 'DELETE']) {
        await assert.rejects(
            fetch(imageUrl, { method }),
            /Add a local test fixture/,
        );
    }
    await assert.rejects(
        fetch(imageUrl.replace('photo.jpg', 'export.json')),
        /Add a local test fixture/,
    );
    assert.equal(upstream, 0);
});

test('non-Blob requests preserve the caller and response', async () => {
    const input = new Request('https://api.gredice.com/api/data');
    const init = { cache: 'no-store' };
    const response = new Response('ok');
    const fetch = createBlobFixtureFetch(async (actualInput, actualInit) => {
        assert.equal(actualInput, input);
        assert.equal(actualInit, init);
        return response;
    });
    assert.equal(await fetch(input, init), response);
});

test('the CI preload serves images and blocks raw HTTP clients and DNS lookups', () => {
    const guard = fileURLToPath(
        new URL('./ci-blob-network-guard.mjs', import.meta.url),
    );
    execFileSync(
        process.execPath,
        [
            '--import',
            guard,
            '--input-type=module',
            '-e',
            `
        import assert from 'node:assert/strict';
        import dns from 'node:dns';
        import https from 'node:https';
        const url = ${JSON.stringify(imageUrl)};
        const response = await fetch(url);
        assert.equal(response.headers.get('content-type'), 'image/png');
        await assert.rejects(dns.promises.lookup(new URL(url).hostname), /CI blocked/);
        await assert.rejects(new Promise((resolve, reject) => https.get(url, resolve).on('error', reject)), /CI blocked/);
    `,
        ],
        {
            env: { ...process.env, GREDICE_CI_BLOB_FIXTURES: '1' },
            stdio: 'pipe',
        },
    );
});

test('redirects cannot bypass the Node Blob guard', () => {
    const guard = fileURLToPath(
        new URL('./ci-blob-network-guard.mjs', import.meta.url),
    );
    execFileSync(
        process.execPath,
        [
            '--import',
            guard,
            '--input-type=module',
            '-e',
            `
        import assert from 'node:assert/strict';
        import { createServer } from 'node:http';
        const server = createServer((request, response) => {
            response.writeHead(302, { location: ${JSON.stringify(imageUrl)} });
            response.end();
        });
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        try {
            await assert.rejects(fetch('http://127.0.0.1:' + server.address().port),
                error => /CI blocked/.test(error.cause?.message));
        } finally {
            await new Promise(resolve => server.close(resolve));
        }
    `,
        ],
        {
            env: { ...process.env, GREDICE_CI_BLOB_FIXTURES: '1' },
            stdio: 'pipe',
        },
    );
});

test('ordinary production and local processes keep their original network functions', () => {
    const guard = fileURLToPath(
        new URL('./ci-blob-network-guard.mjs', import.meta.url),
    );
    execFileSync(
        process.execPath,
        [
            '--input-type=module',
            '-e',
            `
        import assert from 'node:assert/strict';
        import dns from 'node:dns';
        const original = { fetch, lookup: dns.lookup, promiseLookup: dns.promises.lookup };
        await import(${JSON.stringify(guard)});
        assert.equal(fetch, original.fetch);
        assert.equal(dns.lookup, original.lookup);
        assert.equal(dns.promises.lookup, original.promiseLookup);
    `,
        ],
        {
            env: {
                ...process.env,
                NODE_OPTIONS: '',
                GREDICE_CI_BLOB_FIXTURES: '',
                GREDICE_CI_NETWORK_ISOLATION: '',
            },
            stdio: 'pipe',
        },
    );
});

test('isolated CI allows loopback and blocks infrastructure hosts and literal IPs', () => {
    const guard = fileURLToPath(
        new URL('./ci-blob-network-guard.mjs', import.meta.url),
    );
    execFileSync(
        process.execPath,
        [
            '--import',
            guard,
            '--input-type=module',
            '-e',
            `
        import assert from 'node:assert/strict';
        import { createServer, get } from 'node:http';
        import net from 'node:net';
        import dns from 'node:dns';
        const server = createServer((request, response) => {
            if (request.url === '/redirect') response.writeHead(302, { location: 'https://api.gredice.com/api/data' });
            response.end('local fixture');
        });
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        try {
            const origin = 'http://127.0.0.1:' + server.address().port;
            assert.equal(await (await fetch(origin)).text(), 'local fixture');
            for (const host of ['api.gredice.com', 'preview.vercel.app', 'database.neon.tech', 'cache.upstash.io', '192.0.2.1', '[2001:db8::1]']) {
                await assert.rejects(fetch('https://' + host), /CI blocked/);
                await assert.rejects(dns.promises.lookup(host), /CI blocked/);
            }
            await assert.rejects(new Promise((resolve, reject) => get('http://192.0.2.1', resolve).on('error', reject)), /CI blocked/);
            await assert.rejects(new Promise((resolve, reject) => net.connect({ host: '2001:db8::1', port: 443 }).on('connect', resolve).on('error', reject)), /CI blocked/);
            await assert.rejects(fetch(origin + '/redirect'), error => /CI blocked/.test(error.cause?.message));
            const image = await fetch('https://www.gredice.com/assets/plants/placeholder.png');
            assert.equal(image.headers.get('content-type'), 'image/png');
            const emoji = await fetch('https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f33b.svg');
            assert.match(await emoji.text(), /<svg/);
            await assert.rejects(fetch('https://cdn.jsdelivr.net/other.js'), /CI blocked/);
        } finally {
            await new Promise(resolve => server.close(resolve));
        }
    `,
        ],
        {
            env: {
                ...process.env,
                NODE_OPTIONS: '',
                GREDICE_CI_NETWORK_ISOLATION: '1',
            },
            stdio: 'pipe',
        },
    );
});

test('every routine WWW browser test uses the guarded fixtures', async () => {
    const { readdir } = await import('node:fs/promises');
    const directory = new URL('../apps/www/tests/', import.meta.url);
    for (const filename of await readdir(directory)) {
        if (!/\.spec\.tsx?$/.test(filename)) continue;
        const source = readFileSync(new URL(filename, directory), 'utf8');
        assert.doesNotMatch(
            source,
            /import\s*\{[^}]*\btest\b[^}]*\}\s*from\s*['"]@playwright\//s,
            filename,
        );
    }
});

test('routine workflows keep previews and remote caches outside tests', () => {
    for (const name of ['ci.yml', 'nextjs_ci_reusable.yml']) {
        const source = readFileSync(
            new URL(`../.github/workflows/${name}`, import.meta.url),
            'utf8',
        );
        assert.doesNotMatch(
            source,
            /vercel env pull|secrets: inherit|VERCEL_TOKEN|TURBO_TOKEN/,
        );
        assert.match(source, /scripts\/ci-isolated-tests\.sh/);
    }
});
