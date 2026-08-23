import assert from 'node:assert/strict';
import test from 'node:test';
import { assertEnvironmentAnimalWriteAllowed } from './environmentAnimalWriteGuard';

test('allows read-only inspection without a database environment marker', () => {
    assert.doesNotThrow(() =>
        assertEnvironmentAnimalWriteAllowed(
            { apply: false, target: 'development' },
            {},
        ),
    );
});

test('rejects a development write when the loaded database is not independently marked', () => {
    assert.throws(
        () =>
            assertEnvironmentAnimalWriteAllowed(
                { apply: true, target: 'development' },
                {},
            ),
        /GREDICE_DATABASE_ENVIRONMENT=development/u,
    );
});

test('rejects write targets other than development', () => {
    assert.throws(
        () =>
            assertEnvironmentAnimalWriteAllowed(
                { apply: true, target: 'production' },
                { GREDICE_DATABASE_ENVIRONMENT: 'production' },
            ),
        /Writes are restricted to --target development/u,
    );
});

test('allows a development write only when the loaded database carries the matching marker', () => {
    assert.doesNotThrow(() =>
        assertEnvironmentAnimalWriteAllowed(
            { apply: true, target: 'development' },
            { GREDICE_DATABASE_ENVIRONMENT: 'development' },
        ),
    );
});

test('rejects a conflicting Vercel environment marker', () => {
    assert.throws(
        () =>
            assertEnvironmentAnimalWriteAllowed(
                { apply: true, target: 'development' },
                {
                    GREDICE_DATABASE_ENVIRONMENT: 'development',
                    VERCEL_ENV: 'production',
                },
            ),
        /Configured VERCEL_ENV is production/u,
    );
});
