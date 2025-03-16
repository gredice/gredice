'use client';

import { EntityFactory } from "../entities/EntityFactory";
import { Environment } from "../scene/Environment";
import { Scene } from "../scene/Scene";
import { HTMLAttributes, useEffect } from "react";
import { useGameState } from "../useGameState";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { v4 as uuidv4 } from 'uuid';
import { Vector3 } from "three";

const position = new Vector3(0.5, 0, 0.5);

export type EntityViewerProps = HTMLAttributes<HTMLDivElement> & {
    entityName: string;
    appBaseUrl?: string;
    zoom?: number;
    itemPosition?: [number, number, number];
};

export function EntityViewer({ entityName, zoom, itemPosition, ...rest }: EntityViewerProps) {
    const setCurrentTime = useGameState((state) => state.setCurrentTime);
    useEffect(() => {
        setCurrentTime(new Date(2024, 5, 21, 12, 0, 0));
    }, []);

    const client = new QueryClient();

    return (
        <QueryClientProvider client={client}>
            <Scene position={100} zoom={zoom ?? 90} {...rest}>
                <Environment location={{ lat: 45, lon: 15 }} noBackground noSound noWeather />
                <EntityFactory
                    name={entityName}
                    stack={{
                        position: itemPosition ? new Vector3(itemPosition[0], itemPosition[1], itemPosition[2]) : position,
                        blocks: []
                    }}
                    block={{
                        id: uuidv4(),
                        name: entityName,
                        rotation: 0,
                        variant: undefined
                    }}
                    rotation={0}
                />
            </Scene>
        </QueryClientProvider>
    )
}