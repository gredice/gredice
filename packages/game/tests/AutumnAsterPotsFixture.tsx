import { autumnAsterPots } from '@gredice/js/autumnAsterPots';
import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NuqsAdapter } from 'nuqs/adapters/react';
import { Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Box3, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { EntityFactory } from '../src/entities/EntityFactory';
import { EntityInstances } from '../src/entities/EntityInstances';
import { RaisedBedPlantField } from '../src/entities/raisedBed/RaisedBedPlantField';
import { createMockGarden } from '../src/hooks/useCurrentGarden';
import { RaisedBedFieldItemButton } from '../src/hud/raisedBed/RaisedBedFieldItemButton';
import { getLocalSandboxBlockData } from '../src/localSandboxBlockData';
import { Environment } from '../src/scene/Environment';
import { gameQualityProfiles } from '../src/scene/gameQuality';
import { Scene } from '../src/scene/Scene';
import { useSceneTimeInvalidation } from '../src/scene/SceneTime';
import {
    createGameState,
    GameStateContext,
    useDisposeGameStateStore,
} from '../src/useGameState';
import { createDateForGameTimeOfDay } from '../src/utils/timeOfDay';

function AsterProbe({ onReady }: { onReady: (value: string) => void }) {
    const { scene, camera, size } = useThree();
    const reported = useRef(false);
    useSceneTimeInvalidation('test:asters-ready', !reported.current);
    useLayoutEffect(() => {
        camera.lookAt(-0.4, 0.65, -0.4);
        camera.updateProjectionMatrix();
    }, [camera]);
    useFrame(() => {
        if (reported.current) return;
        const crops = scene.getObjectByName('review-crops');
        let cropMeshes = 0;
        crops?.traverse((node) => {
            if (node instanceof Mesh) cropMeshes++;
        });
        if (!crops || !cropMeshes) return;
        scene.updateMatrixWorld(true);
        const pots = autumnAsterPots.map((item) => {
            const object = scene.getObjectByName(`AutumnAsterPot:${item.name}`);
            const petals = object?.getObjectByName('AutumnAsterPot_Petals');
            const centers = object?.getObjectByName('AutumnAsterPot_Centers');
            if (
                !object ||
                !(petals instanceof Mesh) ||
                !(centers instanceof Mesh)
            )
                throw new Error('Missing aster runtime geometry');
            if (!(petals.material instanceof MeshStandardMaterial))
                throw new Error('Missing petal material');
            const bounds = new Box3().setFromObject(object);
            // Select the raised central flower through the production Three.js raycaster.
            const point = object
                .localToWorld(new Vector3(0, 0.59, 0))
                .project(camera);
            return {
                name: item.name,
                rotationY: object.rotation.y,
                minY: bounds.min.y,
                height: bounds.max.y - bounds.min.y,
                width: bounds.max.x - bounds.min.x,
                depth: bounds.max.z - bounds.min.z,
                color: `#${petals.material.color.getHexString()}`,
                materialId: petals.material.uuid,
                x: ((point.x + 1) * size.width) / 2,
                y: ((1 - point.y) * size.height) / 2,
            };
        });
        reported.current = true;
        onReady(JSON.stringify({ cropMeshes, pots }));
    });
    return null;
}

export function AutumnAsterPotsFixture({
    rotation,
    light = 'day',
    small = false,
}: {
    rotation: number;
    light?: 'day' | 'night' | 'dusk' | 'cloudy';
    small?: boolean;
}) {
    const [ready, setReady] = useState('');
    const [hit, setHit] = useState('');
    const [plantClicks, setPlantClicks] = useState(0);
    const stacks = useMemo(
        () =>
            Array.from({ length: 16 }, (_, index) => {
                const x = (index % 4) - 2;
                const z = Math.floor(index / 4) - 2;
                return {
                    position: new Vector3(x, 0, z),
                    blocks: [
                        {
                            name: 'Block_Grass',
                            id: `ground:${index}`,
                            rotation: 0,
                        },
                        ...(x === -2 && z === 1
                            ? [
                                  {
                                      name: 'OutletDisplayTable',
                                      id: 'table',
                                      rotation: 0,
                                  },
                              ]
                            : []),
                        ...(x === -2 && z >= -1
                            ? [
                                  {
                                      name: autumnAsterPots[z + 1].name,
                                      id: autumnAsterPots[z + 1].name,
                                      rotation,
                                  },
                              ]
                            : []),
                        ...(x === 0 && z === -1
                            ? [{ name: 'Raised_Bed', id: 'bed', rotation: 0 }]
                            : []),
                    ],
                };
            }),
        [rotation],
    );
    const client = useMemo(() => {
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false, staleTime: Infinity } },
        });
        queryClient.setQueryData(
            ['blocks', 'local'],
            getLocalSandboxBlockData(),
        );
        queryClient.setQueryData(['gardens', 'current', 'summer', 'default'], {
            ...createMockGarden('summer', 'default'),
            stacks,
            raisedBeds: [],
        });
        queryClient.setQueryData(['sorts'], []);
        queryClient.setQueryData(['operations'], []);
        queryClient.setQueryData(['currentUser'], null);
        return queryClient;
    }, [stacks]);
    const store = useMemo(
        () =>
            createGameState({
                appBaseUrl: '',
                isMock: true,
                authenticatedGardenQueriesEnabled: false,
                winterMode: 'summer',
                freezeTime:
                    light === 'dusk'
                        ? createDateForGameTimeOfDay(
                              new Date('2026-09-23T12:00:00+02:00'),
                              0.8,
                          )
                        : new Date(
                              light === 'night'
                                  ? '2026-09-23T22:30:00+02:00'
                                  : '2026-09-23T12:00:00+02:00',
                          ),
                dayNightCycleDisabled: false,
            }),
        [light],
    );
    useDisposeGameStateStore(store);
    const quality = gameQualityProfiles[small ? 'low' : 'high'];
    const weather = {
        cloudy: light === 'cloudy' ? 1 : 0,
        foggy: 0,
        rainy: 0,
        snowy: 0,
        snowAccumulation: 0,
        windSpeed: 0,
        windDirection: 0,
    };
    return (
        <NuqsAdapter>
            <QueryClientProvider client={client}>
                <GameStateContext.Provider value={store}>
                    <div
                        data-testid="autumn-asters"
                        data-ready={ready}
                        data-hit={hit}
                        data-plant-clicks={plantClicks}
                        style={{
                            width: small ? 390 : 680,
                            height: small ? 440 : 520,
                            position: 'relative',
                        }}
                    >
                        <Scene
                            position={[-100, 100, -100]}
                            zoom={small ? 57 : 90}
                            quality={quality}
                            pixelRatio={1}
                            fixedTimeSeconds={12}
                            frameloop="always"
                            animateSprings={false}
                            style={{ width: '100%', height: '100%' }}
                        >
                            <Environment
                                quality={quality}
                                weather={weather}
                                noSound
                            />
                            <Suspense fallback={null}>
                                <EntityInstances
                                    stacks={stacks}
                                    quality={quality}
                                    weather={weather}
                                />
                                {stacks.flatMap((stack) =>
                                    stack.blocks.slice(1).map((block) => (
                                        // biome-ignore lint/a11y/noStaticElementInteractions: Three.js ray-selection target, not a DOM control.
                                        <group
                                            key={block.id}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setHit(block.name);
                                            }}
                                        >
                                            <EntityFactory
                                                name={block.name}
                                                block={block}
                                                stack={stack}
                                                rotation={block.rotation}
                                                noControl
                                            />
                                        </group>
                                    )),
                                )}
                                <group
                                    name="review-crops"
                                    position={[0, 1.4, -0.95]}
                                >
                                    {[0, 4, 8].map((positionIndex) => (
                                        <RaisedBedPlantField
                                            key={positionIndex}
                                            blockIndex={0}
                                            orientation="vertical"
                                            field={{
                                                positionIndex,
                                                plantSortId: 337,
                                                plantStatus: 'ready',
                                                plantSowDate:
                                                    '2026-06-01T12:00:00Z',
                                            }}
                                        />
                                    ))}
                                </group>
                                {/* Use the production field-button component at a representative crop anchor.
                        The full close-up HUD is DOM above the scene and has separate app tests. */}
                                <Html position={[0, 0.95, -1.2]} center>
                                    <div style={{ width: 58, height: 44 }}>
                                        <RaisedBedFieldItemButton
                                            aria-label="Pregledaj rajčicu"
                                            positionIndex={0}
                                            onClick={() =>
                                                setPlantClicks(
                                                    (count) => count + 1,
                                                )
                                            }
                                        >
                                            Rajčica
                                        </RaisedBedFieldItemButton>
                                    </div>
                                </Html>
                                <AsterProbe onReady={setReady} />
                            </Suspense>
                        </Scene>
                    </div>
                </GameStateContext.Provider>
            </QueryClientProvider>
        </NuqsAdapter>
    );
}
