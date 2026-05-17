import assert from 'node:assert/strict';
import test from 'node:test';
import { __testUtils } from './socialAccountActions.ts';

test('validateAccountPayload accepts active social account', () => {
    const formData = new FormData();
    formData.set('provider', 'instagram');
    formData.set('providerAccountKey', 'brand-main');
    formData.set('label', 'Gredice Instagram');
    formData.set('handle', '@gredice');
    formData.set('externalAccountId', '17841400000000000');
    formData.set('defaultDestination', '17841400000000000');
    formData.set('allowedDestinations', '17841400000000000');
    formData.set(
        'credentialReference',
        'SOCIAL_PROVIDER_INSTAGRAM_ACCESS_TOKEN',
    );
    formData.set('status', 'active');

    const payload = __testUtils.normalizeAccountPayload(formData);
    const result = __testUtils.validateAccountPayload(payload);

    assert.equal(result.ok, true);
    if (result.ok) {
        assert.equal(result.payload.provider, 'instagram');
        assert.equal(result.payload.externalAccountId, '17841400000000000');
        assert.deepEqual(result.payload.allowedDestinations, [
            '17841400000000000',
        ]);
    }
});

test('validateAccountPayload rejects invalid provider account key', () => {
    const formData = new FormData();
    formData.set('provider', 'threads');
    formData.set('providerAccountKey', 'bad key');
    formData.set('label', 'Threads');
    formData.set('defaultDestination', '@gredice');
    formData.set('status', 'active');

    const payload = __testUtils.normalizeAccountPayload(formData);
    const result = __testUtils.validateAccountPayload(payload);

    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.state.errorCode, 'invalid_payload');
});
