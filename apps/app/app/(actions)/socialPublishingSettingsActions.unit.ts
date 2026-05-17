import assert from 'node:assert/strict';
import test from 'node:test';
import { __testUtils } from './socialPublishingSettingsActions.ts';

test('social publishing settings preserve stored Reddit secret when input is blank', () => {
    const formData = new FormData();
    formData.set('provider', 'reddit');
    formData.set('enabled', 'on');
    formData.set('clientId', 'reddit-client');
    formData.set('clientSecret', '');
    formData.set('userAgent', 'GrediceSocialPublisher/1.0');
    formData.set('defaultDestination', 'u_gredice_sandbox');
    formData.set('allowedDestinations', 'u_gredice_sandbox\nu_gredice_public');

    const payload = __testUtils.normalizePayload(formData);
    const validation = __testUtils.validatePayload(payload, {
        enabled: true,
        clientSecret: 'stored-secret',
    });

    assert.equal(validation.ok, true);
    if (!validation.ok) return;

    const config = __testUtils.toProviderConfig(validation.payload, {
        enabled: true,
        clientSecret: 'stored-secret',
    });

    assert.equal(config.clientSecret, 'stored-secret');
    assert.deepEqual(config.allowedDestinations, [
        'u_gredice_sandbox',
        'u_gredice_public',
    ]);
});

test('social publishing settings require generic bridge API key for external endpoint', () => {
    const formData = new FormData();
    formData.set('provider', 'instagram');
    formData.set('enabled', 'on');
    formData.set('publishEndpoint', 'https://social.example.com/instagram');
    formData.set('defaultDestination', '@gredice');

    const payload = __testUtils.normalizePayload(formData);
    const validation = __testUtils.validatePayload(payload, undefined);

    assert.equal(validation.ok, false);
    if (!validation.ok) {
        assert.equal(
            validation.state?.message,
            'API ključ je obavezan za vanjski bridge endpoint.',
        );
    }
});
