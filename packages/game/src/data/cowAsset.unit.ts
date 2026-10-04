import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { gameAssetModels } from './gameAssetModels.generated';

type JsonRecord = Record<string, unknown>;

const manifestPath = fileURLToPath(
    new URL('../../../../assets/game-assets.json', import.meta.url),
);
const sourcePath = fileURLToPath(
    new URL('../../../../assets/game-assets/Cow.blend', import.meta.url),
);
const modelPath = fileURLToPath(
    new URL(
        '../../../../apps/garden/public/assets/models/Cow.glb',
        import.meta.url,
    ),
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

function readCowDocument() {
    const model = readFileSync(modelPath);
    const jsonLength = model.readUInt32LE(12);
    const document: unknown = JSON.parse(
        model.subarray(20, 20 + jsonLength).toString('utf8'),
    );
    assert.ok(isRecord(document));
    return document;
}

function numeric(value: unknown, label: string) {
    assert.equal(typeof value, 'number', `${label} must be numeric`);
    return value as number;
}

function nodeChildrenNames(document: JsonRecord, nodeName: string) {
    const nodes = records(document.nodes, 'Cow.nodes');
    const node = nodes.find((candidate) => candidate.name === nodeName);
    assert.ok(node, `Missing ${nodeName}`);
    assert.ok(Array.isArray(node.children), `${nodeName} needs children`);
    return node.children.map((childIndex) => {
        const child = nodes[numeric(childIndex, `${nodeName}.child`)];
        assert.ok(child, `Missing child of ${nodeName}`);
        assert.equal(typeof child.name, 'string');
        return child.name;
    });
}

function nodePositionBounds(document: JsonRecord, nodeName: string) {
    const nodes = records(document.nodes, 'Cow.nodes');
    const meshes = records(document.meshes, 'Cow.meshes');
    const accessors = records(document.accessors, 'Cow.accessors');
    const node = nodes.find((candidate) => candidate.name === nodeName);
    assert.ok(node, `Missing ${nodeName}`);
    const mesh = meshes[numeric(node.mesh, `${nodeName}.mesh`)];
    assert.ok(mesh, `Missing mesh for ${nodeName}`);
    const primitives = records(mesh.primitives, `${nodeName}.primitives`);
    const bounds = primitives.map((primitive, index) => {
        assert.ok(isRecord(primitive.attributes));
        const accessor =
            accessors[
                numeric(
                    primitive.attributes.POSITION,
                    `${nodeName}.primitives[${index}].POSITION`,
                )
            ];
        assert.ok(accessor, `Missing accessor for ${nodeName}`);
        assert.ok(Array.isArray(accessor.min));
        assert.ok(Array.isArray(accessor.max));
        return {
            maximum: accessor.max.map((channel, axis) =>
                numeric(channel, `${nodeName}.max[${axis}]`),
            ),
            minimum: accessor.min.map((channel, axis) =>
                numeric(channel, `${nodeName}.min[${axis}]`),
            ),
        };
    });
    return {
        maximum: [0, 1, 2].map((axis) =>
            Math.max(...bounds.map(({ maximum }) => maximum[axis] ?? 0)),
        ),
        minimum: [0, 1, 2].map((axis) =>
            Math.min(...bounds.map(({ minimum }) => minimum[axis] ?? 0)),
        ),
    };
}

describe('Cow source and runtime asset', () => {
    it('keeps the original Blender source and every procedural rig pivot', () => {
        assert.ok(readFileSync(sourcePath).byteLength > 10_000);
        const document = readCowDocument();
        const nodeNames = new Set(
            records(document.nodes, 'Cow.nodes').map((node) => node.name),
        );

        for (const nodeName of [
            'Cow_Root',
            'Cow_BodyPivot',
            'Cow_NeckPivot',
            'Cow_HeadPivot',
            'Cow_JawPivot',
            'Cow_EarPivot_L',
            'Cow_EarPivot_R',
            'Cow_TailPivot_Base',
            'Cow_TailPivot_Tip',
            'Cow_LegPivot_FL',
            'Cow_LegPivot_FR',
            'Cow_LegPivot_RL',
            'Cow_LegPivot_RR',
        ]) {
            assert.equal(nodeNames.has(nodeName), true, `Missing ${nodeName}`);
        }
    });

    it('exports exactly the two independently selectable coat patch groups', () => {
        const document = readCowDocument();
        const nodeNames = records(document.nodes, 'Cow.nodes')
            .map((node) => node.name)
            .filter(
                (name): name is string =>
                    typeof name === 'string' && name.startsWith('Cow_Coat_'),
            );
        const materialNames = new Set(
            records(document.materials, 'Cow.materials').map(
                (material) => material.name,
            ),
        );

        assert.deepEqual(nodeNames.sort(), [
            'Cow_Coat_BlackPatches',
            'Cow_Coat_BrownPatches',
        ]);
        assert.equal(materialNames.has('Material.Cow.Black'), true);
        assert.equal(materialNames.has('Material.Cow.Brown'), true);
        assert.equal(materialNames.has('Material.Cow.Cream'), true);
    });

    it('keeps the walking legs attached to the body and the tail behind it', () => {
        const document = readCowDocument();
        const nodes = records(document.nodes, 'Cow.nodes');
        const bodyChildren = nodeChildrenNames(document, 'Cow_BodyPivot');

        for (const legName of [
            'Cow_LegPivot_FL',
            'Cow_LegPivot_FR',
            'Cow_LegPivot_RL',
            'Cow_LegPivot_RR',
        ]) {
            assert.ok(
                bodyChildren.includes(legName),
                `${legName} must follow Cow_BodyPivot`,
            );
            const leg = nodes.find((candidate) => candidate.name === legName);
            assert.ok(leg);
            assert.ok(Array.isArray(leg.translation));
            assert.ok(
                leg.translation.some(
                    (channel) =>
                        typeof channel === 'number' && Math.abs(channel) > 0.1,
                ),
                `${legName} must retain its hip position`,
            );
        }

        const tailTip = nodes.find(
            (candidate) => candidate.name === 'Cow_TailPivot_Tip',
        );
        assert.ok(tailTip);
        assert.ok(Array.isArray(tailTip.translation));
        assert.ok(
            numeric(
                tailTip.translation[2],
                'Cow_TailPivot_Tip.translation.z',
            ) >= 0.14,
            'The tail tip must hang toward the cow rear',
        );
    });

    it('keeps the cow body lean and both marking coats flush to its surface', () => {
        const document = readCowDocument();
        const body = nodePositionBounds(document, 'Cow_Body');
        const bodyWidth =
            numeric(body.maximum[0], 'Cow_Body.max.x') -
            numeric(body.minimum[0], 'Cow_Body.min.x');

        assert.ok(bodyWidth <= 1.04, `Cow body width ${bodyWidth}`);

        const coatBounds = [
            nodePositionBounds(document, 'Cow_Coat_BrownPatches'),
            nodePositionBounds(document, 'Cow_Coat_BlackPatches'),
        ];
        for (const [index, coat] of coatBounds.entries()) {
            const coatWidth =
                numeric(coat.maximum[0], `Cow coat ${index}.max.x`) -
                numeric(coat.minimum[0], `Cow coat ${index}.min.x`);
            const shellDepth = (coatWidth - bodyWidth) * 0.5;
            assert.ok(
                shellDepth <= 0.035,
                `Cow coat ${index} floats ${shellDepth} beyond the body`,
            );
        }
        assert.deepEqual(coatBounds[0], coatBounds[1]);
    });

    it('cache-busts the generated Cow GLB by its content hash', () => {
        const expectedVersion = createHash('sha256')
            .update(readFileSync(modelPath))
            .digest('hex')
            .slice(0, 12);
        const manifest: unknown = JSON.parse(
            readFileSync(manifestPath, 'utf8'),
        );
        assert.ok(isRecord(manifest));
        const cow = records(manifest.assets, 'manifest.assets').find(
            (asset) => asset.name === 'Cow',
        );

        assert.ok(cow);
        assert.equal(cow.version, expectedVersion);
        assert.equal(
            gameAssetModels.Cow.url,
            `/assets/models/Cow.glb?v=${expectedVersion}`,
        );
    });
});
