'use client';

import { invalidate } from '@react-three/fiber';
import { useEffect } from 'react';
import { useHoveredBlockStore } from '../controls/useHoveredBlockStore';
import { meshChunkSize } from '../entities/chunkedMeshGeometry';
import { instancedBlockNames } from '../entities/EntityInstances';
import { resetPlacementAnimationProfileMetrics } from '../entities/placementAnimationProfileMetrics';
import { getGeneratedPackedPlantRenderTaskSchedulerSnapshot } from '../generators/plant/hooks/useGeneratedLSystem';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import type { Block } from '../types/Block';
import { useGameState } from '../useGameState';
import {
    useRemoveRaisedBedCloseupParam,
    useSetRaisedBedCloseupParam,
} from '../useRaisedBedCloseup';
import { updateGameProfileMetadata } from './gameProfileMetadata';
import {
    failGeneratedPlantProfile,
    recordGeneratedPlantProfileCamera,
    resetGeneratedPlantProfile,
    startGeneratedPlantProfile,
} from './generatedPlantProfileMetrics';

export const gameProfileCloseupCommandEventName =
    'gredice:game-profile-closeup-command';
export const gameProfilePlacementCommandEventName =
    'gredice:game-profile-placement-command';
export const gameProfileOutlineCommandEventName =
    'gredice:game-profile-outline-command';

type ProfileGarden = {
    raisedBeds: Array<{
        blockId?: string | null;
        id: number;
        name?: string | null;
    }>;
    stacks: Array<{
        blocks: Block[];
        position?: {
            x: number;
            z: number;
        };
    }>;
};

export type GameProfileCloseupCommand =
    | {
          action: 'close';
      }
    | {
          action: 'open';
          raisedBedId: number;
      }
    | {
          action: 'reset';
      };

export type GameProfilePlacementCommand =
    | {
          action: 'reset';
      }
    | {
          action: 'run';
          staggerMs: number;
      };

export type GameProfileOutlineCommand =
    | {
          action: 'hide';
      }
    | {
          action: 'show';
          raisedBedId: number;
      };

export function readGameProfileCloseupCommand(
    value: unknown,
): GameProfileCloseupCommand | null {
    if (!value || typeof value !== 'object') {
        return null;
    }

    const action = Reflect.get(value, 'action');
    if (action === 'close' || action === 'reset') {
        return { action };
    }
    const raisedBedId = Reflect.get(value, 'raisedBedId');
    if (
        action === 'open' &&
        typeof raisedBedId === 'number' &&
        Number.isInteger(raisedBedId) &&
        raisedBedId > 0
    ) {
        return { action, raisedBedId };
    }

    return null;
}

export function readGameProfilePlacementCommand(
    value: unknown,
): GameProfilePlacementCommand | null {
    if (!value || typeof value !== 'object') {
        return null;
    }

    const action = Reflect.get(value, 'action');
    if (action === 'reset') {
        return { action };
    }
    if (action !== 'run') {
        return null;
    }

    const staggerMs = Reflect.get(value, 'staggerMs');
    if (staggerMs === undefined) {
        return { action, staggerMs: 120 };
    }
    if (
        typeof staggerMs !== 'number' ||
        !Number.isFinite(staggerMs) ||
        staggerMs < 0 ||
        staggerMs > 1_000
    ) {
        return null;
    }

    return { action, staggerMs };
}

export function readGameProfileOutlineCommand(
    value: unknown,
): GameProfileOutlineCommand | null {
    if (!value || typeof value !== 'object') {
        return null;
    }

    const action = Reflect.get(value, 'action');
    if (action === 'hide') {
        return { action };
    }
    const raisedBedId = Reflect.get(value, 'raisedBedId');
    if (
        action === 'show' &&
        typeof raisedBedId === 'number' &&
        Number.isInteger(raisedBedId) &&
        raisedBedId > 0
    ) {
        return { action, raisedBedId };
    }

    return null;
}

const instancedBlockNameSet: ReadonlySet<string> = new Set(instancedBlockNames);

function profilePlacementChunkKey(position: { x: number; z: number }) {
    return `${Math.floor(position.x / meshChunkSize)}:${Math.floor(
        position.z / meshChunkSize,
    )}`;
}

