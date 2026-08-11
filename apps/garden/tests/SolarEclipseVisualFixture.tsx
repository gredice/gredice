import { useFrame, useThree } from '@react-three/fiber';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Environment } from '../../../packages/game/src/scene/Environment';
import { Scene } from '../../../packages/game/src/scene/Scene';
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

function MarkFixtureReady({ onReady }: { onReady: () => void }) {
    const frameCount = useRef(0);

    useFrame(() => {
        frameCount.current += 1;
        if (frameCount.current === 45) {
            onReady();
        }
    });

    return null;
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
    time,
}: {
    dayNightCycleDisabled?: boolean;
    foregroundOcclusionProbe?: boolean;
    time: string;
}) {
    const [ready, setReady] = useState(false);
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
            data-eclipse-obscuration={(eclipse?.obscuration ?? 0).toFixed(3)}
            data-render-ready={ready ? 'true' : 'false'}
            data-testid="solar-eclipse-visual-fixture"
            style={{ height: 400, overflow: 'hidden', width: 640 }}
        >
            <QueryClientProvider client={queryClient}>
                <GameStateContext.Provider value={gameStore}>
                    <Scene
                        fixedTimeSeconds={1}
                        position={[-100, 100, -100]}
                        rendererOptions={{
                            alpha: false,
                            antialias: false,
                            preserveDrawingBuffer: true,
                        }}
                        zoom={90}
                    >
                        <AimCamera />
                        <Environment noSound noWeather />
                        {foregroundOcclusionProbe ? (
                            <ForegroundOcclusionProbe />
                        ) : null}
                        <MarkFixtureReady onReady={() => setReady(true)} />
                    </Scene>
                </GameStateContext.Provider>
            </QueryClientProvider>
        </div>
    );
}
