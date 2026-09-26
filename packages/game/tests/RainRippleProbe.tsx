import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect } from 'react';
import { InstancedMesh, Mesh, ShaderMaterial, Vector3 } from 'three';
import {
    useSceneAfterRenderSubscription,
    useSceneTimeInvalidation,
} from '../src/scene/SceneTime';

export function RainRippleProbe({
    onSample,
    focusSquirrel = false,
}: {
    onSample: (sample: string) => void;
    focusSquirrel?: boolean;
}) {
    const { camera, scene, gl } = useThree();
    const subscribeAfterRender = useSceneAfterRenderSubscription();
    useSceneTimeInvalidation('test:rain-ripple-probe');
    useLayoutEffect(() => {
        camera.lookAt(0, 0.4, 0);
        camera.updateProjectionMatrix();
    }, [camera]);
    useEffect(
        () =>
            subscribeAfterRender(() => {
                const mesh = scene.getObjectByName('Weather:RainRipples');
                const squirrel = scene.getObjectByName('Squirrel:Actor');
                const nut = scene.getObjectByName('Squirrel:DecorativeNut');
                if (squirrel && focusSquirrel) {
                    camera.position
                        .copy(squirrel.position)
                        .add(new Vector3(3, 2, 4));
                    camera.lookAt(squirrel.position);
                    camera.updateProjectionMatrix();
                }
                const head = nut?.parent;
                const position = nut?.getWorldPosition(new Vector3());
                const localPosition =
                    position && head?.worldToLocal(position.clone());
                const rendering = {
                    squirrel: squirrel
                        ? {
                              position: squirrel.position.toArray(),
                              matrix: squirrel.matrixWorld.toArray(),
                              phase: squirrel.userData.cachePhase,
                              nut:
                                  nut instanceof Mesh
                                      ? {
                                            visible: nut.visible,
                                            localPosition:
                                                localPosition?.toArray(),
                                            worldPosition: position?.toArray(),
                                            head: head?.name,
                                            matrix: nut.matrixWorld.toArray(),
                                            triangles:
                                                nut.geometry.getAttribute(
                                                    'position',
                                                ).count / 3,
                                        }
                                      : null,
                          }
                        : null,
                    geometries: gl.info.memory.geometries,
                    calls: gl.info.render.calls,
                    triangles: gl.info.render.triangles,
                };
                if (
                    !(mesh instanceof InstancedMesh) ||
                    !(mesh.material instanceof ShaderMaterial)
                ) {
                    onSample(JSON.stringify({ count: 0, ...rendering }));
                    return;
                }
                onSample(
                    JSON.stringify({
                        count: mesh.visible ? mesh.count : 0,
                        time: mesh.material.uniforms.uTime.value,
                        rain: mesh.material.uniforms.uRain.value,
                        surfaces: Array.from(
                            mesh.geometry.getAttribute('rippleSurface').array,
                        ),
                        wetness: Number(
                            mesh.material.uniforms.uWetness.value.toFixed(3),
                        ),
                        puddles: mesh.material.uniforms.uPuddleStrength.value,
                        matrices: Array.from(mesh.instanceMatrix.array).map(
                            (n) => Number(n.toFixed(4)),
                        ),
                        seeds: Array.from(
                            mesh.geometry.getAttribute('rippleSeed').array,
                        ),
                        ...rendering,
                    }),
                );
            }),
        [camera, focusSquirrel, gl, onSample, scene, subscribeAfterRender],
    );
    return null;
}
