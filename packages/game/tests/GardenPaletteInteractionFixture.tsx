import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useLayoutEffect, useState } from 'react';
import { Vector3 } from 'three';
import { useHoveredBlockStore } from '../src/controls/useHoveredBlockStore';
import { createActiveDragPreviewTarget } from '../src/dragPreviewIdentity';
import { getLocalSandboxBlockData } from '../src/localSandboxBlockData';
import { ParticleSystemProvider } from '../src/particles/ParticleSystem';
import { gameQualityProfiles } from '../src/scene/gameQuality';
import { Scene } from '../src/scene/Scene';
import {
    createGameState,
    GameStateContext,
    useDisposeGameStateStore,
} from '../src/useGameState';
import { GardenPaletteInteractionScene } from './GardenPaletteInteractionScene';

export type GardenPaletteInteractionPhase =
    | 'idle'
    | 'hover'
    | 'pickup'
    | 'selection'
    | 'drag'
    | 'drop';

export function GardenPaletteInteractionFixture({
    batch,
    rain = false,
    entityName = 'Tree',
    sameChunk = false,
}: {
    batch: boolean;
    rain?: boolean;
    entityName?: 'Tree' | 'Stool';
    sameChunk?: boolean;
}) {
    const [phase, setPhase] = useState<GardenPaletteInteractionPhase>('idle');
    const [stacks] = useState(() => [
        {
            position: new Vector3(-1.5, 0, 0),
            blocks: [
                { id: 'palette-picked-tree', name: entityName, rotation: 1 },
            ],
        },
        {
            position: new Vector3(sameChunk ? -0.5 : 1.5, 0, 0),
            blocks: [
                { id: 'palette-static-tree', name: entityName, rotation: 0 },
            ],
        },
        {
            position: new Vector3(0, 0, 1.5),
            blocks: [{ id: 'palette-box', name: 'GardenBox', rotation: 1 }],
        },
    ]);
    const [client] = useState(() => {
        const next = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });
        next.setQueryData(['blocks', 'local'], getLocalSandboxBlockData());
        return next;
    });
    const [store] = useState(() => {
        const next = createGameState({
            appBaseUrl: '',
            isMock: true,
            freezeTime: new Date('2026-07-01T12:00:00Z'),
        });
        next.setState({ rainSurfaceIntensity: rain ? 1 : 0 });
        return next;
    });
    useDisposeGameStateStore(store);
    useLayoutEffect(
        () => () => {
            useHoveredBlockStore.getState().setHoveredBlock(null);
            client.clear();
        },
        [client],
    );

    const selectPhase = (next: GardenPaletteInteractionPhase) => {
        const treeStack = stacks[0];
        const tree = treeStack.blocks[0];
        const box = stacks[2].blocks[0];
        const target = createActiveDragPreviewTarget({
            blockId: tree.id,
            blockIndex: 0,
            stackPosition: treeStack.position,
        });
        const state = store.getState();
        state.setActiveDragPreview(null);
        state.setStationaryPickupOutlineTarget(null);
        state.setPickupBlock(null);
        state.clearPickupSelectionTargets();
        state.setOpenGardenBoxBlockId(null);
        useHoveredBlockStore.getState().setHoveredBlock(null);
        if (next === 'hover')
            useHoveredBlockStore
                .getState()
                .setHoveredBlock(entityName === 'Stool' ? tree : box);
        if (next === 'pickup') {
            state.setPickupBlock(tree);
            state.setPickupSelectionTargets([target]);
            state.setStationaryPickupOutlineTarget(target);
        }
        if (next === 'selection') state.setOpenGardenBoxBlockId(box.id);
        if (next === 'drag') {
            state.setPickupBlock(tree);
            state.setPickupSelectionTargets([target]);
            state.setActiveDragPreview({
                source: target,
                targets: [{ ...target, hoverHeight: 0.25 }],
                relative: { x: 0.75, z: -0.5 },
                hoveredGardenBoxBlockId: null,
                isBlocked: false,
                isOverRecycler: false,
            });
        }
        if (next === 'drop')
            state.queueBlockPlacementDropAnimation(tree.id, {
                mutationConfirmed: true,
            });
        setPhase(next);
    };

    return (
        <QueryClientProvider client={client}>
            <GameStateContext.Provider value={store}>
                <div data-testid="palette-interactions">
                    {(
                        [
                            'idle',
                            'hover',
                            'pickup',
                            'selection',
                            'drag',
                            'drop',
                        ] satisfies GardenPaletteInteractionPhase[]
                    ).map((value) => (
                        <button
                            key={value}
                            type="button"
                            data-testid={`palette-${value}`}
                            onClick={() => selectPhase(value)}
                        >
                            {value}
                        </button>
                    ))}
                    <div style={{ width: 512, height: 384 }}>
                        <Scene
                            position={[4, 6, 9]}
                            zoom={55}
                            pixelRatio={1}
                            quality={gameQualityProfiles.high}
                            fixedTimeSeconds={43200}
                            baseFramesPerSecond={60}
                            animateSprings
                            adaptiveHighEnabled={false}
                            staticOpaqueCacheEnabled={false}
                            rendererOptions={{
                                alpha: false,
                                antialias: false,
                                preserveDrawingBuffer: true,
                            }}
                        >
                            <color attach="background" args={['#ccd9df']} />
                            <ambientLight intensity={1.2} />
                            <directionalLight
                                position={[3, 8, 4]}
                                intensity={2.5}
                                castShadow
                                shadow-mapSize={[1024, 1024]}
                                shadow-camera-left={-6}
                                shadow-camera-right={6}
                                shadow-camera-top={6}
                                shadow-camera-bottom={-6}
                                shadow-normalBias={0.015}
                            />
                            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                                <planeGeometry args={[12, 10]} />
                                <meshStandardMaterial
                                    color="#807767"
                                    roughness={1}
                                />
                            </mesh>
                            <ParticleSystemProvider>
                                <Suspense fallback={null}>
                                    <GardenPaletteInteractionScene
                                        batch={batch}
                                        phase={phase}
                                        stacks={stacks}
                                        entityName={entityName}
                                    />
                                </Suspense>
                            </ParticleSystemProvider>
                        </Scene>
                    </div>
                </div>
            </GameStateContext.Provider>
        </QueryClientProvider>
    );
}
