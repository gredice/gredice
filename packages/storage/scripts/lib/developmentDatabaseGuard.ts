import { createHash } from 'node:crypto';

function normalizedDatabaseIdentity(connection: string) {
    let parsed: URL;
    try {
        parsed = new URL(connection);
    } catch {
        throw new Error('The Postgres connection is not a valid URL.');
    }

    if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
        throw new Error('The database connection must use Postgres.');
    }

    const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    if (!parsed.hostname || !databaseName) {
        throw new Error(
            'The Postgres connection is missing its host or database name.',
        );
    }

    return `${parsed.hostname.toLowerCase()}:${parsed.port || '5432'}/${databaseName}`;
}

export function getDevelopmentDatabaseFingerprint(connection: string) {
    return createHash('sha256')
        .update(normalizedDatabaseIdentity(connection))
        .digest('hex');
}

export function assertDevelopmentDatabaseIsAllowlisted({
    allowedFingerprints,
    connection,
}: {
    allowedFingerprints: string | null | undefined;
    connection: string;
}) {
    const configuredFingerprints = new Set(
        (allowedFingerprints ?? '')
            .split(',')
            .map((value) => value.trim().toLowerCase())
            .filter(Boolean),
    );
    if (configuredFingerprints.size === 0) {
        throw new Error(
            'Apply requires GREDICE_DEVELOPMENT_DATABASE_FINGERPRINTS from the trusted development environment configuration.',
        );
    }

    const actualFingerprint = getDevelopmentDatabaseFingerprint(connection);
    if (!configuredFingerprints.has(actualFingerprint)) {
        throw new Error(
            'Refusing the write because the connected database identity is not allowlisted for development.',
        );
    }
}
