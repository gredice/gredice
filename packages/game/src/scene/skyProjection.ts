import {
    type Camera,
    MathUtils,
    OrthographicCamera,
    PerspectiveCamera,
    Vector2,
    Vector3,
} from 'three';

export const SKY_FORWARD_DISTANCE = 500;
export const SKY_SCREEN_FRACTION = 1.05;
export const SKY_REFERENCE_ZOOM = 100;
export const SUN_SCREEN_OFFSET_MULTIPLIER = 0.8;
const SKY_REFERENCE_HALF_HEIGHT = 3.6;

const MOBILE_MAX_WIDTH = 767;
const TABLET_MAX_WIDTH = 1023;

export type SkyViewBasis = {
    forward: Vector3;
    halfHeight: number;
    halfWidth: number;
    perspective: boolean;
    right: Vector3;
    screenScale: number;
    skyRadius: number;
    viewUp: Vector3;
};

export type SunViewportTuning = {
    horizontalOffsetMultiplier: number;
    sizeMultiplier: number;
    verticalOffsetMultiplier: number;
};

export type SkyCameraProjectionSnapshot = {
    aspect: number;
    bottom: number;
    fov: number;
    initialized: boolean;
    left: number;
    positionX: number;
    positionY: number;
    positionZ: number;
    quaternionW: number;
    quaternionX: number;
    quaternionY: number;
    quaternionZ: number;
    right: number;
    top: number;
    upX: number;
    upY: number;
    upZ: number;
    zoom: number;
};

export function createSkyCameraProjectionSnapshot(): SkyCameraProjectionSnapshot {
    return {
        aspect: 0,
        bottom: 0,
        fov: 0,
        initialized: false,
        left: 0,
        positionX: 0,
        positionY: 0,
        positionZ: 0,
        quaternionW: 0,
        quaternionX: 0,
        quaternionY: 0,
        quaternionZ: 0,
        right: 0,
        top: 0,
        upX: 0,
        upY: 0,
        upZ: 0,
        zoom: 0,
    };
}

export function updateSkyCameraProjectionSnapshot(
    camera: Camera,
    snapshot: SkyCameraProjectionSnapshot,
) {
    if (
        !(camera instanceof OrthographicCamera) &&
        !(camera instanceof PerspectiveCamera)
    ) {
        return false;
    }

    const aspect = camera instanceof PerspectiveCamera ? camera.aspect : 0;
    const bottom = camera instanceof OrthographicCamera ? camera.bottom : 0;
    const fov = camera instanceof PerspectiveCamera ? camera.fov : 0;
    const left = camera instanceof OrthographicCamera ? camera.left : 0;
    const right = camera instanceof OrthographicCamera ? camera.right : 0;
    const top = camera instanceof OrthographicCamera ? camera.top : 0;

    const changed =
        !snapshot.initialized ||
        snapshot.aspect !== aspect ||
        snapshot.bottom !== bottom ||
        snapshot.fov !== fov ||
        snapshot.left !== left ||
        snapshot.positionX !== camera.position.x ||
        snapshot.positionY !== camera.position.y ||
        snapshot.positionZ !== camera.position.z ||
        snapshot.quaternionW !== camera.quaternion.w ||
        snapshot.quaternionX !== camera.quaternion.x ||
        snapshot.quaternionY !== camera.quaternion.y ||
        snapshot.quaternionZ !== camera.quaternion.z ||
        snapshot.right !== right ||
        snapshot.top !== top ||
        snapshot.upX !== camera.up.x ||
        snapshot.upY !== camera.up.y ||
        snapshot.upZ !== camera.up.z ||
        snapshot.zoom !== camera.zoom;

    snapshot.aspect = aspect;
    snapshot.bottom = bottom;
    snapshot.fov = fov;
    snapshot.initialized = true;
    snapshot.left = left;
    snapshot.positionX = camera.position.x;
    snapshot.positionY = camera.position.y;
    snapshot.positionZ = camera.position.z;
    snapshot.quaternionW = camera.quaternion.w;
    snapshot.quaternionX = camera.quaternion.x;
    snapshot.quaternionY = camera.quaternion.y;
    snapshot.quaternionZ = camera.quaternion.z;
    snapshot.right = right;
    snapshot.top = top;
    snapshot.upX = camera.up.x;
    snapshot.upY = camera.up.y;
    snapshot.upZ = camera.up.z;
    snapshot.zoom = camera.zoom;

    return changed;
}

