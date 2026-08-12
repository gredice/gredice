import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Color } from 'three';
import {
    defaultGameWoodColor,
    dogHouseWoodColors,
} from '../entities/woodPalette';

type WoodRole = 'bridgeDeep' | 'bridgeLight' | 'bridgeWarm' | 'default';

const referenceMaterials = {
    bridgeDeep: {
        asset: 'SmallWoodenBridge',
        material: 'Material.SmallWoodenBridge.DeepWood',
    },
    bridgeLight: {
        asset: 'SmallWoodenBridge',
        material: 'Material.SmallWoodenBridge.LightWood',
    },
    bridgeWarm: {
        asset: 'SmallWoodenBridge',
        material: 'Material.SmallWoodenBridge.WarmWood',
    },
    default: {
        asset: 'WoodenWalkway',
        material: 'Material.WoodenWalkway.WarmWood',
    },
} satisfies Record<WoodRole, { asset: string; material: string }>;

const timberAssetMaterials = {
    BeachChair: {
        BeachChair_DarkWood: 'default',
        BeachChair_LightWood: 'default',
        BeachChair_WarmWood: 'default',
    },
    BirdHouse: {
        BH_flat_dark_wood: 'default',
        BH_flat_light_wood: 'default',
    },
    Bucket: { 'Material.Planks': 'default' },
    Composter: { 'Material.Planks': 'default' },
    Fence: { 'Material.Planks': 'default' },
    GardenBox: { 'Material.Planks': 'default' },
    IceCreamCart: { wood: 'default', wood_dark: 'default' },
    LemonadeStand: {
        tan: 'default',
        wood: 'default',
        wood_dark: 'default',
        wood_light: 'default',
    },
    RaisedBed: { 'Material.Planks': 'default' },
    Shade: { 'Material.Planks': 'default' },
    Stool: { 'Material.Planks': 'default' },
    WaterWell: { 'Material.Planks': 'default' },
    WoodenBench: {
        WoodenBench_DarkWood: 'bridgeDeep',
        WoodenBench_LightWood: 'bridgeLight',
        WoodenBench_WarmWood: 'bridgeWarm',
    },
} satisfies Record<string, Record<string, WoodRole>>;

const manifestPath = fileURLToPath(
    new URL('../../../../assets/game-assets.json', import.meta.url),
);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function readNumber(value: unknown): number {
    if (typeof value !== 'number') {
        throw new TypeError(`Expected number, received ${typeof value}`);
    }
    return value;
}

function readGlbDocument(assetName: string): unknown {
    const modelPath = fileURLToPath(
        new URL(
            `../../../../apps/garden/public/assets/models/${assetName}.glb`,
            import.meta.url,
        ),
    );
    const model = readFileSync(modelPath);
    const jsonLength = model.readUInt32LE(12);
    return JSON.parse(model.subarray(20, 20 + jsonLength).toString('utf8'));
}

function readMaterials(assetName: string) {
    const document = readGlbDocument(assetName);
    assert.ok(isRecord(document));
    assert.ok(Array.isArray(document.materials));
    return document.materials.filter(isRecord);
}

function readBaseColor(materials: Record<string, unknown>[], name: string) {
    const material = materials.find((candidate) => candidate.name === name);
    assert.ok(material, `Missing material ${name}`);
    assert.ok(isRecord(material.pbrMetallicRoughness));
    const baseColor = material.pbrMetallicRoughness.baseColorFactor;
    assert.ok(Array.isArray(baseColor));
    assert.equal(baseColor.length, 4);
    return baseColor.map((value) => {
        assert.equal(typeof value, 'number');
        return value;
    });
}

function readSurfaceProfile(
    materials: Record<string, unknown>[],
    name: string,
) {
    const material = materials.find((candidate) => candidate.name === name);
    assert.ok(material, `Missing material ${name}`);
    assert.ok(isRecord(material.pbrMetallicRoughness));
    const metallic = readNumber(
        material.pbrMetallicRoughness.metallicFactor ?? 1,
    );
    const roughness = readNumber(
        material.pbrMetallicRoughness.roughnessFactor ?? 1,
    );
    const emissive = material.emissiveFactor ?? [0, 0, 0];
    assert.ok(Array.isArray(emissive));
    assert.equal(emissive.length, 3);
    return {
        baseColor: readBaseColor(materials, name),
        emissive: emissive.map(readNumber),
        metallic,
        roughness,
    };
}

function assertColorsEqual(
    actual: number[],
    expected: number[],
    epsilon = 0.000_001,
) {
    assert.equal(actual.length, expected.length);
    for (const [index, value] of actual.entries()) {
        assert.ok(
            Math.abs(value - expected[index]) < epsilon,
            `Color channel ${index} differs: ${value} != ${expected[index]}`,
        );
    }
}

