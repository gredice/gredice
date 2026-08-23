'use client';

import {
    DEFAULT_HARVEST_LABEL_PRESET,
    type FieldOperationLabelData,
    GrediceLabelPrinter,
    getLabelPrinterAvailabilityMessage,
} from '@gredice/label-printer';
import { Button, type ButtonProps } from '@gredice/ui/Button';
import { Checkbox } from '@gredice/ui/Checkbox';
import { LinkOff, Reset } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { type ReactNode, useEffect, useState } from 'react';
import { FieldOperationLabelPreviewCanvas } from '../../components/labels/FieldOperationLabelPreviewCanvas';
import { LabelPrinterStatusSummary } from './LabelPrinterStatusSummary';

const sharedLabelPrinter = new GrediceLabelPrinter();

function getErrorMessage(error: unknown) {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    return 'Pisač nije odgovorio. Pokušajte ponovno.';
}

function getLabelPreviewItems(labels: FieldOperationLabelData[]) {
    const keyCounts = new Map<string, number>();
    const items: Array<{
        key: string;
        label: FieldOperationLabelData;
        position: number;
    }> = [];
    let position = 0;

    for (const label of labels) {
        position += 1;
        const baseKey = [
            label.raisedBedPhysicalId,
            label.fieldLabel,
            label.detailLabel,
            label.plantSortName,
            label.dateLabel ?? '',
        ].join('|');
        const count = keyCounts.get(baseKey) ?? 0;
        keyCounts.set(baseKey, count + 1);

        items.push({
            key: count === 0 ? baseKey : `${baseKey}|${count + 1}`,
            label,
            position,
        });
    }

    return items;
}

function getTraceLinkIds(labels: FieldOperationLabelData[]) {
    return Array.from(
        new Set(
            labels
                .map((label) => label.traceLinkId)
                .filter(
                    (traceLinkId): traceLinkId is number =>
                        typeof traceLinkId === 'number',
                ),
        ),
    );
}

interface FieldOperationPrintModalProps {
    title: string;
    description: ReactNode;
    labelData: FieldOperationLabelData | FieldOperationLabelData[];
    triggerLabel?: string;
    triggerStartDecorator?: ReactNode;
    triggerVariant?: ButtonProps['variant'];
    triggerSize?: ButtonProps['size'];
    triggerClassName?: string;
    printButtonLabel?: string;
    onPrintSuccess?: (traceLinkIds: number[]) => Promise<unknown>;
}

