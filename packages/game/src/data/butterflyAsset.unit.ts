import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    gameAssetModels,
    lazyGameAssetNames,
} from './gameAssetModels.generated';

type JsonRecord = Record<string, unknown>;

const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const modelPath = fileURLToPath(
    new URL(
        '../../../../apps/garden/public/assets/models/Butterfly.glb',
        import.meta.url,
    ),
);
const manifestPath = fileURLToPath(
    new URL('../../../../assets/game-assets.json', import.meta.url),
);

function isRecord(value: unknown): value is JsonRecord {
    return typeof value === 'object' && value !== null;
}

function records(value: unknown, label: string) {
    assert.ok(Array.isArray(value), `${label} must be an array`);
    return value.map((item, index) => {
        assert.ok(isRecord(item), `${label}[${index}] must be an object`);
        return item;
    });
}

function numeric(value: unknown, label: string) {
    assert.equal(typeof value, 'number', `${label} must be numeric`);
    return value as number;
}

function readButterflyDocument() {
    const model = readFileSync(modelPath);
    const jsonLength = model.readUInt32LE(12);
    const document: unknown = JSON.parse(
        model.subarray(20, 20 + jsonLength).toString('utf8'),
    );
    assert.ok(isRecord(document));
    return {
        accessors: records(document.accessors, 'accessors'),
        meshes: records(document.meshes, 'meshes'),
        nodes: records(document.nodes, 'nodes'),
    };
}

describe('butterfly asset', () => {
    it('keeps the original Blender source, generator, and lazy GLB registration', () => {
        assert.ok(
            existsSync(`${repositoryRoot}assets/game-assets/Butterfly.blend`),
        );
        assert.ok(
            existsSync(`${repositoryRoot}assets/scripts/generate-butterfly.py`),
        );
        assert.equal(
            gameAssetModels.Butterfly.url,
            '/assets/models/Butterfly.glb',
        );
        assert.ok(lazyGameAssetNames.includes('Butterfly'));

        const manifest: unknown = JSON.parse(
            readFileSync(manifestPath, 'utf8'),
        );
        assert.ok(isRecord(manifest));
        const entry = records(manifest.assets, 'manifest.assets').find(
            ({ name }) => name === 'Butterfly',
        );
        assert.ok(entry);
        assert.equal(entry.source, 'Butterfly.blend');
        assert.equal(entry.output, 'Butterfly.glb');
        assert.equal(entry.preload, 'lazy');
    });

    it('exports articulated anatomy and independently hinged patterned wings', () => {
        const { nodes } = readButterflyDocument();
        const nodeNames = new Set(nodes.map(({ name }) => name));
        for (const name of [
            'Butterfly_Root',
            'Butterfly_BodyPivot',
            'Butterfly_HeadPivot',
            'Butterfly_WingPivot_L',
            'Butterfly_WingPivot_R',
            'Butterfly_Abdomen',
            'Butterfly_Thorax',
            'Butterfly_Head',
            'Butterfly_Antenna_L',
            'Butterfly_Antenna_R',
            'Butterfly_WingFore_L',
            'Butterfly_WingFore_R',
            'Butterfly_WingHind_L',
            'Butterfly_WingHind_R',
            'Butterfly_WingBand_L',
            'Butterfly_WingBand_R',
            'Butterfly_WingSpotOuter_L',
            'Butterfly_WingSpotOuter_R',
            'Butterfly_WingSpotInner_L',
            'Butterfly_WingSpotInner_R',
        ]) {
            assert.ok(nodeNames.has(name), `Missing ${name}`);
        }
        for (const side of ['L', 'R']) {
            for (let index = 1; index <= 3; index += 1) {
                assert.ok(
                    nodeNames.has(`Butterfly_Leg_${side}${index}`),
                    `Missing leg ${side}${index}`,
                );
            }
        }

        const leftPivotIndex = nodes.findIndex(
            ({ name }) => name === 'Butterfly_WingPivot_L',
        );
        const rightPivotIndex = nodes.findIndex(
            ({ name }) => name === 'Butterfly_WingPivot_R',
        );
        assert.ok(leftPivotIndex >= 0);
        assert.ok(rightPivotIndex >= 0);
        const wingParentIndices = nodes
            .map(({ children }, index) => ({ children, index }))
            .filter(({ children }) => Array.isArray(children))
            .flatMap(({ children, index }) =>
                (children as unknown[]).map((child) => ({ child, index })),
            );
        for (const [wingName, pivotIndex] of [
            ['Butterfly_WingFore_L', leftPivotIndex],
            ['Butterfly_WingHind_L', leftPivotIndex],
            ['Butterfly_WingFore_R', rightPivotIndex],
            ['Butterfly_WingHind_R', rightPivotIndex],
        ] as const) {
            const wingIndex = nodes.findIndex(({ name }) => name === wingName);
            assert.ok(
                wingParentIndices.some(
                    ({ child, index }) =>
                        numeric(child, `${wingName}.child`) === wingIndex &&
                        index === pivotIndex,
                ),
                `${wingName} must use its side's hinge`,
            );
        }
    });

    it('stays within a small wildlife mesh and vertex budget', () => {
        const { accessors, meshes } = readButterflyDocument();
        let vertexCount = 0;
        for (const mesh of meshes) {
            for (const primitive of records(mesh.primitives, 'primitives')) {
                assert.ok(isRecord(primitive.attributes));
                const positionAccessorIndex = numeric(
                    primitive.attributes.POSITION,
                    'POSITION accessor',
                );
                const accessor = accessors[positionAccessorIndex];
                assert.ok(accessor);
                vertexCount += numeric(accessor.count, 'vertex count');
            }
        }

        assert.ok(
            meshes.length <= 32,
            `Unexpected mesh count ${meshes.length}`,
        );
        assert.ok(
            vertexCount <= 3_000,
            `Unexpected vertex count ${vertexCount}`,
        );
        assert.ok(readFileSync(modelPath).byteLength <= 140_000);
    });
});
