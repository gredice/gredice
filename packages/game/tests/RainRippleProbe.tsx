import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import { InstancedMesh, ShaderMaterial } from 'three';
import { useSceneTimeInvalidation } from '../src/scene/SceneTime';

export function RainRippleProbe({
    onSample,
}: {
    onSample: (sample: string) => void;
}) {
    const camera = useThree((state) => state.camera);
    const frames = useRef(0);
    useSceneTimeInvalidation('test:rain-ripple-probe');
    useLayoutEffect(() => {
        camera.lookAt(0, 0.4, 0);
        camera.updateProjectionMatrix();
    }, [camera]);
    useFrame(({ scene, gl }) => {
        if (++frames.current % 10) return;
        const mesh = scene.getObjectByName('Weather:RainRipples');
        if (
            !(mesh instanceof InstancedMesh) ||
            !(mesh.material instanceof ShaderMaterial)
        ) {
            onSample(
                JSON.stringify({
                    count: 0,
                    calls: gl.info.render.calls,
                    triangles: gl.info.render.triangles,
                }),
            );
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
                matrices: Array.from(mesh.instanceMatrix.array).map((n) =>
                    Number(n.toFixed(4)),
                ),
                seeds: Array.from(
                    mesh.geometry.getAttribute('rippleSeed').array,
                ),
                calls: gl.info.render.calls,
                triangles: gl.info.render.triangles,
            }),
        );
    });
    return null;
}
