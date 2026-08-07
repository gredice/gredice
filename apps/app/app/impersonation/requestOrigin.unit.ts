import assert from 'node:assert/strict';
import test from 'node:test';
import { requestOrigin } from './requestOrigin';

test('uses the first normalized forwarded protocol', () => {
    assert.equal(
        requestOrigin('app.gredice.com', ' HTTPS , http'),
        'https://app.gredice.com',
    );
});

test('falls back to the protocol implied by the host', () => {
    assert.equal(
        requestOrigin('app.gredice.com', null),
        'https://app.gredice.com',
    );
    assert.equal(requestOrigin('localhost:3000', ''), 'http://localhost:3000');
});

test('returns undefined without a host', () => {
    assert.equal(requestOrigin(null, 'https'), undefined);
});
