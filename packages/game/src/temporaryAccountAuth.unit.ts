import assert from 'node:assert/strict';
import test from 'node:test';
import { getTemporaryAccountLoginUrl } from './temporaryAccountAuth';

test('builds a Garden login URL for AccountHud consumers without an in-app listener', () => {
    assert.equal(
        getTemporaryAccountLoginUrl(
            'https://garden-git-feature-gredice.vercel.app',
        ),
        'https://garden-git-feature-gredice.vercel.app/?prijava=1',
    );
});
