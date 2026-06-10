import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Object3D, Ray, Vector3 } from 'three';
import {
    type BlockInteractionLayerTarget,
    getBlockInteractionLayerBounds,
    getBlockInteractionRotatedHitboxFootprint,
    hasCloserNonLayerIntersection,
    resolveBlockInteractionLayerTarget,
} from './BlockInteractionResolver';

function createTarget(
    overrides: Partial<BlockInteractionLayerTarget> & {
        key: string;
        position?: { x: number; z: number };
    },
): BlockInteractionLayerTarget {
    const position = overrides.position ?? { x: 0, z: 0 };
    const block = overrides.block ?? {
        id: overrides.key,
        name: 'Block_Grass',
        rotation: 0,
    };

    return {
        block,
        blockIndex: overrides.blockIndex ?? 0,
        hitbox: overrides.hitbox ?? {
            depth: 1,
            height: 0.5,
            width: 1,
        },
        key: overrides.key,
        stack: overrides.stack ?? {
            blocks: [block],
            position: new Vector3(position.x, 0, position.z),
        },
        stackHeight: overrides.stackHeight ?? 0,
    };
}

describe('resolveBlockInteractionLayerTarget', () => {
    it('selects the nearest hitbox when a ray intersects overlapping targets', () => {
        const nearTarget = createTarget({
            key: 'near',
            position: { x: -1, z: 0 },
        });
        const farTarget = createTarget({
            key: 'far',
            position: { x: 1, z: 0 },
        });
        const ray = new Ray(new Vector3(-5, 0.25, 0), new Vector3(1, 0, 0));

        const resolved = resolveBlockInteractionLayerTarget(
            [farTarget, nearTarget],
            ray,
        );

        assert.equal(resolved?.target.key, 'near');
        assert.deepEqual(resolved?.hitPoint.toArray(), [-1.5, 0.25, 0]);
    });

    it('uses rotated hitbox footprints for non-square blocks', () => {
        const rotatedTarget = createTarget({
            block: {
                id: 'rotated',
                name: 'Raised_Bed',
                rotation: 1,
            },
            hitbox: {
                depth: 1.6,
                height: 0.5,
                width: 0.4,
            },
            key: 'rotated',
        });
        const ray = new Ray(new Vector3(0.6, 0.25, -1), new Vector3(0, 0, 1));

        assert.deepEqual(
            getBlockInteractionRotatedHitboxFootprint(rotatedTarget),
            {
                depth: 0.4,
                width: 1.6,
            },
        );
        assert.equal(
            resolveBlockInteractionLayerTarget([rotatedTarget], ray)?.target
                .key,
            'rotated',
        );
    });

    it('respects stack height when resolving vertical hitbox bounds', () => {
        const upperTarget = createTarget({
            key: 'upper',
            stackHeight: 1,
        });
        const lowRay = new Ray(new Vector3(-2, 0.5, 0), new Vector3(1, 0, 0));
        const upperRay = new Ray(new Vector3(-2, 1.2, 0), new Vector3(1, 0, 0));

        assert.equal(
            resolveBlockInteractionLayerTarget([upperTarget], lowRay),
            null,
        );
        assert.equal(
            resolveBlockInteractionLayerTarget([upperTarget], upperRay)?.target
                .key,
            'upper',
        );
    });

    it('selects a lower stacked target when the ray hits below the top block', () => {
        const lowerTarget = createTarget({
            key: 'grass',
            stackHeight: 0,
            hitbox: {
                depth: 1,
                height: 0.4,
                width: 1,
            },
        });
        const upperTarget = createTarget({
            key: 'tree',
            stackHeight: 0.4,
            hitbox: {
                depth: 1.43,
                height: 2.38,
                width: 1.36,
            },
        });
        const lowerRay = new Ray(new Vector3(-2, 0.2, 0), new Vector3(1, 0, 0));

        assert.equal(
            resolveBlockInteractionLayerTarget(
                [lowerTarget, upperTarget],
                lowerRay,
            )?.target.key,
            'grass',
        );
    });

    it('returns null when the ray does not intersect a data hitbox', () => {
        const target = createTarget({ key: 'missed' });
        const ray = new Ray(new Vector3(-2, 0.25, 2), new Vector3(1, 0, 0));

        assert.equal(resolveBlockInteractionLayerTarget([target], ray), null);
    });

    it('builds a three-dimensional receiver bound for tall hitboxes', () => {
        const target = createTarget({
            hitbox: {
                depth: 1.43,
                height: 2.38,
                width: 1.36,
            },
            key: 'tree',
            stackHeight: 0.4,
        });

        const bounds = getBlockInteractionLayerBounds([target]);

        assert.deepEqual(
            {
                ...bounds,
                centerY: Number(bounds.centerY.toFixed(2)),
                width: Number(bounds.width.toFixed(2)),
            },
            {
                centerX: 0,
                centerY: 1.59,
                centerZ: 0,
                depth: 1.53,
                height: 2.48,
                width: 1.46,
            },
        );
    });
});

describe('hasCloserNonLayerIntersection', () => {
    it('detects a foreground object closer than the resolved layer target', () => {
        const layerObject = new Object3D();
        const foregroundObject = new Object3D();
        const ray = new Ray(new Vector3(0, 0, 0), new Vector3(0, 0, 1));

        assert.equal(
            hasCloserNonLayerIntersection({
                intersections: [
                    {
                        distance: 1,
                        object: layerObject,
                    },
                    {
                        distance: 2,
                        object: foregroundObject,
                    },
                ],
                layerObject,
                ray,
                resolvedHitPoint: new Vector3(0, 0, 3),
            }),
            true,
        );
    });

    it('ignores the layer receiver and farther intersections', () => {
        const layerObject = new Object3D();
        const backgroundObject = new Object3D();
        const ray = new Ray(new Vector3(0, 0, 0), new Vector3(0, 0, 1));

        assert.equal(
            hasCloserNonLayerIntersection({
                intersections: [
                    {
                        distance: 1,
                        object: layerObject,
                    },
                    {
                        distance: 4,
                        object: backgroundObject,
                    },
                ],
                layerObject,
                ray,
                resolvedHitPoint: new Vector3(0, 0, 3),
            }),
            false,
        );
    });
});
