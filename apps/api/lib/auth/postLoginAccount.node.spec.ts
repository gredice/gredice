import assert from 'node:assert/strict';
import test from 'node:test';
import { resolvePostLoginAccountId } from './postLoginAccount';

test('keeps the existing default garden account active after attaching temporary progress', () => {
    assert.equal(
        resolvePostLoginAccountId({
            accountIds: ['existing-secondary', 'temporary', 'existing-main'],
            attachedTemporaryAccountIds: ['temporary'],
            defaultGardenAccountId: 'existing-main',
        }),
        'existing-main',
    );
});

test('falls back to an existing account when no default garden is set', () => {
    assert.equal(
        resolvePostLoginAccountId({
            accountIds: ['temporary', 'existing'],
            attachedTemporaryAccountIds: ['temporary'],
            defaultGardenAccountId: undefined,
        }),
        'existing',
    );
});

test('keeps attached progress usable when the target user had no account', () => {
    assert.equal(
        resolvePostLoginAccountId({
            accountIds: ['temporary'],
            attachedTemporaryAccountIds: ['temporary'],
            defaultGardenAccountId: undefined,
        }),
        'temporary',
    );
});

test('does not change account selection when no temporary account was attached', () => {
    assert.equal(
        resolvePostLoginAccountId({
            accountIds: ['existing'],
            attachedTemporaryAccountIds: undefined,
            defaultGardenAccountId: 'existing',
        }),
        undefined,
    );
});
