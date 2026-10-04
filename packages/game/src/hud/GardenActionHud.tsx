import { readGardenAction } from '@gredice/js/gardenActions';
import { Button } from '@gredice/ui/Button';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useQueries } from '@tanstack/react-query';
import { parseAsString, useQueryStates } from 'nuqs';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { useGardens } from '../hooks/useGardens';
import { useOperations } from '../hooks/useOperations';
import {
    fetchGardenTarget,
    outletGardenTargetGardenQueryKey,
} from '../hooks/useOutletGardenTargetGarden';
import { useAllSorts } from '../hooks/usePlantSorts';
import { useShoppingCart } from '../hooks/useShoppingCart';
import { GameModal } from '../shared-ui/game-modal';
import { useSetRaisedBedCloseupParam } from '../useRaisedBedCloseup';
import {
    useCurrentGardenIdParam,
    useRaisedBedCloseupParam,
} from '../useUrlState';
import {
    type ResolvedGardenAction,
    resolveGardenAction,
} from './gardenActionTarget';
import { PlantPicker } from './raisedBed/RaisedBedPlantPicker';
import { OperationsListItem } from './raisedBed/shared/OperationsListItem';

const actionParsers = {
    sijanje: parseAsString,
    sorta: parseAsString,
    radnja: parseAsString,
};
const clearAction = { sijanje: null, sorta: null, radnja: null };

