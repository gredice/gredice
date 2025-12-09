import { decodeUriComponentSafe } from '@gredice/js/uri';
import { useEffect, useMemo } from 'react';
import { useCurrentGarden } from './hooks/useCurrentGarden';
import { useGameState } from './useGameState';
import { useRaisedBedCloseupParam } from './useUrlState';

export function useRemoveRaisedBedCloseupParam() {
    const [, setGredica] = useRaisedBedCloseupParam();
    return { mutate: () => setGredica(null) };
}

export function useSetRaisedBedCloseupParam() {
    const [, setGredica] = useRaisedBedCloseupParam();
    return { mutate: (value: string) => setGredica(value) };
}

export function useRaisedBedCloseup() {
    const { data: garden } = useCurrentGarden();
    const [raisedBedParam] = useRaisedBedCloseupParam();
    const setView = useGameState((state) => state.setView);
    const closeupBlock = useGameState((state) => state.closeupBlock);
    const view = useGameState((state) => state.view);

    const blocks = useMemo(
        () => garden?.stacks.flatMap((stack) => stack.blocks) ?? [],
        [garden],
    );

    useEffect(() => {
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
            return;
        }

        // Resolve the block for this raised bed
        const block = blocks.find(
            (candidate) => String(candidate.id) === String(raisedBed.blockId),
        );
        if (!block) {
            return;
        }

        // Ignore if already viewing this closeup
        if (view === 'closeup' && closeupBlock?.id === block.id) {
            return;
        }

        console.debug('Navigating to raised bed closeup for', raisedBed, block);
        setView({ view: 'closeup', block });
    }, [blocks, closeupBlock?.id, garden, raisedBedParam, setView, view]);
}
