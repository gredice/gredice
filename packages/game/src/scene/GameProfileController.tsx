'use client';

import { useEffect, useRef } from 'react';
import { useHoveredBlockStore } from '../controls/useHoveredBlockStore';
import {
    resetAnimalProfileCommandMetrics,
    startAnimalProfileCommandMetrics,
} from '../entities/animals/animalProfileCommandMetrics';
import { meshChunkSize } from '../entities/chunkedMeshGeometry';
import { instancedBlockNames } from '../entities/EntityInstances';
import { resetPlacementAnimationProfileMetrics } from '../entities/placementAnimationProfileMetrics';
import { getGeneratedPackedPlantRenderTaskSchedulerSnapshot } from '../generators/plant/hooks/useGeneratedPlantRenderData';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import type { Block } from '../types/Block';
import { useGameState, useGameStateStore } from '../useGameState';
import {
    useRemoveRaisedBedCloseupParam,
    useSetRaisedBedCloseupParam,
} from '../useRaisedBedCloseup';
import {
    type GameProfileMetadata,
    updateGameProfileMetadata,
} from './gameProfileMetadata';
import {
    failGeneratedPlantProfile,
    recordGeneratedPlantProfileCamera,
    resetGeneratedPlantProfile,
    startGeneratedPlantProfile,
} from './generatedPlantProfileMetrics';
import { useSceneRenderRequest } from './SceneTime';

export const gameProfileCloseupCommandEventName =
    'gredice:game-profile-closeup-command';
export const gameProfilePlacementCommandEventName =
    'gredice:game-profile-placement-command';
export const gameProfileOutlineCommandEventName =
    'gredice:game-profile-outline-command';
export const gameProfileAnimalCommandEventName =
    'gredice:game-profile-animal-command';

