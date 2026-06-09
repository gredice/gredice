'use client';

import {
    plantFieldStatusEmoji,
    plantFieldStatusLabel,
} from '@gredice/js/plants';
import { Button } from '@gredice/ui/Button';
import { Chip } from '@gredice/ui/Chip';
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
import { getPlantFieldStatusChangeGroups } from './plantStatusOptions';

function getStatusButtonLabel(status: string) {
    return plantFieldStatusLabel(status).shortLabel;
}

function getStatusOptionLabel(status: string) {
    const statusLabel = plantFieldStatusLabel(status).shortLabel;

    return {
        value: status,
        label: statusLabel,
        icon: plantFieldStatusEmoji(status),
    };
}

export function PlantStateRequestForm({
    raisedBedId,
    positionIndex,
    currentStatus,
    pendingRequestedStatus,
    allowedStatuses,
}: {
    raisedBedId: number;
    positionIndex: number;
    currentStatus?: string | null;
    pendingRequestedStatus?: string | null;
    allowedStatuses?: readonly string[];
}) {
    const [open, setOpen] = useState(false);
    const [state, formAction, isPending] = useActionState<
        PlantStateRequestActionState,
        FormData
    >(requestPlantStateChangeAction, null);
    const groups = getPlantFieldStatusChangeGroups(
        currentStatus,
        allowedStatuses,
    );

    useEffect(() => {
        if (state?.success) {
            setOpen(false);
        }
    }, [state]);

    if (!currentStatus || groups.length === 0) {
        return (
            <Typography level="body3" className="text-muted-foreground">
                —
            </Typography>
        );
    }

    const currentStatusLabel = getStatusButtonLabel(currentStatus);

    if (pendingRequestedStatus) {
        const pendingStatusLabel = plantFieldStatusLabel(
            pendingRequestedStatus,
        ).shortLabel;

        return (
            <Stack spacing={1} className="items-start">
                <Button
                    type="button"
                    variant="plain"
                    color="neutral"
                    size="sm"
                    disabled
                    className="h-auto justify-start px-1 py-1 text-left"
                    startDecorator={
                        <span
                            className="text-base leading-none"
                            aria-hidden="true"
                        >
                            {plantFieldStatusEmoji(currentStatus)}
                        </span>
                    }
                >
                    {currentStatusLabel}
                </Button>
                <Chip color="warning" size="sm" variant="soft">
                    {plantFieldStatusEmoji(pendingRequestedStatus)} Čeka:{' '}
                    {pendingStatusLabel}
                </Chip>
            </Stack>
        );
    }

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
                    className="h-auto justify-start px-1 py-1 text-left"
                    aria-label={`Promijeni stanje biljke. Trenutno stanje: ${currentStatusLabel}`}
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
                    {currentStatusLabel}
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
                        {groups.map((group) => (
                            <div key={group.label} className="contents">
                                <Typography
                                    level="body3"
                                    className="bg-muted/50 px-3 py-1.5 font-medium text-muted-foreground"
                                >
                                    {group.label}
                                </Typography>
                                {group.statuses.map((status) => {
                                    const item = getStatusOptionLabel(status);

                                    return (
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
                                    );
                                })}
                            </div>
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
