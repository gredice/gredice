import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Color } from 'three';
import { defaultGameWoodColor } from '../entities/woodPalette';

type WoodRole = 'deep' | 'light' | 'warm';

const referenceMaterials = {
    deep: 'Material.SmallWoodenBridge.DeepWood',
    light: 'Material.SmallWoodenBridge.LightWood',
    warm: 'Material.SmallWoodenBridge.WarmWood',
} satisfies Record<WoodRole, string>;

const timberAssetMaterials = {
    BeachChair: {
        BeachChair_DarkWood: 'warm',
        BeachChair_LightWood: 'warm',
        BeachChair_WarmWood: 'warm',
    },
    BirdHouse: {
        BH_flat_dark_wood: 'warm',
        BH_flat_light_wood: 'warm',
    },
    Bucket: { 'Material.Planks': 'warm' },
    Composter: { 'Material.Planks': 'warm' },
    DogHouse: {
        'Material.DogHouse.DarkRedWood': 'warm',
        'Material.DogHouse.RedWood': 'warm',
        'Material.DogHouse.WarmTrim': 'warm',
    },
    Fence: { 'Material.Planks': 'warm' },
    GardenBox: { 'Material.Planks': 'warm' },
    IceCreamCart: { wood: 'warm', wood_dark: 'warm' },
    LemonadeStand: {
        tan: 'warm',
        wood: 'warm',
        wood_dark: 'warm',
        wood_light: 'warm',
    },
    RaisedBed: { 'Material.Planks': 'warm' },
    Shade: { 'Material.Planks': 'warm' },
    Stool: { 'Material.Planks': 'warm' },
    WaterWell: { 'Material.Planks': 'warm' },
    WoodenBench: {
        WoodenBench_DarkWood: 'deep',
        WoodenBench_LightWood: 'light',
        WoodenBench_WarmWood: 'warm',
    },
} satisfies Record<string, Record<string, WoodRole>>;

const manifestPath = fileURLToPath(
    new URL('../../../../assets/game-assets.json', import.meta.url),
);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
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

function readEmissiveColor(materials: Record<string, unknown>[], name: string) {
    const material = materials.find((candidate) => candidate.name === name);
    assert.ok(material, `Missing material ${name}`);
    assert.ok(Array.isArray(material.emissiveFactor));
    assert.equal(material.emissiveFactor.length, 3);
    return material.emissiveFactor.map((value) => {
        assert.equal(typeof value, 'number');
        return value;
    });
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

function readManifestAssets() {
    const manifest: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'));
    assert.ok(isRecord(manifest));
    assert.ok(Array.isArray(manifest.assets));
    return manifest.assets.filter(isRecord);
}

describe('timber asset palette', () => {
    const bridgeMaterials = readMaterials('SmallWoodenBridge');
    const palette = Object.fromEntries(
        Object.entries(referenceMaterials).map(([role, materialName]) => [
            role,
            readBaseColor(bridgeMaterials, materialName),
        ]),
    );
    const referenceColor = palette.warm;
    assert.ok(referenceColor);
    const manifestAssets = readManifestAssets();

    it('uses the bridge middle plank as the default in-game wood color', () => {
        assertColorsEqual(
            new Color(defaultGameWoodColor).toArray(),
            referenceColor.slice(0, 3),
            0.002,
        );
    });

    it('keeps raised-bed planks visibly warm on shadowed faces', () => {
        assertColorsEqual(
            readEmissiveColor(readMaterials('RaisedBed'), 'Material.Planks'),
            referenceColor.slice(0, 3).map((channel) => channel * 0.45),
        );
    });

    for (const [assetName, expectedMaterials] of Object.entries(
        timberAssetMaterials,
    )) {
        const paletteDescription =
            assetName === 'WoodenBench'
                ? 'bridge plank palette'
                : 'bridge middle wood color';
        it(`${assetName} uses the ${paletteDescription} and a current cache version`, () => {
            const materials = readMaterials(assetName);
            for (const [materialName, role] of Object.entries(
                expectedMaterials,
            )) {
                const expectedColor = palette[role];
                assert.ok(expectedColor);
                assertColorsEqual(
                    readBaseColor(materials, materialName),
                    expectedColor,
                );
            }

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
        });
    }
});
