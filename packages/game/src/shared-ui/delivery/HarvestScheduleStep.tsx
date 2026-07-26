'use client';

import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Chip } from '@gredice/ui/Chip';
import { Input } from '@gredice/ui/Input';
import { Check, Edit, Info, Navigate } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
    createHarvestScheduleDateSelections,
    getSuggestedHarvestDate,
    type HarvestScheduleDateSelection,
    type HarvestScheduleItem,
    harvestCalendarDateKey,
    isHarvestDateWithinRange,
} from './harvestSchedule';

export type {
    HarvestScheduleDateSelection,
    HarvestScheduleItem,
    HarvestSchedulePlant,
} from './harvestSchedule';

export interface HarvestScheduleDeliverySummary {
    deliveryDate: string;
    mode: 'delivery' | 'pickup';
    startAt?: string;
    endAt?: string;
    slotStartAt?: string;
    slotEndAt?: string;
    destinationLabel?: string | null;
}

export interface HarvestScheduleStepProps {
    delivery: HarvestScheduleDeliverySummary;
    items: readonly HarvestScheduleItem[];
    onSelectedDatesChange: (
        selections: readonly HarvestScheduleDateSelection[],
    ) => void;
    onBack: () => void;
    onConfirm: (selections: readonly HarvestScheduleDateSelection[]) => void;
    confirmAction?: ReactNode;
    confirmDisabled?: boolean;
    confirmLabel?: string;
    isConfirming?: boolean;
}

const dateFormatter = new Intl.DateTimeFormat('hr-HR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Zagreb',
});

const timeFormatter = new Intl.DateTimeFormat('hr-HR', {
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    timeZone: 'Europe/Zagreb',
});

function formatCalendarDate(value: string | null) {
    const dateKey = harvestCalendarDateKey(value);
    if (!dateKey) {
        return 'Nepoznat datum';
    }

    return dateFormatter.format(new Date(`${dateKey}T12:00:00.000Z`));
}

function formatDeliveryWindow(startAt?: string, endAt?: string) {
    if (!startAt || !endAt) {
        return null;
    }

    const startDate = new Date(startAt);
    const endDate = new Date(endAt);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        return null;
    }

    return `${timeFormatter.format(startDate)} – ${timeFormatter.format(endDate)}`;
}

function plantRuleLabel(maxDays: number) {
    if (maxDays <= 0) {
        return 'isti dan';
    }

    return maxDays === 1
        ? 'do 1 dan ranije'
        : `do ${maxDays.toString()} dana ranije`;
}

function validationReasonLabel(item: HarvestScheduleItem) {
    const reason = item.validationReason ?? item.reason;
    switch (reason) {
        case 'missing_date':
            return 'Datum branja nije bio postavljen.';
        case 'invalid_date':
            return 'Postavljeni datum branja nije ispravan.';
        case 'before_allowed_range':
            return 'Postavljeni datum branja je prerano.';
        case 'after_delivery_date':
            return 'Branje ne može biti nakon dostave.';
        default:
            return item.reason ?? null;
    }
}

function scheduleSelectionKey(items: readonly HarvestScheduleItem[]) {
    return JSON.stringify(
        items.map((item) => [
            item.cartItemId,
            item.scheduledDate,
            item.allowedFrom,
            item.allowedTo,
            item.valid,
        ]),
    );
}

