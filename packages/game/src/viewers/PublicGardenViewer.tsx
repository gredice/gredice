'use client';

import { OrbitControls } from '@react-three/drei';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type HTMLAttributes, useMemo, useRef } from 'react';
import { Vector3 } from 'three';
import { EntityFactory } from '../entities/EntityFactory';
import {
    EntityInstances,
    instancedBlockNames,
} from '../entities/EntityInstances';
import { GameSceneDetailContext } from '../GameSceneDetailContext';
import { useDeferredSceneDetails } from '../hooks/useDeferredSceneDetails';
import { Scene } from '../scene/Scene';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import {
    createGameState,
    GameStateContext,
    type GameStateStore,
} from '../useGameState';

export type PublicGardenBlock = Block;

export type PublicGardenStack = {
    x: number;
    y: number;
    blocks: PublicGardenBlock[];
};

export type PublicGardenViewerProps = HTMLAttributes<HTMLDivElement> & {
    stacks: PublicGardenStack[];
    appBaseUrl?: string;
    spriteBaseUrl?: string;
    deferDetails?: boolean;
    className?: string;
};

function normalizeStacks(stacks: PublicGardenStack[]): Stack[] {
    return stacks.map((stack) => ({
        position: new Vector3(stack.x, stack.y, 0),
        blocks: stack.blocks,
    }));
}

export function PublicGardenViewer({
    appBaseUrl,
    spriteBaseUrl,
    deferDetails = true,
    stacks,
    className,
}: PublicGardenViewerProps) {
    const resolvedAppBaseUrl = appBaseUrl || 'https://vrt.gredice.com';
    const resolvedSpriteBaseUrl = spriteBaseUrl ?? resolvedAppBaseUrl;
    const storeRef = useRef<GameStateStore>(null);
    if (!storeRef.current) {
        storeRef.current = createGameState({
            appBaseUrl: resolvedAppBaseUrl,
            spriteBaseUrl: resolvedSpriteBaseUrl,
            freezeTime: new Date(2024, 5, 21, 12, 0, 0),
            isMock: true,
            winterMode: 'summer',
        });
    }

    const clientRef = useRef<QueryClient>(null);
    if (!clientRef.current) {
        clientRef.current = new QueryClient();
    }
    const normalizedStacks = useMemo(() => normalizeStacks(stacks), [stacks]);
    const renderDetails = useDeferredSceneDetails(deferDetails);

    return (
        <QueryClientProvider client={clientRef.current}>
            <GameStateContext.Provider value={storeRef.current}>
                <GameSceneDetailContext.Provider value={{ renderDetails }}>
                    <Scene
                        position={[-100, 100, -100]}
                        zoom={90}
                        className={className}
                    >
                        <color attach="background" args={['#d9f2dc']} />
                        <ambientLight intensity={2} />
                        <hemisphereLight intensity={3} />
                        <directionalLight
                            position={[5, 20, 10]}
                            intensity={2.8}
                        />
                        <group>
                            {normalizedStacks.map((stack) =>
                                stack.blocks.map((block) => (
                                    <EntityFactory
                                        key={`${stack.position.x}|${stack.position.y}|${block.id}-${block.name}`}
                                        name={block.name}
                                        stack={stack}
                                        block={block}
                                        rotation={block.rotation}
                                        variant={block.variant}
                                        noRenderInView={instancedBlockNames}
                                        noControl
                                    />
                                )),
                            )}
                            <EntityInstances
                                stacks={normalizedStacks}
                                renderDetails={renderDetails}
                            />
                        </group>
                        <OrbitControls
                            enableRotate={false}
                            screenSpacePanning={false}
                            enablePan
                            minZoom={50}
                            maxZoom={500}
                        />
                    </Scene>
                </GameSceneDetailContext.Provider>
            </GameStateContext.Provider>
        </QueryClientProvider>
    );
}
