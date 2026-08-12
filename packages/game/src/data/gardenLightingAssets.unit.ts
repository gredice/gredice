import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    allGameAssetNames,
    gameAssetModels,
    lazyGameAssetNames,
} from './gameAssetModels.generated';

const assetSpecs = [
    {
        name: 'StoneWalkway',
        objects: [
            'StoneWalkway_StonesLight',
            'StoneWalkway_StonesMid',
            'StoneWalkway_StonesWarm',
        ],
        materials: [
            'Material.StoneWalkway.LightStone',
            'Material.StoneWalkway.MidStone',
            'Material.StoneWalkway.WarmStone',
        ],
        horizontalLimit: 0.5,
        depthLimit: 0.5,
        heightRange: [0.063, 0.065],
        vertexLimit: 1_000,
    },
    {
        name: 'EnamelGardenLamp',
        objects: [
            'EnamelGardenLamp_WoodPost',
            'EnamelGardenLamp_LimestoneFoot',
            'EnamelGardenLamp_EnamelShade',
            'EnamelGardenLamp_MetalTrim',
            'EnamelGardenLamp_Bulb',
        ],
        materials: [
            'Material.EnamelGardenLamp.BlueEnamel',
            'Material.EnamelGardenLamp.DarkMetal',
            'Material.EnamelGardenLamp.Glow',
            'Material.EnamelGardenLamp.Limestone',
            'Material.EnamelGardenLamp.Wood',
        ],
        horizontalLimit: 0.5,
        depthLimit: 0.5,
        heightRange: [1.4, 1.42],
        vertexLimit: 3_000,
    },
    {
        name: 'DoubleGardenLightPole',
        objects: [
            'DoubleGardenLightPole_LimestoneBase',
            'DoubleGardenLightPole_Wood',
            'DoubleGardenLightPole_Shades',
            'DoubleGardenLightPole_DarkMetal',
            'DoubleGardenLightPole_BulbLeft',
            'DoubleGardenLightPole_BulbRight',
        ],
        materials: [
            'Material.DoubleGardenLightPole.DarkMetal',
            'Material.DoubleGardenLightPole.Glow',
            'Material.DoubleGardenLightPole.Limestone',
            'Material.DoubleGardenLightPole.WarmWood',
            'Material.DoubleGardenLightPole.WarmEnamel',
        ],
        horizontalLimit: 0.5,
        depthLimit: 0.5,
        heightRange: [2.18, 2.2],
        // The symmetric two-head fixture remains below the existing
        // single-lamp budget (3,000) while retaining readable wood bevels.
        vertexLimit: 2_500,
    },
    {
        name: 'HazelLightArch',
        objects: [
            'HazelLightArch_Poles',
            'HazelLightArch_TerracottaShades',
            'HazelLightArch_Cords',
            'HazelLightArch_Bulbs',
        ],
        materials: [
            'Material.HazelLightArch.DarkCord',
            'Material.HazelLightArch.Glow',
            'Material.HazelLightArch.HazelWood',
            'Material.HazelLightArch.Terracotta',
        ],
        // A single planar gateway reaches the edges of one tile while keeping
        // a narrow side profile.
        horizontalLimit: 0.24,
        depthLimit: 0.505,
        heightRange: [1.53, 1.55],
        vertexLimit: 8_500,
    },
    {
        name: 'RoofTileLantern',
        objects: [
            'RoofTileLantern_Tiles',
            'RoofTileLantern_LimestoneCore',
            'RoofTileLantern_Glow',
        ],
        materials: [
            'Material.RoofTileLantern.Glow',
            'Material.RoofTileLantern.Limestone',
            'Material.RoofTileLantern.Terracotta',
        ],
        horizontalLimit: 0.5,
        depthLimit: 0.5,
        heightRange: [0.35, 0.4],
        vertexLimit: 2_500,
    },
    {
        name: 'WickerGardenLantern',
        objects: [
            'WickerGardenLantern_Wicker',
            'WickerGardenLantern_TerracottaBase',
            'WickerGardenLantern_LimestoneBase',
            'WickerGardenLantern_Glow',
        ],
        materials: [
            'Material.WickerGardenLantern.Glow',
            'Material.WickerGardenLantern.Limestone',
            'Material.WickerGardenLantern.Terracotta',
            'Material.WickerGardenLantern.Wicker',
        ],
        horizontalLimit: 0.5,
        depthLimit: 0.5,
        heightRange: [0.65, 0.68],
        vertexLimit: 13_000,
    },
    {
        name: 'WoodenHandLantern',
        objects: [
            'WoodenHandLantern_Frame',
            'WoodenHandLantern_Handle',
            'WoodenHandLantern_Metal',
            'WoodenHandLantern_Glass',
            'WoodenHandLantern_Glow',
        ],
        materials: [
            'Material.WoodenHandLantern.DarkMetal',
            'Material.WoodenHandLantern.Glass',
            'Material.WoodenHandLantern.Glow',
            'Material.WoodenHandLantern.Wood',
        ],
        horizontalLimit: 0.5,
        depthLimit: 0.5,
        heightRange: [0.6, 0.62],
        vertexLimit: 4_500,
    },
    {
        name: 'MoonRainBarrel',
        objects: [
            'MoonRainBarrel_Staves',
            'MoonRainBarrel_Bands',
            'MoonRainBarrel_Tap',
            'MoonRainBarrel_Lid',
            'MoonRainBarrel_Water',
            'MoonRainBarrel_Leaf',
            'MoonRainBarrel_MoonStone',
            'MoonRainBarrel_LimestoneFeet',
        ],
        materials: [
            'Material.MoonRainBarrel.Brass',
            'Material.MoonRainBarrel.Leaf',
            'Material.MoonRainBarrel.Limestone',
            'Material.MoonRainBarrel.MoonStone',
            'Material.MoonRainBarrel.Water',
            'Material.MoonRainBarrel.Wood',
            'Material.MoonRainBarrel.Zinc',
        ],
        horizontalLimit: 0.5,
        depthLimit: 0.5,
        heightRange: [0.85, 1],
        vertexLimit: 7_000,
    },
    {
        name: 'FishingBoat',
        objects: [
            'FishingBoat_HullWoodDark',
            'FishingBoat_HullWood',
            'FishingBoat_InteriorWood',
            'FishingBoat_Benches',
            'FishingBoat_Oars',
            'FishingBoat_Rope',
            'FishingBoat_Net',
            'FishingBoat_Floats',
            'FishingBoat_Metal',
            'FishingBoat_Ripples',
        ],
        materials: [
            'Material.FishingBoat.DarkWarmWood',
            'Material.FishingBoat.DarkMetal',
            'Material.FishingBoat.FloatGold',
            'Material.FishingBoat.HullWood',
            'Material.FishingBoat.InteriorWood',
            'Material.FishingBoat.Net',
            'Material.FishingBoat.Ripple',
            'Material.FishingBoat.Rope',
            'Material.FishingBoat.WarmWood',
        ],
        horizontalLimit: 0.48,
        depthLimit: 0.96,
        heightRange: [0.59, 0.63],
        vertexLimit: 5_100,
    },
] as const;

