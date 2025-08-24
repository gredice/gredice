'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type HTMLAttributes, useRef } from 'react';
import { Vector3 } from 'three';
import { v4 as uuidv4 } from 'uuid';
import { EntityFactory } from '../entities/EntityFactory';
import { Environment } from '../scene/Environment';
import { Scene } from '../scene/Scene';
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
};

export function EntityViewer({
    appBaseUrl,
    entityName,
    zoom,
    itemPosition,
    className,
}: EntityViewerProps) {
    const storeRef = useRef<GameStateStore>(null);
    if (!storeRef.current) {
        storeRef.current = createGameState({
            appBaseUrl: appBaseUrl || '',
            freezeTime: new Date(2024, 5, 21, 12, 0, 0),
            isMock: true,
        });
    }

    const client = new QueryClient();

    return (
        <QueryClientProvider client={client}>
            <GameStateContext.Provider value={storeRef.current}>
                <Scene position={100} zoom={zoom ?? 90} className={className}>
                    <Environment noBackground noSound noWeather />
                    <EntityFactory
                        name={entityName}
                        stack={{
                            position: itemPosition
                                ? new Vector3(
                                      itemPosition[0],
                                      itemPosition[1],
                                      itemPosition[2],
                                  )
                                : position,
                            blocks: [],
                        }}
                        block={{
                            id: uuidv4(),
                            name: entityName,
                            rotation: 0,
                            variant: undefined,
                        }}
                        rotation={0}
                    />
                </Scene>
            </GameStateContext.Provider>
        </QueryClientProvider>
    );
}
