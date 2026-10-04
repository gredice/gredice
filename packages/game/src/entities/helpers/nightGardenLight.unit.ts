import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    getNightGardenGlowAmount,
    getNightGardenLightPhase,
    resolveGardenNightLightEmissivePeakIntensity,
    resolveGardenNightLightIntensity,
    resolveNightGardenLightFrame,
} from './nightGardenLight';

describe('resolveGardenNightLightIntensity', () => {
    it('increases every garden light to ten times its base strength', () => {
        assert.equal(resolveGardenNightLightIntensity(1.35), 13.5);
        assert.equal(resolveGardenNightLightIntensity(2.6), 26);
    });

    it('keeps the colored source from rendering white-hot', () => {
        assert.ok(
            Math.abs(resolveGardenNightLightEmissivePeakIntensity(3.2) - 0.64) <
                0.000_001,
        );
    });
});

describe('getNightGardenGlowAmount', () => {
    it('keeps the light fully on during the shared night interval', () => {
        assert.equal(getNightGardenGlowAmount(0), 1);
        assert.equal(getNightGardenGlowAmount(0.2), 1);
        assert.equal(getNightGardenGlowAmount(0.8), 1);
        assert.equal(getNightGardenGlowAmount(1), 1);
    });

    it('fades through dawn and dusk without lighting the daytime garden', () => {
        assert.ok(Math.abs(getNightGardenGlowAmount(0.23) - 0.5) < 0.000_001);
        assert.equal(getNightGardenGlowAmount(0.26), 0);
        assert.equal(getNightGardenGlowAmount(0.5), 0);
        assert.equal(getNightGardenGlowAmount(0.74), 0);
        assert.ok(Math.abs(getNightGardenGlowAmount(0.77) - 0.5) < 0.000_001);
    });
});

describe('resolveNightGardenLightFrame', () => {
    it('keeps light and emissive values stable throughout full night', () => {
        const input = {
            emissiveBaseIntensity: 0.25,
            emissivePeakIntensity: 3.1,
            lightIntensity: 2.2,
            physicalLightSelected: true,
        };

        assert.deepEqual(
            resolveNightGardenLightFrame({ ...input, timeOfDay: 0 }),
            resolveNightGardenLightFrame({ ...input, timeOfDay: 0.2 }),
        );
    });

    it('keeps overflow lights emissive without enabling a physical light', () => {
        assert.deepEqual(
            resolveNightGardenLightFrame({
                emissiveBaseIntensity: 0.3,
                emissivePeakIntensity: 3,
                lightIntensity: 2,
                physicalLightSelected: false,
                timeOfDay: 0,
            }),
            {
                emissiveIntensity: 3,
                lightIntensity: 0,
                lightVisible: false,
            },
        );
    });
});

describe('night garden light phase', () => {
    it('uses a deterministic phase for each placed block', () => {
        assert.equal(
            getNightGardenLightPhase('FireflyJar:2:4'),
            getNightGardenLightPhase('FireflyJar:2:4'),
        );
        assert.notEqual(
            getNightGardenLightPhase('FireflyJar:2:4'),
            getNightGardenLightPhase('FireflyJar:3:4'),
        );
    });
});
