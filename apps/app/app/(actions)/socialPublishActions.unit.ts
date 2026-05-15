import assert from 'node:assert/strict';
import test from 'node:test';
import {
  __testUtils,
} from './socialPublishActions.ts';

test('validatePayload rejects missing required fields', () => {
  const payload = __testUtils.normalizePayload(new FormData());
  const result = __testUtils.validatePayload(payload);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.state.errorCode, 'invalid_payload');
  }
});

test('validatePayload accepts valid text publish payload', () => {
  const formData = new FormData();
  formData.set('provider', 'reddit');
  formData.set('providerAccountKey', 'default');
  formData.set('destination', 'r/gardening');
  formData.set('postType', 'text');
  formData.set('title', 'Title');
  formData.set('body', 'Body');
  formData.set('submissionToken', 'submission-token-123');

  const payload = __testUtils.normalizePayload(formData);
  const result = __testUtils.validatePayload(payload);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.payload.destination, 'gardening');
  }
});

test('sanitizeProviderErrorDetails strips sensitive fields', () => {
  const sanitized = __testUtils.sanitizeProviderErrorDetails({
    status: 403,
    reason: 'blocked',
    providerErrorId: 'x',
    accessToken: 'secret',
  });
  assert.deepEqual(sanitized, {
    status: 403,
    reason: 'blocked',
    providerErrorId: 'x',
  });
});
