import { decodeUriComponentSafe } from '@gredice/js/uri';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import type { useCurrentGarden } from './hooks/useCurrentGarden';
import { useGameState } from './useGameState';

export function useRaisedBedCloseup(
    garden: ReturnType<typeof useCurrentGarden>['data'],
) {
    const searchParams = useSearchParams();
    const setView = useGameState((state) => state.setView);
    const closeupBlock = useGameState((state) => state.closeupBlock);
    const view = useGameState((state) => state.view);

    const blocks = useMemo(
        () => garden?.stacks.flatMap((stack) => stack.blocks) ?? [],
        [garden],
    );

    useEffect(() => {
        const raisedBedParam = searchParams?.get('gredica');
        if (!garden || !raisedBedParam) {
            return;
        }

        const decodedRaisedBedName =
            decodeUriComponentSafe(raisedBedParam).trim();
        if (!decodedRaisedBedName) {
            return;
        }

        const raisedBed = garden.raisedBeds.find(
            (bed) =>
                bed.name?.trim().toLowerCase() ===
                decodedRaisedBedName.toLowerCase(),
        );
        if (!raisedBed) {
            return;
        }

        const block = blocks.find(
            (candidate) => String(candidate.id) === String(raisedBed.blockId),
        );
        if (!block) {
            return;
        }

        if (view === 'closeup' && closeupBlock?.id === block.id) {
            return;
        }

        setView({ view: 'closeup', block });
    }, [blocks, closeupBlock?.id, garden, searchParams, setView, view]);
}
