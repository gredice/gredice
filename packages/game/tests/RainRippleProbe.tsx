import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect } from 'react';
import { InstancedMesh, ShaderMaterial } from 'three';
import {
    useSceneAfterRenderSubscription,
    useSceneTimeInvalidation,
} from '../src/scene/SceneTime';

export function RainRippleProbe({
    onSample,
}: {
    onSample: (sample: string) => void;
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
                const rendering = {
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
        [gl, onSample, scene, subscribeAfterRender],
    );
    return null;
}
