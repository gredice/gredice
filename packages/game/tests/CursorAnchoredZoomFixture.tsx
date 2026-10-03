import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Vector3 } from 'three';
import { GameCameraRig } from '../src/controls/GameCameraRig';
import { Scene } from '../src/scene/Scene';
import {
    createGameState,
    GameStateContext,
    useGameState,
} from '../src/useGameState';
import { CameraRenderedProbe } from './CameraRenderedProbe';

const anchor = new Vector3(1.5, 0, -1.25);
const initialPosition = new Vector3(-10, 10, -10);
const initialTarget = new Vector3(0, 0, 0);
const initialZoom = 100;

function ViewportRefresh({ revision }: { revision: number }) {
    const get = useThree((state) => state.get);
    useLayoutEffect(() => {
        if (revision > 0) {
            const state = get();
            state.set({ size: { ...state.size } });
        }
    }, [get, revision]);
    return null;
}

function CameraProjectionProbe() {
    const gameCamera = useGameState((state) => state.gameCamera);
    const [projection, setProjection] = useState<{
        target: [number, number, number];
        x: number;
        y: number;
        zoom: number;
    } | null>(null);

    useEffect(() => {
        if (!gameCamera) {
            return;
        }

        return gameCamera.subscribe((snapshot) => {
            const screenPosition = gameCamera.projectToScreen(anchor);
            if (!screenPosition) {
                return;
            }

            setProjection({
                target: snapshot.target,
                x: screenPosition.x,
                y: screenPosition.y,
                zoom: snapshot.zoom,
            });
        });
    }, [gameCamera]);

    return (
        <output
            data-anchor-x={projection?.x}
            data-anchor-y={projection?.y}
            data-ready={projection ? 'true' : 'false'}
            data-target={JSON.stringify(projection?.target ?? null)}
            data-testid="camera-projection"
            data-zoom={projection?.zoom}
        />
    );
}

export function CursorAnchoredZoomFixture({
    baseFramesPerSecond = 0,
    observeFrames = false,
}: {
    baseFramesPerSecond?: number;
    observeFrames?: boolean;
}) {
    const [viewportRevision, setViewportRevision] = useState(0);
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
                freezeTime: new Date('2026-08-11T12:00:00.000Z'),
                isMock: true,
            }),
        [],
    );

    return (
        <NuqsTestingAdapter>
            <QueryClientProvider client={queryClient}>
                <GameStateContext.Provider value={gameStore}>
                    <div
                        data-testid="cursor-anchored-zoom-fixture"
                        style={{ height: 600, width: 800 }}
                    >
                        <Scene
                            baseFramesPerSecond={baseFramesPerSecond}
                            pixelRatio={1}
                            position={initialPosition}
                            profileStats={observeFrames}
                            suspendWhenOffscreen={false}
                            zoom={initialZoom}
                        >
                            <ViewportRefresh revision={viewportRevision} />
                            <mesh position={anchor}>
                                <sphereGeometry args={[0.12, 12, 8]} />
                                <meshBasicMaterial color="#facc15" />
                            </mesh>
                            <GameCameraRig
                                controlsEnabled
                                initialPosition={initialPosition}
                                initialTarget={initialTarget}
                                initialZoom={initialZoom}
                            />
                            {observeFrames && <CameraRenderedProbe />}
                        </Scene>
                        <CameraProjectionProbe />
                        <button
                            type="button"
                            onClick={() =>
                                setViewportRevision((value) => value + 1)
                            }
                        >
                            Refresh viewport
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                gameStore.getState().worldRotate('cw')
                            }
                        >
                            Rotate camera
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                gameStore
                                    .getState()
                                    .gameCamera?.focus(new Vector3(1, 0, 1), {
                                        immediate: true,
                                    })
                            }
                        >
                            Focus immediately
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                gameStore
                                    .getState()
                                    .gameCamera?.focus(new Vector3(1, 0, 1))
                            }
                        >
                            Animate focus
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                gameStore.getState().gameCamera?.restore(
                                    {
                                        position: [-10, 10, -10],
                                        target: [0, 0, 0],
                                        zoom: initialZoom,
                                    },
                                    { immediate: true },
                                )
                            }
                        >
                            Restore immediately
                        </button>
                    </div>
                </GameStateContext.Provider>
            </QueryClientProvider>
        </NuqsTestingAdapter>
    );
}

import { useThree } from '@react-three/fiber';
