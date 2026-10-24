import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';

// Exercise the published vendor code without installing the CLI, reading local
// credentials, contacting Vercel, or running an application build.
const [cliDirectory, preparerDirectory] = process.argv.slice(2);
assert.ok(cliDirectory && preparerDirectory, 'Pass the two extracted package directories; see README.md.');
const here = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(here, '../..');
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
assert.equal((await readJson(join(cliDirectory, 'package.json'))).version, '59.23.2');
assert.equal((await readJson(join(preparerDirectory, 'package.json'))).version, '0.3.0');
const source = await readFile(join(cliDirectory, 'dist/commands/build/index.js'), 'utf8');
const start = source.indexOf('async function shouldEmbedFlagsDefinitions(');
assert.ok(start >= 0, 'Expected embedding gate in CLI 59.23.2');
const bodyStart = source.indexOf('{', start);
let depth = 1;
let end = bodyStart + 1;
// This pinned function contains no braces inside strings or comments.
for (; depth > 0 && end < source.length; end++) {
    if (source[end] === '{') depth++;
    if (source[end] === '}') depth--;
}
assert.equal(depth, 0);
const gateSource = source.slice(start, end);
const { prepareFlagsDefinitions } = await import(pathToFileURL(join(preparerDirectory, 'dist/index.js')).href);
const payload = await readJson(join(here, 'preview-env.json'));
const manifests = await Promise.all(['www', 'garden'].map((app) => readJson(join(root, 'apps', app, 'package.json'))));
const fixtureOidc = [
    Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url'),
    Buffer.from(JSON.stringify({ project_id: 'prj_fixture', iat: 0, exp: 3600 })).toString('base64url'),
    'unsigned-test-fixture',
].join('.');

function embeddingGate(env) {
    return runInNewContext(`(${gateSource})`, {
        process: { env },
        isFlagsEmbedOption: (value) => value === 'force-on' || value === 'force-off',
        envHasSdkKey: () => Object.values(env).some((value) => /^vf_(?:server|client)_/.test(value)),
        import_build_utils3: { isPackageInstalled: async () => false },
    });
}

test('proposed setting is non-secret and targets only preview', () => {
    assert.deepEqual(payload, {
        key: 'VERCEL_FLAGS_EMBED_DEFINITIONS',
        value: 'force-off',
        type: 'plain',
        target: ['preview'],
    });
});

for (const manifest of manifests) {
    test(`${manifest.name}: default CLI gate reaches the fatal OIDC fetch`, async () => {
        const env = { VERCEL_OIDC_TOKEN: fixtureOidc, VERCEL_ENV: 'preview' };
        assert.equal(await embeddingGate(env)('.', manifest), true);
        let calls = 0;
        await assert.rejects(prepareFlagsDefinitions({
            cwd: tmpdir(),
            env,
            fetch: async (url, { headers }) => {
                calls++;
                assert.equal(url, 'https://flags.vercel.com/v1/datafile');
                assert.equal(headers.authorization, `Bearer ${fixtureOidc}`);
                return new Response(null, { status: 401, statusText: 'Unauthorized' });
            },
        }), /401 Unauthorized/);
        assert.equal(calls, 1);
    });

    test(`${manifest.name}: proposed preview setting skips the fetch`, async () => {
        const env = {
            VERCEL_OIDC_TOKEN: fixtureOidc,
            VERCEL_ENV: 'preview',
            [payload.key]: payload.value,
        };
        const shouldEmbed = await embeddingGate(env)('.', manifest);
        assert.equal(shouldEmbed, false);
        let calls = 0;
        if (shouldEmbed) {
            await prepareFlagsDefinitions({
                cwd: tmpdir(), env,
                fetch: async () => { calls++; throw new Error('Unexpected fetch'); },
            });
        }
        assert.equal(calls, 0);
        assert.equal(env.VERCEL_OIDC_TOKEN, fixtureOidc);
    });
}

test('adding an SDK key does not bypass a failing OIDC entry', async () => {
    let calls = 0;
    await assert.rejects(prepareFlagsDefinitions({
        cwd: tmpdir(),
        env: { FLAGS: 'vf_server_fixture', VERCEL_OIDC_TOKEN: fixtureOidc },
        fetch: async (_url, { headers }) => {
            calls++;
            return headers.authorization === `Bearer ${fixtureOidc}`
                ? new Response(null, { status: 401, statusText: 'Unauthorized' })
                : Response.json({ flags: {} });
        },
    }), /401 Unauthorized/);
    assert.equal(calls, 2);
});

test('without the preview setting, a successful OIDC response still embeds definitions', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'gredice-flags-verify-'));
    try {
        const env = { VERCEL_OIDC_TOKEN: fixtureOidc, VERCEL_ENV: 'production' };
        assert.equal(await embeddingGate(env)(cwd, manifests[0]), true);
        const result = await prepareFlagsDefinitions({
            cwd, env,
            fetch: async () => Response.json({ flags: {} }),
        });
        assert.equal(result.created, true);
        const definitions = await readFile(join(cwd, 'node_modules/@vercel/flags-definitions/index.js'), 'utf8');
        assert.ok(definitions.includes('prj_fixture'));
    } finally {
        await rm(cwd, { recursive: true, force: true });
    }
});
