'use client';

import type { DeliveryRunCompletionOverrideReason } from '@gredice/storage';
import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Chip } from '@gredice/ui/Chip';
import { Info, Warning } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { Typography } from '@gredice/ui/Typography';
import { useRef, useState } from 'react';
import { croatianCountLabel } from '../lib/croatianCount';
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

const overrideReasons = [
    {
        value: 'device-unavailable',
        label: 'Uređaj ili skener nisu dostupni',
    },
    {
        value: 'workflow-recovery',
        label: 'Oporavak prekinutog tijeka dostave',
    },
    {
        value: 'manual-handoff',
        label: 'Predaja je provjerena ručno',
    },
    {
        value: 'other-operational',
        label: 'Drugi operativni razlog',
    },
] satisfies Array<{
    value: DeliveryRunCompletionOverrideReason;
    label: string;
}>;

function legacyRecipientCount(deliveries: DeliveryStopDeliverySummary[]) {
    return new Set(
        deliveries.map((delivery) => {
            const name = delivery.contactName.trim().toLocaleLowerCase('hr');
            const phoneDigits = delivery.phone?.replace(/\D/g, '') ?? '';
            const phone = phoneDigits.startsWith('385')
                ? phoneDigits.slice(3)
                : phoneDigits.startsWith('0')
                  ? phoneDigits.slice(1)
                  : phoneDigits;
            if (name) return `name:${name}`;
            return phone ? `phone:${phone}` : `request:${delivery.requestId}`;
        }),
    ).size;
}

