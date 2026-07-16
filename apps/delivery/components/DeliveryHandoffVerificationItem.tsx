'use client';

import type { DeliveryRunHandoffSkipReason } from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import { Chip } from '@gredice/ui/Chip';
import { Typography } from '@gredice/ui/Typography';
import { useState } from 'react';
import type { DeliveryStopDeliverySummary } from '../lib/deliveryDashboardTypes';
import type {
    DeliveryHandoffManifestItemView,
    DeliveryHandoffMarkItemInput,
} from './DeliveryHarvestVerification';

const skipReasonOptions: Array<{
    value: DeliveryRunHandoffSkipReason;
    label: string;
}> = [
    { value: 'label-unreadable', label: 'Etiketa nije čitljiva' },
    { value: 'scanner-unavailable', label: 'Skener nije dostupan' },
    { value: 'manual-verification', label: 'Ručno provjereno' },
    { value: 'other-operational', label: 'Drugi operativni razlog' },
];

function itemStateLabel(state: DeliveryHandoffManifestItemView['state']) {
    switch (state) {
        case 'scanned':
            return 'Provjereno';
        case 'unverified':
            return 'Nije provjereno';
        case 'no-label':
            return 'Bez etikete';
        case 'missing':
            return 'Nedostaje';
        case 'skipped':
            return 'Preskočeno';
    }
}

function itemStateColor(
    state: DeliveryHandoffManifestItemView['state'],
): 'success' | 'error' | 'warning' | 'neutral' {
    switch (state) {
        case 'scanned':
            return 'success';
        case 'missing':
            return 'error';
        case 'no-label':
        case 'skipped':
            return 'warning';
        case 'unverified':
            return 'neutral';
    }
}

function skipReasonLabel(reason: DeliveryRunHandoffSkipReason | null) {
    return skipReasonOptions.find((option) => option.value === reason)?.label;
}

function itemSyncLabel(
    syncState: DeliveryHandoffManifestItemView['syncState'],
) {
    switch (syncState) {
        case 'queued':
            return 'Čeka slanje';
        case 'sending':
            return 'Šalje se';
        case 'failed':
            return 'Slanje nije uspjelo';
        case 'persisted':
        case undefined:
            return null;
    }
}

