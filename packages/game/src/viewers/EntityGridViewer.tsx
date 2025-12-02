'use client';

import { Html } from '@react-three/drei';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRef } from 'react';
import { Vector3 } from 'three';
import { v4 as uuidv4 } from 'uuid';
import { EntityFactory } from '../entities/EntityFactory';
import { EntityInstances } from '../entities/EntityInstances';
import { Environment } from '../scene/Environment';
import { Scene } from '../scene/Scene';
import type { Block } from '../types/Block';
import {
    createGameState,
    GameStateContext,
    type GameStateStore,
} from '../useGameState';

export type EntityGridViewerProps = {
    entityNames: string[];
    className?: string;
    /**
     * Number of columns in the grid
     * @default 6
     */
    columns?: number;
    /**
     * Spacing between entities
     * @default 2.5
     */
    spacing?: number;
};

export function EntityGridViewer({
    entityNames,
    className,
    columns = 6,
    spacing = 5,
}: EntityGridViewerProps) {
    const storeRef = useRef<GameStateStore>(null);
    if (!storeRef.current) {
        storeRef.current = createGameState({
            appBaseUrl: '',
            freezeTime: new Date(2024, 5, 21, 12, 0, 0),
            isMock: true,
            isWinterMode: false,
        });
    }

    const client = new QueryClient();

    const entities = entityNames.map((entityName, index) => {
        const col = index % columns;
        const row = Math.floor(index / columns);

        const position = new Vector3(col * spacing, 0, row * spacing);

        const stack = {
            position,
            blocks: [] as Block[],
        };

        let variant: number | undefined;
        if (entityName === 'PineAdvent') {
            variant = 100;
        }

        const block: Block = {
            id: uuidv4(),
            name: entityName,
            rotation: 0,
            variant: variant,
        };

        return { entityName, stack, block, variant, position };
    });

    // Calculate camera position to center on the grid
    const rows = Math.ceil(entityNames.length / columns);
    const centerX = ((columns - 1) * spacing) / 2;
    const centerZ = ((rows - 1) * spacing) / 2;

    return (
        <QueryClientProvider client={client}>
            <GameStateContext.Provider value={storeRef.current}>
                <Scene position={100} zoom={35} className={className}>
                    <Environment noBackground noSound noWeather />
                    <group position={[-centerX, 0, -centerZ]}>
                        {entities.map(
                            ({
                                entityName,
                                stack,
                                block,
                                variant,
                                position,
                            }) => (
                                <group key={entityName}>
                                    <EntityFactory
                                        name={entityName}
                                        stack={stack}
                                        block={block}
                                        rotation={0}
                                        variant={variant}
                                    />
                                    <Html
                                        position={[
                                            position.x + 0.5,
                                            -0.5,
                                            position.z + 0.5,
                                        ]}
                                        center
                                        distanceFactor={15}
                                    >
                                        <div className="text-white text-xs bg-black/70 px-2 py-1 rounded whitespace-nowrap">
                                            {entityName}
                                        </div>
                                    </Html>
                                </group>
                            ),
                        )}
                        <EntityInstances
                            stacks={entities.map((e) => e.stack)}
                        />
                    </group>
                </Scene>
            </GameStateContext.Provider>
        </QueryClientProvider>
    );
}
