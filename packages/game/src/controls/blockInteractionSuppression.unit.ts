import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    areBlockInteractionsSuppressed,
    holdBlockInteractions,
} from './blockInteractionSuppression';

test('a hold suppresses block interactions until each hold is released', () => {
    assert.equal(areBlockInteractionsSuppressed(), false);

    const releaseFirst = holdBlockInteractions();
    const releaseSecond = holdBlockInteractions();
    assert.equal(areBlockInteractionsSuppressed(), true);

    releaseFirst();
    // Releasing the same hold again must not end the other one.
    releaseFirst();
    assert.equal(areBlockInteractionsSuppressed(), true);

    releaseSecond();
    assert.equal(areBlockInteractionsSuppressed(), false);
});
