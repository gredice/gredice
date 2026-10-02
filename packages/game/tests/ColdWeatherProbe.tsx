import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect } from 'react';
import { InstancedMesh, ShaderMaterial } from 'three';
import {
    useSceneAfterRenderSubscription,
    useSceneTimeInvalidation,
} from '../src/scene/SceneTime';
import {
    useFrostIntensityUniform,
    useSnowSurfaceAmountUniform,
} from '../src/scene/WeatherSurfaceUniformProvider';
import { useGameState } from '../src/useGameState';

export function ColdWeatherProbe({
    onSample,
}: {
    onSample: (sample: string) => void;
}) {
    const { camera, scene, gl } = useThree();
    const frost = useFrostIntensityUniform();
    const snowAmount = useSnowSurfaceAmountUniform({
        coverageMultiplier: 1,
        overrideSnow: undefined,
    });
    const snow = useGameState((state) => state.snowCoverage);
    const subscribeAfterRender = useSceneAfterRenderSubscription();
    useSceneTimeInvalidation('test:cold-weather-probe');
    useLayoutEffect(() => {
        camera.lookAt(0, 0.4, 0);
        camera.updateProjectionMatrix();
    }, [camera]);
    useEffect(
        () =>
            subscribeAfterRender(() => {
                const mesh = scene.getObjectByName('Weather:ColdBreath');
                const rendering = {
                    frost: frost.value,
                    snow,
                    snowAmount: snowAmount.value,
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
                        alpha: Array.from(mesh.instanceColor?.array ?? []),
                        matrices: Array.from(mesh.instanceMatrix.array).map(
                            (n) => Number(n.toFixed(4)),
                        ),
                        ...rendering,
                    }),
                );
            }),
        [frost, gl, onSample, scene, snow, snowAmount, subscribeAfterRender],
    );
    return null;
}