export function GardenActionHud({ enabled = true }: { enabled?: boolean }) {
    const [params, setParams] = useQueryStates(actionParsers);
    const hasAction = Object.values(params).some((value) => value !== null);
    const gardenQuery = useCurrentGarden();
    const gardensQuery = useGardens(!hasAction);
    const [selectedGardenId, setSelectedGardenId] = useCurrentGardenIdParam();
    const actionKey = JSON.stringify([gardenQuery.data?.id, params]);
    const cartQuery = useShoppingCart(hasAction);
    const sortsQuery = useAllSorts(hasAction);
    const operationsQuery = useOperations();
    const { mutate: focusRaisedBed } = useSetRaisedBedCloseupParam();
    const [focusedBedName] = useRaisedBedCloseupParam();
    const handledKey = useRef<string | null>(null);
    const [opened, setOpened] = useState<{
        key: string;
        action: ResolvedGardenAction;
    } | null>(null);

    const action = useMemo(() => {
        const query = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value !== null) query.set(key, value);
        }
        return readGardenAction(query);
    }, [params]);
    const currentAction = useMemo(() => {
        if (
            !enabled ||
            !action ||
            !gardenQuery.data ||
            cartQuery.data === undefined ||
            !sortsQuery.data ||
            (action.type === 'operation' && !operationsQuery.data)
        )
            return null;
        return resolveGardenAction({
            action,
            garden: gardenQuery.data,
            cartItems: cartQuery.data?.items ?? [],
            sorts: sortsQuery.data,
            operations: operationsQuery.data ?? [],
        });
    }, [
        action,
        cartQuery.data,
        enabled,
        gardenQuery.data,
        operationsQuery.data,
        sortsQuery.data,
    ]);
    const alternativeGardens = useQueries({
        queries: (currentAction?.type === 'unavailable'
            ? (gardensQuery.data ?? [])
            : []
        )
            .filter(
                (garden) =>
                    !garden.isSandbox && garden.id !== gardenQuery.data?.id,
            )
            .map((garden) => ({
                queryKey: outletGardenTargetGardenQueryKey(garden.id),
                queryFn: () => fetchGardenTarget(garden.id),
                staleTime: 60_000,
                retry: false,
            })),
    });

    useEffect(() => {
        if (!hasAction) {
            handledKey.current = null;
            return;
        }
        if (!enabled || handledKey.current === actionKey) return;
        if (!action) {
            handledKey.current = actionKey;
            setOpened({
                key: actionKey,
                action: {
                    type: 'unavailable',
                    message: 'Poveznica za sjetvu ili radnju nije valjana.',
                },
            });
            return;
        }
        if (
            gardenQuery.isError ||
            cartQuery.isError ||
            sortsQuery.isError ||
            (action.type === 'operation' && operationsQuery.isError) ||
            (currentAction?.type === 'unavailable' && gardensQuery.isError) ||
            alternativeGardens.some((query) => query.isError)
        ) {
            handledKey.current = actionKey;
            setOpened({
                key: actionKey,
                action: {
                    type: 'unavailable',
                    message:
                        'Podatke za ovu radnju nije moguće učitati. Osvježi stranicu i pokušaj ponovno.',
                },
            });
            return;
        }
        if (!currentAction) return;
        if (
            currentAction.type === 'unavailable' &&
            (gardensQuery.data === undefined ||
                alternativeGardens.some((query) => query.isPending))
        )
            return;
        if (currentAction.type === 'unavailable' && sortsQuery.data) {
            for (const candidate of alternativeGardens) {
                if (!candidate.data) continue;
                const alternative = resolveGardenAction({
                    action,
                    garden: candidate.data,
                    cartItems: cartQuery.data?.items ?? [],
                    sorts: sortsQuery.data,
                    operations: operationsQuery.data ?? [],
                });
                if (alternative.type !== 'unavailable') {
                    // Keep the intent until the selected garden has loaded, then
                    // resolve again against its live data before opening a dialog.
                    if (selectedGardenId !== alternative.gardenId)
                        void setSelectedGardenId(alternative.gardenId);
                    return;
                }
            }
        }
        const resolved = currentAction;
        handledKey.current = actionKey;
        setOpened({ key: actionKey, action: resolved });
        if (resolved.type !== 'unavailable') {
            // Consume successful links once. Refreshing or reopening a field must not repeat the action.
            void setParams(clearAction);
        }
    }, [
        action,
        actionKey,
        alternativeGardens,
        currentAction,
        gardensQuery.data,
        gardensQuery.isError,
        selectedGardenId,
        setSelectedGardenId,
        cartQuery.data,
        cartQuery.isError,
        enabled,
        gardenQuery.isError,
        hasAction,
        operationsQuery.data,
        operationsQuery.isError,
        setParams,
        sortsQuery.data,
        sortsQuery.isError,
    ]);

    const currentGardenId = gardenQuery.data?.id;
    useEffect(() => {
        setOpened((previous) =>
            previous &&
            previous.action.type !== 'unavailable' &&
            previous.action.gardenId !== currentGardenId
                ? null
                : previous,
        );
    }, [currentGardenId]);

    useEffect(() => {
        const target = opened?.action;
        if (
            !target ||
            target.type === 'unavailable' ||
            target.gardenId !== currentGardenId ||
            !target.raisedBedName ||
            focusedBedName === target.raisedBedName
        )
            return;
        // Garden switching clears the old closeup asynchronously. Keep the open
        // shortcut anchored after that reset, without opening a field/history dialog.
        void focusRaisedBed(target.raisedBedName);
    }, [currentGardenId, focusedBedName, focusRaisedBed, opened]);

    if (!opened) return null;
    const openedAction = opened.action;
    if (
        openedAction.type !== 'unavailable' &&
        openedAction.gardenId !== gardenQuery.data?.id
    )
        return null;
    if (openedAction.type === 'unavailable') {
        return (
            <GameModal
                open
                title="Moj vrt"
                onOpenChange={(open) => {
                    if (!open) setOpened(null);
                }}
            >
                <Stack spacing={4}>
                    <Typography>{openedAction.message}</Typography>
                    <Button onClick={() => setOpened(null)}>U redu</Button>
                </Stack>
            </GameModal>
        );
    }
    if (openedAction.type === 'sow') {
        return (
            <PlantPicker
                key={opened.key}
                defaultOpen
                onClose={() => setOpened(null)}
                gardenId={openedAction.gardenId}
                raisedBedId={openedAction.raisedBedId}
                positionIndex={openedAction.positionIndex}
                selectedPlantId={openedAction.plantId}
                selectedSortId={openedAction.sortId}
            />
        );
    }
    return (
        <OperationsListItem
            key={opened.key}
            scheduleOnly
            onScheduleClose={() => setOpened(null)}
            targetLabel={
                openedAction.raisedBedName
                    ? `${openedAction.raisedBedName}${typeof openedAction.positionIndex === 'number' ? ` · Polje ${openedAction.positionIndex + 1}` : ''}`
                    : gardenQuery.data?.name
            }
            gardenId={openedAction.gardenId}
            raisedBedId={openedAction.raisedBedId}
            positionIndex={
                openedAction.plantingTarget
                    ? undefined
                    : openedAction.positionIndex
            }
            plantingTarget={openedAction.plantingTarget}
            operation={openedAction.operation}
        />
    );
}
