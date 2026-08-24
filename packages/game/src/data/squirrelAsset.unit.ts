import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { gameAssetModels } from './gameAssetModels.generated';

type JsonRecord = Record<string, unknown>;

const expectedAnimations = [
    'Squirrel_Scamper',
    'Squirrel_Bound',
    'Squirrel_Sit',
    'Squirrel_Forage',
    'Squirrel_Pause',
    'Squirrel_Flee',
] as const;
const sourcePath = fileURLToPath(
    new URL('../../../../assets/game-assets/Squirrel.blend', import.meta.url),
);
const modelPath = fileURLToPath(
    new URL(
        '../../../../apps/garden/public/assets/models/Squirrel.glb',
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

function numberValue(value: unknown, label: string) {
    if (typeof value !== 'number') {
        throw new TypeError(`${label} must be numeric`);
    }
    return value;
}

function readGlbDocument() {
    const model = readFileSync(modelPath);
    assert.equal(model.subarray(0, 4).toString('ascii'), 'glTF');
    const jsonLength = model.readUInt32LE(12);
    const document: unknown = JSON.parse(
        model.subarray(20, 20 + jsonLength).toString('utf8'),
    );
    assert.ok(isRecord(document));
    return document;
}

describe('original squirrel game asset', () => {
    it('keeps the editable Blender source and optimized runtime GLB', () => {
        assert.equal(existsSync(sourcePath), true);
        assert.ok(statSync(sourcePath).size > 10_000);
        assert.ok(statSync(modelPath).size > 10_000);
        assert.ok(statSync(modelPath).size < 300_000);
    });

    it('exports every behavior-state animation clip', () => {
        const document = readGlbDocument();
        assert.ok(Array.isArray(document.animations));
        const animationNames = document.animations
            .filter(isRecord)
            .map((animation) => animation.name)
            .filter((name): name is string => typeof name === 'string')
            .sort();

        assert.deepEqual(animationNames, [...expectedAnimations].sort());
    });

    it('animates animal-specific limbs, alert cues, and tail motion', () => {
        const document = readGlbDocument();
        const nodes = records(document.nodes, 'nodes');
        const animations = records(document.animations, 'animations');
        const animatedNodeNames = (animationName: string) => {
            const animation = animations.find(
                (candidate) => candidate.name === animationName,
            );
            assert.ok(animation, `Missing ${animationName}`);
            return new Set(
                records(animation.channels, `${animationName}.channels`).map(
                    (channel) => {
                        assert.ok(isRecord(channel.target));
                        const nodeIndex = numberValue(
                            channel.target.node,
                            `${animationName}.target.node`,
                        );
                        const node = nodes[nodeIndex];
                        assert.ok(node);
                        if (typeof node.name !== 'string') {
                            throw new TypeError(
                                `${animationName}.target node must have a name`,
                            );
                        }
                        return node.name;
                    },
                ),
            );
        };

        const bound = animatedNodeNames('Squirrel_Bound');
        assert.equal(bound.has('Squirrel_LegPivot_FL'), true);
        assert.equal(bound.has('Squirrel_LegPivot_RR'), true);
        const forage = animatedNodeNames('Squirrel_Forage');
        assert.equal(forage.has('Squirrel_HeadPivot'), true);
        assert.equal(forage.has('Squirrel_LegPivot_FL'), true);
        const pause = animatedNodeNames('Squirrel_Pause');
        assert.equal(pause.has('Squirrel_EarPivot_L'), true);
        assert.equal(pause.has('Squirrel_TailPivot_Tip'), true);
        const sit = animatedNodeNames('Squirrel_Sit');
        assert.equal(sit.has('Squirrel_TailPivot_Base'), true);
        assert.equal(sit.has('Squirrel_TailPivot_Tip'), true);
    });

    it('cache-busts the typed model URL using the exported GLB hash', () => {
        const expectedVersion = createHash('sha256')
            .update(readFileSync(modelPath))
            .digest('hex')
            .slice(0, 12);
        const manifest: unknown = JSON.parse(
            readFileSync(manifestPath, 'utf8'),
        );
        assert.ok(isRecord(manifest));
        assert.ok(Array.isArray(manifest.assets));
        const squirrel = manifest.assets
            .filter(isRecord)
            .find((asset) => asset.name === 'Squirrel');

        assert.ok(squirrel);
        assert.equal(squirrel.version, expectedVersion);
        assert.ok(
            gameAssetModels.Squirrel.url.endsWith(`?v=${expectedVersion}`),
        );
    });
});