const manifestPath = fileURLToPath(
    new URL('../../../../assets/game-assets.json', import.meta.url),
);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isNumberArray(value: unknown): value is number[] {
    return (
        Array.isArray(value) && value.every((item) => typeof item === 'number')
    );
}

function readGlbDocument(model: Buffer): Record<string, unknown> {
    const jsonLength = model.readUInt32LE(12);
    const document: unknown = JSON.parse(
        model.subarray(20, 20 + jsonLength).toString('utf8'),
    );
    assert.ok(isRecord(document));
    return document;
}

function getPositionAccessors(document: Record<string, unknown>) {
    assert.ok(Array.isArray(document.meshes));
    assert.ok(Array.isArray(document.accessors));
    const accessors = document.accessors;

    return document.meshes.flatMap((mesh) => {
        assert.ok(isRecord(mesh));
        assert.ok(Array.isArray(mesh.primitives));

        return mesh.primitives.map((primitive) => {
            assert.ok(isRecord(primitive));
            assert.ok(isRecord(primitive.attributes));
            const positionIndex = primitive.attributes.POSITION;
            assert.ok(typeof positionIndex === 'number');
            const accessor = accessors[positionIndex];
            assert.ok(isRecord(accessor));
            assert.ok(isNumberArray(accessor.min));
            assert.ok(isNumberArray(accessor.max));
            assert.ok(typeof accessor.count === 'number');
            return {
                count: accessor.count,
                maximum: accessor.max,
                minimum: accessor.min,
            };
        });
    });
}

function getNodePositionBounds(
    document: Record<string, unknown>,
    nodeName: string,
) {
    assert.ok(Array.isArray(document.nodes));
    assert.ok(Array.isArray(document.meshes));
    assert.ok(Array.isArray(document.accessors));

    const node = document.nodes.find(
        (candidate) => isRecord(candidate) && candidate.name === nodeName,
    );
    assert.ok(isRecord(node));
    assert.ok(typeof node.mesh === 'number');

    const mesh = document.meshes[node.mesh];
    assert.ok(isRecord(mesh));
    assert.ok(Array.isArray(mesh.primitives));
    assert.equal(mesh.primitives.length, 1);

    const primitive = mesh.primitives[0];
    assert.ok(isRecord(primitive));
    assert.ok(isRecord(primitive.attributes));
    const positionIndex = primitive.attributes.POSITION;
    assert.ok(typeof positionIndex === 'number');

    const accessor = document.accessors[positionIndex];
    assert.ok(isRecord(accessor));
    assert.ok(isNumberArray(accessor.min));
    assert.ok(isNumberArray(accessor.max));

    return { maximum: accessor.max, minimum: accessor.min };
}

