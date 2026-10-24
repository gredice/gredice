import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

test('checkout partial fulfillment and replay against isolated PostgreSQL', {
    timeout: 120_000,
}, async (context) => {
    // Deliberately do not inherit provider credentials or app .env files. The
    // storage runner owns database creation, migrations, marker and cleanup.
    const directory = await mkdtemp(join(tmpdir(), 'gredice-checkout-test-'));
    context.after(() => rm(directory, { recursive: true, force: true }));
    const environmentFile = join(directory, '.env.test');
    const environment: NodeJS.ProcessEnv = {
        NODE_ENV: 'test',
        DOTENV_CONFIG_PATH: environmentFile,
        GREDICE_STORAGE_TEST_ENV_FILE: environmentFile,
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        TMPDIR: process.env.TMPDIR,
        NODE_OPTIONS: process.env.NODE_OPTIONS,
        GREDICE_CI_NETWORK_ISOLATION: process.env.GREDICE_CI_NETWORK_ISOLATION,
    };
    const adminUrl = process.env.GREDICE_STORAGE_TEST_DB_ADMIN_URL;
    if (adminUrl) {
        const url = new URL(adminUrl);
        assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname));
        assert.equal(url.pathname, '/postgres');
        environment.GREDICE_STORAGE_TEST_DB_ADMIN_URL = adminUrl;
    }
    try {
        const { stdout, stderr } = await promisify(execFile)(
            'bash',
            [
                './tests/runNodeTests.sh',
                '../../apps/api/lib/stripe/processCheckoutSession.integration.ts',
            ],
            {
                cwd: fileURLToPath(
                    new URL('../../../../packages/storage/', import.meta.url),
                ),
                env: environment,
                timeout: 110_000,
                maxBuffer: 4_000_000,
            },
        );
        assert.match(stdout, /(?:pass|# pass) 1\b/u);
        assert.match(stdout, /(?:fail|# fail) 0\b/u);
        assert.match(stdout, /(?:skipped|# skipped) 0\b/u);
        context.diagnostic(stdout.split('\n').slice(-12).join('\n'));
        if (stderr.trim()) context.diagnostic(stderr);
    } catch (error) {
        if (error && typeof error === 'object' && 'stdout' in error)
            context.diagnostic(String(error.stdout));
        throw error;
    }
});
