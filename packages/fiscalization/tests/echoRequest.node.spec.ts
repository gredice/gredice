import assert from 'node:assert/strict';
import test from 'node:test';
import type { UserSettings } from '../src/@types/UserSettings';
import { echoRequest } from '../src/clients/requests/echoRequest';

// This test hits the real CIS educ (test) endpoint.
// The echo request is a simple connectivity test that doesn't require
// signing or certificates, so we can use dummy credentials.
const educSettings: UserSettings = {
    pin: '00000000000',
    useVat: false,
    receiptNumberOnDevice: false,
    environment: 'educ',
    credentials: {
        cert: '',
        password: '',
    },
};

test('echoRequest - connects to CIS educ endpoint and echoes message', async () => {
    const message = `test-${Date.now()}`;
    const result = await echoRequest(message, {
        userSettings: educSettings,
    });

    assert.equal(result.success, true);
    if (result.success) {
        assert.equal(result.echo, message);
    }
    assert.ok(result.responseText, 'responseText should not be empty');
});

test('echoRequest - echoes different messages correctly', async () => {
    const message = 'Hello from Gredice fiscalization tests!';
    const result = await echoRequest(message, {
        userSettings: educSettings,
    });

    assert.equal(result.success, true);
    if (result.success) {
        assert.equal(result.echo, message);
    }
});

test('fisClient - WSDL loads and parses successfully from CDN', async () => {
    // Import fisClient directly to test WSDL loading in isolation
    const { fisClient } = await import('../src/clients/shared');

    const { wsdl, client } = await fisClient('educ');

    assert.ok(wsdl, 'WSDL should be loaded');
    assert.ok(client, 'SOAP client should be created');
    assert.ok(client.echoAsync, 'Client should have echoAsync method');
    assert.ok(client.racuniAsync, 'Client should have racuniAsync method');
});
