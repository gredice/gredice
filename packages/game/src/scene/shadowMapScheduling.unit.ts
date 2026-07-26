import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    buildDirectionalShadowDepthSignature,
    requestPrimaryShadowMapRefresh,
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

describe('primary shadow refresh accounting', () => {
    it('marks and counts an enabled primary shadow refresh', () => {
        const shadowMap = { enabled: false, needsUpdate: false };

        assert.equal(requestPrimaryShadowMapRefresh(shadowMap, true, 4), 5);
        assert.deepEqual(shadowMap, {
            enabled: true,
            needsUpdate: true,
        });
    });

    it('does not touch or count the primary map while shadows are disabled', () => {
        const shadowMap = { enabled: false, needsUpdate: false };

        assert.equal(requestPrimaryShadowMapRefresh(shadowMap, false, 4), 4);
        assert.deepEqual(shadowMap, {
            enabled: false,
            needsUpdate: false,
        });
    });
});
