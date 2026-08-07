import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getGrediceAppOrigin } from '../src/origins';

describe('getGrediceAppOrigin', () => {
    it('uses production domains without a current origin', () => {
        assert.equal(
            getGrediceAppOrigin('delivery'),
            'https://dostava.gredice.com',
        );
    });

    it('keeps local gredice.test apps on their matching subdomains', () => {
        assert.equal(
            getGrediceAppOrigin('garden', 'https://app.gredice.test'),
            'https://vrt.gredice.test',
        );
    });

    it('maps localhost apps to their registered ports', () => {
        assert.equal(
            getGrediceAppOrigin('farm', 'http://localhost:3003'),
            'http://localhost:3002',
        );
    });
});
