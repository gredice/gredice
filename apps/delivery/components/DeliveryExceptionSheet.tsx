'use client';

import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Checkbox } from '@gredice/ui/Checkbox';
import { Chip } from '@gredice/ui/Chip';
import { Mail, Mobile, Reset, Warning } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { Typography } from '@gredice/ui/Typography';
import { type FormEvent, useState } from 'react';
import type {
    DeliveryExceptionOutcome,
    DeliveryExceptionReason,
    DeliveryStopSummary,
} from '../lib/deliveryDashboardTypes';
import {
    actionableDeliveryExceptionItems,
    buildDeliveryExceptionMutation,
    type DeliveryExceptionMutation,
    type DeliveryExceptionSubmitResult,
    deliveryDispatchContactHref,
    deliveryExceptionItemIdentityLabels,
    deliveryExceptionOutcomeOptions,
    deliveryExceptionReasonOptions,
} from '../lib/deliveryExceptionPresentation';

export function DeliveryExceptionSheet({
    runId,
    routeRevision,
    stop,
    disabled,
    onSubmit,
}: {
    runId: string;
    routeRevision: number;
    stop: DeliveryStopSummary;
    disabled: boolean;
    onSubmit: (
        mutation: DeliveryExceptionMutation,
    ) => Promise<DeliveryExceptionSubmitResult>;
}) {
    const actionableDeliveries = actionableDeliveryExceptionItems(
        stop.deliveries,
    );
    const deliveryIdentityLabels =
        deliveryExceptionItemIdentityLabels(actionableDeliveries);
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState<DeliveryExceptionReason>(
        'customer-unavailable',
    );
    const [outcome, setOutcome] =
        useState<Exclude<DeliveryExceptionOutcome, 'cancelled'>>('deferred');
    const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
    const [note, setNote] = useState('');
    const [pendingMutation, setPendingMutation] =
        useState<DeliveryExceptionMutation | null>(null);
    const [terminalConfirmed, setTerminalConfirmed] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [validationMessage, setValidationMessage] = useState<string | null>(
        null,
    );
    const mutationPending = disabled || submitting;
    const effectiveOutcome: DeliveryExceptionOutcome =
        reason === 'cancellation' ? 'cancelled' : outcome;
    const selectedDeliveries = actionableDeliveries.filter((delivery) =>
        selectedRequestIds.includes(delivery.requestId),
    );
    const terminalOutcome = effectiveOutcome !== 'deferred';

    function resetDraft() {
        setReason('customer-unavailable');
        setOutcome('deferred');
        setSelectedRequestIds(
            actionableDeliveries.length === 1
                ? actionableDeliveries.map((delivery) => delivery.requestId)
                : [],
        );
        setNote('');
        setPendingMutation(null);
        setTerminalConfirmed(false);
        setValidationMessage(null);
    }

    function handleOpenChange(nextOpen: boolean) {
        if (mutationPending) return;
        if (nextOpen) resetDraft();
        setOpen(nextOpen);
    }

    function invalidatePendingOperation() {
        setPendingMutation(null);
        setTerminalConfirmed(false);
        setValidationMessage(null);
    }

    function toggleDelivery(requestId: string, checked: boolean) {
        invalidatePendingOperation();
        setSelectedRequestIds((current) =>
            checked
                ? Array.from(new Set([...current, requestId]))
                : current.filter((candidate) => candidate !== requestId),
        );
    }

    async function submitException(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (mutationPending) return;

        let mutation = pendingMutation;
        if (!mutation) {
            const result = buildDeliveryExceptionMutation({
                deliveries: actionableDeliveries,
                selectedRequestIds,
                outcome,
                reason,
                note,
                expectedRouteRevision: routeRevision,
                clientOperationId: crypto.randomUUID(),
                occurredAt: new Date().toISOString(),
            });
            if (result.status === 'invalid') {
                setValidationMessage(result.message);
                return;
            }
            if (terminalOutcome && !terminalConfirmed) {
                setValidationMessage(
                    'Potvrdi završni ishod za točno navedene urode prije spremanja.',
                );
                return;
            }
            mutation = result.mutation;
            setPendingMutation(mutation);
        }

        setSubmitting(true);
        setValidationMessage(null);
        try {
            const result = await onSubmit(mutation);
            if (result.status === 'saved') {
                setOpen(false);
                resetDraft();
                return;
            }
            if (result.status === 'review-required') {
                setPendingMutation(null);
                setTerminalConfirmed(false);
            }
            setValidationMessage(result.message);
        } catch {
            setValidationMessage(
                'Promjena je možda spremljena. Provjeri vezu i pokušaj ponovno bez izmjene odabira.',
            );
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Modal
            open={open}
            onOpenChange={handleOpenChange}
            title="Prijavi problem s dostavom"
            description="Odaberi pogođene urode, zabilježi razlog i jasno odredi hoće li se dostava pokušati ponovno."
            dismissible={!mutationPending}
            className="md:max-w-2xl"
            trigger={
                <Button
                    color="warning"
                    variant="outlined"
                    disabled={disabled || actionableDeliveries.length === 0}
                    startDecorator={<Warning className="size-4" />}
                >
                    Prijavi problem
                </Button>
            }
        >
            <form className="space-y-5" onSubmit={submitException}>
                <div className="pr-8">
                    <Typography level="h3" semiBold>
                        Problem na trenutačnoj stanici
                    </Typography>
                    <Typography
                        level="body3"
                        className="mt-1 text-muted-foreground"
                    >
                        Odaberi samo urode na koje se problem odnosi. Ostali
                        urodi na skupnoj stanici ostaju spremni za predaju.
                    </Typography>
                </div>

                <fieldset className="space-y-2" disabled={mutationPending}>
                    <legend className="text-sm font-semibold">
                        Pogođeni urodi
                    </legend>
                    {actionableDeliveries.length > 1 ? (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/60 px-3 py-2">
                            <Typography level="body3">
                                Skupna stanica · odabrano{' '}
                                {selectedDeliveries.length} od{' '}
                                {actionableDeliveries.length}
                            </Typography>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="plain"
                                    onClick={() => {
                                        invalidatePendingOperation();
                                        setSelectedRequestIds(
                                            actionableDeliveries.map(
                                                (delivery) =>
                                                    delivery.requestId,
                                            ),
                                        );
                                    }}
                                >
                                    Odaberi sve
                                </Button>
                                {selectedRequestIds.length > 0 ? (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="plain"
                                        onClick={() => {
                                            invalidatePendingOperation();
                                            setSelectedRequestIds([]);
                                        }}
                                    >
                                        Poništi odabir
                                    </Button>
                                ) : null}
                            </div>
                        </div>
                    ) : null}
                    <ul
                        className="space-y-2"
                        aria-label="Urodi obuhvaćeni problemom"
                    >
                        {actionableDeliveries.map((delivery) => {
                            const checked = selectedRequestIds.includes(
                                delivery.requestId,
                            );
                            const identityLabel =
                                deliveryIdentityLabels.get(
                                    delivery.requestId,
                                ) ?? delivery.harvest.plantName;
                            return (
                                <li
                                    key={delivery.requestId}
                                    className="flex min-h-12 flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <Checkbox
                                        checked={checked}
                                        disabled={mutationPending}
                                        label={
                                            <span className="block min-w-0">
                                                <span className="block font-semibold break-words">
                                                    {identityLabel}
                                                </span>
                                            </span>
                                        }
                                        onCheckedChange={(value) =>
                                            toggleDelivery(
                                                delivery.requestId,
                                                value === true,
                                            )
                                        }
                                    />
                                    {delivery.phone ? (
                                        <Button
                                            href={`tel:${delivery.phone}`}
                                            size="sm"
                                            variant="plain"
                                            aria-label={`Nazovi kontakt za ${identityLabel}`}
                                            startDecorator={
                                                <Mobile className="size-4" />
                                            }
                                        >
                                            Nazovi
                                        </Button>
                                    ) : null}
                                </li>
                            );
                        })}
                    </ul>
                </fieldset>

                <fieldset className="space-y-2" disabled={mutationPending}>
                    <legend className="text-sm font-semibold">
                        Što se dogodilo?
                    </legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {deliveryExceptionReasonOptions.map((option) => (
                            <label
                                key={option.value}
                                className={`flex min-h-16 cursor-pointer flex-col justify-center rounded-lg border px-3 py-2 transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${
                                    reason === option.value
                                        ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                                        : 'bg-background hover:bg-muted/60'
                                }`}
                            >
                                <input
                                    className="sr-only"
                                    type="radio"
                                    name="delivery-exception-reason"
                                    value={option.value}
                                    checked={reason === option.value}
                                    onChange={() => {
                                        invalidatePendingOperation();
                                        setReason(option.value);
                                    }}
                                />
                                <span className="text-sm font-semibold">
                                    {option.label}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {option.description}
                                </span>
                            </label>
                        ))}
                    </div>
                </fieldset>

                {reason === 'cancellation' ? (
                    <Alert
                        color="danger"
                        startDecorator={<Warning className="size-5" />}
                    >
                        Otkazivanje je terminalno. Odabrani urodi uklanjaju se
                        iz aktivne dostave i neće dobiti ponovni pokušaj.
                    </Alert>
                ) : (
                    <fieldset className="space-y-2" disabled={mutationPending}>
                        <legend className="text-sm font-semibold">
                            Što slijedi?
                        </legend>
                        <div className="grid gap-2 sm:grid-cols-2">
                            {deliveryExceptionOutcomeOptions.map((option) => (
                                <label
                                    key={option.value}
                                    className={`flex min-h-20 cursor-pointer flex-col justify-center rounded-lg border px-3 py-2 transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${
                                        outcome === option.value
                                            ? option.terminal
                                                ? 'border-red-400 bg-red-50 ring-1 ring-red-300 dark:bg-red-950'
                                                : 'border-amber-400 bg-amber-50 ring-1 ring-amber-300 dark:bg-amber-950'
                                            : 'bg-background hover:bg-muted/60'
                                    }`}
                                >
                                    <input
                                        className="sr-only"
                                        type="radio"
                                        name="delivery-exception-outcome"
                                        value={option.value}
                                        checked={outcome === option.value}
                                        onChange={() => {
                                            invalidatePendingOperation();
                                            setOutcome(option.value);
                                        }}
                                    />
                                    <span className="flex items-center gap-2 text-sm font-semibold">
                                        {option.value === 'deferred' ? (
                                            <Reset className="size-4" />
                                        ) : (
                                            <Warning className="size-4" />
                                        )}
                                        {option.label}
                                        <Chip
                                            color={
                                                option.terminal
                                                    ? 'error'
                                                    : 'warning'
                                            }
                                            size="sm"
                                        >
                                            {option.terminal
                                                ? 'Terminalno'
                                                : 'Ponovni pokušaj'}
                                        </Chip>
                                    </span>
                                    <span className="mt-1 text-xs text-muted-foreground">
                                        {option.description}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </fieldset>
                )}

                <div className="space-y-1">
                    <label
                        className="block text-sm font-semibold"
                        htmlFor={`delivery-exception-note-${stop.id ?? stop.requestId}`}
                    >
                        Operativna napomena
                        {reason === 'operational-other'
                            ? ' (obavezno)'
                            : ' (opcionalno)'}
                    </label>
                    <textarea
                        id={`delivery-exception-note-${stop.id ?? stop.requestId}`}
                        value={note}
                        onChange={(event) => {
                            invalidatePendingOperation();
                            setNote(event.currentTarget.value);
                        }}
                        rows={3}
                        maxLength={1_000}
                        disabled={mutationPending}
                        aria-describedby={`delivery-exception-note-help-${stop.id ?? stop.requestId}`}
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                        placeholder="Informacije korisne dispečeru (ne prikazuju se korisniku)"
                    />
                    <Typography
                        id={`delivery-exception-note-help-${stop.id ?? stop.requestId}`}
                        level="body3"
                        className="text-muted-foreground"
                    >
                        Napomena je interna i korisnik je neće vidjeti.{' '}
                        {note.length}
                        /1000
                    </Typography>
                </div>

                {effectiveOutcome === 'failed' ? (
                    <Alert
                        color="danger"
                        startDecorator={<Warning className="size-5" />}
                    >
                        Ovo je završni ishod za odabrane urode. Provjeri odabir
                        prije spremanja.
                    </Alert>
                ) : null}

                {terminalOutcome && selectedDeliveries.length > 0 ? (
                    <div className="space-y-3 rounded-lg border border-red-300 bg-red-50 p-3 text-red-950 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
                        <div>
                            <Typography level="body2" semiBold>
                                Potvrdi završni ishod za{' '}
                                {selectedDeliveries.length}{' '}
                                {selectedDeliveries.length === 1
                                    ? 'urod'
                                    : 'uroda'}
                            </Typography>
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                                {selectedDeliveries.map((delivery) => (
                                    <li key={delivery.requestId}>
                                        {deliveryIdentityLabels.get(
                                            delivery.requestId,
                                        ) ?? delivery.harvest.plantName}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <Checkbox
                            checked={terminalConfirmed}
                            disabled={mutationPending}
                            label="Potvrđujem da samo navedeni urodi dobivaju završni ishod."
                            onCheckedChange={(value) => {
                                setPendingMutation(null);
                                setValidationMessage(null);
                                setTerminalConfirmed(value === true);
                            }}
                        />
                    </div>
                ) : null}

                {validationMessage ? (
                    <Alert
                        color="warning"
                        aria-live="assertive"
                        startDecorator={<Warning className="size-5" />}
                    >
                        {validationMessage}
                    </Alert>
                ) : null}

                <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <Button
                        href={deliveryDispatchContactHref({
                            runId,
                            stopId: stop.id,
                        })}
                        variant="plain"
                        startDecorator={<Mail className="size-4" />}
                    >
                        Javi se dispečeru
                    </Button>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row">
                        <Button
                            type="button"
                            variant="plain"
                            disabled={mutationPending}
                            onClick={() => handleOpenChange(false)}
                        >
                            Odustani
                        </Button>
                        <Button
                            type="submit"
                            color={
                                effectiveOutcome === 'deferred'
                                    ? 'warning'
                                    : 'danger'
                            }
                            loading={submitting}
                            disabled={mutationPending}
                        >
                            {effectiveOutcome === 'deferred'
                                ? 'Spremi i nastavi rutu'
                                : 'Potvrdi završni ishod'}
                        </Button>
                    </div>
                </div>
            </form>
        </Modal>
    );
}