export function FieldOperationPrintModal({
    title,
    description,
    labelData,
    triggerLabel = 'Etiketa',
    triggerStartDecorator,
    triggerVariant = 'outlined',
    triggerSize = 'sm',
    triggerClassName,
    printButtonLabel,
    onPrintSuccess,
}: FieldOperationPrintModalProps) {
    const labels = Array.isArray(labelData) ? labelData : [labelData];
    const labelPreviewItems = getLabelPreviewItems(labels);
    const [isOpen, setIsOpen] = useState(false);
    const [excludedLabelKeys, setExcludedLabelKeys] = useState<Set<string>>(
        () => new Set(),
    );
    const [snapshot, setSnapshot] = useState(() =>
        sharedLabelPrinter.getSnapshot(),
    );
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isDisconnecting, setIsDisconnecting] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const selectedLabelPreviewItems = labelPreviewItems.filter(
        (item) => !excludedLabelKeys.has(item.key),
    );
    const selectedLabels = selectedLabelPreviewItems.map((item) => item.label);
    const allLabelsSelected =
        selectedLabels.length > 0 && selectedLabels.length === labels.length;
    const someLabelsSelected = selectedLabels.length > 0 && !allLabelsSelected;

    useEffect(() => {
        return sharedLabelPrinter.subscribe(setSnapshot);
    }, []);

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        setActionError(null);
        setSuccessMessage(null);

        if (open) {
            setExcludedLabelKeys(new Set());
        }

        if (open && snapshot.isConnected) {
            void sharedLabelPrinter.refresh().catch(() => undefined);
        }
    };

    const handleConnect = async () => {
        setActionError(null);
        setSuccessMessage(null);

        try {
            await sharedLabelPrinter.connect();
        } catch (error) {
            setActionError(getErrorMessage(error));
        }
    };

    const handleRefresh = async () => {
        setActionError(null);
        setSuccessMessage(null);
        setIsRefreshing(true);

        try {
            await sharedLabelPrinter.refresh();
        } catch (error) {
            setActionError(getErrorMessage(error));
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleDisconnect = async () => {
        setActionError(null);
        setSuccessMessage(null);
        setIsDisconnecting(true);

        try {
            await sharedLabelPrinter.disconnect();
        } catch (error) {
            setActionError(getErrorMessage(error));
        } finally {
            setIsDisconnecting(false);
        }
    };

    const handleToggleAllLabels = (checked: boolean) => {
        setExcludedLabelKeys(
            checked
                ? new Set()
                : new Set(labelPreviewItems.map((item) => item.key)),
        );
    };

    const handleToggleLabel = (key: string, checked: boolean) => {
        setExcludedLabelKeys((currentKeys) => {
            const nextKeys = new Set(currentKeys);
            if (checked) {
                nextKeys.delete(key);
            } else {
                nextKeys.add(key);
            }
            return nextKeys;
        });
    };

    const handlePrint = async () => {
        setActionError(null);
        setSuccessMessage(null);

        if (selectedLabels.length === 0) {
            setActionError('Odaberite barem jednu etiketu za ispis.');
            return;
        }

        try {
            if (selectedLabels.length === 1) {
                const firstLabel = selectedLabels.at(0);
                if (!firstLabel) {
                    setActionError('Nema etiketa za ispis.');
                    return;
                }

                await sharedLabelPrinter.printFieldOperationLabel(firstLabel, {
                    preset: DEFAULT_HARVEST_LABEL_PRESET,
                });
            } else {
                await sharedLabelPrinter.printFieldOperationLabels(
                    selectedLabels,
                    {
                        preset: DEFAULT_HARVEST_LABEL_PRESET,
                    },
                );
            }

            const traceLinkIds = getTraceLinkIds(selectedLabels);
            if (traceLinkIds.length > 0 && onPrintSuccess) {
                try {
                    await onPrintSuccess(traceLinkIds);
                } catch {
                    setActionError(
                        'Etikete su poslane na pisač, ali evidencija ispisa nije spremljena.',
                    );
                }
            }
            setSuccessMessage(
                selectedLabels.length === 1
                    ? 'Etiketa je poslana na pisač.'
                    : 'Etikete su poslane na pisač.',
            );
        } catch (error) {
            setActionError(getErrorMessage(error));
        }
    };

    const availabilityMessage = snapshot.availability.supported
        ? null
        : getLabelPrinterAvailabilityMessage(snapshot.availability);
    const canPrint =
        snapshot.isConnected &&
        !snapshot.isConnecting &&
        !snapshot.isPrinting &&
        selectedLabels.length > 0 &&
        snapshot.paperInserted !== false &&
        snapshot.lidClosed !== false;
    const resolvedPrintButtonLabel =
        printButtonLabel ??
        (labels.length === 1 ? 'Ispiši etiketu' : 'Ispiši odabrane etikete');
    const printButtonText =
        labels.length > 1
            ? `${resolvedPrintButtonLabel} (${selectedLabels.length})`
            : resolvedPrintButtonLabel;

    return (
        <Modal
            title={title}
            open={isOpen}
            onOpenChange={handleOpenChange}
            trigger={
                <Button
                    variant={triggerVariant}
                    size={triggerSize}
                    type="button"
                    className={triggerClassName}
                    disabled={labels.length === 0}
                    startDecorator={triggerStartDecorator}
                >
                    {triggerLabel}
                </Button>
            }
        >
            <Stack spacing={4}>
                {description}

                <div className="rounded-lg border bg-muted/20 p-3">
                    <Stack spacing={2}>
                        {labels.length > 1 && (
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <Typography
                                    level="body2"
                                    className="text-muted-foreground"
                                >
                                    Odabrano: {selectedLabels.length} od{' '}
                                    {labels.length} etiketa
                                </Typography>
                                <Checkbox
                                    checked={
                                        allLabelsSelected
                                            ? true
                                            : someLabelsSelected
                                              ? 'indeterminate'
                                              : false
                                    }
                                    disabled={snapshot.isPrinting}
                                    label={
                                        allLabelsSelected
                                            ? 'Poništi odabir svih'
                                            : 'Odaberi sve'
                                    }
                                    onCheckedChange={(checked) =>
                                        handleToggleAllLabels(checked === true)
                                    }
                                />
                            </div>
                        )}
                        <div
                            className={
                                labels.length > 1
                                    ? 'grid max-h-[28rem] gap-3 overflow-y-auto sm:grid-cols-2'
                                    : ''
                            }
                        >
                            {labelPreviewItems.map((item) => {
                                const isSelected = !excludedLabelKeys.has(
                                    item.key,
                                );

                                return (
                                    <div key={item.key} className="min-w-0">
                                        {labels.length > 1 && (
                                            <div className="mb-2 flex min-h-11 items-center">
                                                <Checkbox
                                                    checked={isSelected}
                                                    disabled={
                                                        snapshot.isPrinting
                                                    }
                                                    label={`Uključi etiketu #${item.position}`}
                                                    onCheckedChange={(
                                                        checked,
                                                    ) =>
                                                        handleToggleLabel(
                                                            item.key,
                                                            checked === true,
                                                        )
                                                    }
                                                />
                                            </div>
                                        )}
                                        <div
                                            className={
                                                isSelected
                                                    ? undefined
                                                    : 'opacity-45 grayscale'
                                            }
                                        >
                                            <FieldOperationLabelPreviewCanvas
                                                labelData={item.label}
                                                className="mx-auto block w-full max-w-sm rounded border bg-white shadow-xs"
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Stack>
                </div>

                {availabilityMessage ? (
                    <Typography level="body2" className="text-red-600">
                        {availabilityMessage}
                    </Typography>
                ) : (
                    <Stack spacing={3}>
                        <Stack spacing={2}>
                            <LabelPrinterStatusSummary snapshot={snapshot} />

                            {!snapshot.consumableUsage &&
                                snapshot.isConnected && (
                                    <Typography
                                        level="body2"
                                        className="text-muted-foreground"
                                    >
                                        Pisač nije dojavio broj preostalih
                                        etiketa.
                                    </Typography>
                                )}

                            {snapshot.isPrinting && snapshot.progress && (
                                <Typography level="body2">
                                    Ispis u tijeku: stranica{' '}
                                    {snapshot.progress.page}/
                                    {snapshot.progress.pagesTotal}, ispis{' '}
                                    {snapshot.progress.pagePrintProgress}%,
                                    pomak {snapshot.progress.pageFeedProgress}%
                                </Typography>
                            )}

                            {(actionError || snapshot.lastError) && (
                                <Typography
                                    level="body2"
                                    className="text-red-600"
                                >
                                    {actionError ?? snapshot.lastError}
                                </Typography>
                            )}

                            {successMessage && (
                                <Typography
                                    level="body2"
                                    className="text-green-600"
                                >
                                    {successMessage}
                                </Typography>
                            )}
                        </Stack>

                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap gap-2">
                                {snapshot.isConnected ? (
                                    <>
                                        <Button
                                            variant="plain"
                                            size="sm"
                                            type="button"
                                            aria-label="Osvježi stanje"
                                            title="Osvježi stanje"
                                            className="size-9 px-0"
                                            startDecorator={
                                                <Reset
                                                    aria-hidden
                                                    className="size-4"
                                                />
                                            }
                                            onClick={handleRefresh}
                                            loading={isRefreshing}
                                            disabled={
                                                isRefreshing ||
                                                snapshot.isPrinting ||
                                                isDisconnecting
                                            }
                                        />
                                        <Button
                                            variant="plain"
                                            size="sm"
                                            type="button"
                                            aria-label="Prekini vezu"
                                            title="Prekini vezu"
                                            className="size-9 px-0"
                                            startDecorator={
                                                <LinkOff
                                                    aria-hidden
                                                    className="size-4"
                                                />
                                            }
                                            onClick={handleDisconnect}
                                            loading={isDisconnecting}
                                            disabled={
                                                isDisconnecting ||
                                                snapshot.isPrinting ||
                                                isRefreshing
                                            }
                                        />
                                    </>
                                ) : (
                                    <Button
                                        variant="outlined"
                                        type="button"
                                        onClick={handleConnect}
                                        loading={snapshot.isConnecting}
                                        disabled={snapshot.isConnecting}
                                    >
                                        Poveži pisač
                                    </Button>
                                )}
                            </div>

                            <Button
                                variant="solid"
                                type="button"
                                onClick={handlePrint}
                                loading={snapshot.isPrinting}
                                disabled={!canPrint}
                            >
                                {printButtonText}
                            </Button>
                        </div>
                    </Stack>
                )}
            </Stack>
        </Modal>
    );
}

export default FieldOperationPrintModal;
