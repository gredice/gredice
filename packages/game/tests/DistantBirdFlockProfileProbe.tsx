import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import { InstancedMesh } from 'three';
import { readGameProfileMetadata } from '../src/scene/gameProfileMetadata';
import { useSceneRenderRequest } from '../src/scene/SceneTime';
import { useSceneAfterFrame } from '../src/scene/useSceneAfterFrame';

export function DistantBirdFlockProfileProbe({
    enabled,
    onReport,
}: {
    enabled: boolean;
    onReport: (value: string) => void;
}) {
    const gl = useThree((state) => state.gl);
    const scene = useThree((state) => state.scene);
    const requestRender = useSceneRenderRequest();
    const sample = useRef({ frames: 0, calls: 0, triangles: 0 });
    useLayoutEffect(() => {
        sample.current = { frames: 0, calls: 0, triangles: 0 };
        requestRender(
            enabled
                ? 'test:flock-profile-enabled'
                : 'test:flock-profile-disabled',
        );
    }, [enabled, requestRender]);
    useSceneAfterFrame(() => {
        const metadata = readGameProfileMetadata();
        if (
            !metadata?.autumnLeafCount ||
            !metadata.autumnEntityLeafClusters ||
            !metadata.steamParticleCount
        )
            return;
        const mesh = scene.getObjectByName('Environment:DistantBirdFlocks');
        if (enabled && (!(mesh instanceof InstancedMesh) || mesh.count !== 5))
            return;
        const state = sample.current;
        if (state.frames >= 30) return;
        if (state.frames >= 10) {
            state.calls += gl.info.render.calls;
            state.triangles += gl.info.render.triangles;
        }
        state.frames++;
        if (state.frames === 30) {
            onReport(
                JSON.stringify({
                    enabled,
                    frames: 20,
                    calls: state.calls / 20,
                    triangles: state.triangles / 20,
                    birds: mesh instanceof InstancedMesh ? mesh.count : 0,
                    birdTriangles:
                        mesh instanceof InstancedMesh
                            ? mesh.geometry.getAttribute('position').count / 3
                            : 0,
                    steam: metadata.steamParticleCount,
                    falling: metadata.autumnLeafCount,
                    ground: metadata.autumnGroundLeafClusters,
                    entity: metadata.autumnEntityLeafClusters,
                }),
            );
        }
    });
    return null;
}
