'use client';

import { type HTMLAttributes, useMemo } from 'react';
import { Vector3 } from 'three';
import { GameSceneDynamic } from '../GameSceneDynamic';
import { localSandboxBlockNames } from '../localSandboxBlockData';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';

const defaultColumns = 9;

export const entitySandboxStorageKey = 'gredice.debug.entities.sandbox.v1';

export function getEntitySandboxStorageKey(entityName: string) {
    return `gredice.debug.entity.${encodeURIComponent(entityName)}.sandbox.v1`;
}

function createEntitySandboxBlock(
    name: string,
    index: number,
    rotation: number,
): Block {
    return {
        id: `entity-sandbox:${name}:${index}`,
        name,
        rotation,
        variant: name === 'PineAdvent' ? 100 : undefined,
    };
}

function createEntitySandboxStacks({
    blockNames,
    columns,
    rotation,
}: {
    blockNames: readonly string[];
    columns: number;
    rotation: number;
}): Stack[] {
    const safeColumns = Math.max(1, Math.floor(columns));
    const rowCount = Math.ceil(blockNames.length / safeColumns);
    const xOffset = Math.floor(safeColumns / 2);
    const zOffset = Math.floor(rowCount / 2);

    return blockNames.map((name, index) => {
        const x = (index % safeColumns) - xOffset;
        const z = Math.floor(index / safeColumns) - zOffset;

        return {
            position: new Vector3(x, 0, z),
            blocks: [createEntitySandboxBlock(name, index, rotation)],
        };
    });
}

export type EntitySandboxViewerProps = HTMLAttributes<HTMLDivElement> & {
    columns?: number;
    debugHud?: boolean;
    entityName?: string;
    localSandboxStorageKey?: string;
    rotation?: number;
};

export function EntitySandboxViewer({
    className,
    columns = defaultColumns,
    debugHud,
    entityName,
    localSandboxStorageKey,
    rotation = 0,
    ...rest
}: EntitySandboxViewerProps) {
    const normalizedRotation = ((rotation % 4) + 4) % 4;
    const blockNames = useMemo(
        () => (entityName ? [entityName] : [...localSandboxBlockNames]),
        [entityName],
    );
    const stacks = useMemo(
        () =>
            createEntitySandboxStacks({
                blockNames,
                columns,
                rotation: normalizedRotation,
            }),
        [blockNames, columns, normalizedRotation],
    );
    const storageKey =
        localSandboxStorageKey ??
        (entityName
            ? getEntitySandboxStorageKey(entityName)
            : entitySandboxStorageKey);

    return (
        <GameSceneDynamic
            className={className}
            dayNightCycleDisabled={false}
            deferDetails={false}
            flags={{
                enableDebugHudFlag: debugHud,
                enableRainWetOverlayFlag: debugHud,
            }}
            key={storageKey}
            localSandboxInitialStacks={stacks}
            localSandboxStorageKey={storageKey}
            noSound
            zoom={entityName ? 'normal' : 'far'}
            {...rest}
        />
    );
}
