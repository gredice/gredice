import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const appDirectory = fileURLToPath(new URL('..', import.meta.url));
const nextCli = join(
    appDirectory,
    'node_modules',
    'next',
    'dist',
    'bin',
    'next',
);

const archives = [
    {
        description:
            'Blog objave iz Gredica koje pomažu pratiti što se događa u vrtu i oko njega.',
        imageAlt: 'Novosti iz Gredica – blog objave iz vrta',
        imagePath: '/novosti/opengraph-image',
        path: '/novosti',
        publicUrl: 'https://www.gredice.com/novosti',
        title: 'Novosti iz Gredica',
    },
    {
        description:
            'Kronološki pregled nadogradnji, poboljšanja i novih značajki u Gredicama.',
        imageAlt: 'Što je novo u Gredicama – promjene i nove mogućnosti',
        imagePath: '/novosti/sto-je-novo/opengraph-image',
        path: '/novosti/sto-je-novo',
        publicUrl: 'https://www.gredice.com/novosti/sto-je-novo',
        title: 'Što je novo u Gredicama',
    },
];

function delay(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function listen(server) {
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            server.off('error', reject);
            resolve();
        });
    });

    const address = server.address();
    assert.ok(address && typeof address === 'object');
    return address.port;
}

async function closeServer(server) {
    if (!server.listening) {
        return;
    }

    await new Promise((resolve, reject) => {
        server.close((error) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    });
}

async function reservePort() {
    const server = createServer();
    const port = await listen(server);
    await closeServer(server);
    return port;
}

function startNextServer(port) {
    const child = spawn(process.execPath, [nextCli, 'start', '-p', `${port}`], {
        cwd: appDirectory,
        env: {
            ...process.env,
            GREDICE_API_HOST: 'http://127.0.0.1:9',
            NEXT_TELEMETRY_DISABLED: '1',
            VERCEL_ENV: 'development',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';

    for (const stream of [child.stdout, child.stderr]) {
        stream.setEncoding('utf8');
        stream.on('data', (chunk) => {
            output = `${output}${chunk}`.slice(-12_000);
        });
    }

    return { child, getOutput: () => output };
}

async function stopChild(child) {
    if (child.exitCode !== null || child.signalCode !== null) {
        return;
    }

    await new Promise((resolve) => {
        const forceStop = setTimeout(() => {
            child.kill('SIGKILL');
        }, 5_000);

        child.once('exit', () => {
            clearTimeout(forceStop);
            resolve();
        });
        child.kill('SIGTERM');
    });
}

async function waitForPage(url, nextServer) {
    const deadline = Date.now() + 30_000;
    let lastError;

    while (Date.now() < deadline) {
        if (nextServer.child.exitCode !== null) {
            throw new Error(
                `Next.js exited before becoming ready.\n${nextServer.getOutput()}`,
            );
        }

        try {
            const response = await fetch(url, {
                headers: { 'user-agent': 'Twitterbot' },
            });
            if (response.ok) {
                return await response.text();
            }
            lastError = new Error(
                `Unexpected readiness status ${response.status}`,
            );
        } catch (error) {
            lastError = error;
        }

        await delay(100);
    }

    throw new Error(
        `Next.js did not become ready: ${String(lastError)}\n${nextServer.getOutput()}`,
    );
}

function headMetadata(html) {
    const metadata = new Map();
    const tags = html.match(/<(?:link|meta)\s+[^>]*>/gu) ?? [];

    for (const tag of tags) {
        const attributes = new Map();
        for (const match of tag.matchAll(/([\w:-]+)="([^"]*)"/gu)) {
            attributes.set(match[1], match[2]);
        }

        const property = attributes.get('property') ?? attributes.get('name');
        if (property?.startsWith('og:') || property?.startsWith('twitter:')) {
            metadata.set(property, attributes.get('content'));
        }
        if (attributes.get('rel') === 'canonical') {
            metadata.set('canonical', attributes.get('href'));
        }
    }

    return metadata;
}

function assertArchiveMetadata(metadata, archive) {
    const publicImageUrl = `https://www.gredice.com${archive.imagePath}`;

    assert.equal(metadata.get('canonical'), archive.publicUrl);
    assert.equal(metadata.get('og:title'), archive.title);
    assert.equal(metadata.get('og:description'), archive.description);
    assert.equal(metadata.get('og:url'), archive.publicUrl);
    assert.equal(metadata.get('og:type'), 'website');
    assert.equal(metadata.get('og:image'), publicImageUrl);
    assert.equal(metadata.get('og:image:type'), 'image/png');
    assert.equal(metadata.get('og:image:width'), '1200');
    assert.equal(metadata.get('og:image:height'), '630');
    assert.equal(metadata.get('og:image:alt'), archive.imageAlt);
    assert.equal(metadata.get('twitter:card'), 'summary_large_image');
    assert.equal(metadata.get('twitter:title'), archive.title);
    assert.equal(metadata.get('twitter:description'), archive.description);
    assert.equal(metadata.get('twitter:image'), publicImageUrl);
    assert.equal(metadata.get('twitter:image:alt'), archive.imageAlt);
}

function pngDimensions(bytes) {
    const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    assert.deepEqual(bytes.subarray(0, pngSignature.length), pngSignature);

    return {
        height: bytes.readUInt32BE(20),
        width: bytes.readUInt32BE(16),
    };
}

describe('production news archive metadata', () => {
    it('renders distinct public metadata and 1200x630 PNG previews', {
        timeout: 60_000,
    }, async (testContext) => {
        const nextPort = await reservePort();
        const nextServer = startNextServer(nextPort);
        testContext.after(() => stopChild(nextServer.child));

        const origin = `http://127.0.0.1:${nextPort}`;
        const renderedMetadata = [];
        const imageHashes = [];

        for (const archive of archives) {
            const html = await waitForPage(
                `${origin}${archive.path}`,
                nextServer,
            );
            const metadata = headMetadata(html);
            assertArchiveMetadata(metadata, archive);
            renderedMetadata.push(metadata);

            const imageResponse = await fetch(`${origin}${archive.imagePath}`);
            assert.equal(imageResponse.status, 200);
            assert.equal(
                imageResponse.headers.get('content-type'),
                'image/png',
            );

            const imageBytes = Buffer.from(await imageResponse.arrayBuffer());
            assert.deepEqual(pngDimensions(imageBytes), {
                height: 630,
                width: 1200,
            });
            imageHashes.push(
                createHash('sha256').update(imageBytes).digest('hex'),
            );
        }

        assert.notEqual(
            renderedMetadata[0].get('og:url'),
            renderedMetadata[1].get('og:url'),
        );
        assert.notEqual(
            renderedMetadata[0].get('og:title'),
            renderedMetadata[1].get('og:title'),
        );
        assert.notEqual(
            renderedMetadata[0].get('og:image'),
            renderedMetadata[1].get('og:image'),
        );
        assert.notEqual(imageHashes[0], imageHashes[1]);
    });
});
