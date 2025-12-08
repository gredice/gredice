import { decodeUriComponentSafe } from '@gredice/js/uri';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo } from 'react';
import { useCurrentGarden } from './hooks/useCurrentGarden';
import { useGameState } from './useGameState';

export function useRemoveRaisedBedCloseupParam() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const createQueryString = useCallback(
        (name: string) => {
            const params = new URLSearchParams(searchParams.toString());
            params.delete(name);
            router.push(`${pathname}?${params.toString()}`);
        },
        [searchParams, pathname, router],
    );
    return { mutate: () => createQueryString('gredica') };
}

export function useSetRaisedBedCloseupParam() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const createQueryString = useCallback(
        (name: string, value: string) => {
            const params = new URLSearchParams(searchParams.toString());
            params.set(name, value);
            router.push(`${pathname}?${params.toString()}`);
        },
        [searchParams, pathname, router.push],
    );
    return { mutate: (value: string) => createQueryString('gredica', value) };
}

export function useRaisedBedCloseup() {
    const { data: garden } = useCurrentGarden();
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
    }, [blocks, closeupBlock?.id, garden, searchParams, setView, view]);
}
