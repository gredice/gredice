import assert from 'node:assert/strict';
import test from 'node:test';
import type { BufferGeometry } from 'three';
import {
    createMulchPatchGeometry,
    fullMulchPatchConnectionMask,
    getMulchPatchConnectionMask,
    getMulchPatchConnectionsFromMask,
    isolatedMulchPatchConnectionMask,
    resolveMulchPatchConnectionMask,
} from './mulchPatchGeometry';

function rounded(value: number) {
    return Number(value.toFixed(6));
}

function getBounds(geometry: BufferGeometry) {
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    assert.ok(box);

    return {
        maxX: rounded(box.max.x),
        maxY: rounded(box.max.y),
        maxZ: rounded(box.max.z),
        minX: rounded(box.min.x),
        minY: rounded(box.min.y),
        minZ: rounded(box.min.z),
    };
}

function hasBottomEdgeAtX(geometry: BufferGeometry, x: number) {
    const position = geometry.getAttribute('position');

    for (let index = 0; index < position.count; index += 3) {
        const triangle = [index, index + 1, index + 2];

        for (const firstIndex of triangle) {
            for (const secondIndex of triangle) {
                if (firstIndex >= secondIndex) {
                    continue;
                }

                if (
                    rounded(position.getX(firstIndex)) === rounded(x) &&
                    rounded(position.getX(secondIndex)) === rounded(x) &&
                    rounded(position.getY(firstIndex)) === 0 &&
                    rounded(position.getY(secondIndex)) === 0
                ) {
                    return true;
                }
            }
        }
    }

    return false;
}

test('mulch patch target resolver connects neighbors on the same height only', () => {
    const target = {
        position: [0, 1, 0],
        size: [1, 1],
    } satisfies {
        position: readonly [number, number, number];
        size: readonly [number, number];
    };
    const sameHeightNorth = {
        position: [1, 1, 0],
        size: [1, 1],
    } satisfies typeof target;
    const sameHeightEast = {
        position: [0, 1, -1],
        size: [1, 1],
    } satisfies typeof target;
    const differentHeightSouth = {
        position: [-1, 1.25, 0],
        size: [1, 1],
    } satisfies typeof target;

    assert.equal(
        resolveMulchPatchConnectionMask(target, [
            target,
            sameHeightNorth,
            sameHeightEast,
            differentHeightSouth,
        ]),
        getMulchPatchConnectionMask({
            e: true,
            n: true,
            s: false,
            w: false,
        }),
    );
});

test('isolated mulch patch keeps an inset rounded footprint', () => {
    const geometry = createMulchPatchGeometry({
        connections: getMulchPatchConnectionsFromMask(
            isolatedMulchPatchConnectionMask,
        ),
    });

    assert.deepEqual(getBounds(geometry), {
        maxX: 0.39,
        maxY: 0.026,
        maxZ: 0.39,
        minX: -0.39,
        minY: 0,
        minZ: -0.39,
    });

    geometry.dispose();
});

test('connected mulch patch reaches neighbor edges without internal walls', () => {
    const northConnected = createMulchPatchGeometry({
        connections: getMulchPatchConnectionsFromMask(
            getMulchPatchConnectionMask({
                e: false,
                n: true,
                s: false,
                w: false,
            }),
        ),
    });

    assert.deepEqual(getBounds(northConnected), {
        maxX: 0.5,
        maxY: 0.026,
        maxZ: 0.39,
        minX: -0.39,
        minY: 0,
        minZ: -0.39,
    });
    assert.equal(hasBottomEdgeAtX(northConnected, 0.5), false);

    northConnected.dispose();
});

test('fully connected mulch patch fills the tile without skirt walls', () => {
    const geometry = createMulchPatchGeometry({
        connections: getMulchPatchConnectionsFromMask(
            fullMulchPatchConnectionMask,
        ),
    });

    assert.deepEqual(getBounds(geometry), {
        maxX: 0.5,
        maxY: 0.026,
        maxZ: 0.5,
        minX: -0.5,
        minY: 0.018,
        minZ: -0.5,
    });

    geometry.dispose();
});
