import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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

function numericVector(value: unknown, label: string) {
    assert.ok(Array.isArray(value), `${label} must be an array`);
    assert.equal(value.length, 3, `${label} must have three channels`);
    return value.map((channel, index) =>
        numeric(channel, `${label}[${index}]`),
    );
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

function nodeBounds(nodeName: string) {
    const { accessors, meshes, nodes } = readButterflyDocument();
    const node = nodes.find(({ name }) => name === nodeName);
    assert.ok(node, `Missing ${nodeName}`);
    const meshIndex = numeric(node.mesh, `${nodeName}.mesh`);
    const mesh = meshes[meshIndex];
    assert.ok(mesh, `Missing ${nodeName} mesh`);
    const bounds = records(mesh.primitives, `${nodeName}.primitives`).map(
        (primitive, index) => {
            assert.ok(isRecord(primitive.attributes));
            const accessorIndex = numeric(
                primitive.attributes.POSITION,
                `${nodeName}.primitives[${index}].POSITION`,
            );
            const accessor = accessors[accessorIndex];
            assert.ok(accessor, `Missing ${nodeName} accessor`);
            return {
                maximum: numericVector(accessor.max, `${nodeName}.max`),
                minimum: numericVector(accessor.min, `${nodeName}.min`),
            };
        },
    );
    return {
        maximum: [0, 1, 2].map((axis) =>
            Math.max(...bounds.map(({ maximum }) => maximum[axis] ?? 0)),
        ),
        minimum: [0, 1, 2].map((axis) =>
            Math.min(...bounds.map(({ minimum }) => minimum[axis] ?? 0)),
        ),
    };
}

function span(bounds: { maximum: number[]; minimum: number[] }, axis: number) {
    const maximum = bounds.maximum[axis];
    const minimum = bounds.minimum[axis];
    assert.equal(typeof maximum, 'number');
    assert.equal(typeof minimum, 'number');
    return maximum - minimum;
}

describe('butterfly asset', () => {
    it('keeps the original Blender source, generator, and lazy GLB registration', () => {
        assert.ok(
            existsSync(`${repositoryRoot}assets/game-assets/Butterfly.blend`),
        );
        assert.ok(
            existsSync(`${repositoryRoot}assets/scripts/generate-butterfly.py`),
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
        const expectedVersion = createHash('sha256')
            .update(readFileSync(modelPath))
            .digest('hex')
            .slice(0, 12);
        assert.equal(entry.version, expectedVersion);
        assert.equal(
            gameAssetModels.Butterfly.url,
            `/assets/models/Butterfly.glb?v=${expectedVersion}`,
        );
    });

    it('keeps a compact body beneath broad, readable wings', () => {
        const abdomen = nodeBounds('Butterfly_Abdomen');
        const thorax = nodeBounds('Butterfly_Thorax');
        const foreWing = nodeBounds('Butterfly_WingFore_L');
        const abdomenWidth = span(abdomen, 0);
        const thoraxWidth = span(thorax, 0);
        const foreWingWidth = span(foreWing, 0);
        const foreWingLength = span(foreWing, 2);

        assert.ok(abdomenWidth <= 0.12, `Abdomen width ${abdomenWidth}`);
        assert.ok(thoraxWidth <= 0.19, `Thorax width ${thoraxWidth}`);
        assert.ok(foreWingWidth >= 0.94, `Forewing width ${foreWingWidth}`);
        assert.ok(foreWingLength >= 0.86, `Forewing length ${foreWingLength}`);
        assert.ok(
            foreWingWidth / abdomenWidth >= 8,
            `Wing/body ratio ${foreWingWidth / abdomenWidth}`,
        );
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
