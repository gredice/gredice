'use client';

import { useFrame, useThree } from '@react-three/fiber';
import {
    type RefObject,
    useCallback,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import * as THREE from 'three';
import type { CameraFrame } from '../../../spatial/cameraFrame';
import { useCameraFrame } from '../../../spatial/useCameraFrame';
import { useGameState } from '../../../useGameState';
import {
    type PlantLodLevel,
    resolvePlantLodLevel,
    resolvePlantLodLevelWithHysteresis,
} from '../lib/plantLod';

const DEFAULT_VISIBILITY_MARGIN = 0.14;

export type PlantLodState = {
    level: PlantLodLevel;
    measured: boolean;
    screenOccupancy: number;
    visible: boolean;
};

type PlantLodOptions = {
    cullOffscreen?: boolean;
    visibilityMargin?: number;
};

function getOrthographicCameraZoom(camera: THREE.Camera) {
    return camera instanceof THREE.OrthographicCamera ? camera.zoom : 0;
}

function resolvePlantVisibility({
    approximatePlantHeight,
    frame,
    cullOffscreen,
    visibilityMargin,
    viewportHeight,
    worldPosition,
}: {
    approximatePlantHeight: number;
    frame: CameraFrame;
    cullOffscreen: boolean;
    visibilityMargin: number;
    viewportHeight: number;
    worldPosition: THREE.Vector3;
}) {
    if (!cullOffscreen) {
        return true;
    }

    const projected = frame.project(worldPosition, new THREE.Vector3());
    if (
        !Number.isFinite(projected.x) ||
        !Number.isFinite(projected.y) ||
        !Number.isFinite(projected.z)
    ) {
        return true;
    }

    const plantMargin = Math.max(approximatePlantHeight, 0.25) / viewportHeight;
    const ndcMargin = visibilityMargin + plantMargin * 2;

    return (
        Math.abs(projected.x) <= 1 + ndcMargin &&
        Math.abs(projected.y) <= 1 + ndcMargin
    );
}

export function usePlantLodState(
    objectRef: RefObject<THREE.Object3D | null>,
    approximatePlantHeight: number,
    {
        cullOffscreen = false,
        visibilityMargin = DEFAULT_VISIBILITY_MARGIN,
    }: PlantLodOptions = {},
) {
    const camera = useThree((state) => state.camera);
    const readCameraFrame = useCameraFrame();
    const evaluatedFrameRef = useRef<{
        frame: CameraFrame;
        version: number;
    } | null>(null);
    const viewport = useThree((state) => state.viewport);
    const gameCamera = useGameState((state) => state.gameCamera);
    const gardenAvatarView = useGameState((state) => state.gardenAvatarView);
    const worldPosition = useMemo(() => new THREE.Vector3(), []);
    const [lodState, setLodState] = useState<PlantLodState>(() => ({
        level: cullOffscreen ? 'far' : resolvePlantLodLevel(1),
        measured: false,
        screenOccupancy: cullOffscreen ? 0 : 1,
        visible: !cullOffscreen,
    }));
    const lodStateRef = useRef(lodState);

    useLayoutEffect(() => {
        lodStateRef.current = lodState;
    }, [lodState]);

    const updateLod = useCallback(() => {
        const frame = readCameraFrame();
        evaluatedFrameRef.current = { frame, version: frame.version };
        const object = objectRef.current;
        if (!object) {
            return;
        }

        object.updateWorldMatrix(true, false);
        object.getWorldPosition(worldPosition);
        const currentViewport = viewport.getCurrentViewport(
            camera,
            worldPosition,
        );
        const viewportHeight = Math.max(currentViewport.height, 0.001);
        const screenOccupancy =
            Math.max(approximatePlantHeight, 0.25) / viewportHeight;
        const visible = resolvePlantVisibility({
            approximatePlantHeight,
            frame,
            cullOffscreen,
            visibilityMargin,
            viewportHeight,
            worldPosition,
        });
        const nextLevel = resolvePlantLodLevelWithHysteresis({
            cameraZoom: getOrthographicCameraZoom(camera),
            currentLevel: lodStateRef.current.level,
            screenOccupancy,
        });

        const resolvedLevel = visible ? nextLevel : 'far';
        setLodState((current) => {
            if (
                current.level === resolvedLevel &&
                current.measured &&
                current.visible === visible &&
                Math.abs(current.screenOccupancy - screenOccupancy) < 0.001
            ) {
                return current;
            }

            return {
                level: resolvedLevel,
                measured: true,
                screenOccupancy,
                visible,
            };
        });
    }, [
        approximatePlantHeight,
        camera,
        cullOffscreen,
        objectRef,
        readCameraFrame,
        viewport,
        visibilityMargin,
        worldPosition,
    ]);

    useLayoutEffect(() => {
        updateLod();

        if (!gameCamera) {
            return;
        }

        return gameCamera.subscribe(() => updateLod());
    }, [gameCamera, updateLod]);

    useFrame(() => {
        // Overview changes already publish through the camera subscription.
        // Avatar movement writes the camera directly and needs this fallback.
        if (gameCamera && gardenAvatarView === 'overview') return;
        const frame = readCameraFrame();
        if (
            gameCamera &&
            evaluatedFrameRef.current?.frame === frame &&
            evaluatedFrameRef.current.version === frame.version
        )
            return;
        updateLod();
    }, -90);

    return lodState;
}

export function usePlantLod(
    objectRef: RefObject<THREE.Object3D | null>,
    approximatePlantHeight: number,
) {
    const lodState = usePlantLodState(objectRef, approximatePlantHeight);

    return lodState.level;
}
