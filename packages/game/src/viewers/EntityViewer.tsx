'use client';

import { Vector3 } from "three";
import { EntityFactory } from "../entities/EntityFactory";
import { Environment } from "../scene/Environment";
import { Scene } from "../scene/Scene";
import { HTMLAttributes, useEffect } from "react";
import { useGameState } from "../useGameState";

const position = new Vector3(0.75, 0, 0.75);

export type EntityViewerProps = HTMLAttributes<HTMLDivElement> & {
    entityName: string;
    appBaseUrl?: string;
};

export function EntityViewer({ entityName, ...rest }: EntityViewerProps) {
    const setCurrentTime = useGameState((state) => state.setCurrentTime);
    useEffect(() => {
        setCurrentTime(new Date(2024, 5, 21, 12, 0, 0));
    }, []);

    return (
        <Scene position={100} zoom={100} {...rest}>
            <Environment location={{ lat: 14, lon: 35 }} noBackground />
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
    )
}