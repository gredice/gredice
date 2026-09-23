import { Canvas } from '@react-three/fiber';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { type Group, Vector3 } from 'three';
import { AutumnLeaves } from '../src/scene/AutumnLeaves';
import {
    AutumnSourcesProvider,
    useRegisterAutumnSource,
} from '../src/scene/AutumnSources';
import {
    createRuntimeFrameLoopProfileTelemetry,
    updateGameProfileMetadata,
} from '../src/scene/gameProfileMetadata';
import { SceneTimeProvider } from '../src/scene/SceneTime';
import { getSeasonDebugDates } from '../src/scene/seasonDebugDates';
import {
    createGameState,
    GameStateContext,
    useDisposeGameStateStore,
} from '../src/useGameState';

function BareAutumnSource() {
    const ref = useRef<Group>(null);
    useRegisterAutumnSource('gust-lease-tree', ref, true);
    return <group ref={ref} position={[0, 0.5, 0]} />;
}

export function AutumnGustLeaseFixture() {
    const client = useMemo(() => new QueryClient(), []);
    const store = useMemo(
        () =>
            createGameState({
                appBaseUrl: '',
                isMock: true,
                freezeTime: getSeasonDebugDates().winter,
            }),
        [],
    );
    useDisposeGameStateStore(store);
    const runtimeFrameLoop = useMemo(
        createRuntimeFrameLoopProfileTelemetry,
        [],
    );
    useEffect(() => {
        updateGameProfileMetadata({ runtimeFrameLoop });
        return () => updateGameProfileMetadata({ runtimeFrameLoop: undefined });
    }, [runtimeFrameLoop]);
    const stacks = useMemo(
        () => [
            {
                position: new Vector3(0, 0, 0),
                blocks: [
                    { name: 'Block_Grass', id: 'gust-ground', rotation: 0 },
                ],
            },
        ],
        [],
    );

    return (
        <QueryClientProvider client={client}>
            <GameStateContext.Provider value={store}>
                <Canvas
                    camera={{ position: [4, 4, 6], zoom: 95 }}
                    frameloop="never"
                    orthographic
                    style={{ width: 640, height: 420 }}
                >
                    <SceneTimeProvider
                        ambientFramesPerSecond={30}
                        baseFramesPerSecond={0}
                        runtimeFrameLoop={runtimeFrameLoop}
                    >
                        <AutumnSourcesProvider>
                            <BareAutumnSource />
                            <AutumnLeaves
                                gardenId={7}
                                stacks={stacks}
                                tier="low"
                                windSpeed={3}
                            />
                        </AutumnSourcesProvider>
                    </SceneTimeProvider>
                </Canvas>
            </GameStateContext.Provider>
        </QueryClientProvider>
    );
}
