import assert from 'node:assert/strict';
import test from 'node:test';
import { getBlockImageUrl } from './index';

test('block image URLs include an encoded content version', () => {
    assert.equal(
        getBlockImageUrl('WoodenBench', { version: 'assets/2026' }),
        'https://www.gredice.com/assets/blocks/WoodenBench.webp?v=assets%2F2026',
    );
});

test('block image URLs support versioned local asset bases', () => {
    assert.equal(
        getBlockImageUrl('BeachUmbrella', {
            baseUrl: '/assets/blocks/',
            version: 'abc123',
        }),
        '/assets/blocks/BeachUmbrella.webp?v=abc123',
    );
});

test('block image URLs stay compatible when no version is available', () => {
    assert.equal(
        getBlockImageUrl('Block Grass', { version: null }),
        'https://www.gredice.com/assets/blocks/Block%20Grass.webp',
    );
    assert.equal(getBlockImageUrl('  ', { version: 'abc123' }), null);
});
