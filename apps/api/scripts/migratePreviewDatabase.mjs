import { spawnSync } from 'node:child_process';

const migrationGate = process.env.GREDICE_PREVIEW_DATABASE_MIGRATIONS;

if (migrationGate) {
    const postgresUrl = process.env.POSTGRES_URL;
    const configuredProductionHost =
        process.env.GREDICE_PRODUCTION_POSTGRES_HOST;

    if (migrationGate !== '1') {
        throw new Error('Unexpected preview migration gate.');
    }
    if (process.env.VERCEL_ENV !== 'preview') {
        throw new Error('Preview migration refused outside Vercel Preview.');
    }
    if (!postgresUrl || !configuredProductionHost) {
        throw new Error('Preview migration safety configuration is missing.');
    }

    const normalizeHostname = (hostname) =>
        hostname.trim().toLowerCase().replace(/\.+$/, '');
    const previewHost = normalizeHostname(new URL(postgresUrl).hostname);
    const productionHost = normalizeHostname(configuredProductionHost);
    if (!previewHost || !productionHost) {
        throw new Error('Preview migration database identity is invalid.');
    }
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
