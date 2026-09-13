'use client';

import { plantFieldStatusLabel } from '@gredice/js/plants';
import { Chip } from '@gredice/ui/Chip';
import { GamePlantStatusIcon } from '@gredice/ui/GameIcons';
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
    };
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
    const [open, setOpen] = useState(false);
    const [state, formAction, isPending] = useActionState<
        PlantStateRequestActionState,
        FormData
    >(requestPlantStateChangeAction, null);
    const groups = getPlantFieldStatusChangeGroups(currentStatus);

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
                <Chip
                    variant="outlined"
                    color="neutral"
                    size="sm"
                    disabled
                    className="whitespace-normal text-left"
                    onClick={() => {}}
                    startDecorator={
                        <GamePlantStatusIcon
                            status={currentStatus}
                            className="size-5! shrink-0"
                            aria-hidden
                        />
                    }
                >
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                        {currentStatusLabel}
                    </span>
                </Chip>
                <Chip
                    color="warning"
                    size="sm"
                    variant="outlined"
                    className="whitespace-normal text-left"
                    startDecorator={
                        <GamePlantStatusIcon
                            status={pendingRequestedStatus}
                            className="size-5! shrink-0"
                            aria-hidden
                        />
                    }
                >
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                        Čeka: {pendingStatusLabel}
                    </span>
                </Chip>
            </Stack>
        );
    }

    return (
        <Popper
            open={open}
            onOpenChange={setOpen}
            trigger={
                <Chip
                    variant="outlined"
                    color="neutral"
                    size="sm"
                    className="whitespace-normal text-left"
                    onClick={() => {}}
                    aria-label={`Promijeni stanje biljke. Trenutno stanje: ${currentStatusLabel}`}
                    startDecorator={
                        <GamePlantStatusIcon
                            status={currentStatus}
                            className="size-5! shrink-0"
                            aria-hidden
                        />
                    }
                >
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                        {currentStatusLabel}
                    </span>
                    <Down className="size-3 shrink-0" aria-hidden />
                </Chip>
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
                        <GamePlantStatusIcon
                            status={currentStatus}
                            className="size-5! shrink-0"
                            aria-hidden
                        />
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
                                            <GamePlantStatusIcon
                                                status={item.value}
                                                className="size-6 shrink-0"
                                                aria-hidden
                                            />
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
