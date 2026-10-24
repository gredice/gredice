import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { Pool } from 'pg';

/** Run actual repository/service regressions in an isolated provider before storage imports. */
export function registerGardenPackIntegrationSuite(
    name: string,
    integrationFile: URL,
) {
    test(name, { timeout: 120_000 }, async (context) => {
        const directory = await mkdtemp(
            join(tmpdir(), 'gredice-pack-lifecycle-'),
        );
        const databaseName = `pack_lifecycle_${randomUUID().replaceAll('-', '')}`;
        const adminUrl = process.env.GREDICE_PACK_TEST_ADMIN_URL;
        let adminPool: Pool | undefined;
        const environment: NodeJS.ProcessEnv = {
            ...process.env,
            TEST_ENV: '1',
            GREDICE_PACK_LIFECYCLE_TEST: '1',
            GREDICE_PACK_PLACEMENT_TEST: '1',
            GREDICE_TEST_DB_PROVIDER: 'pglite',
            GREDICE_TEST_DB_PGLITE_DIR: directory,
            POSTGRES_URL: 'postgres://unused@127.0.0.1/unused',
        };
        delete environment.NODE_TEST_CONTEXT;
        try {
            if (adminUrl) {
                const url = new URL(adminUrl);
                assert.ok(
                    ['127.0.0.1', 'localhost'].includes(url.hostname),
                    'Only a disposable local PostgreSQL cluster is allowed',
                );
                assert.equal(url.username, 'packtest');
                assert.equal(url.pathname, '/postgres');
                adminPool = new Pool({ connectionString: adminUrl, max: 1 });
                await adminPool.query(`CREATE DATABASE "${databaseName}"`);
                url.pathname = `/${databaseName}`;
                environment.POSTGRES_URL = url.toString();
                environment.GREDICE_TEST_DB_PROVIDER = 'postgres';
            }
            const { stdout, stderr } = await promisify(execFile)(
                process.execPath,
                [
                    '--import',
                    'tsx',
                    '--test',
                    '--conditions=react-server',
                    fileURLToPath(integrationFile),
                ],
                { env: environment, maxBuffer: 2_000_000, timeout: 110_000 },
            );
            assert.match(stdout, /(?:pass|# pass) \d+/u);
            assert.match(stdout, /(?:fail|# fail) 0/u);
            assert.match(stdout, /(?:skipped|# skipped) 0/u);
            context.diagnostic(stdout.split('\n').slice(-10).join('\n'));
            if (stderr.trim()) context.diagnostic(stderr);
        } finally {
            if (adminPool) {
                await adminPool.query(
                    `DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`,
                );
                await adminPool.end();
            }
            await rm(directory, { recursive: true, force: true });
        }
    });
}
