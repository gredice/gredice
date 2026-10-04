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

test('builds four circular arches and one continuous cover without longitudinal rods', () => {
    const visual = createRaisedBedInsectProtectionMeshVisual({
        depth: 0.75,
        position: [0, -0.704, 0],
        width: 1.55,
    });

    assert.equal(visual.endPositions.length, 2);
    assert.equal(visual.cover.positions.length / 3, 18);
    assert.equal(visual.cover.indices.length / 3, 16);
    assert.equal(Math.max(...visual.cover.indices), 17);
    assert.equal(visual.anchors.length, 4);
    assert.equal(visual.frameRods.length, 32);
    assert.ok(visual.frameRods.every((rod) => rod.key.startsWith('hoop-')));

    const archPositions = visual.frameRods
        .filter((rod) => rod.key.endsWith('-0'))
        .map((rod) => rod.position[0]);
    assert.equal(archPositions.length, 4);
    assert.ok(Math.abs(archPositions[0] + archPositions[3]) < 0.000_001);
    assert.ok(Math.abs(archPositions[1] + archPositions[2]) < 0.000_001);
    assert.ok(
        Math.abs(
            archPositions[1] -
                archPositions[0] -
                (archPositions[2] - archPositions[1]),
        ) < 0.000_001,
    );

    const coverProfile = Array.from(
        { length: visual.cover.positions.length / 6 },
        (_, index) => ({
            lateral: visual.cover.positions[index * 6 + 2],
            y: visual.cover.positions[index * 6 + 1],
        }),
    );
    const chordLengths = coverProfile.slice(1).map((point, index) => {
        const previous = coverProfile[index];
        return Math.hypot(
            point.lateral - previous.lateral,
            point.y - previous.y,
        );
    });
    assert.ok(
        chordLengths.every(
            (length) => Math.abs(length - chordLengths[0]) < 0.000_001,
        ),
    );

    const profilePoints = visual.endShape.getPoints();
    const baseY = Math.min(...profilePoints.map((point) => point.y));
    const radius = Math.max(...profilePoints.map((point) => Math.abs(point.x)));
    for (const point of profilePoints.filter((point) => point.y > baseY)) {
        assert.ok(
            Math.abs(
                point.x * point.x +
                    (point.y - baseY) * (point.y - baseY) -
                    radius * radius,
            ) < 0.000_001,
        );
    }
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
    assert.equal(visual.frameRods.length, 32);
    assert.ok(visual.frameRods.every((rod) => rod.key.startsWith('hoop-')));
});
