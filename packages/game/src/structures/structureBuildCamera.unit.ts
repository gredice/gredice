import assert from 'node:assert/strict';
import test from 'node:test';
import {
    gardenStructureBuildMinimumZoom,
    resolveGardenStructureBuildCameraFrame,
} from './structureBuildCamera';

const isometricCameraOffset = [-100, 100, -100] as const;

function assertFitsVisibleViewport(
    frame: ReturnType<typeof resolveGardenStructureBuildCameraFrame>,
    viewportWidth: number,
    viewportHeight: number,
) {
    const centerX = frame.screenPosition.x * viewportWidth;
    const centerY = frame.screenPosition.y * viewportHeight;
    const halfWidth = (frame.projectedWidth * frame.zoom) / 2;
    const halfHeight = (frame.projectedHeight * frame.zoom) / 2;

    assert.ok(centerX - halfWidth >= frame.visibleViewport.left);
    assert.ok(centerX + halfWidth <= frame.visibleViewport.right);
    assert.ok(centerY - halfHeight >= frame.visibleViewport.top);
    assert.ok(centerY + halfHeight <= frame.visibleViewport.bottom);
}

test('frames an isometric shell inside the unobscured mobile viewport', () => {
    for (const [viewportWidth, viewportHeight] of [
        [390, 844],
        [844, 390],
    ] as const) {
        const frame = resolveGardenStructureBuildCameraFrame({
            cameraOffset: isometricCameraOffset,
            depth: 4.12,
            height: 3.28,
            viewportHeight,
            viewportWidth,
            width: 3.12,
        });

        assertFitsVisibleViewport(frame, viewportWidth, viewportHeight);
    }
});

test('fits the maximum 20 by 20 bounds in portrait without the normal zoom floor', () => {
    const viewportWidth = 390;
    const viewportHeight = 844;
    const frame = resolveGardenStructureBuildCameraFrame({
        cameraOffset: isometricCameraOffset,
        depth: 20.12,
        height: 3.28,
        viewportHeight,
        viewportWidth,
        width: 20.12,
    });

    assert.ok(frame.zoom >= gardenStructureBuildMinimumZoom);
    assert.ok(frame.zoom < 12);
    assertFitsVisibleViewport(frame, viewportWidth, viewportHeight);
});

test('moves the focus center above a portrait sheet and right of a landscape sheet', () => {
    const portrait = resolveGardenStructureBuildCameraFrame({
        cameraOffset: isometricCameraOffset,
        depth: 4,
        height: 3,
        viewportHeight: 844,
        viewportWidth: 390,
        width: 3,
    });
    const landscape = resolveGardenStructureBuildCameraFrame({
        cameraOffset: isometricCameraOffset,
        depth: 4,
        height: 3,
        viewportHeight: 390,
        viewportWidth: 844,
        width: 3,
    });

    assert.ok(portrait.screenPosition.y < 0.5);
    assert.ok(landscape.screenPosition.x > 0.5);
});
