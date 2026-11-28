import assert from 'node:assert/strict';
import test from 'node:test';
import { ShaderChunk } from 'three';
import { installSkyRimShaderChunk } from './skyRimShaderChunk';

test('installs the sky rim once, after the indirect light is gathered', () => {
    const original = ShaderChunk.lights_fragment_end;
    try {
        installSkyRimShaderChunk();
        const installed = ShaderChunk.lights_fragment_end;
        installSkyRimShaderChunk();

        assert.equal(ShaderChunk.lights_fragment_end, installed);
        assert.ok(installed.startsWith(original));
        assert.equal(installed.split('gredice:sky-rim').length, 2);
        // Only lit standard materials with a hemisphere light take part.
        assert.match(installed, /defined\( STANDARD \)/);
        assert.match(installed, /NUM_HEMI_LIGHTS > 0/);
    } finally {
        ShaderChunk.lights_fragment_end = original;
    }
});