export function HarvestScheduleStep({
    delivery,
    items,
    onSelectedDatesChange,
    onBack,
    onConfirm,
    confirmAction,
    confirmDisabled = false,
    confirmLabel = 'Potvrdi i plati',
    isConfirming = false,
}: HarvestScheduleStepProps) {
    const selectedDatesChangeRef = useRef(onSelectedDatesChange);
    const lastScheduleKeyRef = useRef<string | null>(null);
    const currentScheduleKey = scheduleSelectionKey(items);
    const [selectedDates, setSelectedDates] = useState(() =>
        createHarvestScheduleDateSelections(items),
    );
    const [editFlexibleDates, setEditFlexibleDates] = useState(false);

    useEffect(() => {
        selectedDatesChangeRef.current = onSelectedDatesChange;
    }, [onSelectedDatesChange]);

    useEffect(() => {
        if (lastScheduleKeyRef.current === currentScheduleKey) {
            return;
        }

        lastScheduleKeyRef.current = currentScheduleKey;
        const nextSelections = createHarvestScheduleDateSelections(items);
        setSelectedDates(nextSelections);
        setEditFlexibleDates(false);
        selectedDatesChangeRef.current(nextSelections);
    }, [currentScheduleKey, items]);

    const selectedDateByItemId = useMemo(
        () =>
            new Map(
                selectedDates.map((selection) => [
                    selection.cartItemId,
                    selection.scheduledDate,
                ]),
            ),
        [selectedDates],
    );
    const allDatesValid = items.every((item) =>
        isHarvestDateWithinRange(
            selectedDateByItemId.get(item.cartItemId) ?? '',
            item,
        ),
    );
    const hasFlexibleDates = items.some(
        (item) =>
            harvestCalendarDateKey(item.allowedFrom) !==
            harvestCalendarDateKey(item.allowedTo),
    );
    const hasDatesToAdjust = !allDatesValid;
    const deliveryWindow = formatDeliveryWindow(
        delivery.slotStartAt ?? delivery.startAt,
        delivery.slotEndAt ?? delivery.endAt,
    );

    function handleDateChange(item: HarvestScheduleItem, date: string) {
        const nextSelections = selectedDates.map((selection) =>
            selection.cartItemId === item.cartItemId
                ? { ...selection, scheduledDate: date }
                : selection,
        );

        setSelectedDates(nextSelections);
        onSelectedDatesChange(nextSelections);
    }

    return (
        <Stack spacing={6}>
            <section
                aria-label={
                    delivery.mode === 'pickup'
                        ? 'Detalji preuzimanja'
                        : 'Detalji dostave'
                }
            >
                <div className="rounded-lg border bg-card/60 px-3 py-2.5">
                    <Stack spacing={2}>
                        <div>
                            <Typography level="body3" tertiary>
                                {deliveryWindow ? 'Datum i vrijeme' : 'Datum'}
                            </Typography>
                            <Typography level="body2" semiBold>
                                {formatCalendarDate(delivery.deliveryDate)}
                                {deliveryWindow ? ` · ${deliveryWindow}` : null}
                            </Typography>
                        </div>
                        {delivery.destinationLabel ? (
                            <div>
                                <Typography level="body3" tertiary>
                                    {delivery.mode === 'pickup'
                                        ? 'Mjesto preuzimanja'
                                        : 'Adresa dostave'}
                                </Typography>
                                <Typography level="body2" semiBold>
                                    {delivery.destinationLabel}
                                </Typography>
                            </div>
                        ) : null}
                    </Stack>
                </div>
            </section>

            <section aria-labelledby="harvest-schedule-title">
                <Stack spacing={4}>
                    <Row
                        className="min-w-0 flex-wrap"
                        justifyContent="space-between"
                        spacing={2}
                    >
                        <div className="min-w-0">
                            <Typography
                                component="h3"
                                id="harvest-schedule-title"
                                level="h6"
                                semiBold
                            >
                                Datumi branja
                            </Typography>
                            <Typography level="body3" tertiary>
                                Branje se planira prema svježini svake biljke.
                            </Typography>
                        </div>
                        {hasFlexibleDates &&
                        (allDatesValid || editFlexibleDates) ? (
                            <Button
                                aria-pressed={editFlexibleDates}
                                disabled={
                                    isConfirming ||
                                    (editFlexibleDates && !allDatesValid)
                                }
                                size="sm"
                                startDecorator={
                                    <Edit
                                        aria-hidden="true"
                                        className="size-4"
                                    />
                                }
                                variant="outlined"
                                onClick={() =>
                                    setEditFlexibleDates((editing) => !editing)
                                }
                            >
                                {editFlexibleDates
                                    ? 'Završi uređivanje'
                                    : 'Uredi datume'}
                            </Button>
                        ) : null}
                    </Row>

                    {hasDatesToAdjust ? (
                        <Alert
                            color="warning"
                            startDecorator={
                                <Info aria-hidden="true" className="size-5" />
                            }
                        >
                            Provjeri označene datume prije plaćanja. Za biljke
                            koje se moraju brati isti dan datum je već
                            postavljen na dan{' '}
                            {delivery.mode === 'pickup'
                                ? 'preuzimanja'
                                : 'dostave'}
                            .
                        </Alert>
                    ) : (
                        <Alert
                            color="success"
                            startDecorator={
                                <Check aria-hidden="true" className="size-5" />
                            }
                        >
                            Svi datumi branja usklađeni su s odabranim terminom{' '}
                            {delivery.mode === 'pickup'
                                ? 'preuzimanja'
                                : 'dostave'}
                            .
                        </Alert>
                    )}

                    <Stack spacing={3}>
                        {items.map((item) => {
                            const selectedDate =
                                selectedDateByItemId.get(item.cartItemId) ?? '';
                            const allowedFrom = harvestCalendarDateKey(
                                item.allowedFrom,
                            );
                            const allowedTo = harvestCalendarDateKey(
                                item.allowedTo,
                            );
                            const fixedToDeliveryDate =
                                allowedFrom !== null &&
                                allowedFrom === allowedTo;
                            const selectedDateValid = isHarvestDateWithinRange(
                                selectedDate,
                                item,
                            );
                            const suggestedDate = getSuggestedHarvestDate(
                                selectedDate,
                                item,
                            );
                            const showDateControl =
                                !fixedToDeliveryDate &&
                                (!selectedDateValid || editFlexibleDates);
                            const inputId = `harvest-date-${item.cartItemId.toString()}`;
                            const helpId = `${inputId}-help`;

                            return (
                                <article
                                    className="rounded-lg border bg-card p-3"
                                    key={item.cartItemId}
                                >
                                    <Stack spacing={3}>
                                        <Row
                                            className="min-w-0 flex-wrap"
                                            justifyContent="space-between"
                                            spacing={2}
                                        >
                                            <div className="min-w-0">
                                                <Typography
                                                    component="h4"
                                                    level="body2"
                                                    semiBold
                                                >
                                                    {item.operationLabel}
                                                </Typography>
                                                {item.raisedBedLabel ? (
                                                    <Typography
                                                        level="body3"
                                                        tertiary
                                                    >
                                                        {item.raisedBedLabel}
                                                    </Typography>
                                                ) : null}
                                            </div>
                                            <Chip
                                                color={
                                                    selectedDateValid
                                                        ? 'success'
                                                        : 'warning'
                                                }
                                                size="sm"
                                                variant="soft"
                                            >
                                                {formatCalendarDate(
                                                    selectedDate,
                                                )}
                                            </Chip>
                                        </Row>

                                        <Row className="flex-wrap" spacing={1}>
                                            {item.plants.map((plant) => (
                                                <Chip
                                                    key={
                                                        plant.id ??
                                                        `${item.cartItemId.toString()}-${plant.label}`
                                                    }
                                                    size="sm"
                                                    title={`${plant.label}: ${plantRuleLabel(plant.maxHarvestDaysBeforeDelivery)}`}
                                                    variant="outlined"
                                                >
                                                    {plant.label} ·{' '}
                                                    {plantRuleLabel(
                                                        plant.maxHarvestDaysBeforeDelivery,
                                                    )}
                                                </Chip>
                                            ))}
                                        </Row>

                                        {showDateControl ? (
                                            <div>
                                                {!selectedDateValid &&
                                                suggestedDate ? (
                                                    <Row
                                                        className="mb-2 min-w-0 flex-wrap"
                                                        justifyContent="space-between"
                                                        spacing={2}
                                                    >
                                                        <Typography
                                                            level="body3"
                                                            semiBold
                                                        >
                                                            Predloženi datum
                                                            branja:{' '}
                                                            {formatCalendarDate(
                                                                suggestedDate,
                                                            )}
                                                        </Typography>
                                                        <Button
                                                            aria-label={`Primijeni predloženi datum za ${item.operationLabel}`}
                                                            color="warning"
                                                            disabled={
                                                                isConfirming
                                                            }
                                                            size="sm"
                                                            variant="soft"
                                                            onClick={() =>
                                                                handleDateChange(
                                                                    item,
                                                                    suggestedDate,
                                                                )
                                                            }
                                                        >
                                                            Primijeni prijedlog
                                                        </Button>
                                                    </Row>
                                                ) : null}
                                                <Input
                                                    aria-describedby={helpId}
                                                    aria-invalid={
                                                        !selectedDateValid
                                                    }
                                                    disabled={isConfirming}
                                                    fullWidth
                                                    id={inputId}
                                                    label={`Datum branja za ${item.operationLabel}`}
                                                    max={allowedTo ?? undefined}
                                                    min={
                                                        allowedFrom ?? undefined
                                                    }
                                                    type="date"
                                                    value={selectedDate}
                                                    onChange={(event) =>
                                                        handleDateChange(
                                                            item,
                                                            event.target.value,
                                                        )
                                                    }
                                                />
                                                <Typography
                                                    component="p"
                                                    color={
                                                        selectedDateValid
                                                            ? undefined
                                                            : 'danger'
                                                    }
                                                    id={helpId}
                                                    level="body3"
                                                >
                                                    Odaberi datum od{' '}
                                                    {formatCalendarDate(
                                                        item.allowedFrom,
                                                    )}{' '}
                                                    do{' '}
                                                    {formatCalendarDate(
                                                        item.allowedTo,
                                                    )}
                                                    .
                                                    {!selectedDateValid
                                                        ? ' Odabrani datum nije dopušten.'
                                                        : ''}
                                                </Typography>
                                                {!selectedDateValid &&
                                                validationReasonLabel(item) ? (
                                                    <Typography
                                                        color="warning"
                                                        level="body3"
                                                    >
                                                        {validationReasonLabel(
                                                            item,
                                                        )}
                                                    </Typography>
                                                ) : null}
                                            </div>
                                        ) : (
                                            <Typography level="body3" tertiary>
                                                {fixedToDeliveryDate
                                                    ? `Branje je obavezno na dan ${delivery.mode === 'pickup' ? 'preuzimanja' : 'dostave'}.`
                                                    : `Planirano branje: ${formatCalendarDate(selectedDate)}.`}
                                            </Typography>
                                        )}
                                    </Stack>
                                </article>
                            );
                        })}
                    </Stack>
                </Stack>
            </section>

            <Row className="flex-wrap" justifyContent="end" spacing={4}>
                <Button
                    disabled={isConfirming}
                    variant="outlined"
                    onClick={onBack}
                >
                    Natrag
                </Button>
                {confirmAction ? (
                    <fieldset
                        className="contents"
                        disabled={
                            confirmDisabled || !allDatesValid || isConfirming
                        }
                    >
                        {confirmAction}
                    </fieldset>
                ) : (
                    <Button
                        disabled={
                            confirmDisabled || !allDatesValid || isConfirming
                        }
                        endDecorator={
                            <Navigate
                                aria-hidden="true"
                                className="size-5 shrink-0"
                            />
                        }
                        loading={isConfirming}
                        onClick={() => onConfirm(selectedDates)}
                    >
                        {confirmLabel}
                    </Button>
                )}
            </Row>
        </Stack>
    );
}
