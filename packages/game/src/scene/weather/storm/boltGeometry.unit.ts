import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    boltTriangleBudget,
    countBoltTriangles,
    createBakedBoltGeometry,
    createBoltGeometry,
    resolveBoltSilhouetteArea,
    resolveBoltSpan,
} from './boltGeometry';

describe('baked bolt geometry', () => {
    it('matches the extruded outline it was baked from', () => {
        const built = createBoltGeometry();
        const baked = createBakedBoltGeometry();
        for (const name of ['position', 'normal'] as const) {
            const a = built.getAttribute(name);
            const b = baked.getAttribute(name);
            assert.equal(b.count, a.count, `${name} count`);
            for (let i = 0; i < a.count; i += 1) {
                for (const read of ['getX', 'getY', 'getZ'] as const) {
                    assert.ok(
                        Math.abs(a[read](i) - b[read](i)) < 1e-4,
                        `${name} ${i} ${read}`,
                    );
                }
            }
        }
        assert.deepEqual(
            Array.from(baked.getIndex()?.array ?? []),
            Array.from(built.getIndex()?.array ?? []),
        );
        assert.ok(countBoltTriangles(baked) <= boltTriangleBudget);
        const builtSpan = resolveBoltSpan(built);
        const bakedSpan = resolveBoltSpan(baked);
        assert.ok(Math.abs(builtSpan.height - bakedSpan.height) < 1e-4);
        assert.ok(Math.abs(builtSpan.width - bakedSpan.width) < 1e-4);
        assert.ok(
            Math.abs(
                resolveBoltSilhouetteArea(built) -
                    resolveBoltSilhouetteArea(baked),
            ) < 1e-3,
        );
    });
});
