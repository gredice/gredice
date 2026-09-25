import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NuqsAdapter } from 'nuqs/adapters/react';
import { Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Box3, Mesh, Vector3 } from 'three';
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

function ScarecrowProbe({ onReady }: { onReady: (value: string) => void }) {
    const { scene, camera, size } = useThree();
    const frames = useRef(0);
    const reported = useRef(false);
    useSceneTimeInvalidation('test:scarecrow-ready', !reported.current);
    useLayoutEffect(() => {
        camera.lookAt(-0.4, 0.65, -0.4);
        camera.updateProjectionMatrix();
    }, [camera]);
    useFrame(() => {
        if (++frames.current < 30 || reported.current) return;
        const crops = scene.getObjectByName('review-crops');
        let cropMeshes = 0;
        crops?.traverse((node) => {
            if (node instanceof Mesh) cropMeshes++;
        });
        if (!crops || cropMeshes === 0) return;
        scene.updateMatrixWorld(true);
        const object = scene.getObjectByName('GardenScarecrow:scarecrow');
        const shirt = object?.getObjectByName('GardenScarecrow_Shirt');
        if (!object || !shirt)
            throw new Error('Missing scarecrow runtime geometry');
        const bounds = new Box3().setFromObject(object);
        const point = new Box3()
            .setFromObject(shirt)
            .getCenter(new Vector3())
            .project(camera);
        const corners = [bounds.min.x, bounds.max.x].flatMap((x) =>
            [bounds.min.y, bounds.max.y].flatMap((y) =>
                [bounds.min.z, bounds.max.z].map((z) =>
                    new Vector3(x, y, z).project(camera),
                ),
            ),
        );
        reported.current = true;
        onReady(
            JSON.stringify({
                cropMeshes,
                cropHeight: new Box3()
                    .setFromObject(crops)
                    .getSize(new Vector3()).y,
                rotationY: object.rotation.y,
                minY: bounds.min.y,
                height: bounds.max.y - bounds.min.y,
                x: ((point.x + 1) * size.width) / 2,
                y: ((1 - point.y) * size.height) / 2,
                left:
                    ((Math.min(...corners.map((corner) => corner.x)) + 1) *
                        size.width) /
                    2,
                right:
                    ((Math.max(...corners.map((corner) => corner.x)) + 1) *
                        size.width) /
                    2,
                top:
                    ((1 - Math.max(...corners.map((corner) => corner.y))) *
                        size.height) /
                    2,
                bottom:
                    ((1 - Math.min(...corners.map((corner) => corner.y))) *
                        size.height) /
                    2,
            }),
        );
    });
    return null;
}

export function GardenScarecrowFixture({
    rotation,
    night = false,
    small = false,
}: {
    rotation: number;
    night?: boolean;
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
                        ...(x === 0 && z === 1
                            ? [
                                  {
                                      name: 'GardenScarecrow',
                                      id: 'scarecrow',
                                      rotation,
                                  },
                              ]
                            : []),
                        ...(x === -1 && z === -1
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
                freezeTime: new Date(
                    night
                        ? '2026-09-23T22:30:00+02:00'
                        : '2026-09-23T12:00:00+02:00',
                ),
                dayNightCycleDisabled: false,
            }),
        [night],
    );
    useDisposeGameStateStore(store);
    const quality = gameQualityProfiles[small ? 'low' : 'high'];
    const weather = {
        cloudy: 0,
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
                        data-testid="scarecrow"
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
                                    position={[-1, 1.4, -0.95]}
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
                                <Html position={[-1, 0.95, -1.2]} center>
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
                                <ScarecrowProbe onReady={setReady} />
                            </Suspense>
                        </Scene>
                    </div>
                </GameStateContext.Provider>
            </QueryClientProvider>
        </NuqsAdapter>
    );
}