type ProfileGarden = {
    id?: number;
    raisedBeds: Array<{
        blockId?: string | null;
        fields?: Array<{
            active: boolean;
            id?: number | null;
            positionIndex: number;
        }>;
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

export type GameProfileAnimalCommand = {
    behavior: 'trot';
    species: 'Cow';
    targetId?: null;
};

export function readGameProfileAnimalCommand(
    value: unknown,
): GameProfileAnimalCommand | null {
    if (!value || typeof value !== 'object') {
        return null;
    }

    const species = Reflect.get(value, 'species');
    const behavior = Reflect.get(value, 'behavior');
    const targetId = Reflect.get(value, 'targetId');
    if (
        species !== 'Cow' ||
        behavior !== 'trot' ||
        (targetId !== undefined && targetId !== null)
    ) {
        return null;
    }

    return {
        behavior,
        species,
        ...(targetId !== undefined ? { targetId } : {}),
    };
}

export type GameProfileOperationVisualHighlightRequest = {
    fieldId: number;
    positionIndex: number;
    raisedBedId: number;
};

type OperationVisualHighlightProfileMetadataUpdate = Pick<
    GameProfileMetadata,
    | 'operationVisualHighlightProfileDispatched'
    | 'operationVisualHighlightProfileTargetFieldId'
    | 'operationVisualHighlightProfileTargetGardenId'
    | 'operationVisualHighlightProfileTargetPositionIndex'
    | 'operationVisualHighlightProfileTargetRaisedBedId'
>;

function readProfileInteger(value: string | null | undefined, minimum: number) {
    if (typeof value !== 'string' || value.length === 0) {
        return null;
    }
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= minimum ? parsed : null;
}

export function readGameProfileOperationVisualHighlightRequest({
    enabled,
    fieldId,
    positionIndex,
    raisedBedId,
}: {
    enabled?: string | null;
    fieldId?: string | null;
    positionIndex?: string | null;
    raisedBedId?: string | null;
}): GameProfileOperationVisualHighlightRequest | null {
    if (enabled !== '1') {
        return null;
    }

    const parsedFieldId = readProfileInteger(fieldId, 1);
    const parsedPositionIndex = readProfileInteger(positionIndex, 0);
    const parsedRaisedBedId = readProfileInteger(raisedBedId, 1);
    if (
        parsedFieldId === null ||
        parsedPositionIndex === null ||
        parsedRaisedBedId === null
    ) {
        return null;
    }

    return {
        fieldId: parsedFieldId,
        positionIndex: parsedPositionIndex,
        raisedBedId: parsedRaisedBedId,
    };
}

export function resolveGameProfileOperationVisualHighlight(
    garden: ProfileGarden | null | undefined,
    request: GameProfileOperationVisualHighlightRequest | null,
) {
    const gardenId = garden?.id;
    if (
        !garden ||
        !request ||
        typeof gardenId !== 'number' ||
        !Number.isInteger(gardenId) ||
        gardenId <= 0
    ) {
        return null;
    }

    const raisedBed = garden.raisedBeds.find(
        (candidate) => candidate.id === request.raisedBedId,
    );
    if (!raisedBed) {
        return null;
    }

    const field = raisedBed.fields?.find(
        (candidate) =>
            candidate.active &&
            candidate.id === request.fieldId &&
            candidate.positionIndex === request.positionIndex,
    );
    if (!field || typeof field.id !== 'number') {
        return null;
    }

    const raisedBedName = raisedBed?.name?.trim() || null;
    return {
        fieldId: field.id,
        gardenId,
        label: `Polje ${field.positionIndex + 1}`,
        message: 'Profil operacijskih vizuala',
        positionIndex: field.positionIndex,
        raisedBedId: raisedBed.id,
        raisedBedName,
    };
}

function updateOperationVisualHighlightProfileMetadata(
    metadata: OperationVisualHighlightProfileMetadataUpdate,
) {
    updateGameProfileMetadata(metadata);
}

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
    const gameStateStore = useGameStateStore();
    const requestRender = useSceneRenderRequest();
    const operationVisualHighlightDispatchKeyRef = useRef<string | null>(null);
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
    const setGardenTargetHighlight = useGameState(
        (current) => current.setGardenTargetHighlight,
    );
    const clearGardenTargetHighlight = useGameState(
        (current) => current.clearGardenTargetHighlight,
    );
    const { mutate: removeRaisedBedCloseupParam } =
        useRemoveRaisedBedCloseupParam();
    const { mutate: setRaisedBedCloseupParam } = useSetRaisedBedCloseupParam();

    useEffect(() => {
        if (!garden) {
            return;
        }

        const blockCounts = new Map<string, number>();
        let blockCount = 0;
        for (const stack of garden.stacks) {
            for (const block of stack.blocks) {
                blockCount += 1;
                blockCounts.set(
                    block.name,
                    (blockCounts.get(block.name) ?? 0) + 1,
                );
            }
        }

        updateGameProfileMetadata({
            profileGardenBlockCount: blockCount,
            profileGardenBlockCountsByName: Object.fromEntries(
                Array.from(blockCounts.entries()).sort(([left], [right]) =>
                    left.localeCompare(right),
                ),
            ),
            profileGardenId: garden.id,
            profileGardenRaisedBedCount: garden.raisedBeds.length,
            profileGardenStackCount: garden.stacks.length,
        });
    }, [garden]);

    useEffect(() => {
        resetAnimalProfileCommandMetrics();
        const handleCommand = (event: Event) => {
            const command =
                event instanceof CustomEvent
                    ? readGameProfileAnimalCommand(event.detail)
                    : null;
            if (!command) {
                return;
            }
            gameStateStore.getState().triggerAnimalDebugBehavior(command);
            const dispatched = gameStateStore.getState().animalDebugCommand;
            if (
                !dispatched ||
                dispatched.species !== command.species ||
                dispatched.behavior !== command.behavior
            ) {
                return;
            }
            startAnimalProfileCommandMetrics({
                behavior: command.behavior,
                sequence: dispatched.sequence,
                species: command.species,
                targetId: command.targetId,
            });
            requestRender('profile-animal-command', 2);
        };

        window.addEventListener(
            gameProfileAnimalCommandEventName,
            handleCommand,
        );
        return () => {
            window.removeEventListener(
                gameProfileAnimalCommandEventName,
                handleCommand,
            );
        };
    }, [gameStateStore, requestRender]);

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

        const recordCameraSnapshot = (
            snapshot: ReturnType<typeof gameCamera.getSnapshot>,
        ) => {
            recordGeneratedPlantProfileCamera({ zoom: snapshot.zoom });
            updateGameProfileMetadata({ gameCameraSnapshot: snapshot });
        };

        recordCameraSnapshot(gameCamera.getSnapshot());
        return gameCamera.subscribe(recordCameraSnapshot);
    }, [gameCamera]);

    useEffect(() => {
        const profileElement = document.querySelector(
            '[data-game-profile-operation-visuals]',
        );
        if (!(profileElement instanceof HTMLElement)) {
            return;
        }

        const request = readGameProfileOperationVisualHighlightRequest({
            enabled: profileElement.getAttribute(
                'data-game-profile-operation-visuals',
            ),
            fieldId: profileElement.getAttribute(
                'data-game-profile-operation-visual-highlight-field-id',
            ),
            positionIndex: profileElement.getAttribute(
                'data-game-profile-operation-visual-highlight-position-index',
            ),
            raisedBedId: profileElement.getAttribute(
                'data-game-profile-operation-visual-highlight-raised-bed-id',
            ),
        });
        if (
            !request ||
            !garden ||
            typeof garden.id !== 'number' ||
            !Number.isInteger(garden.id) ||
            garden.id <= 0
        ) {
            return;
        }

        const highlight = resolveGameProfileOperationVisualHighlight(
            garden,
            request,
        );
        if (!highlight) {
            if (operationVisualHighlightDispatchKeyRef.current !== null) {
                clearGardenTargetHighlight();
                operationVisualHighlightDispatchKeyRef.current = null;
            }
            updateOperationVisualHighlightProfileMetadata({
                operationVisualHighlightProfileDispatched: false,
                operationVisualHighlightProfileTargetFieldId: request.fieldId,
                operationVisualHighlightProfileTargetGardenId: garden.id,
                operationVisualHighlightProfileTargetPositionIndex:
                    request.positionIndex,
                operationVisualHighlightProfileTargetRaisedBedId:
                    request.raisedBedId,
            });
            return;
        }

        const dispatchKey = [
            highlight.gardenId,
            highlight.raisedBedId,
            highlight.fieldId,
            highlight.positionIndex,
        ].join(':');
        if (operationVisualHighlightDispatchKeyRef.current === dispatchKey) {
            return;
        }

        setGardenTargetHighlight(highlight);
        operationVisualHighlightDispatchKeyRef.current = dispatchKey;
        requestRender('profile-operation-highlight', 2);
        updateOperationVisualHighlightProfileMetadata({
            operationVisualHighlightProfileDispatched: true,
            operationVisualHighlightProfileTargetFieldId: highlight.fieldId,
            operationVisualHighlightProfileTargetGardenId: highlight.gardenId,
            operationVisualHighlightProfileTargetPositionIndex:
                highlight.positionIndex,
            operationVisualHighlightProfileTargetRaisedBedId:
                highlight.raisedBedId,
        });
    }, [
        clearGardenTargetHighlight,
        garden,
        requestRender,
        setGardenTargetHighlight,
    ]);

    useEffect(
        () => () => {
            if (operationVisualHighlightDispatchKeyRef.current === null) {
                return;
            }
            clearGardenTargetHighlight();
            operationVisualHighlightDispatchKeyRef.current = null;
        },
        [clearGardenTargetHighlight],
    );

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
                    requestRender('profile-outline-command', 2);
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
            requestRender('profile-outline-command', 2);
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
    }, [garden, requestRender]);

    return null;
}
