import {
    type BufferAttribute,
    type BufferGeometry,
    type Camera,
    type InterleavedBuffer,
    InterleavedBufferAttribute,
    type Matrix4,
    Object3D,
} from 'three';

const defaultObject = new Object3D();
const defaultOnAfterRender = defaultObject.onAfterRender;
const defaultOnBeforeRender = defaultObject.onBeforeRender;

type CacheObservedCamera = Camera & {
    isArrayCamera?: boolean;
};

export type HoverOutlineMaskCacheTarget = {
    contentKey: unknown;
    object: Object3D;
};

type CacheObservedObject = Object3D & {
    geometry?: BufferGeometry;
    instanceMatrix?: { version: number };
    isBatchedMesh?: boolean;
    isInstancedMesh?: boolean;
    isLine?: boolean;
    isLOD?: boolean;
    isMesh?: boolean;
    isPoints?: boolean;
    isSkinnedMesh?: boolean;
    isSprite?: boolean;
    material?: unknown | unknown[];
    morphTargetInfluences?: number[];
};

type HoverOutlineMaskObjectSnapshot = {
    drawRangeCount: number | null;
    drawRangeStart: number | null;
    geometry: BufferGeometry | null;
    geometryGroups: {
        count: number;
        materialIndex: number | undefined;
        start: number;
    }[];
    index: BufferAttribute | null;
    indexVersion: number | null;
    instanceMatrixVersion: number | null;
    matrixWorld: Matrix4;
    object: Object3D;
    parent: Object3D | null;
    position: BufferAttribute | InterleavedBufferAttribute | null;
    positionInterleavedBuffer: InterleavedBuffer | null;
    positionVersion: number | null;
    frustumCulled: boolean;
    visible: boolean;
};

type HoverOutlineMaskTargetSnapshot = {
    contentKey: unknown;
    object: Object3D;
    objects: HoverOutlineMaskObjectSnapshot[];
};

export type HoverOutlineMaskCacheSnapshot = {
    camera: Camera;
    cameraMatrixWorldInverse: Matrix4;
    cameraProjectionMatrix: Matrix4;
    drawingBufferHeight: number;
    drawingBufferWidth: number;
    registryVersion: number;
    scene: Object3D;
    targets: HoverOutlineMaskTargetSnapshot[];
};

type HoverOutlineMaskCacheInput = {
    camera: Camera;
    drawingBufferHeight: number;
    drawingBufferWidth: number;
    registryVersion: number;
    scene: Object3D;
    targets: HoverOutlineMaskCacheTarget[];
};

function readObjectState(object: Object3D) {
    const observed = object as CacheObservedObject;
    const geometry = observed.geometry ?? null;
    const position = geometry?.getAttribute('position') ?? null;
    const positionInterleavedBuffer =
        position instanceof InterleavedBufferAttribute ? position.data : null;
    const positionVersion = position
        ? position instanceof InterleavedBufferAttribute
            ? position.data.version
            : position.version
        : null;

    return {
        drawRangeCount: geometry?.drawRange.count ?? null,
        drawRangeStart: geometry?.drawRange.start ?? null,
        geometry,
        index: geometry?.index ?? null,
        indexVersion: geometry?.index?.version ?? null,
        instanceMatrixVersion: observed.instanceMatrix?.version ?? null,
        position,
        positionInterleavedBuffer,
        positionVersion,
    };
}

function hasUnsupportedDynamicGeometry(object: Object3D) {
    let unsupported = false;

    object.traverse((child) => {
        const observed = child as CacheObservedObject;
        if (
            observed.isInstancedMesh === true ||
            observed.isBatchedMesh === true ||
            observed.isLine === true ||
            observed.isLOD === true ||
            observed.isPoints === true ||
            observed.isSkinnedMesh === true ||
            observed.isSprite === true ||
            (observed.geometry !== undefined && observed.isMesh !== true) ||
            Array.isArray(observed.material) ||
            (observed.morphTargetInfluences?.length ?? 0) > 0 ||
            observed.onAfterRender !== defaultOnAfterRender ||
            observed.onBeforeRender !== defaultOnBeforeRender
        ) {
            unsupported = true;
        }
    });

    return unsupported;
}

function isEligibleTarget(target: HoverOutlineMaskCacheTarget) {
    return (
        target.contentKey !== null &&
        target.contentKey !== undefined &&
        !hasUnsupportedDynamicGeometry(target.object)
    );
}

function captureTarget(target: HoverOutlineMaskCacheTarget) {
    const objects: HoverOutlineMaskObjectSnapshot[] = [];
    target.object.traverse((object) => {
        const objectState = readObjectState(object);
        objects.push({
            ...objectState,
            frustumCulled: object.frustumCulled,
            geometryGroups:
                objectState.geometry?.groups.map(
                    ({ count, materialIndex, start }) => ({
                        count,
                        materialIndex,
                        start,
                    }),
                ) ?? [],
            matrixWorld: object.matrixWorld.clone(),
            object,
            parent: object.parent,
            visible: object.visible,
        });
    });

    return {
        contentKey: target.contentKey,
        object: target.object,
        objects,
    };
}

