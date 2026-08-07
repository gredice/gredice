'use client';

import { useEffect, useMemo } from 'react';
import { useBlockData } from '../hooks/useBlockData';
import { useBlockPlace } from '../hooks/useBlockPlace';
import { useCurrentAccount } from '../hooks/useCurrentAccount';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { getHudEntityPlacementAvailability } from '../hud/itemPlacementAvailability';
import { useGameState } from '../useGameState';
import {
    type HudPlacementGridPosition,
    resolveHudPlacementPreview,
} from './hudPlacement';

export function useHudPlacementPreview(
    pointerPosition: HudPlacementGridPosition | null,
) {
    const { data: blockData } = useBlockData();
    const { data: garden } = useCurrentGarden();
    const { data: account, isLoading: isAccountLoading } = useCurrentAccount();
    const { mutate: placeBlock } = useBlockPlace();
    const hudPlacementDrag = useGameState((state) => state.hudPlacementDrag);
    const clearHudPlacementDrag = useGameState(
        (state) => state.clearHudPlacementDrag,
    );
    const timeOfDay = useGameState((state) => state.timeOfDay);
    const blockName = hudPlacementDrag?.blockName;
    const pointerX = pointerPosition?.x;
    const pointerZ = pointerPosition?.z;

    const placementPreview = useMemo(() => {
        if (!blockName || pointerX === undefined || pointerZ === undefined) {
            return null;
        }

        return resolveHudPlacementPreview({
            blockData,
            blockName,
            garden,
            position: {
                x: pointerX,
                z: pointerZ,
            },
        });
    }, [blockData, blockName, garden, pointerX, pointerZ]);

    const blockEntity = useMemo(
        () =>
            blockData?.find(
                (candidate) => candidate.information.name === blockName,
            ),
        [blockData, blockName],
    );
    const availability =
        blockEntity && garden
            ? getHudEntityPlacementAvailability({
                  accountSunflowers: account?.sunflowers.amount,
                  block: blockEntity,
                  isAccountLoading,
                  isSandbox: garden.isSandbox,
                  timeOfDay,
              })
            : null;
    const isBlocked =
        !availability?.canPlace || (placementPreview?.isBlocked ?? true);
    const dropRequestSequence = hudPlacementDrag?.dropRequest?.sequence ?? null;

    useEffect(() => {
        if (!blockName || dropRequestSequence === null) {
            return;
        }

        if (!placementPreview || isBlocked || !availability?.canPlace) {
            clearHudPlacementDrag();
            return;
        }

        placeBlock({
            blockName,
            position: {
                x: placementPreview.position.x,
                y: placementPreview.position.z,
            },
        });
        clearHudPlacementDrag();
    }, [
        availability?.canPlace,
        blockName,
        clearHudPlacementDrag,
        dropRequestSequence,
        isBlocked,
        placeBlock,
        placementPreview,
    ]);

    return {
        hudPlacementDrag,
        isBlocked,
        placementPreview,
    };
}