function getMaterialBaseColor(
    document: Record<string, unknown>,
    materialName: string,
) {
    assert.ok(Array.isArray(document.materials));
    const material = document.materials.find(
        (candidate) => isRecord(candidate) && candidate.name === materialName,
    );
    assert.ok(isRecord(material));
    assert.ok(isRecord(material.pbrMetallicRoughness));
    const color = material.pbrMetallicRoughness.baseColorFactor;
    assert.ok(isNumberArray(color));
    assert.equal(color.length, 4);
    return color;
}

function sortedNames(value: unknown) {
    assert.ok(Array.isArray(value));
    return value
        .map((item) => {
            assert.ok(isRecord(item));
            assert.ok(typeof item.name === 'string');
            return item.name;
        })
        .toSorted();
}

function getNodeBounds(document: Record<string, unknown>, nodeName: string) {
    assert.ok(Array.isArray(document.nodes));
    assert.ok(Array.isArray(document.meshes));
    const node = document.nodes.find(
        (candidate) => isRecord(candidate) && candidate.name === nodeName,
    );
    assert.ok(isRecord(node));
    assert.ok(typeof node.mesh === 'number');
    const mesh = document.meshes[node.mesh];
    assert.ok(isRecord(mesh));
    assert.ok(Array.isArray(mesh.primitives));
    const accessors = getPositionAccessors({
        accessors: document.accessors,
        meshes: [mesh],
    });

    return {
        maximum: [0, 1, 2].map((axis) =>
            Math.max(...accessors.map((accessor) => accessor.maximum[axis])),
        ),
        minimum: [0, 1, 2].map((axis) =>
            Math.min(...accessors.map((accessor) => accessor.minimum[axis])),
        ),
    };
}

