import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import { readGameProfileMetadata } from '../src/scene/gameProfileMetadata';
import { useGameState } from '../src/useGameState';
import type { CameraRenderedWitness } from './cameraRenderedState';

export function CameraRenderedProbe() {
    const gl = useThree((state) => state.gl);
    const gameCamera = useGameState((state) => state.gameCamera);
    const counters = useRef<ReturnType<CameraRenderedWitness['snapshot']>>({
        frames: 0,
        cameraChangeRequests: 0,
        targetFramesPerSecond: [],
        submittedCamera: null,
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
        };
        window.cameraRenderedWitness = {
            reset: () => {
                counters.current = {
                    frames: 0,
                    cameraChangeRequests: 0,
                    targetFramesPerSecond: [],
                    submittedCamera: null,
                };
            },
            snapshot: () => ({
                ...counters.current,
                targetFramesPerSecond: [
                    ...counters.current.targetFramesPerSecond,
                ],
            }),
        };
        return () => {
            gl.render = render;
            delete window.cameraRenderedWitness;
        };
    }, [gameCamera, gl]);

    return null;
}
