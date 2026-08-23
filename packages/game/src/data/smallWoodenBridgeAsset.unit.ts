import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const modelPath = fileURLToPath(
    new URL(
        '../../../../apps/garden/public/assets/models/SmallWoodenBridge.glb',
        import.meta.url,
    ),
);
const manifestPath = fileURLToPath(
    new URL('../../../../assets/game-assets.json', import.meta.url),
);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function readGlbDocument(model: Buffer): unknown {
    const jsonLength = model.readUInt32LE(12);
    return JSON.parse(model.subarray(20, 20 + jsonLength).toString('utf8'));
}

describe('SmallWoodenBridge asset', () => {
    it('keeps every exported mesh inside one tile along the bridge axis', () => {
        const document: unknown = readGlbDocument(readFileSync(modelPath));
        assert.ok(isRecord(document));
        assert.ok(Array.isArray(document.accessors));

        const positionBounds = document.accessors.flatMap((accessor) => {
            if (
                !isRecord(accessor) ||
                accessor.type !== 'VEC3' ||
                !Array.isArray(accessor.min) ||
                !Array.isArray(accessor.max) ||
                accessor.min.length !== 3 ||
                accessor.max.length !== 3
            ) {
                return [];
            }

            const minimum = accessor.min[2];
            const maximum = accessor.max[2];
            return typeof minimum === 'number' && typeof maximum === 'number'
                ? [{ minimum, maximum }]
                : [];
        });

        assert.ok(positionBounds.length > 0);
        assert.ok(
            positionBounds.every(
                ({ minimum, maximum }) => minimum >= -0.5 && maximum <= 0.5,
            ),
        );
    });

    it('starts at the placement surface instead of floating above it', () => {
        const document: unknown = readGlbDocument(readFileSync(modelPath));
        assert.ok(isRecord(document));
        assert.ok(Array.isArray(document.accessors));

        const verticalBounds = document.accessors.flatMap((accessor) => {
            if (
                !isRecord(accessor) ||
                accessor.type !== 'VEC3' ||
                !Array.isArray(accessor.min) ||
                !Array.isArray(accessor.max)
            ) {
                return [];
            }

            const minimum = accessor.min[1];
            const maximum = accessor.max[1];
            return typeof minimum === 'number' && typeof maximum === 'number'
                ? [{ minimum, maximum }]
                : [];
        });

        assert.ok(verticalBounds.length > 0);
        assert.ok(
            Math.abs(
                Math.min(...verticalBounds.map(({ minimum }) => minimum)),
            ) < 0.000_01,
        );
        assert.ok(verticalBounds.every(({ maximum }) => maximum <= 0.38));
    });

    it('uses a cache version matching the exported model', () => {
        const model = readFileSync(modelPath);
        const expectedVersion = createHash('sha256')
            .update(model)
            .digest('hex')
            .slice(0, 12);
        const manifest: unknown = JSON.parse(
            readFileSync(manifestPath, 'utf8'),
        );

        assert.ok(isRecord(manifest));
        assert.ok(Array.isArray(manifest.assets));
        const bridge = manifest.assets.find(
            (asset) => isRecord(asset) && asset.name === 'SmallWoodenBridge',
        );

        assert.ok(isRecord(bridge));
        assert.equal(bridge.version, expectedVersion);
    });
});