describe('generated garden decoration assets', () => {
    const manifestDocument: unknown = JSON.parse(
        readFileSync(manifestPath, 'utf8'),
    );
    assert.ok(isRecord(manifestDocument));
    assert.ok(Array.isArray(manifestDocument.assets));
    const manifestAssets = manifestDocument.assets;

    for (const spec of assetSpecs) {
        const modelPath = fileURLToPath(
            new URL(
                `../../../../apps/garden/public/assets/models/${spec.name}.glb`,
                import.meta.url,
            ),
        );

        it(`${spec.name} matches its source contract and lazy registry`, () => {
            const model = readFileSync(modelPath);
            const version = createHash('sha256')
                .update(model)
                .digest('hex')
                .slice(0, 12);
            const document = readGlbDocument(model);
            const asset = manifestAssets.find(
                (candidate) =>
                    isRecord(candidate) && candidate.name === spec.name,
            );

            assert.ok(isRecord(asset));
            assert.equal(asset.source, `${spec.name}.blend`);
            assert.equal(asset.output, `${spec.name}.glb`);
            assert.equal(asset.preload, 'lazy');
            assert.equal(asset.version, version);
            assert.deepEqual(asset.objects, spec.objects);
            assert.deepEqual(
                sortedNames(document.nodes),
                [...spec.objects].toSorted(),
            );
            assert.deepEqual(
                sortedNames(document.materials),
                [...spec.materials].toSorted(),
            );
            assert.equal(
                gameAssetModels[spec.name].url,
                `/assets/models/${spec.name}.glb?v=${version}`,
            );
            assert.ok(lazyGameAssetNames.includes(spec.name));
            assert.ok(allGameAssetNames.includes(spec.name));
        });

        it(`${spec.name} stays grounded inside its placement footprint`, () => {
            const document = readGlbDocument(readFileSync(modelPath));
            const accessors = getPositionAccessors(document);
            const minimum = [0, 1, 2].map((axis) =>
                Math.min(
                    ...accessors.map((accessor) => accessor.minimum[axis]),
                ),
            );
            const maximum = [0, 1, 2].map((axis) =>
                Math.max(
                    ...accessors.map((accessor) => accessor.maximum[axis]),
                ),
            );
            const vertexCount = accessors.reduce(
                (total, accessor) => total + accessor.count,
                0,
            );

            assert.ok(Math.abs(minimum[1]) < 0.000_01);
            assert.ok(minimum[0] >= -spec.horizontalLimit);
            assert.ok(maximum[0] <= spec.horizontalLimit);
            assert.ok(minimum[2] >= -spec.depthLimit);
            assert.ok(maximum[2] <= spec.depthLimit);
            assert.ok(maximum[1] >= spec.heightRange[0]);
            assert.ok(maximum[1] <= spec.heightRange[1]);
            assert.ok(vertexCount <= spec.vertexLimit);
        });
    }

    it('joins the StoneWalkway paving at all four edges of its tile', () => {
        const modelPath = fileURLToPath(
            new URL(
                '../../../../apps/garden/public/assets/models/StoneWalkway.glb',
                import.meta.url,
            ),
        );
        const document = readGlbDocument(readFileSync(modelPath));
        const light = getNodePositionBounds(
            document,
            'StoneWalkway_StonesLight',
        );
        const middle = getNodePositionBounds(
            document,
            'StoneWalkway_StonesMid',
        );
        const warm = getNodePositionBounds(document, 'StoneWalkway_StonesWarm');

        const bounds = [light, middle, warm];

        assert.ok(
            Math.min(...bounds.map(({ minimum }) => minimum[0])) <= -0.499_99,
        );
        assert.ok(
            Math.max(...bounds.map(({ maximum }) => maximum[0])) >= 0.499_99,
        );
        assert.ok(
            Math.min(...bounds.map(({ minimum }) => minimum[2])) <= -0.499_99,
        );
        assert.ok(
            Math.max(...bounds.map(({ maximum }) => maximum[2])) >= 0.499_99,
        );
    });

    it('keeps the double pole bulbs opposed along local X', () => {
        const modelPath = fileURLToPath(
            new URL(
                '../../../../apps/garden/public/assets/models/DoubleGardenLightPole.glb',
                import.meta.url,
            ),
        );
        const document = readGlbDocument(readFileSync(modelPath));
        const left = getNodePositionBounds(
            document,
            'DoubleGardenLightPole_BulbLeft',
        );
        const right = getNodePositionBounds(
            document,
            'DoubleGardenLightPole_BulbRight',
        );

        assert.ok(left.maximum[0] < 0);
        assert.ok(right.minimum[0] > 0);
        assert.ok(Math.abs(left.minimum[0] + right.maximum[0]) < 0.000_01);
        assert.deepEqual(left.minimum.slice(1), right.minimum.slice(1));
        assert.deepEqual(left.maximum.slice(1), right.maximum.slice(1));
    });

    it('keeps the StoneWalkway palette in one warm limestone family', () => {
        const walkwayModelPath = fileURLToPath(
            new URL(
                '../../../../apps/garden/public/assets/models/StoneWalkway.glb',
                import.meta.url,
            ),
        );
        const walkway = readGlbDocument(readFileSync(walkwayModelPath));

        for (const materialName of [
            'Material.StoneWalkway.LightStone',
            'Material.StoneWalkway.MidStone',
            'Material.StoneWalkway.WarmStone',
        ]) {
            const color = getMaterialBaseColor(walkway, materialName).slice(
                0,
                3,
            );
            assert.ok(color[0] > color[1]);
            assert.ok(color[1] > color[2]);
            assert.ok(color[0] - color[2] >= 0.2);
        }
    });

    it('HazelLightArch remains one thin free-standing one-tile gateway', () => {
        const modelPath = fileURLToPath(
            new URL(
                '../../../../apps/garden/public/assets/models/HazelLightArch.glb',
                import.meta.url,
            ),
        );
        const document = readGlbDocument(readFileSync(modelPath));
        const poles = getNodeBounds(document, 'HazelLightArch_Poles');
        const shades = getNodeBounds(
            document,
            'HazelLightArch_TerracottaShades',
        );
        const bulbs = getNodeBounds(document, 'HazelLightArch_Bulbs');
        const width = poles.maximum[0] - poles.minimum[0];
        const depth = poles.maximum[2] - poles.minimum[2];
        const shadeDepth = shades.maximum[2] - shades.minimum[2];

        // A square shoe or under-block would widen the 0.104-unit round posts.
        assert.ok(width <= 0.11);
        assert.ok(depth >= 0.98);
        assert.ok(depth <= 1.01);
        assert.ok(poles.minimum[2] >= -0.5);
        assert.ok(poles.maximum[2] <= 0.5);
        assert.ok(depth - shadeDepth >= 0.25);
        assert.ok(depth >= width * 8);
        assert.ok(bulbs.minimum[1] >= 1.16);
        assert.ok(Math.abs(poles.minimum[1]) < 0.000_01);
    });

    it('WoodenHandLantern rests directly on its wooden frame', () => {
        const modelPath = fileURLToPath(
            new URL(
                '../../../../apps/garden/public/assets/models/WoodenHandLantern.glb',
                import.meta.url,
            ),
        );
        const document = readGlbDocument(readFileSync(modelPath));
        const frame = getNodeBounds(document, 'WoodenHandLantern_Frame');

        assert.ok(Math.abs(frame.minimum[1]) < 0.000_01);
        assert.ok(frame.maximum[0] - frame.minimum[0] <= 0.405);
    });
});
