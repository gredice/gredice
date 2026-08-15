import { PerspectiveCamera } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { useMemo, useState } from 'react';
import { Vector3 } from 'three';
import { GameCameraRig } from '../src/controls/GameCameraRig';
import { Drops } from '../src/scene/Rain/Drops';
import { Scene } from '../src/scene/Scene';
import Snow from '../src/scene/Snow/Snow';
import {
    createGameState,
    GameStateContext,
    useGameState,
} from '../src/useGameState';

const overviewPosition = new Vector3(-10, 10, -10);
const overviewTarget = new Vector3(2, 0, 3);

function CharacterCamera({ position }: { position: [number, number, number] }) {
    const view = useGameState((state) => state.gardenAvatarView);

    return view === 'overview' ? null : (
        <PerspectiveCamera makeDefault position={position} />
    );
}

type PrecipitationPositions = {
    activeCamera: string;
    localSnow: string;
    rain: string;
    snow: string;
};

function formatPosition({ x, y, z }: { x: number; y: number; z: number }) {
    return JSON.stringify([x, y, z]);
}

function PrecipitationPositionProbe({
    onChange,
}: {
    onChange: (positions: PrecipitationPositions) => void;
}) {
    const camera = useThree((state) => state.camera);
    const scene = useThree((state) => state.scene);

    useFrame(() => {
        const globalWeather = scene.getObjectByName('GlobalWeather');
        const localWeather = scene.getObjectByName('LocalMagicSnow');
        const rain = globalWeather?.getObjectByName('Weather:Rain');
        const snow = globalWeather?.getObjectByName('Weather:Snow');
        const localSnow = localWeather?.getObjectByName('Weather:Snow');
        if (!rain || !snow || !localSnow) {
            return;
        }

        onChange({
            activeCamera: formatPosition(camera.position),
            localSnow: formatPosition(localSnow.position),
            rain: formatPosition(rain.position),
            snow: formatPosition(snow.position),
        });
    });

    return null;
}

export function PrecipitationCameraFollowFixture() {
    const [cameraPosition, setCameraPosition] = useState<
        [number, number, number]
    >([10, 3, -6]);
    const [positions, setPositions] = useState<PrecipitationPositions | null>(
        null,
    );
    const queryClient = useMemo(
        () =>
            new QueryClient({
                defaultOptions: { queries: { retry: false } },
            }),
        [],
    );
    const gameStore = useMemo(
        () =>
            createGameState({
                appBaseUrl: 'http://localhost',
                authenticatedGardenQueriesEnabled: false,
                freezeTime: new Date('2026-08-15T12:00:00.000Z'),
                isMock: true,
            }),
        [],
    );

    return (
        <NuqsTestingAdapter>
            <QueryClientProvider client={queryClient}>
                <GameStateContext.Provider value={gameStore}>
                    <div
                        data-active-camera-position={positions?.activeCamera}
                        data-local-snow-position={positions?.localSnow}
                        data-rain-position={positions?.rain}
                        data-snow-position={positions?.snow}
                        data-testid="precipitation-camera-follow-fixture"
                        style={{ height: 400, width: 640 }}
                    >
                        <button
                            type="button"
                            onClick={() =>
                                gameStore
                                    .getState()
                                    .setGardenAvatarView('third-person')
                            }
                        >
                            Enter character mode
                        </button>
                        <button
                            type="button"
                            onClick={() => setCameraPosition([22, 3, 14])}
                        >
                            Move character camera
                        </button>
                        <Scene
                            pixelRatio={1}
                            position={overviewPosition}
                            suspendWhenOffscreen={false}
                            zoom={100}
                        >
                            <group name="GlobalWeather">
                                <Drops count={1} intensity={1} />
                                <Snow count={1} />
                            </group>
                            <group name="LocalMagicSnow" position={[7, 0, 9]}>
                                <Snow count={1} followCamera={false} size={2} />
                            </group>
                            <GameCameraRig
                                controlsEnabled={false}
                                initialPosition={overviewPosition}
                                initialTarget={overviewTarget}
                                initialZoom={100}
                            />
                            <CharacterCamera position={cameraPosition} />
                            <PrecipitationPositionProbe
                                onChange={setPositions}
                            />
                        </Scene>
                    </div>
                </GameStateContext.Provider>
            </QueryClientProvider>
        </NuqsTestingAdapter>
    );
}
