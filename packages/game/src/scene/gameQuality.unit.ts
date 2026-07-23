import assert from 'node:assert/strict';
import test from 'node:test';
import {
    gameQualityProfiles,
    isGameQualitySetting,
    resolveGameQualityProfile,
    toGameQualityCustomProfile,
} from './gameQuality';

const constrainedDeviceMetrics = {
    coarsePointer: true,
    coreCount: 4,
    dpr: 3,
    memoryGb: 4,
    narrowViewport: true,
};

const standardDeviceMetrics = {
    coarsePointer: false,
    coreCount: 8,
    dpr: 1,
    memoryGb: 8,
    narrowViewport: false,
};

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

    assert.deepEqual(
        resolveGameQualityProfile(
            'custom',
            customProfile,
            constrainedDeviceMetrics,
        ),
        {
            ...customProfile,
            tier: 'custom',
        },
    );
});

test('manual quality profiles ignore constrained device metrics', () => {
    for (const tier of ['low', 'medium', 'high'] as const) {
        assert.equal(
            resolveGameQualityProfile(
                tier,
                undefined,
                constrainedDeviceMetrics,
            ),
            gameQualityProfiles[tier],
        );
    }
});

test('auto quality profile resolves medium for a standard device', () => {
    assert.equal(
        resolveGameQualityProfile('auto', undefined, standardDeviceMetrics),
        gameQualityProfiles.medium,
    );
});

test('auto quality profile reduces expensive work on a constrained device', () => {
    const profile = resolveGameQualityProfile(
        'auto',
        undefined,
        constrainedDeviceMetrics,
    );

    assert.deepEqual(profile, {
        cloudShadowMode: 'hard',
        dpr: 1,
        groundDecorationDensity: 0.25,
        rainParticleMultiplier: 0.5,
        shadowMapSize: 1024,
        shadows: true,
        snowOverlayMinCoverage: 0.18,
        snowParticleMultiplier: 0.45,
        tier: 'auto-constrained',
    });
    assert.ok(profile.rainParticleMultiplier > 0);
    assert.ok(profile.snowParticleMultiplier > 0);
});

test('low core count alone does not constrain a low-DPR device', () => {
    assert.equal(
        resolveGameQualityProfile('auto', undefined, {
            coarsePointer: false,
            coreCount: 4,
            dpr: 1,
            memoryGb: 8,
            narrowViewport: false,
        }),
        gameQualityProfiles.medium,
    );
});
