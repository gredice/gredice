'use client';

import { Vector3 } from "three";
import { EntityFactory } from "../entities/EntityFactory";
import { Environment } from "../scene/Environment";
import { Scene } from "../scene/Scene";
import { HTMLAttributes, useEffect } from "react";
import { useGameState } from "../useGameState";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const position = new Vector3(0.5, 0, 0.5);

export type EntityViewerProps = HTMLAttributes<HTMLDivElement> & {
    entityName: string;
    appBaseUrl?: string;
};

export function EntityViewer({ entityName, ...rest }: EntityViewerProps) {
    const setCurrentTime = useGameState((state) => state.setCurrentTime);
    useEffect(() => {
        setCurrentTime(new Date(2024, 5, 21, 12, 0, 0));
    }, []);

    const client = new QueryClient();

    return (
        <QueryClientProvider client={client}>
            <Scene position={100} zoom={90} {...rest}>
                <Environment location={{ lat: 45, lon: 15 }} noBackground />
                <EntityFactory
                    name={entityName}
                    stack={{
                        position: position,
                        blocks: []
                    }}
                    block={{
                        name: entityName,
                        rotation: 0,
                        variant: undefined
                    }}
                    rotation={0}
                    noControl />
            </Scene>
        </QueryClientProvider>
    )
}