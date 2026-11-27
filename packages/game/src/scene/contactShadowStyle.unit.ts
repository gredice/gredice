import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { terrainVergeDimensions } from '../entities/terrainRim/terrainVergeGeometry';
import {
    defaultGameCameraPosition,
    defaultGameCameraTarget,
} from '../gameCamera';
import {
    contactShadowSnowCrest,
    contactShadowSnowFade,
    contactShadowSurfaceLift,
    contactShadowTint,
    contactShadowVergeDepthBias,
    contactShadowVergeReach,
    resolveContactShadowLift,
    resolveContactShadowSnowCoverage,
    resolveContactShadowSnowStrength,
    resolveStaticContactShadowEdgeFade,
    staticContactShadowStrength,
} from './contactShadowStyle';

describe('contact shadow style', () => {
    it('tints shadows cool and never black', () => {
        const [red, green, blue] = contactShadowTint;

        for (const channel of contactShadowTint) {
            assert.ok(channel > 0.3 && channel < 1);
        }
        assert.ok(blue > green && green > red, 'warm light drops out first');
    });

    it('stays subtler where shadow maps already darken the ground', () => {
        assert.ok(
            staticContactShadowStrength.withShadowMaps <
                staticContactShadowStrength.withoutShadowMaps,
        );
        assert.ok(staticContactShadowStrength.withoutShadowMaps <= 1);
    });

    it('lifts blobs just above bare ground', () => {
        const snow = {
            coverageMultiplier: 1.5,
            crest: contactShadowSnowCrest,
            lift: 0.01,
            maxThickness: 0.1,
        };

        assert.equal(
            resolveContactShadowLift(0, snow),
            contactShadowSurfaceLift,
        );
        assert.equal(
            resolveContactShadowLift(Number.NaN, snow),
            contactShadowSurfaceLift,
        );
        assert.equal(
            resolveContactShadowLift(1, {
                coverageMultiplier: 1,
                crest: contactShadowSnowCrest,
                lift: 0,
                maxThickness: 0,
            }),
            contactShadowSurfaceLift,
        );
    });

    it('rises above the highest snow drift on its surface', () => {
        const snow = {
            coverageMultiplier: 1.5,
            crest: contactShadowSnowCrest,
            lift: 0.01,
            maxThickness: 0.1,
        };
        // The overlay's noise lifts drifts up to 35% above the average depth.
        const highestDrift = snow.lift + snow.maxThickness * 1.35;

        assert.ok(resolveContactShadowLift(1, snow) > highestDrift);
        assert.ok(resolveContactShadowLift(1, snow) < highestDrift + 0.01);
        assert.ok(
            resolveContactShadowLift(0.3, snow) <
                resolveContactShadowLift(0.6, snow),
        );
        // Coverage times the multiplier saturates like the overlay does.
        assert.equal(
            resolveContactShadowLift(0.7, snow),
            resolveContactShadowLift(1, snow),
        );
        assert.equal(
            resolveContactShadowLift(4, snow),
            resolveContactShadowLift(1, snow),
        );
    });

    it('rises only to the crest its surface reaches', () => {
        const snow = {
            coverageMultiplier: 1,
            crest: 0.8,
            lift: 0.003,
            maxThickness: 0.15,
        };

        assert.ok(
            Math.abs(
                resolveContactShadowLift(1, snow) -
                    (contactShadowSurfaceLift + 0.003 + 0.15 * 0.8),
            ) < 1e-12,
        );
        assert.ok(
            resolveContactShadowLift(1, snow) <
                resolveContactShadowLift(1, {
                    ...snow,
                    crest: contactShadowSnowCrest,
                }),
        );
    });

    it('fades blobs that snow lifts in front of what stands in it', () => {
        assert.equal(resolveContactShadowSnowStrength(0), 1);
        assert.equal(resolveContactShadowSnowStrength(Number.NaN), 1);
        assert.equal(
            resolveContactShadowSnowStrength(contactShadowSnowFade.start),
            1,
        );
        assert.equal(
            resolveContactShadowSnowStrength(contactShadowSnowFade.end),
            contactShadowSnowFade.minScale,
        );
        assert.equal(
            resolveContactShadowSnowStrength(1),
            contactShadowSnowFade.minScale,
        );
        assert.ok(
            resolveContactShadowSnowStrength(0.1) >
                resolveContactShadowSnowStrength(0.2),
        );
        assert.ok(
            contactShadowSnowFade.minScale >= 0.5,
            'a lifted blob still reads on the snow',
        );
    });

    it('fades wide pools out softly at a terrain edge', () => {
        // A tree crown pool spreads 0.4; a bucket blob about 0.12.
        assert.ok(resolveStaticContactShadowEdgeFade(0.4) >= 0.12);
        assert.ok(resolveStaticContactShadowEdgeFade(0.4) <= 0.16);
        assert.ok(resolveStaticContactShadowEdgeFade(0.12) <= 0.07);
        assert.ok(resolveStaticContactShadowEdgeFade(0) >= 0.05);
    });

    it('follows snow only once the quality tier draws it', () => {
        assert.equal(resolveContactShadowSnowCoverage(0.1, 0.35), 0);
        assert.equal(resolveContactShadowSnowCoverage(0.4, 0.35), 0.4);
        assert.equal(resolveContactShadowSnowCoverage(0.01, 0), 0.01);
        assert.equal(resolveContactShadowSnowCoverage(2, 0.02), 1);
        assert.equal(resolveContactShadowSnowCoverage(-1, 0), 0);
        assert.equal(resolveContactShadowSnowCoverage(Number.NaN, 0), 0);
    });

    it('clears the grass bank, and little more, from the game camera', () => {
        const [cx, cy, cz] = defaultGameCameraPosition;
        const [tx, ty, tz] = defaultGameCameraTarget;
        const horizontal = Math.hypot(cx - tx, cz - tz);
        const sinElevation = (cy - ty) / Math.hypot(horizontal, cy - ty);
        const clearedHeight =
            contactShadowSurfaceLift +
            contactShadowVergeDepthBias * sinElevation;

        assert.ok(clearedHeight > terrainVergeDimensions.rise);
        assert.ok(clearedHeight < terrainVergeDimensions.rise + 0.02);
        assert.ok(
            contactShadowVergeReach > terrainVergeDimensions.baseReach + 0.08,
            'covers the widest bank bulge over the path',
        );
        assert.ok(contactShadowVergeReach < 0.5);
    });
});
