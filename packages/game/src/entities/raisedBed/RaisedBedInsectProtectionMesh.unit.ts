import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    createRaisedBedFieldInsectProtectionMeshLayout,
    createRaisedBedInsectProtectionMeshVisual,
    createRaisedBedWholeInsectProtectionMeshLayout,
    type RaisedBedInsectProtectionMeshBlock,
} from './RaisedBedInsectProtectionMesh';

const connectedBedBlocks = [
    {
        blockIndex: 0,
        blockOffset: 9,
        position: [0, 1, 0],
        raisedBedId: 10,
    },
    {
        blockIndex: 1,
        blockOffset: 0,
        position: [0.95, 1, 0],
        raisedBedId: 10,
    },
] satisfies RaisedBedInsectProtectionMeshBlock[];

test('spans one tunnel across connected raised-bed blocks', () => {
    const layout = createRaisedBedWholeInsectProtectionMeshLayout({
        blocks: connectedBedBlocks,
        orientation: 'vertical',
    });

    assert.ok(layout);
    assert.ok(layout.width > layout.depth);
    assert.ok(Math.abs(layout.position[1] - 0.296) < 0.000_001);
    assert.ok(layout.position[0] > 0);
});

test('places a field mesh at the matching world-space field position', () => {
    const layout = createRaisedBedFieldInsectProtectionMeshLayout({
        block: connectedBedBlocks[1],
        orientation: 'vertical',
        positionIndex: 4,
    });

    assert.equal(layout.depth, 0.25);
    assert.equal(layout.width, 0.25);
    assert.ok(Math.abs(layout.position[1] - 0.296) < 0.000_001);
    assert.ok(layout.position[0] > connectedBedBlocks[0].position[0]);
});

test('builds a closed arched mesh along the longest raised-bed axis', () => {
    const visual = createRaisedBedInsectProtectionMeshVisual({
        depth: 0.75,
        position: [0, -0.704, 0],
        width: 1.55,
    });

    assert.equal(visual.endPositions.length, 2);
    assert.equal(visual.panels.length, 6);
    assert.equal(visual.anchors.length, 4);
    assert.ok(visual.frameRods.length > visual.panels.length);
    assert.deepStrictEqual(visual.endRotation, [0, Math.PI / 2, 0]);
    assert.ok(visual.endPositions[0][0] < 0);
    assert.ok(visual.endPositions[1][0] > 0);
});

test('rotates the tunnel for a raised bed that runs along z', () => {
    const visual = createRaisedBedInsectProtectionMeshVisual({
        depth: 1.55,
        position: [0, -0.704, 0],
        width: 0.75,
    });

    assert.deepStrictEqual(visual.endRotation, [0, 0, 0]);
    assert.ok(visual.endPositions[0][2] < 0);
    assert.ok(visual.endPositions[1][2] > 0);
    assert.equal(
        visual.frameRods.filter((rod) => rod.key.startsWith('longitudinal-'))
            .length,
        7,
    );
});