function assertSurfaceProfilesEqual(
    actual: ReturnType<typeof readSurfaceProfile>,
    expected: ReturnType<typeof readSurfaceProfile>,
) {
    assertColorsEqual(actual.baseColor, expected.baseColor);
    assertColorsEqual(actual.emissive, expected.emissive);
    assert.ok(Math.abs(actual.metallic - expected.metallic) < 0.000_001);
    assert.ok(Math.abs(actual.roughness - expected.roughness) < 0.000_001);
}

function readManifestAssets() {
    const manifest: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'));
    assert.ok(isRecord(manifest));
    assert.ok(Array.isArray(manifest.assets));
    return manifest.assets.filter(isRecord);
}

function assertCurrentCacheVersion(
    assetName: string,
    manifestAssets: Record<string, unknown>[],
) {
    const asset = manifestAssets.find(
        (candidate) => candidate.name === assetName,
    );
    assert.ok(asset);
    assert.equal(typeof asset.output, 'string');
    assert.equal(typeof asset.version, 'string');
    const modelPath = fileURLToPath(
        new URL(
            `../../../../apps/garden/public/assets/models/${asset.output}`,
            import.meta.url,
        ),
    );
    const expectedVersion = createHash('sha256')
        .update(readFileSync(modelPath))
        .digest('hex')
        .slice(0, 12);
    assert.equal(asset.version, expectedVersion);
}

describe('timber asset palette', () => {
    const referenceProfiles = Object.fromEntries(
        Object.entries(referenceMaterials).map(([role, reference]) => [
            role,
            readSurfaceProfile(
                readMaterials(reference.asset),
                reference.material,
            ),
        ]),
    );
    const referenceProfile = referenceProfiles.default;
    assert.ok(referenceProfile);
    const manifestAssets = readManifestAssets();

    it('uses the walkway warm plank as the default in-game wood color', () => {
        assertColorsEqual(
            new Color(defaultGameWoodColor).toArray(),
            referenceProfile.baseColor.slice(0, 3),
            0.002,
        );
    });

    it('uses the complete walkway warm profile for raised-bed planks', () => {
        const raisedBedProfile = readSurfaceProfile(
            readMaterials('RaisedBed'),
            'Material.Planks',
        );
        assert.equal(raisedBedProfile.metallic, 0);
        assertSurfaceProfilesEqual(raisedBedProfile, referenceProfile);
    });

    it('restores the doghouse multi-tone wood palette', () => {
        assert.deepEqual(dogHouseWoodColors, {
            darkWall: '#3f2618',
            roof: '#5f3a22',
            trim: '#b8793d',
            wall: '#7a4f2b',
        });
        assert.equal(new Set(Object.values(dogHouseWoodColors)).size, 4);

        const dogHouseMaterials = readMaterials('DogHouse');
        const expectedProfiles = {
            'Material.DogHouse.DarkRedWood': {
                baseColor: [0.3, 0.18, 0.1, 1],
                emissive: [0, 0, 0],
                metallic: 0,
                roughness: 0.94,
            },
            'Material.DogHouse.RedWood': {
                baseColor: [0.48, 0.31, 0.17, 1],
                emissive: [0, 0, 0],
                metallic: 0,
                roughness: 0.92,
            },
            'Material.DogHouse.WarmTrim': {
                baseColor: [0.72, 0.47, 0.24, 1],
                emissive: [0, 0, 0],
                metallic: 0,
                roughness: 0.86,
            },
        };
        for (const [materialName, expectedProfile] of Object.entries(
            expectedProfiles,
        )) {
            assertSurfaceProfilesEqual(
                readSurfaceProfile(dogHouseMaterials, materialName),
                expectedProfile,
            );
        }
        assertCurrentCacheVersion('DogHouse', manifestAssets);
    });

    for (const [assetName, expectedMaterials] of Object.entries(
        timberAssetMaterials,
    )) {
        const paletteDescription =
            assetName === 'WoodenBench'
                ? 'bridge plank palette'
                : 'walkway warm wood profile';
        it(`${assetName} uses the ${paletteDescription} and a current cache version`, () => {
            const materials = readMaterials(assetName);
            for (const [materialName, role] of Object.entries(
                expectedMaterials,
            )) {
                const expectedProfile = referenceProfiles[role];
                assert.ok(expectedProfile);
                assertSurfaceProfilesEqual(
                    readSurfaceProfile(materials, materialName),
                    expectedProfile,
                );
            }
            assertCurrentCacheVersion(assetName, manifestAssets);
        });
    }
});
