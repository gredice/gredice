import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { gameAssetModels } from './gameAssetModels.generated';

type JsonRecord = Record<string, unknown>;

const modelPath = fileURLToPath(
    new URL(
        '../../../../apps/garden/public/assets/models/Frog.glb',
        import.meta.url,
    ),
);
const sourcePath = fileURLToPath(
    new URL('../../../../assets/game-assets/Frog.blend', import.meta.url),
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

function readDocument() {
    const model = readFileSync(modelPath);
    const jsonLength = model.readUInt32LE(12);
    const document: unknown = JSON.parse(
        model.subarray(20, 20 + jsonLength).toString('utf8'),
    );
    assert.ok(isRecord(document));
    return document;
}

describe('Frog asset', () => {
    it('keeps an editable original Blender source and typed lazy GLB entry', () => {
        assert.ok(existsSync(sourcePath));
        assert.ok(existsSync(modelPath));

        const manifest: unknown = JSON.parse(
            readFileSync(manifestPath, 'utf8'),
        );
        assert.ok(isRecord(manifest));
        const frog = records(manifest.assets, 'manifest.assets').find(
            (asset) => asset.name === 'Frog',
        );
        assert.ok(frog);
        assert.equal(frog.source, 'Frog.blend');
        assert.equal(frog.output, 'Frog.glb');
        assert.equal(frog.preload, 'lazy');
        assert.ok(Array.isArray(frog.objects));
        assert.ok(frog.objects.length >= 28);
    });

    it('exports the complete frog animation state machine', () => {
        const document = readDocument();
        const animationNames = records(document.animations, 'Frog.animations')
            .map((animation) => animation.name)
            .sort();

        assert.deepEqual(animationNames, [
            'Frog_Blink',
            'Frog_Croak',
            'Frog_Hop',
            'Frog_Idle',
        ]);
    });

    it('retains readable anatomy within the low-poly scene budget', () => {
        const document = readDocument();
        const nodeNames = new Set(
            records(document.nodes, 'Frog.nodes').map((node) => node.name),
        );
        for (const expected of [
            'Frog_Body',
            'Frog_Head',
            'Frog_Throat',
            'Frog_Eyelid_L',
            'Frog_Eyelid_R',
            'Frog_RearThigh_L',
            'Frog_RearThigh_R',
            'Frog_FrontFoot_L',
            'Frog_FrontFoot_R',
        ]) {
            assert.ok(nodeNames.has(expected), `Missing ${expected}`);
        }

        const accessors = records(document.accessors, 'Frog.accessors');
        let triangleCount = 0;
        for (const mesh of records(document.meshes, 'Frog.meshes')) {
            for (const primitive of records(
                mesh.primitives,
                'mesh.primitives',
            )) {
                const indices = primitive.indices;
                if (typeof indices !== 'number') {
                    throw new TypeError('Frog mesh indices must be numeric');
                }
                const accessor = accessors[indices];
                assert.ok(accessor);
                const count = accessor.count;
                if (typeof count !== 'number') {
                    throw new TypeError('Frog index count must be numeric');
                }
                triangleCount += count / 3;
            }
        }
        assert.ok(triangleCount >= 1_000);
        assert.ok(triangleCount <= 2_500);
    });

    it('cache-busts the Frog GLB using its content hash', () => {
        const expectedVersion = createHash('sha256')
            .update(readFileSync(modelPath))
            .digest('hex')
            .slice(0, 12);
        const manifest: unknown = JSON.parse(
            readFileSync(manifestPath, 'utf8'),
        );
        assert.ok(isRecord(manifest));
        const frog = records(manifest.assets, 'manifest.assets').find(
            (asset) => asset.name === 'Frog',
        );
        assert.ok(frog);
        assert.equal(frog.version, expectedVersion);
        assert.ok(gameAssetModels.Frog.url.endsWith(`?v=${expectedVersion}`));
    });
});
