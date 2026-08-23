import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const modelPath = fileURLToPath(
    new URL(
        '../../../../apps/garden/public/assets/models/WoodenWalkway.glb',
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

function readPositionBounds() {
    const document: unknown = readGlbDocument(readFileSync(modelPath));
    assert.ok(isRecord(document));
    assert.ok(Array.isArray(document.accessors));

    return document.accessors.flatMap((accessor) => {
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

        return [{ minimum: accessor.min, maximum: accessor.max }];
    });
}

describe('WoodenWalkway asset', () => {
    it('stays within one tile so adjacent walkway pieces do not overlap', () => {
        const positionBounds = readPositionBounds();

        assert.ok(positionBounds.length > 0);
        assert.ok(
            positionBounds.every(
                ({ minimum, maximum }) =>
                    typeof minimum[0] === 'number' &&
                    typeof minimum[2] === 'number' &&
                    typeof maximum[0] === 'number' &&
                    typeof maximum[2] === 'number' &&
                    minimum[0] >= -0.5 &&
                    minimum[2] >= -0.5 &&
                    maximum[0] <= 0.5 &&
                    maximum[2] <= 0.5,
            ),
        );
    });

    it('rests on the placement plane and remains a low-profile path', () => {
        const positionBounds = readPositionBounds();
        const verticalMinimum = Math.min(
            ...positionBounds.flatMap(({ minimum }) =>
                typeof minimum[1] === 'number' ? [minimum[1]] : [],
            ),
        );
        const verticalMaximum = Math.max(
            ...positionBounds.flatMap(({ maximum }) =>
                typeof maximum[1] === 'number' ? [maximum[1]] : [],
            ),
        );

        assert.ok(Math.abs(verticalMinimum) < 0.000_01);
        assert.ok(verticalMaximum <= 0.1);
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
        const walkway = manifest.assets.find(
            (asset) => isRecord(asset) && asset.name === 'WoodenWalkway',
        );

        assert.ok(isRecord(walkway));
        assert.equal(walkway.version, expectedVersion);
    });
});
