'use client';

import {
    plantFieldStatusLabel,
    userAllowedPlantStatusTransitions,
} from '@gredice/js/plants';
import { Button } from '@gredice/ui/Button';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useActionState, useMemo } from 'react';
import { useFormStatus } from 'react-dom';
import {
    type PlantStateRequestActionState,
    requestPlantStateChangeAction,
} from './actions';

function SubmitButton({ disabled }: { disabled: boolean }) {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" size="sm" loading={pending} disabled={disabled}>
            {pending ? 'Slanje...' : 'Zatraži promjenu'}
        </Button>
    );
}

export function PlantStateRequestForm({
    raisedBedId,
    positionIndex,
    currentStatus,
    pendingRequestedStatus,
}: {
    raisedBedId: number;
    positionIndex: number;
    currentStatus?: string | null;
    pendingRequestedStatus?: string | null;
}) {
    const [state, formAction] = useActionState<
        PlantStateRequestActionState,
        FormData
    >(requestPlantStateChangeAction, null);
    const allowedNextStatuses = currentStatus
        ? (userAllowedPlantStatusTransitions[currentStatus] ?? [])
        : [];
    const items = useMemo(
        () =>
            allowedNextStatuses.map((status) => ({
                value: status,
                label: plantFieldStatusLabel(status).shortLabel,
            })),
        [allowedNextStatuses],
    );
    const defaultValue = items[0]?.value;

    if (pendingRequestedStatus) {
        return (
            <Typography level="body3" className="text-amber-700">
                Čeka odobrenje
            </Typography>
        );
    }

    if (!currentStatus || items.length === 0 || !defaultValue) {
        return (
            <Typography level="body3" className="text-muted-foreground">
                Nema promjene
            </Typography>
        );
    }

    return (
        <form action={formAction} className="min-w-48">
            <input type="hidden" name="raisedBedId" value={raisedBedId} />
            <input type="hidden" name="positionIndex" value={positionIndex} />
            <Stack spacing={1}>
                <SelectItems
                    name="status"
                    defaultValue={defaultValue}
                    items={items}
                    aria-label="Novo stanje biljke"
                    searchable={false}
                />
                <SubmitButton disabled={items.length === 0} />
                {state?.message && (
                    <Typography
                        level="body3"
                        className={
                            state.success ? 'text-green-700' : 'text-red-700'
                        }
                    >
                        {state.message}
                    </Typography>
                )}
            </Stack>
        </form>
    );
}
