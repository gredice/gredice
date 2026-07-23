'use client';

import { useEffect } from 'react';
import { getGeneratedPackedPlantRenderTaskSchedulerSnapshot } from '../generators/plant/hooks/useGeneratedLSystem';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import type { Block } from '../types/Block';
import { useGameState } from '../useGameState';
import {
    useRemoveRaisedBedCloseupParam,
    useSetRaisedBedCloseupParam,
} from '../useRaisedBedCloseup';
import {
    failGeneratedPlantProfile,
    recordGeneratedPlantProfileCamera,
    resetGeneratedPlantProfile,
    startGeneratedPlantProfile,
} from './generatedPlantProfileMetrics';

export const gameProfileCloseupCommandEventName =
    'gredice:game-profile-closeup-command';

type ProfileGarden = {
    raisedBeds: Array<{
        blockId?: string | null;
        id: number;
        name?: string | null;
    }>;
    stacks: Array<{
        blocks: Block[];
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

    return null;
}
