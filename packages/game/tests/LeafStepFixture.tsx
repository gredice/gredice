import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useEffect, useMemo } from 'react';
import { Vector3 } from 'three';
import { AutumnRustle } from '../src/audio/AutumnRustle';
import { GardenAvatar } from '../src/entities/avatar/GardenAvatar';
import { EntityInstances } from '../src/entities/EntityInstances';
import { AutumnLeaves } from '../src/scene/AutumnLeaves';
import { gameQualityProfiles } from '../src/scene/gameQuality';
import { Scene } from '../src/scene/Scene';
import { getSeasonDebugDates } from '../src/scene/seasonDebugDates';
import {
    createGameState,
    GameStateContext,
    useDisposeGameStateStore,
} from '../src/useGameState';

const spawn = { x: 0, z: 1.5 };

export function LeafStepFixture({
    tier = 'high',
    disabled = false,
    snow = 0,
    rain = 0,
    mounted = true,
    summer = false,
    fixed = false,
}: {
    tier?: 'low' | 'high';
    disabled?: boolean;
    snow?: number;
    rain?: number;
    mounted?: boolean;
    summer?: boolean;
    fixed?: boolean;
}) {
    const client = useMemo(() => new QueryClient(), []);
    const store = useMemo(
        () =>
            createGameState({
                appBaseUrl: '',
                isMock: true,
                freezeTime: getSeasonDebugDates().lateAutumn,
            }),
        [],
    );
    useDisposeGameStateStore(store);
    useEffect(() => {
        store.setState({
            weatherVisualizationDisabled: disabled,
            snowCoverage: snow,
            rainSurfaceIntensity: rain,
        });
        store
            .getState()
            .setSceneDate(
                getSeasonDebugDates()[summer ? 'summer' : 'lateAutumn'],
            );
    }, [store, disabled, snow, rain, summer]);
    const stacks = useMemo(
        () =>
            Array.from({ length: 25 }, (_, i) => ({
                position: new Vector3((i % 5) - 2, 0, Math.floor(i / 5) - 2),
                blocks: [
                    {
                        id: `step-ground:${i}`,
                        name: 'Block_Grass',
                        rotation: 0,
                    },
                    ...(i === 11 || i === 13
                        ? [{ id: `step-tree:${i}`, name: 'Tree', rotation: 0 }]
                        : []),
                ],
            })),
        [],
    );
    const audio = store.getState().audio;
    return (
        <QueryClientProvider client={client}>
            <GameStateContext.Provider value={store}>
                <button
                    type="button"
                    onClick={() => {
                        void audio.resume({ userActivation: true });
                        store.getState().setGardenAvatarView('third-person');
                    }}
                >
                    Walk
                </button>
                <button
                    type="button"
                    onClick={() =>
                        audio.setChannelMuted(
                            'ambient',
                            !audio.getState().ambient.isMuted,
                        )
                    }
                >
                    Toggle ambient
                </button>
                <button
                    type="button"
                    onClick={() =>
                        audio.setMasterMuted(!audio.getState().master.isMuted)
                    }
                >
                    Toggle master
                </button>
                <div style={{ width: 640, height: 420 }}>
                    <Scene
                        position={[6, 7, 9]}
                        zoom={50}
                        quality={gameQualityProfiles[tier]}
                        fixedTimeSeconds={fixed ? 12 : undefined}
                        profileStats
                    >
                        <ambientLight intensity={1.5} />
                        <Suspense fallback={null}>
                            <EntityInstances
                                stacks={stacks}
                                quality={gameQualityProfiles[tier]}
                                weather={{ windSpeed: 1 }}
                            />
                            <AutumnLeaves
                                stacks={stacks}
                                gardenId={7}
                                tier={tier}
                                windSpeed={1}
                                rain={rain}
                                snow={snow}
                                enabled={!disabled}
                            />
                            <AutumnRustle windSpeed={1} enabled={!disabled} />
                            {mounted && (
                                <GardenAvatar
                                    stacks={stacks}
                                    initialSpawnPoint={spawn}
                                    roamSeed="leaf-step-fixture"
                                    onPresenceChange={(presence) => {
                                        Reflect.set(
                                            window,
                                            '__leafStepPosition',
                                            presence.position,
                                        );
                                    }}
                                />
                            )}
                        </Suspense>
                    </Scene>
                </div>
            </GameStateContext.Provider>
        </QueryClientProvider>
    );
}
