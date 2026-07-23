import assert from 'node:assert/strict';
import test from 'node:test';
import { estimateRgba8MipmappedTextureBytes } from './groundDecorationAtlasMemory';

test('estimates every RGBA8 mip level down to one pixel', () => {
    assert.equal(estimateRgba8MipmappedTextureBytes(4, 2), 44);
    assert.equal(estimateRgba8MipmappedTextureBytes(1, 1), 4);
});

test('cropping a half-empty 2048px atlas page saves one quarter of two full pages', () => {
    const fullPage = estimateRgba8MipmappedTextureBytes(2048, 2048);
    const halfPage = estimateRgba8MipmappedTextureBytes(2048, 1024);

    assert.equal(fullPage, 22_369_620);
    assert.equal(halfPage, 11_184_812);
    assert.equal(fullPage * 2 - (fullPage + halfPage), 11_184_808);
});
