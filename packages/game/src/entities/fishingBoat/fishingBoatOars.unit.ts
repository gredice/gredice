import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BoxGeometry, BufferAttribute, BufferGeometry } from 'three';
import { splitFishingBoatOarGeometries } from './fishingBoatOars';

function createOarGeometry(x: number) {
    return new BoxGeometry(0.1, 0.1, 1.4)
        .translate(x, 0.55, -0.1)
        .toNonIndexed();
}

function createOarPairGeometry() {
    const port = createOarGeometry(-0.32);
    const starboard = createOarGeometry(0.32);
    const geometry = new BufferGeometry();
    for (const name of ['position', 'normal']) {
        geometry.setAttribute(
            name,
            new BufferAttribute(
                Float32Array.from([
                    ...port.getAttribute(name).array,
                    ...starboard.getAttribute(name).array,
                ]),
                3,
            ),
        );
    }
    return geometry;
}

describe('fishing boat oars', () => {
    it('splits the stowed oar mesh into one pivot per side', () => {
        const parts = splitFishingBoatOarGeometries(createOarPairGeometry());

        assert.deepEqual(
            parts.map((part) => part.side),
            ['port', 'starboard'],
        );
        for (const part of parts) {
            const position = part.geometry.getAttribute('position');
            assert.equal(position.count, 36);
            assert.ok(part.geometry.getAttribute('normal'));
        }
    });

    it('pivots each oar at its own rowlock on the hull side', () => {
        const [port, starboard] = splitFishingBoatOarGeometries(
            createOarPairGeometry(),
        );

        assert.ok(port);
        assert.ok(starboard);
        assert.ok(Math.abs(port.pivot[0] + 0.32) < 0.000_001);
        assert.ok(Math.abs(starboard.pivot[0] - 0.32) < 0.000_001);
        assert.ok(Math.abs(port.pivot[1] - 0.55) < 0.000_001);
        // The rowlock sits at the boat origin plane so the blade reaches out
        // over the water once the oar swings sideways.
        assert.equal(port.pivot[2], 0);
        assert.equal(starboard.pivot[2], 0);
    });

    it('re-centers the split geometry around its pivot', () => {
        const [port] = splitFishingBoatOarGeometries(createOarPairGeometry());

        assert.ok(port);
        port.geometry.computeBoundingBox();
        const bounds = port.geometry.boundingBox;
        assert.ok(bounds);
        assert.ok(Math.abs(bounds.min.x + 0.05) < 0.000_001);
        assert.ok(Math.abs(bounds.max.x - 0.05) < 0.000_001);
        assert.ok(Math.abs(bounds.min.z + 0.8) < 0.000_001);
        assert.ok(Math.abs(bounds.max.z - 0.6) < 0.000_001);
    });

    it('keeps the source geometry untouched', () => {
        const source = createOarPairGeometry();
        const before = source.getAttribute('position').getX(0);
        splitFishingBoatOarGeometries(source);

        assert.equal(source.getAttribute('position').getX(0), before);
        assert.ok(source instanceof BufferGeometry);
    });
});
