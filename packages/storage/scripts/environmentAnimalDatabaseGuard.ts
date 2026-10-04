import { createHash } from 'node:crypto';

// SHA-256 of hostname + database path. Updating the development database
// requires an explicit reviewed pin change; credentials and URL options are
// deliberately excluded so routine rotations do not bypass or break the guard.
const developmentDatabaseIdentityHashes = new Set([
    'dab1b4042d16ac5507c5f15f565ea378de2609db95582f6bd52196cc886b04c2',
]);

export function getDatabaseIdentityHash(connectionString: string) {
    const url = new URL(connectionString);
    if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
        throw new Error('Expected a PostgreSQL connection string.');
    }

    const identity = `${url.hostname.toLowerCase()}|${decodeURIComponent(url.pathname)}`;
    return createHash('sha256').update(identity).digest('hex');
}

export function assertEnvironmentAnimalDevelopmentDatabase(
    connectionString: string,
    allowedIdentityHashes = developmentDatabaseIdentityHashes,
) {
    const identityHash = getDatabaseIdentityHash(connectionString);
    if (!allowedIdentityHashes.has(identityHash)) {
        throw new Error(
            'Refusing environment-animal writes: the connected database is not the repository-approved development database.',
        );
    }
}
