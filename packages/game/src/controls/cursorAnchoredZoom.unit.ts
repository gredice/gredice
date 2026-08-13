import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { OrthographicCamera, Raycaster, Vector2, Vector3 } from 'three';
import {
    applyCursorAnchoredZoom,
    createCursorAnchoredZoomScratch,
} from './cursorAnchoredZoom';

const viewport = {
    height: 600,
    left: 100,
    top: 40,
    width: 800,
};

function createCamera(target: Vector3) {
    const camera = new OrthographicCamera(-4, 4, 3, -3, 0.1, 100);
    camera.position.set(8, 10, 8);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    return camera;
}

function getGroundPointAtCursor({
    camera,
    clientX,
    clientY,
    targetY,
}: {
    camera: OrthographicCamera;
    clientX: number;
    clientY: number;
    targetY: number;
}) {
    const ndc = new Vector2(
        ((clientX - viewport.left) / viewport.width) * 2 - 1,
        -((clientY - viewport.top) / viewport.height) * 2 + 1,
    );
    const raycaster = new Raycaster();
    raycaster.setFromCamera(ndc, camera);
    const distance =
        (targetY - raycaster.ray.origin.y) / raycaster.ray.direction.y;
    return raycaster.ray.at(distance, new Vector3());
}

function projectToClient(camera: OrthographicCamera, point: Vector3) {
    const projected = point.clone().project(camera);
    return {
        clientX: viewport.left + ((projected.x + 1) / 2) * viewport.width,
        clientY: viewport.top + ((-projected.y + 1) / 2) * viewport.height,
    };
}

describe('applyCursorAnchoredZoom', () => {
    it('keeps the garden point beneath an off-center cursor stationary', () => {
        const target = new Vector3(0, 0, 0);
        const camera = createCamera(target);
        const cursor = { clientX: 720, clientY: 220 };
        const anchor = getGroundPointAtCursor({
            camera,
            ...cursor,
            targetY: target.y,
        });

        const changed = applyCursorAnchoredZoom({
            camera,
            cursor,
            nextZoom: 2.4,
            scratch: createCursorAnchoredZoomScratch(),
            target,
            viewport,
        });
        camera.lookAt(target);
        camera.updateMatrixWorld();

        assert.equal(changed, true);
        assert.equal(camera.zoom, 2.4);
        assert.notDeepEqual(target.toArray(), [0, 0, 0]);
        const projectedAnchor = projectToClient(camera, anchor);
        assert.ok(
            Math.abs(projectedAnchor.clientX - cursor.clientX) < 0.000_001,
        );
        assert.ok(
            Math.abs(projectedAnchor.clientY - cursor.clientY) < 0.000_001,
        );
    });

    it('zooms without panning when the cursor is at the viewport center', () => {
        const target = new Vector3(0, 0, 0);
        const camera = createCamera(target);
        const initialCameraPosition = camera.position.clone();

        applyCursorAnchoredZoom({
            camera,
            cursor: {
                clientX: viewport.left + viewport.width / 2,
                clientY: viewport.top + viewport.height / 2,
            },
            nextZoom: 1.8,
            scratch: createCursorAnchoredZoomScratch(),
            target,
            viewport,
        });

        assert.ok(target.length() < 0.000_001);
        assert.ok(
            camera.position.distanceTo(initialCameraPosition) < 0.000_001,
        );
    });
});
