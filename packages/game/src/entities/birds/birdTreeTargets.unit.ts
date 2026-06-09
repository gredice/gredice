import assert from 'node:assert/strict';
import test from 'node:test';
import { Vector3 } from 'three';
import type { Block } from '../../types/Block';
import type { Stack } from '../../types/Stack';
import {
    createBirdTreeLandingTargets,
    getBirdTreeVisualPerchYOffset,
    isBirdTreeBlockName,
} from './birdTreeTargets';

function createStack(block: Block): Stack {
    return {
        blocks: [block],
        position: new Vector3(4, 0, -2),
    };
}

test('targets the top side of leafy tree canopies', () => {
    const block = { id: 'tree-1', name: 'Tree', rotation: 0 };
    const targets = createBirdTreeLandingTargets({
        block,
        blockData: null,
        stack: createStack(block),
    });

    assert.equal(targets.length, 3);
    assert.ok(targets.every((target) => target.position.y > 2.15));
    assert.ok(targets.every((target) => target.position.y < 2.38));
    assert.ok(
        targets.some(
            (target) =>
                Math.hypot(target.position.x - 4, target.position.z + 2) > 0.25,
        ),
    );
});

test('rotates canopy landing offsets with the tree block', () => {
    const unrotatedBlock = { id: 'pine-1', name: 'Pine', rotation: 0 };
    const rotatedBlock = { id: 'pine-1', name: 'Pine', rotation: 1 };
    const stack = createStack(unrotatedBlock);
    const unrotatedTarget = createBirdTreeLandingTargets({
        block: unrotatedBlock,
        blockData: null,
        stack,
    })[0];
    const rotatedTarget = createBirdTreeLandingTargets({
        block: rotatedBlock,
        blockData: null,
        stack,
    })[0];

    assert.ok(unrotatedTarget);
    assert.ok(rotatedTarget);
    assert.ok(Math.abs(unrotatedTarget.position.x - 4) < 0.000001);
    assert.ok(unrotatedTarget.position.z > -2);
    assert.ok(rotatedTarget.position.x > 4);
    assert.ok(Math.abs(rotatedTarget.position.z + 2) < 0.000001);
});

test('uses top branch targets for trees without canopies', () => {
    const block = { id: 'dead-tree-1', name: 'DeadTreeTall', rotation: 0 };
    const targets = createBirdTreeLandingTargets({
        block,
        blockData: null,
        stack: createStack(block),
    });

    assert.equal(isBirdTreeBlockName('DeadTreeTall'), true);
    assert.equal(targets.length, 2);
    assert.ok(targets.every((target) => target.id.includes('branch')));
    assert.ok(targets.every((target) => target.position.y > 1.5));
});

test('exposes tree visual perch heights for circling anchors', () => {
    assert.equal(getBirdTreeVisualPerchYOffset('Bucket'), null);
    assert.ok((getBirdTreeVisualPerchYOffset('Tree') ?? 0) > 2.25);
    assert.ok((getBirdTreeVisualPerchYOffset('DeadTreeStump') ?? 0) > 0.85);
});
