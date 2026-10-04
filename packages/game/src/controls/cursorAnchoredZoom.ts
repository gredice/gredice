import {
    type OrthographicCamera,
    Plane,
    Raycaster,
    Vector2,
    Vector3,
} from 'three';

const up = new Vector3(0, 1, 0);

type CursorPosition = {
    clientX: number;
    clientY: number;
};

type CursorZoomViewport = {
    height: number;
    left: number;
    top: number;
    width: number;
};

export type CursorAnchoredZoomScratch = {
    anchorAfter: Vector3;
    anchorBefore: Vector3;
    ndc: Vector2;
    plane: Plane;
    raycaster: Raycaster;
};

export function createCursorAnchoredZoomScratch(): CursorAnchoredZoomScratch {
    return {
        anchorAfter: new Vector3(),
        anchorBefore: new Vector3(),
        ndc: new Vector2(),
        plane: new Plane(),
        raycaster: new Raycaster(),
    };
}

function getCursorPointOnPlane({
    camera,
    cursor,
    result,
    scratch,
    viewport,
}: {
    camera: OrthographicCamera;
    cursor: CursorPosition;
    result: Vector3;
    scratch: CursorAnchoredZoomScratch;
    viewport: CursorZoomViewport;
}) {
    scratch.ndc.set(
        ((cursor.clientX - viewport.left) / viewport.width) * 2 - 1,
        -((cursor.clientY - viewport.top) / viewport.height) * 2 + 1,
    );
    scratch.raycaster.setFromCamera(scratch.ndc, camera);
    return scratch.raycaster.ray.intersectPlane(scratch.plane, result);
}

export function applyCursorAnchoredZoom({
    camera,
    cursor,
    nextZoom,
    scratch,
    target,
    viewport,
}: {
    camera: OrthographicCamera;
    cursor: CursorPosition;
    nextZoom: number;
    scratch: CursorAnchoredZoomScratch;
    target: Vector3;
    viewport: CursorZoomViewport;
}) {
    if (camera.zoom === nextZoom) {
        return false;
    }

    if (viewport.width <= 0 || viewport.height <= 0) {
        camera.zoom = nextZoom;
        camera.updateProjectionMatrix();
        return true;
    }

    scratch.plane.setFromNormalAndCoplanarPoint(up, target);
    const anchorBefore = getCursorPointOnPlane({
        camera,
        cursor,
        result: scratch.anchorBefore,
        scratch,
        viewport,
    });

    camera.zoom = nextZoom;
    camera.updateProjectionMatrix();

    const anchorAfter = getCursorPointOnPlane({
        camera,
        cursor,
        result: scratch.anchorAfter,
        scratch,
        viewport,
    });
    if (anchorBefore && anchorAfter) {
        const offset = anchorBefore.sub(anchorAfter);
        camera.position.add(offset);
        target.add(offset);
    }

    return true;
}
