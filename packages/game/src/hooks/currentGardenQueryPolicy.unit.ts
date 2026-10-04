import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getCurrentGardenQueryPolicy } from './currentGardenQueryPolicy';

describe('getCurrentGardenQueryPolicy', () => {
    it('keeps seeded public-garden data isolated from authenticated queries', () => {
        assert.deepEqual(
            getCurrentGardenQueryPolicy({
                authenticatedGardenQueriesEnabled: false,
                isLocalSandbox: false,
                isMock: false,
            }),
            {
                accountGardenQueriesEnabled: false,
                currentGardenQueryEnabled: false,
            },
        );
    });

    it('loads authenticated garden data in the customer game', () => {
        assert.deepEqual(
            getCurrentGardenQueryPolicy({
                authenticatedGardenQueriesEnabled: true,
                isLocalSandbox: false,
                isMock: false,
            }),
            {
                accountGardenQueriesEnabled: true,
                currentGardenQueryEnabled: true,
            },
        );
    });

    it('keeps local and mock garden loaders enabled without account queries', () => {
        for (const mode of [
            { isLocalSandbox: true, isMock: false },
            { isLocalSandbox: false, isMock: true },
        ]) {
            assert.deepEqual(
                getCurrentGardenQueryPolicy({
                    authenticatedGardenQueriesEnabled: true,
                    ...mode,
                }),
                {
                    accountGardenQueriesEnabled: false,
                    currentGardenQueryEnabled: true,
                },
            );
        }
    });
});
