'use client';

import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Chip } from '@gredice/ui/Chip';
import { Info, Warning } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { Typography } from '@gredice/ui/Typography';
import { useState } from 'react';
import type { DeliveryStopDeliverySummary } from '../lib/deliveryDashboardTypes';
import { isDriverCommandResult } from '../lib/driverCommandResult';
import type {
    DeliveryHandoffCompletionConfirmation,
    DeliveryHandoffManifestItemView,
    DeliveryHandoffManifestView,
    DeliveryHandoffSummary,
} from './DeliveryHarvestVerification';

function matchingDelivery(
    deliveries: DeliveryStopDeliverySummary[],
    item: DeliveryHandoffManifestItemView,
) {
    return (
        deliveries.find(
            (delivery) => delivery.requestId === item.deliveryRequestId,
        ) ?? deliveries.find((delivery) => delivery.stopId === item.stopId)
    );
}

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

export function DeliveryHandoffCompletionDialog({
    confirmation,
    deliveries,
    handoffSyncState,
    items,
    summary,
}: {
    confirmation: DeliveryHandoffCompletionConfirmation;
    deliveries: DeliveryStopDeliverySummary[];
    handoffSyncState: DeliveryHandoffManifestView['syncState'];
    items: DeliveryHandoffManifestItemView[];
    summary: DeliveryHandoffSummary;
}) {
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const busy = submitting || Boolean(confirmation.pending);
    const summaryLoading = handoffSyncState === 'loading';

    function changeOpen(open: boolean) {
        if (!open) setError(null);
        confirmation.onOpenChange(open);
    }

    async function confirmDelivery() {
        setSubmitting(true);
        setError(null);
        try {
            const result = await confirmation.onConfirm();
            if (isDriverCommandResult(result) && result.status === 'failed') {
                setError(result.message);
                return;
            }
            confirmation.onOpenChange(false);
        } catch {
            setError(
                'Potvrdu dostave nije moguće sigurno spremiti. Pokušaj ponovno.',
            );
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Modal
            open={confirmation.open}
            onOpenChange={changeOpen}
            title="Potvrdi dostavu"
            description="Pregledaj zabilježene ishode provjere uroda prije potvrde skupne dostave."
            dismissible={!busy}
            className="md:max-w-xl"
        >
            <form
                className="space-y-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    void confirmDelivery();
                }}
            >
                <div className="pr-8">
                    <Typography level="h3" semiBold>
                        Sažetak predaje
                    </Typography>
                    <Typography
                        level="body3"
                        className="mt-1 text-muted-foreground"
                    >
                        {summaryLoading
                            ? 'Sažetak provjere još se učitava.'
                            : `${summary.expectedCount} ${
                                  summary.expectedCount === 1
                                      ? 'urod na ovoj stanici'
                                      : 'uroda na ovoj stanici'
                              }`}
                    </Typography>
                </div>

                {summaryLoading ? (
                    <Alert
                        color="info"
                        startDecorator={<Info className="size-5" />}
                    >
                        Spremljeni ishodi provjere još se učitavaju. Dostavu i
                        dalje možeš potvrditi bez čekanja.
                    </Alert>
                ) : (
                    <>
                        <fieldset
                            className="flex flex-wrap gap-2"
                            aria-label="Sažetak za potvrdu dostave"
                        >
                            <Chip color="success" size="sm">
                                {summary.scannedCount} provjereno
                            </Chip>
                            <Chip color="neutral" size="sm">
                                {summary.unverifiedCount} bez provjere
                            </Chip>
                            <Chip color="warning" size="sm">
                                {summary.noLabelCount} bez etikete
                            </Chip>
                            <Chip color="error" size="sm">
                                {summary.missingCount} nedostaje
                            </Chip>
                            <Chip color="warning" size="sm">
                                {summary.skippedCount} preskočeno
                            </Chip>
                        </fieldset>

                        <ul
                            className="max-h-52 space-y-2 overflow-y-auto"
                            aria-label="Ishodi uroda za potvrdu dostave"
                        >
                            {items.map((item) => {
                                const delivery = matchingDelivery(
                                    deliveries,
                                    item,
                                );
                                return (
                                    <li
                                        key={item.stopId}
                                        className="flex items-center justify-between gap-3 rounded-md bg-muted/70 px-3 py-2"
                                    >
                                        <span className="min-w-0 truncate text-sm">
                                            {delivery?.harvest.plantName ??
                                                'Urod na ovoj stanici'}
                                            {delivery
                                                ? ` · ${delivery.contactName}`
                                                : ''}
                                        </span>
                                        <Chip
                                            color={itemStateColor(item.state)}
                                            size="sm"
                                        >
                                            {itemStateLabel(item.state)}
                                        </Chip>
                                    </li>
                                );
                            })}
                        </ul>
                    </>
                )}

                <Alert
                    color="info"
                    startDecorator={<Info className="size-5" />}
                >
                    QR provjera je pomoćna i ne blokira dostavu. Dostavu možeš
                    potvrditi s neprovjerenim, preskočenim ili nepotvrđenim
                    promjenama.
                </Alert>

                {!summaryLoading && summary.unverifiedCount > 0 ? (
                    <Alert
                        color="warning"
                        startDecorator={<Warning className="size-5" />}
                    >
                        {summary.unverifiedCount}{' '}
                        {summary.unverifiedCount === 1
                            ? 'urod ostaje bez zabilježene provjere.'
                            : 'uroda ostaju bez zabilježene provjere.'}
                    </Alert>
                ) : null}

                {summary.pendingCount > 0 || handoffSyncState === 'failed' ? (
                    <Alert
                        color="warning"
                        startDecorator={<Warning className="size-5" />}
                    >
                        {handoffSyncState === 'failed'
                            ? 'Sinkronizacija nekih provjera nije uspjela. Dostavu i dalje možeš potvrditi.'
                            : `${summary.pendingCount} ${summary.pendingCount === 1 ? 'promjena čeka' : 'promjene čekaju'} potvrdu poslužitelja. Dostavu i dalje možeš potvrditi.`}
                    </Alert>
                ) : null}

                {error ? (
                    <Alert
                        color="danger"
                        role="alert"
                        aria-live="assertive"
                        startDecorator={<Warning className="size-5" />}
                    >
                        {error}
                    </Alert>
                ) : null}

                <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                    <Button
                        type="button"
                        variant="plain"
                        disabled={busy}
                        onClick={() => changeOpen(false)}
                    >
                        Natrag
                    </Button>
                    <Button
                        type="submit"
                        color="success"
                        loading={busy}
                        disabled={busy || Boolean(confirmation.disabled)}
                    >
                        Potvrdi dostavu i nastavi
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