function completionOverrideReason(
    value: string,
): DeliveryRunCompletionOverrideReason | null {
    switch (value) {
        case 'device-unavailable':
        case 'workflow-recovery':
        case 'manual-handoff':
        case 'other-operational':
            return value;
        default:
            return null;
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
    const [overrideReason, setOverrideReason] =
        useState<DeliveryRunCompletionOverrideReason | null>(null);
    const submittingRef = useRef(false);
    const busy = submitting || Boolean(confirmation.pending);
    const summaryLoading = handoffSyncState === 'loading';
    const overrideRequired = confirmation.overrideBypasses.length > 0;
    const recipients =
        confirmation.recipientCount ?? legacyRecipientCount(deliveries);

    function changeOpen(open: boolean) {
        if (!open) {
            setError(null);
            setOverrideReason(null);
            requestAnimationFrame(() =>
                confirmation.returnFocusRef?.current?.focus(),
            );
        }
        confirmation.onOpenChange(open);
    }

    async function confirmDelivery() {
        if (submittingRef.current || busy) return;
        if (overrideRequired && !overrideReason) return;
        submittingRef.current = true;
        setSubmitting(true);
        setError(null);
        try {
            const result = await confirmation.onConfirm(
                overrideReason ? { reason: overrideReason } : undefined,
            );
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
            submittingRef.current = false;
            setSubmitting(false);
        }
    }

    return (
        <Modal
            open={confirmation.open}
            onOpenChange={changeOpen}
            title="Potvrdi dostavu"
            description="Pregledaj primatelje, urode i zabilježene ishode prije konačne potvrde dostave."
            dismissible={!busy}
            className="motion-reduce:transition-none md:max-w-xl"
        >
            <form
                className="space-y-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    void confirmDelivery();
                }}
            >
                <div
                    className="pr-8"
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                    aria-busy={summaryLoading || busy}
                >
                    <Typography level="h3" semiBold>
                        {overrideRequired
                            ? 'Dostava zahtijeva operativnu iznimku'
                            : 'Sažetak skupne predaje'}
                    </Typography>
                    <Typography
                        level="body3"
                        className="mt-1 text-muted-foreground"
                    >
                        {croatianCountLabel(
                            recipients,
                            'primatelj',
                            'primatelja',
                            'primatelja',
                        )}{' '}
                        ·{' '}
                        {croatianCountLabel(
                            summary.expectedCount,
                            'očekivani urod',
                            'očekivana uroda',
                            'očekivanih uroda',
                        )}
                        {' · '}
                        {confirmation.arrived
                            ? 'dolazak potvrđen'
                            : 'dolazak nije potvrđen'}
                    </Typography>
                    <span className="sr-only">
                        {summary.scannedCount} provjereno,{' '}
                        {summary.unverifiedCount} neskenirano,{' '}
                        {summary.noLabelCount} bez etikete,{' '}
                        {croatianCountLabel(
                            summary.exceptionCount,
                            'iznimka',
                            'iznimke',
                            'iznimki',
                        )}
                        .
                    </span>
                </div>

                {summaryLoading ? (
                    <div className="flex gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100">
                        <Info className="size-5 shrink-0" />
                        <span>
                            Spremljeni ishodi provjere još se učitavaju. Broj
                            primatelja i uroda dolazi iz trenutačne stanice.
                        </span>
                    </div>
                ) : (
                    <>
                        <fieldset
                            className="flex flex-wrap gap-2"
                            aria-label="Sažetak za potvrdu dostave"
                        >
                            <Chip color="neutral" size="sm">
                                Očekivano: {summary.expectedCount}
                            </Chip>
                            <Chip color="success" size="sm">
                                {summary.scannedCount} provjereno
                            </Chip>
                            <Chip color="neutral" size="sm">
                                {summary.unverifiedCount} neskenirano
                            </Chip>
                            <Chip color="warning" size="sm">
                                {summary.noLabelCount} bez etikete
                            </Chip>
                            <Chip
                                color={
                                    summary.exceptionCount > 0
                                        ? 'warning'
                                        : 'neutral'
                                }
                                size="sm"
                            >
                                {croatianCountLabel(
                                    summary.exceptionCount,
                                    'iznimka',
                                    'iznimke',
                                    'iznimki',
                                )}
                            </Chip>
                        </fieldset>

                        {summary.exceptionCount > 0 ? (
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                Iznimke: {summary.missingCount} nedostaje ·{' '}
                                {summary.skippedCount} preskočeno
                            </Typography>
                        ) : null}

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

                {overrideRequired ? (
                    <section className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
                        <div className="flex gap-2">
                            <Warning className="size-5 shrink-0" />
                            <div className="space-y-1 text-sm">
                                <p className="font-semibold">
                                    Ova potvrda zaobilazi uobičajenu provjeru.
                                </p>
                                <p>
                                    {confirmation.overrideBypasses.includes(
                                        'arrival',
                                    )
                                        ? 'Dolazak nije zabilježen. '
                                        : ''}
                                    {confirmation.overrideBypasses.includes(
                                        'handoff-review',
                                    )
                                        ? 'Manifest nije u potpunosti pregledan ili potvrđen. '
                                        : ''}
                                    QR je i dalje neobavezan, ali razlog iznimke
                                    ostat će u revizijskom zapisu.
                                </p>
                            </div>
                        </div>
                        <label className="block text-sm font-medium">
                            Razlog operativne iznimke
                            <select
                                className="mt-1 min-h-11 w-full rounded-md border bg-background px-3 py-2 text-base text-foreground outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                                value={overrideReason ?? ''}
                                disabled={busy}
                                required
                                onChange={(event) =>
                                    setOverrideReason(
                                        completionOverrideReason(
                                            event.target.value,
                                        ),
                                    )
                                }
                            >
                                <option value="">Odaberi razlog</option>
                                {overrideReasons.map((reason) => (
                                    <option
                                        key={reason.value}
                                        value={reason.value}
                                    >
                                        {reason.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </section>
                ) : null}

                <div className="flex gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100">
                    <Info className="size-5 shrink-0" />
                    <span>
                        QR provjera je pomoćna. Dostavu možeš potvrditi i kada
                        etiketa ili skeniranje nisu dostupni.
                    </span>
                </div>

                {!summaryLoading && summary.unverifiedCount > 0 ? (
                    <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                        <Warning className="size-5 shrink-0" />
                        <span>
                            {summary.unverifiedCount}{' '}
                            {summary.unverifiedCount === 1
                                ? 'urod ostaje bez zabilježene provjere.'
                                : 'uroda ostaju bez zabilježene provjere.'}
                        </span>
                    </div>
                ) : null}

                {summary.pendingCount > 0 || handoffSyncState === 'failed' ? (
                    <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                        <Warning className="size-5 shrink-0" />
                        <span>
                            {handoffSyncState === 'failed'
                                ? 'Sinkronizacija nekih provjera nije uspjela. Dostavu i dalje možeš potvrditi.'
                                : `${summary.pendingCount} ${summary.pendingCount === 1 ? 'promjena čeka' : 'promjene čekaju'} potvrdu poslužitelja. Dostavu i dalje možeš potvrditi.`}
                        </span>
                    </div>
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

                <div className="sticky bottom-0 -mx-1 flex flex-col-reverse gap-2 border-t bg-background/95 px-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:justify-end sm:px-0 sm:pb-0">
                    <Button
                        type="button"
                        size="lg"
                        variant="plain"
                        className="w-full motion-reduce:transition-none sm:w-auto"
                        disabled={busy}
                        onClick={() => changeOpen(false)}
                    >
                        Natrag
                    </Button>
                    <Button
                        type="submit"
                        size="lg"
                        color="success"
                        className="w-full motion-reduce:transition-none sm:w-auto"
                        loading={busy}
                        disabled={
                            busy ||
                            Boolean(confirmation.disabled) ||
                            (overrideRequired && !overrideReason)
                        }
                    >
                        {busy
                            ? 'Spremanje dostave…'
                            : overrideRequired
                              ? 'Potvrdi iznimku i dostavu'
                              : 'Potvrdi dostavu i nastavi'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