export function DeliveryHandoffVerificationItem({
    compact,
    delivery,
    disabled,
    item,
    pendingAction,
    onMarkItem,
    onRunAction,
}: {
    compact: boolean;
    delivery: DeliveryStopDeliverySummary | undefined;
    disabled: boolean;
    item: DeliveryHandoffManifestItemView;
    pendingAction: string | null;
    onMarkItem?: (
        input: DeliveryHandoffMarkItemInput,
    ) => unknown | Promise<unknown>;
    onRunAction: (
        key: string,
        action: () => unknown | Promise<unknown>,
    ) => Promise<boolean>;
}) {
    const [editingOutcome, setEditingOutcome] = useState(false);
    const [skipReason, setSkipReason] = useState<DeliveryRunHandoffSkipReason>(
        item.reason ?? 'label-unreadable',
    );
    const identityLabel = delivery
        ? `${delivery.harvest.plantName} · ${delivery.contactName}`
        : 'Urod na ovoj stanici';
    const syncLabel = itemSyncLabel(item.syncState);
    const canCorrect =
        item.state === 'scanned' ||
        item.state === 'no-label' ||
        item.state === 'missing' ||
        item.state === 'skipped';
    const showEditor = item.state === 'unverified' || editingOutcome;
    const actionsDisabled = disabled || Boolean(pendingAction);

    function updateSkipReason(value: string) {
        const reason = skipReasonOptions.find(
            (option) => option.value === value,
        )?.value;
        if (reason) setSkipReason(reason);
    }

    async function mark(key: string, input: DeliveryHandoffMarkItemInput) {
        if (!onMarkItem) return;
        const saved = await onRunAction(key, () => onMarkItem(input));
        if (saved) setEditingOutcome(false);
    }

    return (
        <li
            className={`space-y-2 rounded-md bg-muted/70 ${compact ? 'px-2 py-2' : 'px-3 py-2'}`}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <Typography level="body3" semiBold className="truncate">
                        {delivery?.harvest.plantName ?? 'Urod na ovoj stanici'}
                    </Typography>
                    <Typography
                        level="body3"
                        className="truncate text-muted-foreground"
                    >
                        {delivery?.contactName ??
                            'Podaci o primatelju nisu dostupni'}
                    </Typography>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                    <Chip color={itemStateColor(item.state)} size="sm">
                        {itemStateLabel(item.state)}
                    </Chip>
                    {syncLabel ? (
                        <Chip
                            color={
                                item.syncState === 'failed' ? 'warning' : 'info'
                            }
                            size="sm"
                            variant="outlined"
                        >
                            {syncLabel}
                        </Chip>
                    ) : null}
                </div>
            </div>

            {item.state === 'skipped' && item.reason ? (
                <Typography level="body3" className="text-muted-foreground">
                    Razlog: {skipReasonLabel(item.reason)}
                </Typography>
            ) : null}

            {canCorrect && onMarkItem && !showEditor ? (
                <Button
                    type="button"
                    size="xs"
                    variant="plain"
                    disabled={actionsDisabled}
                    aria-label={`Promijeni ishod: ${identityLabel}`}
                    onClick={() => setEditingOutcome(true)}
                >
                    Promijeni ishod
                </Button>
            ) : null}

            {showEditor && onMarkItem ? (
                <div className="space-y-2 border-t pt-2">
                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            size="xs"
                            variant="outlined"
                            color="warning"
                            loading={
                                pendingAction === `no-label:${item.stopId}`
                            }
                            disabled={actionsDisabled}
                            aria-label={`Označi bez etikete: ${identityLabel}`}
                            onClick={() =>
                                void mark(`no-label:${item.stopId}`, {
                                    itemStopId: item.stopId,
                                    outcome: 'no-label',
                                })
                            }
                        >
                            Bez etikete
                        </Button>
                        <Button
                            type="button"
                            size="xs"
                            variant="outlined"
                            color="danger"
                            loading={pendingAction === `missing:${item.stopId}`}
                            disabled={actionsDisabled}
                            aria-label={`Označi da nedostaje: ${identityLabel}`}
                            onClick={() =>
                                void mark(`missing:${item.stopId}`, {
                                    itemStopId: item.stopId,
                                    outcome: 'missing',
                                })
                            }
                        >
                            Nedostaje
                        </Button>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                        <label className="min-w-0 flex-1 text-xs font-medium">
                            Razlog preskakanja
                            <select
                                className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                                value={skipReason}
                                disabled={actionsDisabled}
                                aria-label={`Razlog preskakanja za ${identityLabel}`}
                                onChange={(event) =>
                                    updateSkipReason(event.target.value)
                                }
                            >
                                {skipReasonOptions.map((option) => (
                                    <option
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <Button
                            type="button"
                            size="sm"
                            variant="outlined"
                            loading={pendingAction === `skipped:${item.stopId}`}
                            disabled={actionsDisabled}
                            aria-label={`Preskoči provjeru: ${identityLabel}`}
                            onClick={() =>
                                void mark(`skipped:${item.stopId}`, {
                                    itemStopId: item.stopId,
                                    outcome: 'skipped',
                                    reason: skipReason,
                                })
                            }
                        >
                            Preskoči
                        </Button>
                    </div>
                    {canCorrect ? (
                        <Button
                            type="button"
                            size="xs"
                            variant="plain"
                            disabled={actionsDisabled}
                            onClick={() => setEditingOutcome(false)}
                        >
                            Odustani od promjene
                        </Button>
                    ) : null}
                </div>
            ) : null}
        </li>
    );
}
