import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect } from 'react';
import { InstancedMesh, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { readGameProfileMetadata } from '../src/scene/gameProfileMetadata';
import {
    useSceneAfterRenderSubscription,
    useSceneTimeInvalidation,
} from '../src/scene/SceneTime';
import { useGameGLTF } from '../src/utils/useGameGLTF';

export function WarmPropsProbe({
    onSample,
}: {
    onSample: (value: string) => void;
}) {
    const { scene, camera, gl, size } = useThree();
    const { materials } = useGameGLTF('GardenBrazier');
    const subscribe = useSceneAfterRenderSubscription();
    useSceneTimeInvalidation('test:warm-props');
    useLayoutEffect(() => {
        camera.lookAt(0, 0.4, 0);
        camera.updateProjectionMatrix();
    }, [camera]);
    useEffect(
        () =>
            subscribe(() => {
                const fire = scene.getObjectByName('WarmProps:Fire');
                const smoke = scene.getObjectByName('WarmProps:Smoke');
                const root = scene.getObjectByName('GardenBrazier:warm:0');
                const point = root
                    ?.localToWorld(new Vector3(0, 0.35, 0))
                    .project(camera);
                const emberIntensities: number[] = [];
                scene.traverse((node) => {
                    if (
                        node.name === 'GardenBrazier_Embers' &&
                        node instanceof Mesh &&
                        node.material instanceof MeshStandardMaterial
                    )
                        emberIntensities.push(node.material.emissiveIntensity);
                });
                onSample(
                    JSON.stringify({
                        leaves: readGameProfileMetadata()?.autumnLeafCount ?? 0,
                        groundLeaves:
                            readGameProfileMetadata()
                                ?.autumnGroundLeafClusters ?? 0,
                        entityLeaves:
                            readGameProfileMetadata()
                                ?.autumnEntityLeafClusters ?? 0,
                        count: readGameProfileMetadata()?.warmPropCount ?? 0,
                        smoke: smoke instanceof InstancedMesh ? smoke.count : 0,
                        matrices:
                            fire instanceof InstancedMesh
                                ? Array.from(fire.instanceMatrix.array).map(
                                      (n) => Number(n.toFixed(5)),
                                  )
                                : [],
                        emberIntensities,
                        sourceIntensity:
                            materials['Material.GardenBrazier.Embers']
                                .emissiveIntensity,
                        calls: gl.info.render.calls,
                        triangles: gl.info.render.triangles,
                        target: point
                            ? {
                                  x: ((point.x + 1) * size.width) / 2,
                                  y: ((1 - point.y) * size.height) / 2,
                              }
                            : null,
                    }),
                );
            }),
        [scene, camera, gl, materials, onSample, size, subscribe],
    );
    return null;
}
