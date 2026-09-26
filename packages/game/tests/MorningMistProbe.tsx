import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { InstancedMesh, ShaderMaterial } from 'three';
import {
    useSceneAfterRenderSubscription,
    useSceneTimeInvalidation,
} from '../src/scene/SceneTime';

export function MorningMistProbe({
    onSample,
}: {
    onSample: (sample: string) => void;
}) {
    const { camera, scene, gl } = useThree();
    const observedMeshes = useRef(new WeakSet<InstancedMesh>());
    const disposed = useRef({ geometry: 0, material: 0, mesh: 0 });
    const frames = useRef(0);
    const subscribeAfterRender = useSceneAfterRenderSubscription();
    useSceneTimeInvalidation('test:morning-mist-probe');
    useLayoutEffect(() => {
        camera.lookAt(0, 0.4, 0);
        camera.updateProjectionMatrix();
    }, [camera]);
    useEffect(
        () =>
            subscribeAfterRender(() => {
                const mesh = scene.getObjectByName('Weather:MorningMist');
                const rendering = {
                    calls: gl.info.render.calls,
                    triangles: gl.info.render.triangles,
                    disposed: disposed.current,
                    frames: ++frames.current,
                };
                if (
                    !(mesh instanceof InstancedMesh) ||
                    !(mesh.material instanceof ShaderMaterial)
                ) {
                    onSample(JSON.stringify({ count: 0, ...rendering }));
                    return;
                }
                if (!observedMeshes.current.has(mesh)) {
                    observedMeshes.current.add(mesh);
                    mesh.geometry.addEventListener(
                        'dispose',
                        () => disposed.current.geometry++,
                    );
                    mesh.material.addEventListener(
                        'dispose',
                        () => disposed.current.material++,
                    );
                    mesh.addEventListener(
                        'dispose',
                        () => disposed.current.mesh++,
                    );
                }
                onSample(
                    JSON.stringify({
                        count: mesh.visible ? mesh.count : 0,
                        time: mesh.material.uniforms.uTime.value,
                        density: Number(
                            mesh.material.uniforms.uDensity.value.toFixed(3),
                        ),
                        matrices: Array.from(mesh.instanceMatrix.array).map(
                            (n) => Number(n.toFixed(4)),
                        ),
                        seeds: Array.from(
                            mesh.geometry.getAttribute('mistPhase').array,
                        ),
                        ...rendering,
                    }),
                );
            }),
        [gl, onSample, scene, subscribeAfterRender],
    );
    return null;
}
