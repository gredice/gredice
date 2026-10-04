import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    assertEnvironmentAnimalDevelopmentDatabase,
    getDatabaseIdentityHash,
} from '../scripts/environmentAnimalDatabaseGuard';

describe('environment-animal database guard', () => {
    it('accepts only a pinned database identity regardless of credentials', () => {
        const developmentUrl =
            'postgresql://development-user:secret@development.example.test/gredice?sslmode=require';
        const allowedIdentities = new Set([
            getDatabaseIdentityHash(developmentUrl),
        ]);

        assert.doesNotThrow(() =>
            assertEnvironmentAnimalDevelopmentDatabase(
                'postgres://another-user:another-secret@development.example.test/gredice?sslmode=verify-full',
                allowedIdentities,
            ),
        );
        assert.throws(
            () =>
                assertEnvironmentAnimalDevelopmentDatabase(
                    'postgresql://development-user:secret@production.example.test/gredice',
                    allowedIdentities,
                ),
            /repository-approved development database/,
        );
    });

    it('rejects non-PostgreSQL connection strings', () => {
        assert.throws(
            () => getDatabaseIdentityHash('https://development.example.test'),
            /PostgreSQL connection string/,
        );
    });
});
