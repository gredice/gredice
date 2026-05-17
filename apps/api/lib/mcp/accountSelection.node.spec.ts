import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveMcpAccountId } from './accountSelection';

test('resolveMcpAccountId selects the requested authorized account', () => {
    assert.equal(
        resolveMcpAccountId('account-2', ['account-1', 'account-2']),
        'account-2',
    );
});

test('resolveMcpAccountId rejects an explicitly unauthorized account', () => {
    assert.equal(
        resolveMcpAccountId('account-3', ['account-1', 'account-2']),
        null,
    );
});

test('resolveMcpAccountId falls back only when no account is selected', () => {
    assert.equal(
        resolveMcpAccountId(undefined, ['account-1', 'account-2']),
        'account-1',
    );
});
