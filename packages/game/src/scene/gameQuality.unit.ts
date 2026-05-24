import assert from 'node:assert/strict';
import test from 'node:test';
import {
    gameQualityProfiles,
    isGameQualitySetting,
    resolveGameQualityProfile,
    toGameQualityCustomProfile,
} from './gameQuality';

test('custom is a valid game quality setting', () => {
    assert.equal(isGameQualitySetting('custom'), true);
});

test('custom quality profile resolves all adjustable fields', () => {
    const customProfile = {
        ...toGameQualityCustomProfile(gameQualityProfiles.high),
        dpr: 1.75,
        groundDecorationDensity: 0.25,
        rainParticleMultiplier: 0.45,
        shadowMapSize: 2048,
        shadows: false,
        snowOverlayMinCoverage: 0.12,
        snowParticleMultiplier: 0.55,
    };

    assert.deepEqual(resolveGameQualityProfile('custom', customProfile), {
        ...customProfile,
        tier: 'custom',
    });
});