function isDescendantOf(object: Object3D, ancestor: Object3D) {
    let current: Object3D | null = object;
    while (current) {
        if (current === ancestor) {
            return true;
        }
        current = current.parent;
    }
    return false;
}

function isEffectivelyVisible(object: Object3D, ancestor: Object3D) {
    let current: Object3D | null = object;
    while (current) {
        if (!current.visible) {
            return false;
        }
        if (current === ancestor) {
            return true;
        }
        current = current.parent;
    }
    return false;
}

export function captureHoverOutlineMaskCacheSnapshot({
    camera,
    drawingBufferHeight,
    drawingBufferWidth,
    registryVersion,
    scene,
    targets,
}: HoverOutlineMaskCacheInput): HoverOutlineMaskCacheSnapshot | null {
    const observedCamera = camera as CacheObservedCamera;
    if (
        observedCamera.isArrayCamera === true ||
        targets.length === 0 ||
        !targets.every(
            (target) =>
                isEligibleTarget(target) &&
                isDescendantOf(target.object, scene) &&
                isEffectivelyVisible(target.object, scene),
        )
    ) {
        return null;
    }

    return {
        camera,
        cameraMatrixWorldInverse: camera.matrixWorldInverse.clone(),
        cameraProjectionMatrix: camera.projectionMatrix.clone(),
        drawingBufferHeight,
        drawingBufferWidth,
        registryVersion,
        scene,
        targets: targets.map(captureTarget),
    };
}

function objectMatchesSnapshot(
    object: Object3D,
    snapshot: HoverOutlineMaskObjectSnapshot,
) {
    const state = readObjectState(object);
    const geometryGroups = state.geometry?.groups ?? [];

    return (
        snapshot.object === object &&
        snapshot.parent === object.parent &&
        snapshot.visible === object.visible &&
        snapshot.frustumCulled === object.frustumCulled &&
        snapshot.matrixWorld.equals(object.matrixWorld) &&
        snapshot.geometry === state.geometry &&
        snapshot.geometryGroups.length === geometryGroups.length &&
        geometryGroups.every((group, index) => {
            const expected = snapshot.geometryGroups[index];
            return (
                expected !== undefined &&
                expected.count === group.count &&
                expected.materialIndex === group.materialIndex &&
                expected.start === group.start
            );
        }) &&
        snapshot.drawRangeCount === state.drawRangeCount &&
        snapshot.drawRangeStart === state.drawRangeStart &&
        snapshot.index === state.index &&
        snapshot.indexVersion === state.indexVersion &&
        snapshot.instanceMatrixVersion === state.instanceMatrixVersion &&
        snapshot.position === state.position &&
        snapshot.positionInterleavedBuffer ===
            state.positionInterleavedBuffer &&
        snapshot.positionVersion === state.positionVersion
    );
}

function targetMatchesSnapshot(
    target: HoverOutlineMaskCacheTarget,
    snapshot: HoverOutlineMaskTargetSnapshot,
    scene: Object3D,
) {
    if (
        snapshot.object !== target.object ||
        !Object.is(snapshot.contentKey, target.contentKey) ||
        !isEligibleTarget(target) ||
        !isDescendantOf(target.object, scene) ||
        !isEffectivelyVisible(target.object, scene)
    ) {
        return false;
    }

    let objectIndex = 0;
    let matches = true;
    target.object.traverse((object) => {
        const objectSnapshot = snapshot.objects[objectIndex];
        if (!objectSnapshot || !objectMatchesSnapshot(object, objectSnapshot)) {
            matches = false;
        }
        objectIndex += 1;
    });

    return matches && objectIndex === snapshot.objects.length;
}

export function hoverOutlineMaskCacheSnapshotMatches(
    snapshot: HoverOutlineMaskCacheSnapshot,
    {
        camera,
        drawingBufferHeight,
        drawingBufferWidth,
        registryVersion,
        scene,
        targets,
    }: HoverOutlineMaskCacheInput,
) {
    return (
        snapshot.camera === camera &&
        (camera as CacheObservedCamera).isArrayCamera !== true &&
        snapshot.registryVersion === registryVersion &&
        snapshot.drawingBufferHeight === drawingBufferHeight &&
        snapshot.drawingBufferWidth === drawingBufferWidth &&
        snapshot.scene === scene &&
        snapshot.cameraMatrixWorldInverse.equals(camera.matrixWorldInverse) &&
        snapshot.cameraProjectionMatrix.equals(camera.projectionMatrix) &&
        snapshot.targets.length === targets.length &&
        targets.every((target, index) => {
            const targetSnapshot = snapshot.targets[index];
            return (
                targetSnapshot !== undefined &&
                targetMatchesSnapshot(target, targetSnapshot, scene)
            );
        })
    );
}
