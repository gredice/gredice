import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    buildDirectionalShadowDepthSignature,
    cloudShadowRefreshMsByMode,
    hasShadowDynamicCadenceChanged,
    resolveShadowMapRefreshTick,
} from './shadowMapScheduling';

const baseShadowDepth = {
    lightPosition: { x: 10, y: 20, z: 30 },
    shadowCameraSize: 40,
    shadowMapSize: 2048,
    shadows: true,
};

describe('buildDirectionalShadowDepthSignature', () => {
    it('is stable when all depth inputs are unchanged', () => {
        const daylightLight = {
            color: '#ffffff',
            intensity: 2,
            position: baseShadowDepth.lightPosition,
        };
        const stormLight = {
            color: '#8090a0',
            intensity: 0.2,
            position: { ...baseShadowDepth.lightPosition },
        };

        const daylightSignature = buildDirectionalShadowDepthSignature({
            ...baseShadowDepth,
            lightPosition: daylightLight.position,
        });
        const stormSignature = buildDirectionalShadowDepthSignature({
            ...baseShadowDepth,
            lightPosition: stormLight.position,
        });

        assert.equal(daylightSignature, stormSignature);
    });

    it('changes for enabled, map, camera, and light-position changes', () => {
        const signature = buildDirectionalShadowDepthSignature(baseShadowDepth);
        const changedInputs = [
            { ...baseShadowDepth, shadows: false },
            { ...baseShadowDepth, shadowMapSize: 4096 },
            { ...baseShadowDepth, shadowCameraSize: 42 },
            {
                ...baseShadowDepth,
                lightPosition: { ...baseShadowDepth.lightPosition, x: 11 },
            },
        ];

        for (const input of changedInputs) {
            assert.notEqual(
                buildDirectionalShadowDepthSignature(input),
                signature,
            );
        }
    });
});

describe('shadow map scheduling', () => {
    it('uses reduced hard and soft cloud-shadow refresh rates', () => {
        assert.deepEqual(cloudShadowRefreshMsByMode, {
            hard: 160,
            soft: 96,
        });
    });

    it('detects dynamic cadence start, change, and removal', () => {
        assert.equal(hasShadowDynamicCadenceChanged(undefined, 96), true);
        assert.equal(hasShadowDynamicCadenceChanged(96, 96), false);
        assert.equal(hasShadowDynamicCadenceChanged(96, 64), true);
        assert.equal(hasShadowDynamicCadenceChanged(64, undefined), true);
    });

    it('refreshes throughout settlement and stops after its deadline', () => {
        assert.deepEqual(
            resolveShadowMapRefreshTick({
                dynamicRefreshMs: undefined,
                nextDynamicRefreshAt: 0,
                now: 800,
                settleUntil: 900,
            }),
            {
                nextDynamicRefreshAt: 0,
                shouldRefresh: true,
                shouldRefreshDynamic: false,
                shouldRefreshSettling: true,
            },
        );
        assert.equal(
            resolveShadowMapRefreshTick({
                dynamicRefreshMs: undefined,
                nextDynamicRefreshAt: 0,
                now: 901,
                settleUntil: 900,
            }).shouldRefresh,
            false,
        );
    });

    it('refreshes dynamic shadows only when due without catch-up bursts', () => {
        const earlyTick = resolveShadowMapRefreshTick({
            dynamicRefreshMs: 96,
            nextDynamicRefreshAt: 1_000,
            now: 999,
            settleUntil: 0,
        });
        assert.equal(earlyTick.shouldRefresh, false);
        assert.equal(earlyTick.nextDynamicRefreshAt, 1_000);

        const dueTick = resolveShadowMapRefreshTick({
            dynamicRefreshMs: 96,
            nextDynamicRefreshAt: 1_000,
            now: 1_400,
            settleUntil: 0,
        });
        assert.equal(dueTick.shouldRefresh, true);
        assert.equal(dueTick.shouldRefreshDynamic, true);
        assert.equal(dueTick.nextDynamicRefreshAt, 1_496);
    });

    it('requests one update when dynamic and settlement refresh overlap', () => {
        const tick = resolveShadowMapRefreshTick({
            dynamicRefreshMs: 64,
            nextDynamicRefreshAt: 500,
            now: 500,
            settleUntil: 900,
        });

        assert.equal(tick.shouldRefresh, true);
        assert.equal(tick.shouldRefreshDynamic, true);
        assert.equal(tick.shouldRefreshSettling, true);
        assert.equal(tick.nextDynamicRefreshAt, 564);
    });
});
