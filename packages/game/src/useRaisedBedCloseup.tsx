import { decodeUriComponentSafe } from '@gredice/js/uri';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useCurrentGarden } from './hooks/useCurrentGarden';
import { useGameState } from './useGameState';
import { useRaisedBedCloseupParams } from './useUrlState';

export function useRemoveRaisedBedCloseupParam() {
    const [, setRaisedBedCloseupParams] = useRaisedBedCloseupParams();
    const mutate = useCallback(
        () =>
            setRaisedBedCloseupParams({
                gredica: null,
                polje: null,
            }),
        [setRaisedBedCloseupParams],
    );

    return {
        mutate,
    };
}

export function useSetRaisedBedCloseupParam() {
    const [, setRaisedBedCloseupParams] = useRaisedBedCloseupParams();
    const mutate = useCallback(
        (value: string, positionIndex?: number | null) =>
            setRaisedBedCloseupParams({
                gredica: value,
                polje:
                    typeof positionIndex === 'number'
                        ? positionIndex + 1
                        : null,
            }),
        [setRaisedBedCloseupParams],
    );

    return {
        mutate,
    };
}

export function useRaisedBedCloseup() {
    const { data: garden } = useCurrentGarden();
    const [{ gredica: raisedBedParam }, setRaisedBedCloseupParams] =
        useRaisedBedCloseupParams();
    const setView = useGameState((state) => state.setView);
    const closeupBlock = useGameState((state) => state.closeupBlock);
    const view = useGameState((state) => state.view);
    const previousGardenIdRef = useRef(garden?.id);

    const blocks = useMemo(
        () => garden?.stacks.flatMap((stack) => stack.blocks) ?? [],
        [garden],
    );

    useEffect(() => {
        const previousGardenId = previousGardenIdRef.current;
        if (garden?.id !== undefined) {
            previousGardenIdRef.current = garden.id;
        }

        if (
            garden?.id !== undefined &&
            previousGardenId !== undefined &&
            previousGardenId !== garden.id
        ) {
            if (view === 'closeup') {
                setView({ view: 'normal' });
            }
            void setRaisedBedCloseupParams({
                gredica: null,
                polje: null,
            });
            return;
        }

        if (!garden || !raisedBedParam) {
            // No raised bed param, reset view if needed
            if (view === 'closeup') {
                // If we were viewing a closeup, reset to default view
                setView({ view: 'normal' });
            }
            return;
        }

        const decodedRaisedBedName =
            decodeUriComponentSafe(raisedBedParam).trim();
        if (!decodedRaisedBedName) {
            return;
        }

        // Resolve the raised bed by name
        const raisedBed = garden.raisedBeds.find(
            (bed) =>
                bed.name?.trim().toLowerCase() ===
                decodedRaisedBedName.toLowerCase(),
        );
        if (!raisedBed) {
            if (view === 'closeup') {
                setView({ view: 'normal' });
            }
            void setRaisedBedCloseupParams({
                gredica: null,
                polje: null,
            });
            return;
        }

        // Resolve the block for this raised bed
        const block = blocks.find(
            (candidate) => String(candidate.id) === String(raisedBed.blockId),
        );
        if (!block) {
            if (view === 'closeup') {
                setView({ view: 'normal' });
            }
            void setRaisedBedCloseupParams({
                gredica: null,
                polje: null,
            });
            return;
        }

        // Ignore if already viewing this closeup
        if (view === 'closeup' && closeupBlock?.id === block.id) {
            return;
        }

        console.debug('Navigating to raised bed closeup for', raisedBed, block);
        setView({ view: 'closeup', block });
    }, [
        blocks,
        closeupBlock?.id,
        garden,
        raisedBedParam,
        setRaisedBedCloseupParams,
        setView,
        view,
    ]);
}
