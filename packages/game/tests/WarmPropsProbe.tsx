import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import { InstancedMesh, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { readGameProfileMetadata } from '../src/scene/gameProfileMetadata';
import { useSceneTimeInvalidation } from '../src/scene/SceneTime';
import { useSceneAfterFrame } from '../src/scene/useSceneAfterFrame';
import { useGameGLTF } from '../src/utils/useGameGLTF';

export function WarmPropsProbe({
    onSample,
}: {
    onSample: (value: string) => void;
}) {
    const { scene, camera, gl, size } = useThree();
    const { materials } = useGameGLTF('GardenBrazier');
    const observedMeshes = useRef(new WeakSet<InstancedMesh>());
    const warmCost = useRef({ calls: 0, triangles: 0 });
    useSceneTimeInvalidation('test:warm-props');
    useLayoutEffect(() => {
        camera.lookAt(0, 0.4, 0);
        camera.updateProjectionMatrix();
    }, [camera]);
    useSceneAfterFrame(() => {
        const fire = scene.getObjectByName('WarmProps:Fire');
        const smoke = scene.getObjectByName('WarmProps:Smoke');
        const cost = warmCost.current;
        warmCost.current = { calls: 0, triangles: 0 };
        for (const mesh of [fire, smoke]) {
            if (
                !(mesh instanceof InstancedMesh) ||
                observedMeshes.current.has(mesh)
            )
                continue;
            observedMeshes.current.add(mesh);
            let callsBefore = 0;
            let trianglesBefore = 0;
            // Count only this effect's actual submissions. Other autumn
            // batches may finish loading between active and unmounted frames.
            mesh.onBeforeRender = () => {
                callsBefore = gl.info.render.calls;
                trianglesBefore = gl.info.render.triangles;
            };
            mesh.onAfterRender = () => {
                warmCost.current.calls += gl.info.render.calls - callsBefore;
                warmCost.current.triangles +=
                    gl.info.render.triangles - trianglesBefore;
            };
        }
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
                    readGameProfileMetadata()?.autumnGroundLeafClusters ?? 0,
                entityLeaves:
                    readGameProfileMetadata()?.autumnEntityLeafClusters ?? 0,
                count: readGameProfileMetadata()?.warmPropCount ?? 0,
                smoke: smoke instanceof InstancedMesh ? smoke.count : 0,
                matrices:
                    fire instanceof InstancedMesh
                        ? Array.from(fire.instanceMatrix.array).map((n) =>
                              Number(n.toFixed(5)),
                          )
                        : [],
                emberIntensities,
                sourceIntensity:
                    materials['Material.GardenBrazier.Embers']
                        .emissiveIntensity,
                calls: gl.info.render.calls,
                triangles: gl.info.render.triangles,
                warmCalls: cost.calls,
                warmTriangles: cost.triangles,
                target: point
                    ? {
                          x: ((point.x + 1) * size.width) / 2,
                          y: ((1 - point.y) * size.height) / 2,
                      }
                    : null,
            }),
        );
    });
    return null;
}
