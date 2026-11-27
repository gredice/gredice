import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    createTerrainVergeCornerGeometry,
    createTerrainVergeEdgeGeometry,
    createTerrainVergeInnerCornerGeometry,
    terrainVergeDimensions,
    terrainVergeReach,
    terrainVergeVariantCount,
} from './terrainVergeGeometry';

describe('terrain verge geometry', () => {
    it('joins every pair of edge shapes without a step or a kink', () => {
        const step = 1e-4;
        for (let variant = 0; variant < terrainVergeVariantCount; variant++) {
            for (const end of [0, 1]) {
                const reach = terrainVergeReach(end, variant);
                assert.ok(
                    Math.abs(reach - terrainVergeDimensions.baseReach) < 1e-9,
                );
                const inward = end === 0 ? step : 1 - step;
                const slope =
                    (terrainVergeReach(inward, variant) - reach) / step;
                assert.ok(Math.abs(slope) < 0.01);
            }
        }
    });

    it('keeps every edge shape reaching over the path', () => {
        for (let variant = 0; variant < terrainVergeVariantCount; variant++) {
            for (let step = 0; step <= 20; step++) {
                assert.ok(terrainVergeReach(step / 20, variant) > 0.03);
            }
        }
    });

    it('stays low and within its own tile side', () => {
        const { baseReach, inset, rise, tuck } = terrainVergeDimensions;
        for (let variant = 0; variant < terrainVergeVariantCount; variant++) {
            const box = createTerrainVergeEdgeGeometry(variant).boundingBox;
            assert.ok(box);
            assert.ok(Math.abs(box.min.x - (0.5 - inset)) < 1e-6);
            assert.ok(box.max.x < 0.5 + baseReach + 0.1);
            assert.ok(Math.abs(box.min.z + 0.5) < 1e-6);
            assert.ok(Math.abs(box.max.z - 0.5) < 1e-6);
            assert.ok(Math.abs(box.max.y - rise) < 1e-6);
            assert.ok(Math.abs(box.min.y + tuck) < 1e-6);
        }
        const corner = createTerrainVergeCornerGeometry().boundingBox;
        assert.ok(corner);
        // The corner never reaches back into the grass tile.
        assert.ok(corner.min.x >= 0.5 - 1e-6);
        assert.ok(corner.min.z >= 0.5 - 1e-6);
        assert.ok(Math.abs(corner.max.x - (0.5 + baseReach)) < 1e-6);
    });

    it('sinks a tapered end flush with the lawn and off the path', () => {
        const tapered = createTerrainVergeEdgeGeometry(0, {
            end: true,
            start: false,
        });
        const position = tapered.getAttribute('position');
        let checked = 0;
        for (let index = 0; index < position.count; index++) {
            // Points on the far end of the bank, at z = +0.5.
            if (Math.abs(position.getZ(index) - 0.5) > 1e-6) continue;
            checked++;
            assert.ok(position.getY(index) <= 1e-6);
            assert.ok(position.getX(index) <= 0.5 + 1e-6);
        }
        assert.ok(checked > 0);
    });

    it('fills a diagonal corner from inside the tile, facing up', () => {
        const { inset, rise } = terrainVergeDimensions;
        const inner = createTerrainVergeInnerCornerGeometry();
        const box = inner.boundingBox;
        assert.ok(box);
        assert.ok(Math.abs(box.min.x - (0.5 - inset)) < 1e-6);
        assert.ok(Math.abs(box.max.x - 0.5) < 1e-6);
        assert.ok(Math.abs(box.max.z - 0.5) < 1e-6);
        assert.ok(Math.abs(box.max.y - rise) < 1e-6);
        const normal = inner.getAttribute('normal');
        for (let index = 0; index < normal.count; index++) {
            assert.ok(normal.getY(index) > 0);
        }
    });
});
