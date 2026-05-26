'use client';

import {
    plantFieldStatusEmoji,
    plantFieldStatusLabel,
    userAllowedPlantStatusTransitions,
} from '@gredice/js/plants';
import { Button } from '@gredice/ui/Button';
import { Down } from '@gredice/ui/icons';
import { List } from '@gredice/ui/List';
import { Popper } from '@gredice/ui/Popper';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useActionState, useEffect, useState } from 'react';
import {
    type PlantStateRequestActionState,
    requestPlantStateChangeAction,
} from './actions';

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
    const [open, setOpen] = useState(false);
    const [state, formAction, isPending] = useActionState<
        PlantStateRequestActionState,
        FormData
    >(requestPlantStateChangeAction, null);
    const allowedNextStatuses = currentStatus
        ? (userAllowedPlantStatusTransitions[currentStatus] ?? [])
        : [];
    const items = allowedNextStatuses.map((status) => ({
        value: status,
        label: plantFieldStatusLabel(status).shortLabel,
        icon: plantFieldStatusEmoji(status),
    }));

    useEffect(() => {
        if (state?.success) {
            setOpen(false);
        }
    }, [state]);

    if (pendingRequestedStatus) {
        const pendingStatusLabel = plantFieldStatusLabel(
            pendingRequestedStatus,
        ).shortLabel;

        return (
            <Row spacing={1} className="items-center text-amber-700">
                <span className="text-base leading-none" aria-hidden="true">
                    {plantFieldStatusEmoji(pendingRequestedStatus)}
                </span>
                <Typography level="body3">
                    Čeka odobrenje: {pendingStatusLabel}
                </Typography>
            </Row>
        );
    }

    if (!currentStatus || items.length === 0) {
        return (
            <Typography level="body3" className="text-muted-foreground">
                Nema promjene
            </Typography>
        );
    }

    const currentStatusLabel = plantFieldStatusLabel(currentStatus).shortLabel;

    return (
        <Popper
            open={open}
            onOpenChange={setOpen}
            trigger={
                <Button
                    type="button"
                    variant="plain"
                    color="primary"
                    size="sm"
                    aria-label={`Zatraži promjenu stanja biljke. Trenutno stanje: ${currentStatusLabel}`}
                    startDecorator={
                        <span
                            className="text-base leading-none"
                            aria-hidden="true"
                        >
                            {plantFieldStatusEmoji(currentStatus)}
                        </span>
                    }
                    endDecorator={
                        <Down className="size-3.5 shrink-0" aria-hidden />
                    }
                >
                    Promijeni stanje
                </Button>
            }
            side="bottom"
            align="start"
            sideOffset={8}
            className="w-72 p-3"
        >
            <form action={formAction} aria-busy={isPending}>
                <input type="hidden" name="raisedBedId" value={raisedBedId} />
                <input
                    type="hidden"
                    name="positionIndex"
                    value={positionIndex}
                />
                <Stack spacing={2}>
                    <Row spacing={1} className="items-center">
                        <span
                            className="text-base leading-none"
                            aria-hidden="true"
                        >
                            {plantFieldStatusEmoji(currentStatus)}
                        </span>
                        <Typography level="body3" secondary>
                            Trenutno: {currentStatusLabel}
                        </Typography>
                    </Row>
                    <List
                        variant="outlined"
                        className="bg-card overflow-hidden"
                    >
                        {items.map((item) => (
                            <button
                                key={item.value}
                                type="submit"
                                name="status"
                                value={item.value}
                                disabled={isPending}
                                className="flex h-auto w-full items-center justify-start gap-2 rounded-none bg-transparent px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
                                aria-label={`Zatraži promjenu u ${item.label}`}
                            >
                                <span
                                    className="w-7 text-center text-lg leading-none"
                                    aria-hidden="true"
                                >
                                    {item.icon}
                                </span>
                                <span className="min-w-0 grow font-medium">
                                    {item.label}
                                </span>
                            </button>
                        ))}
                    </List>
                    {state?.message && (
                        <Typography
                            level="body3"
                            className={
                                state.success
                                    ? 'text-green-700'
                                    : 'text-red-700'
                            }
                        >
                            {state.message}
                        </Typography>
                    )}
                </Stack>
            </form>
        </Popper>
    );
}
