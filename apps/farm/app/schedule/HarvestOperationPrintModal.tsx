'use client';

import {
    DEFAULT_HARVEST_LABEL_PRESET,
    GrediceLabelPrinter,
    getLabelPrinterAvailabilityMessage,
    type HarvestLabelData,
    type LabelPrinterSnapshot,
} from '@gredice/label-printer';
import { Button } from '@signalco/ui-primitives/Button';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useEffect, useState } from 'react';
import { HarvestLabelPreviewCanvas } from '../../components/labels/HarvestLabelPreviewCanvas';

const sharedLabelPrinter = new GrediceLabelPrinter();

function getErrorMessage(error: unknown) {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    return 'Pisač nije odgovorio. Pokušajte ponovno.';
}

function getStatusPillClassName(tone: 'neutral' | 'success' | 'warning') {
    switch (tone) {
        case 'success':
            return 'rounded-full border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-700';
        case 'warning':
            return 'rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700';
        default:
            return 'rounded-full border border-border bg-muted/40 px-2 py-1 text-xs font-medium text-foreground';
    }
}

function getConsumableUsageLabel(snapshot: LabelPrinterSnapshot) {
    if (!snapshot.consumableUsage) {
        return null;
    }

    return `${snapshot.consumableUsage.remaining}/${snapshot.consumableUsage.total} etiketa`;
}

interface HarvestOperationPrintModalProps {
    operationLabel: string;
    labelData: HarvestLabelData;
}

export function HarvestOperationPrintModal({
    operationLabel,
    labelData,
}: HarvestOperationPrintModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [snapshot, setSnapshot] = useState(() =>
        sharedLabelPrinter.getSnapshot(),
    );
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isDisconnecting, setIsDisconnecting] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    useEffect(() => {
        return sharedLabelPrinter.subscribe(setSnapshot);
    }, []);

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        setActionError(null);
        setSuccessMessage(null);

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

    const handlePrint = async () => {
        setActionError(null);
        setSuccessMessage(null);

        try {
            await sharedLabelPrinter.printHarvestLabel(labelData, {
                preset: DEFAULT_HARVEST_LABEL_PRESET,
            });
            setSuccessMessage('Etiketa je poslana na pisač.');
        } catch (error) {
            setActionError(getErrorMessage(error));
        }
    };

    const availabilityMessage = snapshot.availability.supported
        ? null
        : getLabelPrinterAvailabilityMessage(snapshot.availability);
    const consumableUsageLabel = getConsumableUsageLabel(snapshot);
    const canPrint =
        snapshot.isConnected &&
        !snapshot.isConnecting &&
        !snapshot.isPrinting &&
        snapshot.paperInserted !== false &&
        snapshot.lidClosed !== false;

    return (
        <Modal
            title="Ispis etikete za berbu"
            open={isOpen}
            onOpenChange={handleOpenChange}
            trigger={
                <Button
                    variant="outlined"
                    type="button"
                    className="h-8 px-3 text-xs"
                >
                    Etiketa
                </Button>
            }
        >
            <Stack spacing={2}>
                <Typography>
                    Etiketa za <strong>{operationLabel}</strong> sadržavat će
                    gredicu <strong>{labelData.raisedBedPhysicalId}</strong>,
                    polje <strong>{labelData.fieldIndex}</strong> i sortu{' '}
                    <strong>{labelData.plantSortName}</strong>.
                </Typography>

                <div className="rounded-lg border bg-muted/20 p-3">
                    <HarvestLabelPreviewCanvas
                        labelData={labelData}
                        className="mx-auto block w-full max-w-sm rounded border bg-white shadow-sm"
                    />
                </div>

                {availabilityMessage ? (
                    <Typography level="body2" className="text-red-600">
                        {availabilityMessage}
                    </Typography>
                ) : (
                    <Stack spacing={1.5}>
                        <Stack spacing={1}>
                            <Typography semiBold>Stanje pisača</Typography>
                            <Row spacing={1} className="flex-wrap gap-y-2">
                                <span
                                    className={getStatusPillClassName(
                                        snapshot.isConnected
                                            ? 'success'
                                            : 'neutral',
                                    )}
                                >
                                    {snapshot.isConnected
                                        ? 'Povezan'
                                        : 'Nije povezan'}
                                </span>
                                {snapshot.batteryPercent !== undefined && (
                                    <span
                                        className={getStatusPillClassName(
                                            snapshot.batteryPercent > 25
                                                ? 'success'
                                                : 'warning',
                                        )}
                                    >
                                        Baterija {snapshot.batteryPercent}%
                                    </span>
                                )}
                                {snapshot.paperInserted !== undefined && (
                                    <span
                                        className={getStatusPillClassName(
                                            snapshot.paperInserted
                                                ? 'success'
                                                : 'warning',
                                        )}
                                    >
                                        {snapshot.paperInserted
                                            ? 'Etikete su umetnute'
                                            : 'Nema umetnutih etiketa'}
                                    </span>
                                )}
                                {snapshot.lidClosed !== undefined && (
                                    <span
                                        className={getStatusPillClassName(
                                            snapshot.lidClosed
                                                ? 'success'
                                                : 'warning',
                                        )}
                                    >
                                        {snapshot.lidClosed
                                            ? 'Poklopac zatvoren'
                                            : 'Poklopac otvoren'}
                                    </span>
                                )}
                                {consumableUsageLabel && (
                                    <span
                                        className={getStatusPillClassName(
                                            'neutral',
                                        )}
                                    >
                                        {consumableUsageLabel}
                                    </span>
                                )}
                            </Row>

                            {(snapshot.deviceName ||
                                snapshot.modelName ||
                                snapshot.serial) && (
                                <Stack spacing={0.5}>
                                    {snapshot.deviceName && (
                                        <Typography level="body2">
                                            Uređaj: {snapshot.deviceName}
                                        </Typography>
                                    )}
                                    {snapshot.modelName && (
                                        <Typography level="body2">
                                            Model: {snapshot.modelName}
                                        </Typography>
                                    )}
                                    {snapshot.serial && (
                                        <Typography level="body2">
                                            Serijski broj: {snapshot.serial}
                                        </Typography>
                                    )}
                                </Stack>
                            )}

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
                                            variant="outlined"
                                            type="button"
                                            onClick={handleRefresh}
                                            loading={isRefreshing}
                                            disabled={
                                                isRefreshing ||
                                                snapshot.isPrinting ||
                                                isDisconnecting
                                            }
                                        >
                                            Osvježi stanje
                                        </Button>
                                        <Button
                                            variant="outlined"
                                            type="button"
                                            onClick={handleDisconnect}
                                            loading={isDisconnecting}
                                            disabled={
                                                isDisconnecting ||
                                                snapshot.isPrinting ||
                                                isRefreshing
                                            }
                                        >
                                            Prekini vezu
                                        </Button>
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
                                Ispiši etiketu
                            </Button>
                        </div>
                    </Stack>
                )}
            </Stack>
        </Modal>
    );
}

export default HarvestOperationPrintModal;
