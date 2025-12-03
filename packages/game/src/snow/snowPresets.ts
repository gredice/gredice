import type { SnowMaterialOptions } from './SnowOverlay';

export const snowPresets = {
    grassFlat: {
        maxThickness: 0.1,
        slopeExponent: 2.4,
        noiseScale: 0.2,
    },
    grassAngle: {
        maxThickness: 0.18,
        slopeExponent: 2.4,
        noiseScale: 0.2,
        coverageMultiplier: 0.9,
    },
    sand: {
        maxThickness: 0.12,
        slopeExponent: 2.8,
        noiseScale: 0.2,
        coverageMultiplier: 0.9,
    },
    sandAngle: {
        maxThickness: 0.12,
        slopeExponent: 1.4,
        noiseScale: 0.2,
        coverageMultiplier: 0.85,
    },
    snow: {
        maxThickness: 0.15,
        slopeExponent: 3,
        noiseScale: 0.2,
    },
    snowAngle: {
        maxThickness: 0.15,
        slopeExponent: 1.2,
        noiseScale: 0.2,
        coverageMultiplier: 0.8,
    },
    giftBox: {
        maxThickness: 0.05,
        slopeExponent: 2.5,
        noiseScale: 1.5,
    },
    treeCanopyInner: {
        maxThickness: 0.5,
        slopeExponent: 0.1,
        noiseScale: 91,
        coverageMultiplier: 0.6,
    },
    pine: {
        maxThickness: 0.09,
        slopeExponent: 1.8,
        noiseScale: 7.5,
        coverageMultiplier: 0.6,
    },
    hay: {
        maxThickness: 0.02,
        slopeExponent: 1.4,
        noiseScale: 4,
        coverageMultiplier: 0.85,
    },
    mulch: {
        maxThickness: 0.01,
        slopeExponent: 2.6,
        noiseScale: 3,
    },
    tulip: {
        maxThickness: 0.06,
        slopeExponent: 1.8,
        noiseScale: 5,
        coverageMultiplier: 0.6,
    },
    bushCore: {
        maxThickness: 0.08,
        slopeExponent: 0.6,
        noiseScale: 2.4,
        coverageMultiplier: 0.65,
    },
    bushFoliage: {
        maxThickness: 0.07,
        slopeExponent: 1.5,
        noiseScale: 5,
        coverageMultiplier: 0.7,
    },
    stone: {
        maxThickness: 0.09,
        slopeExponent: 2.8,
        noiseScale: 2.2,
    },
    tool: {
        maxThickness: 0.01,
        slopeExponent: 3.5,
        noiseScale: 4.5,
        coverageMultiplier: 0.9,
    },
} satisfies Record<string, SnowMaterialOptions>;

export type SnowPresetKey = keyof typeof snowPresets;
