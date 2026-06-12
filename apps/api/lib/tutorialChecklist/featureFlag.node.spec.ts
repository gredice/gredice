import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    isTutorialChecklistEnabled,
    tutorialChecklistFlag,
} from './featureFlag';

describe('tutorialChecklistFlag', () => {
    it('uses the shared rollout flag key', () => {
        assert.equal(tutorialChecklistFlag.key, 'tutorialChecklist');
    });

    it('defaults to enabled for garden-side rollout debugging', async () => {
        const request = new Request('https://api.gredice.test/api/accounts');

        assert.equal(await isTutorialChecklistEnabled(request), true);
    });
});
