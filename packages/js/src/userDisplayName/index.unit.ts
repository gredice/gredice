import assert from 'node:assert/strict';
import test from 'node:test';
import { safeUserDisplayName } from './index';

test('display names never fall back to a login email', () => {
    for (const unsafe of [
        null,
        undefined,
        '',
        '  ',
        'ana@example.com',
        'Ana <ana@example.com>',
    ]) {
        assert.equal(safeUserDisplayName(unsafe), 'Vrtlar');
    }
    assert.equal(safeUserDisplayName('  Veseli vrtlar  '), 'Veseli vrtlar');
});
