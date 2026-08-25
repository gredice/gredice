import assert from 'node:assert/strict';
import test from 'node:test';
import {
    resolvePostLoginAccountId,
    resolveTemporaryUserIdToRetire,
} from './postLoginAccount';

test('preserves a selected account that still belongs to the signed-in user', () => {
    assert.equal(
        resolvePostLoginAccountId({
            accountIds: ['existing-secondary', 'existing-main'],
            defaultGardenAccountId: 'existing-main',
            selectedAccountId: 'existing-secondary',
        }),
        'existing-secondary',
    );
});

test('uses the default garden account when the previous account is inaccessible', () => {
    assert.equal(
        resolvePostLoginAccountId({
            accountIds: ['existing-secondary', 'existing-main'],
            defaultGardenAccountId: 'existing-main',
            selectedAccountId: 'retired-temporary',
        }),
        'existing-main',
    );
});

test('falls back to the first accessible account when no default garden is set', () => {
    assert.equal(
        resolvePostLoginAccountId({
            accountIds: ['existing-secondary', 'existing-main'],
            defaultGardenAccountId: undefined,
            selectedAccountId: 'retired-temporary',
        }),
        'existing-secondary',
    );
});

test('returns no selection for a user without an account', () => {
    assert.equal(
        resolvePostLoginAccountId({
            accountIds: [],
            defaultGardenAccountId: undefined,
            selectedAccountId: 'retired-temporary',
        }),
        undefined,
    );
});

test('retires a different temporary identity after existing-user login', () => {
    assert.equal(
        resolveTemporaryUserIdToRetire({
            authenticatedUserId: 'existing-user',
            currentTemporaryUserId: 'temporary-user',
        }),
        'temporary-user',
    );
});

test('does not retire the identity being authenticated or a missing temporary identity', () => {
    assert.equal(
        resolveTemporaryUserIdToRetire({
            authenticatedUserId: 'promoted-user',
            currentTemporaryUserId: 'promoted-user',
        }),
        undefined,
    );
    assert.equal(
        resolveTemporaryUserIdToRetire({
            authenticatedUserId: 'existing-user',
            currentTemporaryUserId: undefined,
        }),
        undefined,
    );
});