export function resolveGameProfilePlacementBlockIds(
    garden: ProfileGarden | null | undefined,
) {
    if (!garden) {
        return [];
    }

    const firstTargetByBlockName = new Map<
        string,
        { blockId: string; chunkKey: string }
    >();
    for (const stack of garden.stacks) {
        if (!stack.position) {
            continue;
        }
        const chunkKey = profilePlacementChunkKey(stack.position);
        for (const block of stack.blocks) {
            if (!instancedBlockNameSet.has(block.name)) {
                continue;
            }
            const firstTarget = firstTargetByBlockName.get(block.name);
            if (!firstTarget) {
                firstTargetByBlockName.set(block.name, {
                    blockId: block.id,
                    chunkKey,
                });
                continue;
            }
            if (firstTarget.chunkKey !== chunkKey) {
                return [firstTarget.blockId, block.id];
            }
        }
    }

    return [];
}

export function resolveGameProfileRaisedBedTarget(
    garden: ProfileGarden | null | undefined,
    raisedBedId: number,
) {
    if (!garden) {
        return null;
    }

    const raisedBed = garden.raisedBeds.find(
        (candidate) => candidate.id === raisedBedId,
    );
    const raisedBedName = raisedBed?.name?.trim();
    if (!raisedBed?.blockId || !raisedBedName) {
        return null;
    }

    const block = garden.stacks
        .flatMap((stack) => stack.blocks)
        .find((candidate) => candidate.id === raisedBed.blockId);
    if (!block) {
        return null;
    }

    return {
        block,
        blockId: raisedBed.blockId,
        raisedBedName,
        raisedBedId: raisedBed.id,
    };
}

