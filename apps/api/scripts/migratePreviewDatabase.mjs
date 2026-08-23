import { spawnSync } from 'node:child_process';

const migrationGate = process.env.GREDICE_PREVIEW_DATABASE_MIGRATIONS;

if (migrationGate) {
    const postgresUrl = process.env.POSTGRES_URL;
    const productionHost = process.env.GREDICE_PRODUCTION_POSTGRES_HOST?.trim();

    if (migrationGate !== '1') {
        throw new Error('Unexpected preview migration gate.');
    }
    if (process.env.VERCEL_ENV !== 'preview') {
        throw new Error('Preview migration refused outside Vercel Preview.');
    }
    if (!postgresUrl || !productionHost) {
        throw new Error('Preview migration safety configuration is missing.');
    }

    const previewHost = new URL(postgresUrl).hostname;
    if (previewHost === productionHost) {
        throw new Error(
            'Preview migration refused because Preview is using the Production database host.',
        );
    }

    console.info('Migrating isolated Vercel Preview database.');
    const result = spawnSync(
        'pnpm',
        ['--filter', '@gredice/storage', 'migrate:deploy'],
        { env: process.env, stdio: 'inherit' },
    );

    if (result.status !== 0) {
        throw new Error('Preview database migration failed.');
    }
}