export function createSkyViewBasis(): SkyViewBasis {
    return {
        forward: new Vector3(),
        halfHeight: 1,
        halfWidth: 1,
        perspective: false,
        right: new Vector3(),
        screenScale: 1,
        skyRadius: 1,
        viewUp: new Vector3(),
    };
}

export function updateSkyViewBasis(camera: Camera, basis: SkyViewBasis) {
    if (
        !(camera instanceof OrthographicCamera) &&
        !(camera instanceof PerspectiveCamera)
    ) {
        return false;
    }

    camera.getWorldDirection(basis.forward);
    basis.right.set(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
    basis.viewUp.set(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
    if (camera instanceof OrthographicCamera) {
        basis.perspective = false;
        basis.halfWidth = (camera.right - camera.left) / (2 * camera.zoom);
        basis.halfHeight = (camera.top - camera.bottom) / (2 * camera.zoom);
        basis.screenScale = SKY_REFERENCE_ZOOM / camera.zoom;
    } else {
        basis.perspective = true;
        basis.halfHeight =
            (Math.tan(MathUtils.degToRad(camera.fov) / 2) *
                SKY_FORWARD_DISTANCE) /
            camera.zoom;
        basis.halfWidth = basis.halfHeight * camera.aspect;
        basis.screenScale = basis.halfHeight / SKY_REFERENCE_HALF_HEIGHT;
    }
    basis.skyRadius = basis.halfHeight * SKY_SCREEN_FRACTION;

    return true;
}

const SKY_MIN_FORWARD_DEPTH = 0.000_1;
const SKY_HIDDEN_SCREEN_POSITION = 10;

export function getSkyDirectionProjectionScale(
    direction: Vector3,
    basis: SkyViewBasis,
) {
    if (!basis.perspective) {
        return 1;
    }

    const forwardDepth = direction.dot(basis.forward);
    return forwardDepth > SKY_MIN_FORWARD_DEPTH ? 1 / forwardDepth : null;
}

export function getSunViewportTuning(
    viewportWidth: number,
    viewportHeight: number,
): SunViewportTuning {
    const isPortrait = viewportHeight > viewportWidth;

    if (viewportWidth <= MOBILE_MAX_WIDTH) {
        return {
            sizeMultiplier: 0.6,
            horizontalOffsetMultiplier: isPortrait ? 0.7 : 1,
            verticalOffsetMultiplier: isPortrait ? 1 : 0.8,
        };
    }

    if (viewportWidth <= TABLET_MAX_WIDTH) {
        return {
            sizeMultiplier: 0.9,
            horizontalOffsetMultiplier: isPortrait ? 1 : 0.9,
            verticalOffsetMultiplier: isPortrait ? 1 : 0.9,
        };
    }

    return {
        sizeMultiplier: 1,
        horizontalOffsetMultiplier: isPortrait ? 0.9 : 1.6,
        verticalOffsetMultiplier: isPortrait ? 1.1 : 1,
    };
}

export function projectSkyDirectionToScreen(
    direction: Vector3,
    basis: SkyViewBasis,
    {
        horizontalOffsetMultiplier = 1,
        screenOffsetMultiplier = 1,
        verticalOffsetMultiplier = 1,
    }: {
        horizontalOffsetMultiplier?: number;
        screenOffsetMultiplier?: number;
        verticalOffsetMultiplier?: number;
    },
    target = new Vector2(),
) {
    const projectionScale = getSkyDirectionProjectionScale(direction, basis);
    if (projectionScale === null) {
        target.set(SKY_HIDDEN_SCREEN_POSITION, SKY_HIDDEN_SCREEN_POSITION);
        return false;
    }

    const x =
        basis.halfWidth === 0
            ? 0
            : (direction.dot(basis.right) *
                  projectionScale *
                  basis.skyRadius *
                  screenOffsetMultiplier *
                  horizontalOffsetMultiplier) /
              basis.halfWidth;
    const y =
        basis.halfHeight === 0
            ? 0
            : (direction.dot(basis.viewUp) *
                  projectionScale *
                  basis.skyRadius *
                  screenOffsetMultiplier *
                  verticalOffsetMultiplier) /
              basis.halfHeight;

    target.set(x, y);
    return true;
}
