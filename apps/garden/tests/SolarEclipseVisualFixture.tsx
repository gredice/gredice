import { useFrame, useThree } from '@react-three/fiber';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Environment } from '../../../packages/game/src/scene/Environment';
import { Scene } from '../../../packages/game/src/scene/Scene';
import {
    sceneFrameRates,
    useSceneTimeInvalidation,
} from '../../../packages/game/src/scene/SceneTime';
import { getSolarEclipseState } from '../../../packages/game/src/scene/solarEclipse';
import {
    createGameState,
    GameStateContext,
} from '../../../packages/game/src/useGameState';
import { defaultGameLocation } from '../../../packages/game/src/utils/timeOfDay';

function AimCamera() {
    const camera = useThree((state) => state.camera);

    useLayoutEffect(() => {
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
    }, [camera]);

    return null;
}

type EnvironmentLightIntensities = {
    ambient: number;
    directional: number;
    hemisphere: number;
};

function readLightIntensity(
    scene: { getObjectByName: (name: string) => unknown },
    name: string,
) {
    const light = scene.getObjectByName(name);
    return light !== null &&
        typeof light === 'object' &&
        'intensity' in light &&
        typeof light.intensity === 'number'
        ? light.intensity
        : 0;
}

function MarkFixtureReady({
    onReady,
    ready,
}: {
    onReady: (intensities: EnvironmentLightIntensities) => void;
    ready: boolean;
}) {
    const frameCount = useRef(0);
    const scene = useThree((state) => state.scene);
    useSceneTimeInvalidation(
        'test:solar-eclipse-warmup',
        !ready,
        sceneFrameRates.ambient,
    );

    useFrame(() => {
        frameCount.current += 1;
        if (frameCount.current === 45) {
            onReady({
                ambient: readLightIntensity(scene, 'Environment:AmbientLight'),
                directional: readLightIntensity(
                    scene,
                    'Environment:SunDirectionalLight',
                ),
                hemisphere: readLightIntensity(
                    scene,
                    'Environment:HemisphereLight',
                ),
            });
        }
    });

    return null;
}

function EnvironmentLightProbe() {
    return (
        <group name="EnvironmentLightProbe">
            <mesh position={[0, -0.8, 0]} receiveShadow>
                <boxGeometry args={[6, 0.3, 6]} />
                <meshStandardMaterial color="#7da85d" roughness={0.9} />
            </mesh>
            <mesh castShadow position={[-0.9, 0.1, 0]}>
                <boxGeometry args={[1.25, 1.5, 1.25]} />
                <meshStandardMaterial color="#d39b43" roughness={0.72} />
            </mesh>
            <mesh position={[1, 0.12, 0.45]}>
                <sphereGeometry args={[0.82, 24, 16]} />
                <meshBasicMaterial color="#cbd5e1" toneMapped={false} />
            </mesh>
        </group>
    );
}

function ForegroundOcclusionProbe() {
    const camera = useThree((state) => state.camera);
    const scene = useThree((state) => state.scene);

    useFrame(() => {
        const sun = scene.getObjectByName('Environment:SunBillboard');
        const mesh = scene.getObjectByName('ForegroundDepthProbe');
        if (!mesh || !sun) return;

        mesh.position.copy(sun.position).lerp(camera.position, 0.02);
        mesh.quaternion.copy(sun.quaternion);
        mesh.scale.copy(sun.scale);
    });

    return (
        <mesh frustumCulled={false} name="ForegroundDepthProbe">
            <planeGeometry args={[0.26, 0.26]} />
            <meshBasicMaterial color="#16a34a" />
        </mesh>
    );
}

export function SolarEclipseVisualFixture({
    dayNightCycleDisabled = false,
    foregroundOcclusionProbe = false,
    lightingProbe = false,
    noBackground = false,
    time,
}: {
    dayNightCycleDisabled?: boolean;
    foregroundOcclusionProbe?: boolean;
    lightingProbe?: boolean;
    noBackground?: boolean;
    time: string;
}) {
    const [lightIntensities, setLightIntensities] =
        useState<EnvironmentLightIntensities | null>(null);
    const frozenTime = useMemo(() => new Date(time), [time]);
    const eclipse = useMemo(
        () =>
            dayNightCycleDisabled
                ? null
                : getSolarEclipseState(frozenTime, defaultGameLocation),
        [dayNightCycleDisabled, frozenTime],
    );
    const gameStore = useMemo(
        () =>
            createGameState({
                appBaseUrl: 'http://localhost',
                dayNightCycleDisabled,
                freezeTime: frozenTime,
                isMock: true,
                mockGardenProfile: 'high-target',
                winterMode: 'summer',
            }),
        [dayNightCycleDisabled, frozenTime],
    );
    const queryClient = useMemo(
        () =>
            new QueryClient({
                defaultOptions: { queries: { retry: false } },
            }),
        [],
    );

    return (
        <div
            data-ambient-light-intensity={lightIntensities?.ambient.toFixed(3)}
            data-directional-light-intensity={lightIntensities?.directional.toFixed(
                3,
            )}
            data-eclipse-obscuration={(eclipse?.obscuration ?? 0).toFixed(3)}
            data-hemisphere-light-intensity={lightIntensities?.hemisphere.toFixed(
                3,
            )}
            data-render-ready={lightIntensities ? 'true' : 'false'}
            data-testid="solar-eclipse-visual-fixture"
            style={{ height: 400, overflow: 'hidden', width: 640 }}
        >
            <QueryClientProvider client={queryClient}>
                <GameStateContext.Provider value={gameStore}>
                    <Scene
                        fixedTimeSeconds={1}
                        position={[-100, 100, -100]}
                        rendererOptions={{
                            alpha: noBackground,
                            antialias: false,
                            preserveDrawingBuffer: true,
                        }}
                        zoom={90}
                    >
                        <AimCamera />
                        <Environment
                            noBackground={noBackground}
                            noSound
                            noWeather
                        />
                        {lightingProbe ? <EnvironmentLightProbe /> : null}
                        {foregroundOcclusionProbe ? (
                            <ForegroundOcclusionProbe />
                        ) : null}
                        <MarkFixtureReady
                            onReady={setLightIntensities}
                            ready={lightIntensities !== null}
                        />
                    </Scene>
                </GameStateContext.Provider>
            </QueryClientProvider>
        </div>
    );
}
