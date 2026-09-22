import { readGardenAction } from '@gredice/js/gardenActions';
import { Button } from '@gredice/ui/Button';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { parseAsString, useQueryStates } from 'nuqs';
import { useEffect, useRef, useState } from 'react';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { useOperations } from '../hooks/useOperations';
import { useAllSorts } from '../hooks/usePlantSorts';
import { useShoppingCart } from '../hooks/useShoppingCart';
import { GameModal } from '../shared-ui/game-modal';
import { useSetRaisedBedCloseupParam } from '../useRaisedBedCloseup';
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
    const actionKey = JSON.stringify([gardenQuery.data?.id, params]);
    const cartQuery = useShoppingCart(hasAction);
    const sortsQuery = useAllSorts(hasAction);
    const operationsQuery = useOperations();
    const { mutate: focusRaisedBed } = useSetRaisedBedCloseupParam();
    const handledKey = useRef<string | null>(null);
    const [opened, setOpened] = useState<{
        key: string;
        action: ResolvedGardenAction;
    } | null>(null);

    useEffect(() => {
        if (!hasAction) {
            handledKey.current = null;
            return;
        }
        if (!enabled || handledKey.current === actionKey) return;
        const query = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value !== null) query.set(key, value);
        }
        const action = readGardenAction(query);
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
            (action.type === 'operation' && operationsQuery.isError)
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
        if (
            !gardenQuery.data ||
            cartQuery.data === undefined ||
            !sortsQuery.data ||
            (action.type === 'operation' && !operationsQuery.data)
        )
            return;
        const resolved = resolveGardenAction({
            action,
            garden: gardenQuery.data,
            cartItems: cartQuery.data?.items ?? [],
            sorts: sortsQuery.data,
            operations: operationsQuery.data ?? [],
        });
        handledKey.current = actionKey;
        setOpened({ key: actionKey, action: resolved });
        if (resolved.type !== 'unavailable') {
            if (resolved.raisedBedName)
                void focusRaisedBed(
                    resolved.raisedBedName,
                    resolved.positionIndex,
                );
            // Consume successful links once. Refreshing or reopening a field must not repeat the action.
            void setParams(clearAction);
        }
    }, [
        actionKey,
        cartQuery.data,
        cartQuery.isError,
        enabled,
        focusRaisedBed,
        gardenQuery.data,
        gardenQuery.isError,
        hasAction,
        operationsQuery.data,
        operationsQuery.isError,
        params,
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

    if (!opened) return null;
    const action = opened.action;
    if (
        action.type !== 'unavailable' &&
        action.gardenId !== gardenQuery.data?.id
    )
        return null;
    if (action.type === 'unavailable') {
        return (
            <GameModal
                open
                title="Moj vrt"
                onOpenChange={(open) => {
                    if (!open) setOpened(null);
                }}
            >
                <Stack spacing={4}>
                    <Typography>{action.message}</Typography>
                    <Button onClick={() => setOpened(null)}>U redu</Button>
                </Stack>
            </GameModal>
        );
    }
    if (action.type === 'sow') {
        return (
            <PlantPicker
                key={opened.key}
                defaultOpen
                onClose={() => setOpened(null)}
                gardenId={action.gardenId}
                raisedBedId={action.raisedBedId}
                positionIndex={action.positionIndex}
                selectedPlantId={action.plantId}
                selectedSortId={action.sortId}
            />
        );
    }
    return (
        <OperationsListItem
            key={opened.key}
            scheduleOnly
            onScheduleClose={() => setOpened(null)}
            targetLabel={
                action.raisedBedName
                    ? `${action.raisedBedName}${typeof action.positionIndex === 'number' ? ` · Polje ${action.positionIndex + 1}` : ''}`
                    : gardenQuery.data?.name
            }
            gardenId={action.gardenId}
            raisedBedId={action.raisedBedId}
            positionIndex={
                action.plantingTarget ? undefined : action.positionIndex
            }
            plantingTarget={action.plantingTarget}
            operation={action.operation}
        />
    );
}
