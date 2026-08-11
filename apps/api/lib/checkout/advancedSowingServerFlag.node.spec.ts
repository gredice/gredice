import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    advancedSowingSelectedFulfillmentReady,
    advancedSowingServerFlagName,
    isAdvancedSowingServerEnabled,
    parseAdvancedSowingServerFlag,
} from './advancedSowingServerFlag';

test('selected Advanced Sowing fulfillment is compile-time ready', () => {
    assert.equal(advancedSowingSelectedFulfillmentReady, true);
});

test('Advanced Sowing server gate is fail-closed', () => {
    for (const value of [undefined, '', 'false', '1', 'yes', 'enabled']) {
        assert.equal(parseAdvancedSowingServerFlag(value), false);
    }
    for (const value of ['true', 'TRUE', ' true ']) {
        assert.equal(parseAdvancedSowingServerFlag(value), true);
    }
});

test('Advanced Sowing server gate reads its dedicated environment variable', (t) => {
    const previous = process.env[advancedSowingServerFlagName];
    t.after(() => {
        if (previous === undefined) {
            delete process.env[advancedSowingServerFlagName];
            return;
        }
        process.env[advancedSowingServerFlagName] = previous;
    });

    delete process.env[advancedSowingServerFlagName];
    assert.equal(isAdvancedSowingServerEnabled(), false);
    process.env[advancedSowingServerFlagName] = 'true';
    assert.equal(isAdvancedSowingServerEnabled(), true);
});