export function GameProfileController() {
    const { data: garden } = useCurrentGarden();
    const view = useGameState((current) => current.view);
    const closeupCameraActive = useGameState(
        (current) => current.closeupCameraActive,
    );
    const closeupCameraSettled = useGameState(
        (current) => current.closeupCameraSettled,
    );
    const gameCamera = useGameState((current) => current.gameCamera);
    const queueBlockPlacementDropAnimation = useGameState(
        (current) => current.queueBlockPlacementDropAnimation,
    );
    const cancelBlockPlacementDropAnimation = useGameState(
        (current) => current.cancelBlockPlacementDropAnimation,
    );
    const { mutate: removeRaisedBedCloseupParam } =
        useRemoveRaisedBedCloseupParam();
    const { mutate: setRaisedBedCloseupParam } = useSetRaisedBedCloseupParam();

    useEffect(() => {
        recordGeneratedPlantProfileCamera({
            active: closeupCameraActive,
            settled: closeupCameraSettled,
            view,
        });
    }, [closeupCameraActive, closeupCameraSettled, view]);

    useEffect(() => {
        if (!gameCamera) {
            return;
        }

        recordGeneratedPlantProfileCamera({
            zoom: gameCamera.getSnapshot().zoom,
        });
        return gameCamera.subscribe((snapshot) => {
            recordGeneratedPlantProfileCamera({ zoom: snapshot.zoom });
        });
    }, [gameCamera]);

    useEffect(() => {
        const handleCommand = (event: Event) => {
            const command =
                event instanceof CustomEvent
                    ? readGameProfileCloseupCommand(event.detail)
                    : null;
            if (!command) {
                return;
            }
            if (command.action === 'reset') {
                resetGeneratedPlantProfile();
                return;
            }
            if (command.action === 'close') {
                void removeRaisedBedCloseupParam();
                return;
            }

            const target = resolveGameProfileRaisedBedTarget(
                garden,
                command.raisedBedId,
            );
            if (!target) {
                resetGeneratedPlantProfile();
                startGeneratedPlantProfile({
                    selectedBlockId: '',
                    selectedRaisedBedId: command.raisedBedId,
                });
                failGeneratedPlantProfile(
                    `Unable to resolve raised bed ${command.raisedBedId} and its primary block.`,
                );
                return;
            }

            startGeneratedPlantProfile({
                schedulerBaseline:
                    getGeneratedPackedPlantRenderTaskSchedulerSnapshot(),
                selectedBlockId: target.blockId,
                selectedRaisedBedId: target.raisedBedId,
            });
            void setRaisedBedCloseupParam(target.raisedBedName);
        };

        window.addEventListener(
            gameProfileCloseupCommandEventName,
            handleCommand,
        );
        return () => {
            window.removeEventListener(
                gameProfileCloseupCommandEventName,
                handleCommand,
            );
            resetGeneratedPlantProfile();
        };
    }, [garden, removeRaisedBedCloseupParam, setRaisedBedCloseupParam]);

    useEffect(() => {
        const pendingTimeouts = new Set<number>();
        const clearPendingTimeouts = () => {
            for (const timeout of pendingTimeouts) {
                window.clearTimeout(timeout);
            }
            pendingTimeouts.clear();
        };
        const handleCommand = (event: Event) => {
            const command =
                event instanceof CustomEvent
                    ? readGameProfilePlacementCommand(event.detail)
                    : null;
            if (!command) {
                return;
            }
            clearPendingTimeouts();
            const blockIds = resolveGameProfilePlacementBlockIds(garden);
            for (const blockId of blockIds) {
                cancelBlockPlacementDropAnimation(blockId);
            }
            if (command.action === 'reset') {
                resetPlacementAnimationProfileMetrics();
                return;
            }

            if (blockIds.length === 0) {
                resetPlacementAnimationProfileMetrics();
                return;
            }

            const startTimeout = window.setTimeout(() => {
                pendingTimeouts.delete(startTimeout);
                resetPlacementAnimationProfileMetrics();
                const [firstBlockId, ...remainingBlockIds] = blockIds;
                if (!firstBlockId) {
                    return;
                }
                queueBlockPlacementDropAnimation(firstBlockId, {
                    mutationConfirmed: true,
                });
                remainingBlockIds.forEach((blockId, index) => {
                    const timeout = window.setTimeout(
                        () => {
                            pendingTimeouts.delete(timeout);
                            queueBlockPlacementDropAnimation(blockId, {
                                mutationConfirmed: true,
                            });
                        },
                        command.staggerMs * (index + 1),
                    );
                    pendingTimeouts.add(timeout);
                });
            }, 0);
            pendingTimeouts.add(startTimeout);
        };

        window.addEventListener(
            gameProfilePlacementCommandEventName,
            handleCommand,
        );
        return () => {
            window.removeEventListener(
                gameProfilePlacementCommandEventName,
                handleCommand,
            );
            clearPendingTimeouts();
        };
    }, [
        cancelBlockPlacementDropAnimation,
        garden,
        queueBlockPlacementDropAnimation,
    ]);

    useEffect(() => {
        const setHoveredBlock = useHoveredBlockStore.getState().setHoveredBlock;
        const handleCommand = (event: Event) => {
            const command =
                event instanceof CustomEvent
                    ? readGameProfileOutlineCommand(event.detail)
                    : null;
            if (!command || command.action === 'hide') {
                if (command) {
                    setHoveredBlock(null);
                    invalidate(undefined, 2);
                    updateGameProfileMetadata({
                        hoverOutlineProfileCommandAction: command.action,
                        hoverOutlineProfileTargetBlockId: null,
                        hoverOutlineProfileTargetRaisedBedId: null,
                    });
                }
                return;
            }

            const target = resolveGameProfileRaisedBedTarget(
                garden,
                command.raisedBedId,
            );
            setHoveredBlock(target?.block ?? null);
            invalidate(undefined, 2);
            updateGameProfileMetadata({
                hoverOutlineProfileCommandAction: command.action,
                hoverOutlineProfileTargetBlockId: target?.blockId ?? null,
                hoverOutlineProfileTargetRaisedBedId:
                    target?.raisedBedId ?? null,
            });
        };

        window.addEventListener(
            gameProfileOutlineCommandEventName,
            handleCommand,
        );
        return () => {
            window.removeEventListener(
                gameProfileOutlineCommandEventName,
                handleCommand,
            );
            setHoveredBlock(null);
        };
    }, [garden]);

    return null;
}
