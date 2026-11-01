import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import { OrthographicCamera, Vector3 } from 'three';
import type { GameCameraSnapshot } from '../src/controls/GameCameraRigApi';
import { readGameProfileMetadata } from '../src/scene/gameProfileMetadata';
import { useGameState, useGameStateStore } from '../src/useGameState';
import type { CameraRenderedWitness } from './cameraRenderedState';

function hasCurrentCameraMatrices(
    camera: unknown,
    snapshot: GameCameraSnapshot | null,
) {
    if (!(camera instanceof OrthographicCamera) || !snapshot) return false;
    const expected = camera.clone();
    expected.position.fromArray(snapshot.position);
    expected.zoom = snapshot.zoom;
    expected.lookAt(new Vector3(...snapshot.target));
    expected.updateProjectionMatrix();
    expected.updateMatrixWorld(true);
    return [
        [camera.matrixWorld, expected.matrixWorld],
        [camera.matrixWorldInverse, expected.matrixWorldInverse],
        [camera.projectionMatrix, expected.projectionMatrix],
    ].every(
        ([actual, target]) =>
            actual &&
            target &&
            actual.elements.every(
                (value, index) =>
                    Math.abs(value - (target.elements[index] ?? Infinity)) <
                    1e-9,
            ),
    );
}

export function CameraRenderedProbe() {
    const gl = useThree((state) => state.gl);
    const gameCamera = useGameState((state) => state.gameCamera);
    const gameStore = useGameStateStore();
    const counters = useRef<ReturnType<CameraRenderedWitness['snapshot']>>({
        frames: 0,
        cameraChangeRequests: 0,
        targetFramesPerSecond: [],
        submittedCamera: null,
        submittedCameras: [],
        publishedCamera: null,
        snapshotMismatches: 0,
        matrixMismatches: 0,
        shadowSubmissions: 0,
    });

    useLayoutEffect(() => {
        const render = gl.render;
        gl.render = (...args) => {
            const beforeFrame = gl.info.render.frame;
            const runtime = readGameProfileMetadata()?.runtimeFrameLoop;
            const cameraChangeRequested =
                runtime?.renderRequestReasons.includes('camera-change') ??
                false;
            const targetFramesPerSecond = runtime?.targetFramesPerSecond;
            const cameraSnapshot = gameCamera?.getSnapshot() ?? null;
            const publishedCamera = gameStore.getState().gameCameraSnapshot;
            const currentMatrices = hasCurrentCameraMatrices(
                args[1],
                publishedCamera,
            );
            render.apply(gl, args);
            if (gl.info.render.frame <= beforeFrame) return;
            counters.current.frames += 1;
            if (cameraChangeRequested)
                counters.current.cameraChangeRequests += 1;
            if (targetFramesPerSecond !== undefined)
                counters.current.targetFramesPerSecond.push(
                    targetFramesPerSecond,
                );
            counters.current.submittedCamera = cameraSnapshot;
            counters.current.publishedCamera = publishedCamera;
            if (cameraSnapshot)
                counters.current.submittedCameras.push(cameraSnapshot);
            if (
                JSON.stringify(cameraSnapshot) !==
                JSON.stringify(publishedCamera)
            )
                counters.current.snapshotMismatches += 1;
            if (!currentMatrices) counters.current.matrixMismatches += 1;
        };
        window.cameraRenderedWitness = {
            reset: () => {
                counters.current = {
                    frames: 0,
                    cameraChangeRequests: 0,
                    targetFramesPerSecond: [],
                    submittedCamera: null,
                    submittedCameras: [],
                    publishedCamera: null,
                    snapshotMismatches: 0,
                    matrixMismatches: 0,
                    shadowSubmissions: 0,
                };
            },
            snapshot: () => ({
                ...counters.current,
                targetFramesPerSecond: [
                    ...counters.current.targetFramesPerSecond,
                ],
                submittedCameras: [...counters.current.submittedCameras],
            }),
        };
        return () => {
            gl.render = render;
            delete window.cameraRenderedWitness;
        };
    }, [gameCamera, gameStore, gl]);

    return (
        <>
            <directionalLight castShadow position={[3, 8, 4]} />
            <mesh
                castShadow
                position={[0, 0.5, 0]}
                onBeforeShadow={() => {
                    counters.current.shadowSubmissions += 1;
                    if (
                        JSON.stringify(gameCamera?.getSnapshot() ?? null) !==
                        JSON.stringify(gameStore.getState().gameCameraSnapshot)
                    )
                        counters.current.snapshotMismatches += 1;
                    if (
                        !hasCurrentCameraMatrices(
                            gameCamera?.getCamera(),
                            gameStore.getState().gameCameraSnapshot,
                        )
                    )
                        counters.current.matrixMismatches += 1;
                }}
            >
                <boxGeometry />
                <meshStandardMaterial color="#287b38" />
            </mesh>
            <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[8, 8]} />
                <meshStandardMaterial color="#e1d0aa" />
            </mesh>
        </>
    );
}
