'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type HTMLAttributes, useRef } from 'react';
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

const position = new Vector3(0.5, 0, 0.5);

export type EntityViewerProps = HTMLAttributes<HTMLDivElement> & {
    entityName: string;
    appBaseUrl?: string;
    className?: string;
    /**
     * Zoom level of the camera
     * @default 90
     */
    zoom?: number;
    itemPosition?: [number, number, number];
    /**
     * Rotation of the rendered entity. Values map to quarter turns clockwise.
     * @default 0
     */
    rotation?: number;
};

export function EntityViewer({
    appBaseUrl,
    entityName,
    zoom,
    itemPosition,
    className,
    rotation = 0,
}: EntityViewerProps) {
    const storeRef = useRef<GameStateStore>(null);
    if (!storeRef.current) {
        storeRef.current = createGameState({
            appBaseUrl: appBaseUrl || '',
            freezeTime: new Date(2024, 5, 21, 12, 0, 0),
            isMock: true,
            winterMode: 'summer',
        });
    }

    const client = new QueryClient();
    const stack = {
        position: itemPosition
            ? new Vector3(itemPosition[0], itemPosition[1], itemPosition[2])
            : position,
        blocks: [],
    };
    const normalizedRotation = ((rotation % 4) + 4) % 4;
    let variant: number | undefined;
    if (entityName === 'PineAdvent') {
        variant = 100;
    }
    const block: Block = {
        id: uuidv4(),
        name: entityName,
        rotation: normalizedRotation,
        variant: variant,
    };

    return (
        <QueryClientProvider client={client}>
            <GameStateContext.Provider value={storeRef.current}>
                <Scene position={100} zoom={zoom ?? 90} className={className}>
                    <Environment noBackground noSound noWeather />
                    <EntityFactory
                        name={entityName}
                        stack={stack}
                        block={block}
                        rotation={normalizedRotation}
                        variant={variant}
                    />
                    <EntityInstances stacks={[stack]} />
                </Scene>
            </GameStateContext.Provider>
        </QueryClientProvider>
    );
}
