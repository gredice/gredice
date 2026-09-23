'use client';

import {
    DEFAULT_HARVEST_LABEL_PRESET,
    getLabelPrinterAvailabilityMessage,
    HARVEST_LABEL_PRINT_TASK_TYPE,
    type LabelPrinterSnapshot,
} from '@gredice/label-printer';
import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Progress } from '@gredice/ui/Progress';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useEffect, useRef, useState } from 'react';
import { HomeButton } from '../../../components/HomeButton';
import { FieldOperationLabelPreviewCanvas } from '../../../components/labels/FieldOperationLabelPreviewCanvas';
import { HarvestLabelPreviewCanvas } from '../../../components/labels/HarvestLabelPreviewCanvas';
import { sharedLabelPrinter } from '../../../components/labels/sharedLabelPrinter';
import { LabelPrinterStatusSummary } from '../../schedule/LabelPrinterStatusSummary';
import { DebugFieldLabel } from '../labels/DebugFieldLabel';
import { DebugTextInput } from '../labels/DebugTextInput';
import {
    DEBUG_FIELD_OPERATION_BATCH,
    DEBUG_FIELD_OPERATION_LABEL,
    DEBUG_HARVEST_LABEL,
    describeSnapshotChanges,
} from './labelPrinterDebugSamples';

const MAX_QUANTITY = 20;
const MAX_LOG_ENTRIES = 200;

type LogTone = 'info' | 'success' | 'error';

type LogEntry = {
    id: number;
    at: Date;
    tone: LogTone;
    message: string;
};

type PrinterAction =
    | 'connect'
    | 'refresh'
    | 'disconnect'
    | 'print-harvest'
    | 'print-field'
    | 'print-batch';

const logToneClassNames: Record<LogTone, string> = {
    info: 'text-foreground',
    success: 'text-green-700 dark:text-green-400',
    error: 'text-red-700 dark:text-red-400',
};

let nextLogEntryId = 0;

function prependLogEntry(log: LogEntry[], tone: LogTone, message: string) {
    nextLogEntryId += 1;
    const entry = { id: nextLogEntryId, at: new Date(), tone, message };
    return [entry, ...log].slice(0, MAX_LOG_ENTRIES);
}

function getErrorMessage(error: unknown) {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    return 'Pisač nije odgovorio.';
}

function parseQuantity(value: string, fallback: number) {
    const nextValue = Number.parseInt(value, 10);
    if (!Number.isFinite(nextValue)) {
        return fallback;
    }

    return Math.min(MAX_QUANTITY, Math.max(1, nextValue));
}

function formatValue(value: string | number | boolean | undefined) {
    if (value === undefined || value === '') {
        return '—';
    }

    if (typeof value === 'boolean') {
        return value ? 'da' : 'ne';
    }

    return value.toString();
}

function getPrintBlockedReason(snapshot: LabelPrinterSnapshot) {
    if (!snapshot.isConnected) {
        return 'Najprije povežite pisač.';
    }
    if (snapshot.isPrinting) {
        return 'Ispis je u tijeku.';
    }
    if (snapshot.paperInserted === false) {
        return 'Pisač javlja da etikete nisu umetnute.';
    }
    if (snapshot.lidClosed === false) {
        return 'Pisač javlja da je poklopac otvoren.';
    }

    return null;
}

export function LabelPrinterDebugPage() {
    // Snapshot stays null until mount; Web Bluetooth availability is only known in the browser.
    const [snapshot, setSnapshot] = useState<LabelPrinterSnapshot | null>(null);
    const [busyAction, setBusyAction] = useState<PrinterAction | null>(null);
    const [harvestQuantity, setHarvestQuantity] = useState(1);
    const [fieldQuantity, setFieldQuantity] = useState(2);
    const [log, setLog] = useState<LogEntry[]>([]);
    const previousSnapshotRef = useRef<LabelPrinterSnapshot | null>(null);

    const appendLog = (tone: LogTone, message: string) => {
        setLog((current) => prependLogEntry(current, tone, message));
    };

    useEffect(() => {
        return sharedLabelPrinter.subscribe((nextSnapshot) => {
            const changes = describeSnapshotChanges(
                previousSnapshotRef.current,
                nextSnapshot,
            );
            previousSnapshotRef.current = nextSnapshot;
            setSnapshot(nextSnapshot);

            if (changes.length > 0) {
                setLog((current) =>
                    prependLogEntry(current, 'info', changes.join(' · ')),
                );
            }
        });
    }, []);

    const runAction = async (
        action: PrinterAction,
        label: string,
        run: () => Promise<unknown>,
    ) => {
        setBusyAction(action);
        appendLog('info', `${label}…`);
        const startedAt = performance.now();

        try {
            await run();
            const durationMs = Math.round(performance.now() - startedAt);
            appendLog('success', `${label} uspješno (${durationMs} ms)`);
        } catch (error) {
            const durationMs = Math.round(performance.now() - startedAt);
            appendLog(
                'error',
                `${label} neuspješno (${durationMs} ms): ${getErrorMessage(error)}`,
            );
        } finally {
            setBusyAction(null);
        }
    };

    if (!snapshot) {
        return (
            <div className="min-h-[100dvh] w-full bg-background p-4">
                <Typography className="text-sm text-muted-foreground">
                    Učitavanje pisača…
                </Typography>
            </div>
        );
    }

    const availabilityMessage =
        getLabelPrinterAvailabilityMessage(snapshot.availability) ?? null;
    const printBlockedReason = getPrintBlockedReason(snapshot);
    const canPrint = !printBlockedReason && busyAction === null;
    const progress = snapshot.progress;

    const statusRows: Array<{ title: string; value: string }> = [
        { title: 'Uređaj', value: formatValue(snapshot.deviceName) },
        { title: 'Model', value: formatValue(snapshot.modelName) },
        { title: 'Serijski broj', value: formatValue(snapshot.serial) },
        {
            title: 'Hardver / softver',
            value: `${formatValue(snapshot.hardwareVersion)} / ${formatValue(snapshot.softwareVersion)}`,
        },
        {
            title: 'Baterija',
            value:
                snapshot.batteryPercent === undefined
                    ? '—'
                    : `${snapshot.batteryPercent}%`,
        },
        {
            title: 'Etikete umetnute',
            value: formatValue(snapshot.paperInserted),
        },
        {
            title: 'RFID etiketa očitana',
            value: formatValue(snapshot.paperRfidDetected),
        },
        { title: 'Poklopac zatvoren', value: formatValue(snapshot.lidClosed) },
        {
            title: 'Potrošni materijal',
            value: snapshot.consumableUsage
                ? `${snapshot.consumableUsage.remaining} preostalo (${snapshot.consumableUsage.used} / ${snapshot.consumableUsage.total} iskorišteno)`
                : '—',
        },
        {
            title: 'Zadnje ažuriranje',
            value: snapshot.updatedAt
                ? snapshot.updatedAt.toLocaleTimeString('hr-HR')
                : '—',
        },
    ];

    return (
        <div className="min-h-[100dvh] w-full bg-background">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4">
                <Row spacing={4} justifyContent="space-between">
                    <HomeButton />
                    <Button variant="outlined" href="/debug/labels">
                        Pregled etiketa
                    </Button>
                </Row>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]">
                    <Stack spacing={8}>
                        <Card>
                            <CardHeader>
                                <Stack spacing={2}>
                                    <CardTitle>Pisač</CardTitle>
                                    <Typography className="text-sm text-muted-foreground">
                                        Poveži Niimbot pisač preko Web
                                        Bluetootha i provjeri stanje koje
                                        aplikacija očitava. Veza je zajednička s
                                        ispisom iz rasporeda.
                                    </Typography>
                                </Stack>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {availabilityMessage && (
                                    <Alert color="warning">
                                        {availabilityMessage}
                                    </Alert>
                                )}
                                <LabelPrinterStatusSummary
                                    snapshot={snapshot}
                                />
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        variant="solid"
                                        type="button"
                                        loading={
                                            busyAction === 'connect' ||
                                            snapshot.isConnecting
                                        }
                                        disabled={
                                            !snapshot.availability.supported ||
                                            busyAction !== null ||
                                            snapshot.isConnected
                                        }
                                        onClick={() =>
                                            runAction(
                                                'connect',
                                                'Povezivanje',
                                                () =>
                                                    sharedLabelPrinter.connect(),
                                            )
                                        }
                                    >
                                        Poveži
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        type="button"
                                        loading={busyAction === 'refresh'}
                                        disabled={
                                            !snapshot.isConnected ||
                                            busyAction !== null
                                        }
                                        onClick={() =>
                                            runAction(
                                                'refresh',
                                                'Osvježavanje stanja',
                                                () =>
                                                    sharedLabelPrinter.refresh(),
                                            )
                                        }
                                    >
                                        Osvježi
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        type="button"
                                        loading={busyAction === 'disconnect'}
                                        disabled={
                                            !snapshot.isConnected ||
                                            busyAction !== null
                                        }
                                        onClick={() =>
                                            runAction(
                                                'disconnect',
                                                'Prekid veze',
                                                () =>
                                                    sharedLabelPrinter.disconnect(),
                                            )
                                        }
                                    >
                                        Prekini vezu
                                    </Button>
                                </div>
                                <dl className="grid gap-x-4 gap-y-3 rounded-lg border bg-background p-4 sm:grid-cols-2">
                                    {statusRows.map((row) => (
                                        <div key={row.title}>
                                            <dt className="text-xs text-muted-foreground">
                                                {row.title}
                                            </dt>
                                            <dd className="break-words text-sm font-medium">
                                                {row.value}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                                {snapshot.lastError && (
                                    <Alert color="danger">
                                        {snapshot.lastError}
                                    </Alert>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <Stack spacing={2}>
                                    <CardTitle>Napredak ispisa</CardTitle>
                                    <Typography className="text-sm text-muted-foreground">
                                        Vrijednosti dolaze iz događaja
                                        printprogress tijekom ispisa.
                                    </Typography>
                                </Stack>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {progress ? (
                                    <>
                                        <DebugFieldLabel
                                            title="Stranica"
                                            description={`${progress.page} / ${progress.pagesTotal}`}
                                        />
                                        <Stack spacing={1}>
                                            <Typography level="body2">
                                                Ispis stranice{' '}
                                                {progress.pagePrintProgress}%
                                            </Typography>
                                            <Progress
                                                aria-label="Ispis stranice"
                                                value={
                                                    progress.pagePrintProgress
                                                }
                                            />
                                        </Stack>
                                        <Stack spacing={1}>
                                            <Typography level="body2">
                                                Uvlačenje stranice{' '}
                                                {progress.pageFeedProgress}%
                                            </Typography>
                                            <Progress
                                                aria-label="Uvlačenje stranice"
                                                value={
                                                    progress.pageFeedProgress
                                                }
                                            />
                                        </Stack>
                                    </>
                                ) : (
                                    <Typography className="text-sm text-muted-foreground">
                                        Još nema ispisa u ovoj sesiji.
                                    </Typography>
                                )}
                            </CardContent>
                        </Card>
                    </Stack>

                    <Stack spacing={8}>
                        <Card>
                            <CardHeader>
                                <Stack spacing={2}>
                                    <CardTitle>Probni ispis</CardTitle>
                                    <Typography className="text-sm text-muted-foreground">
                                        Profil {HARVEST_LABEL_PRINT_TASK_TYPE},
                                        etiketa{' '}
                                        {DEFAULT_HARVEST_LABEL_PRESET.widthMm} ×{' '}
                                        {DEFAULT_HARVEST_LABEL_PRESET.heightMm}{' '}
                                        mm, smjer{' '}
                                        {
                                            DEFAULT_HARVEST_LABEL_PRESET.printDirection
                                        }
                                        .
                                    </Typography>
                                </Stack>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {printBlockedReason && (
                                    <Alert color="info">
                                        {printBlockedReason}
                                    </Alert>
                                )}

                                <section className="grid gap-4 rounded-lg border p-4 md:grid-cols-[auto_minmax(0,1fr)]">
                                    <HarvestLabelPreviewCanvas
                                        labelData={DEBUG_HARVEST_LABEL}
                                        className="w-48 rounded border border-black bg-white"
                                    />
                                    <Stack spacing={3}>
                                        <DebugFieldLabel
                                            title="Etiketa berbe"
                                            description="Jedna slika ispisana u više primjeraka (quantity na jednoj stranici)."
                                        />
                                        <DebugTextInput
                                            label="Količina"
                                            type="number"
                                            min={1}
                                            value={harvestQuantity}
                                            onChange={(value) =>
                                                setHarvestQuantity((current) =>
                                                    parseQuantity(
                                                        value,
                                                        current,
                                                    ),
                                                )
                                            }
                                        />
                                        <Button
                                            variant="solid"
                                            type="button"
                                            loading={
                                                busyAction === 'print-harvest'
                                            }
                                            disabled={!canPrint}
                                            onClick={() =>
                                                runAction(
                                                    'print-harvest',
                                                    `Ispis etikete berbe ×${harvestQuantity}`,
                                                    () =>
                                                        sharedLabelPrinter.printHarvestLabel(
                                                            DEBUG_HARVEST_LABEL,
                                                            {
                                                                quantity:
                                                                    harvestQuantity,
                                                            },
                                                        ),
                                                )
                                            }
                                        >
                                            Ispiši etiketu berbe
                                        </Button>
                                    </Stack>
                                </section>

                                <section className="grid gap-4 rounded-lg border p-4 md:grid-cols-[auto_minmax(0,1fr)]">
                                    <FieldOperationLabelPreviewCanvas
                                        labelData={DEBUG_FIELD_OPERATION_LABEL}
                                        className="w-48 rounded border border-black bg-white"
                                    />
                                    <Stack spacing={3}>
                                        <DebugFieldLabel
                                            title="Etiketa radnje"
                                            description="Ista etiketa kao u rasporedu, ispisana u odabranoj količini."
                                        />
                                        <DebugTextInput
                                            label="Količina"
                                            type="number"
                                            min={1}
                                            value={fieldQuantity}
                                            onChange={(value) =>
                                                setFieldQuantity((current) =>
                                                    parseQuantity(
                                                        value,
                                                        current,
                                                    ),
                                                )
                                            }
                                        />
                                        <Button
                                            variant="solid"
                                            type="button"
                                            loading={
                                                busyAction === 'print-field'
                                            }
                                            disabled={!canPrint}
                                            onClick={() =>
                                                runAction(
                                                    'print-field',
                                                    `Ispis etikete radnje ×${fieldQuantity}`,
                                                    () =>
                                                        sharedLabelPrinter.printFieldOperationLabel(
                                                            DEBUG_FIELD_OPERATION_LABEL,
                                                            {
                                                                quantity:
                                                                    fieldQuantity,
                                                            },
                                                        ),
                                                )
                                            }
                                        >
                                            Ispiši etiketu radnje
                                        </Button>
                                    </Stack>
                                </section>

                                <section className="space-y-4 rounded-lg border p-4">
                                    <DebugFieldLabel
                                        title={`Serija različitih etiketa (${DEBUG_FIELD_OPERATION_BATCH.length})`}
                                        description="Svaka etiketa je zasebna stranica u jednom zadatku ispisa, kao kod ispisa više odabranih etiketa u rasporedu."
                                    />
                                    <div className="flex flex-wrap gap-3">
                                        {DEBUG_FIELD_OPERATION_BATCH.map(
                                            (label) => (
                                                <FieldOperationLabelPreviewCanvas
                                                    key={`${label.raisedBedPhysicalId}-${label.fieldLabel}`}
                                                    labelData={label}
                                                    className="w-40 rounded border border-black bg-white"
                                                />
                                            ),
                                        )}
                                    </div>
                                    <Button
                                        variant="solid"
                                        type="button"
                                        loading={busyAction === 'print-batch'}
                                        disabled={!canPrint}
                                        onClick={() =>
                                            runAction(
                                                'print-batch',
                                                `Ispis serije od ${DEBUG_FIELD_OPERATION_BATCH.length} etiketa`,
                                                () =>
                                                    sharedLabelPrinter.printFieldOperationLabels(
                                                        DEBUG_FIELD_OPERATION_BATCH,
                                                    ),
                                            )
                                        }
                                    >
                                        Ispiši seriju
                                    </Button>
                                </section>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <Row justifyContent="space-between">
                                    <CardTitle>Dnevnik događaja</CardTitle>
                                    <Button
                                        variant="plain"
                                        size="sm"
                                        type="button"
                                        disabled={log.length === 0}
                                        onClick={() => setLog([])}
                                    >
                                        Očisti
                                    </Button>
                                </Row>
                            </CardHeader>
                            <CardContent>
                                {log.length === 0 ? (
                                    <Typography className="text-sm text-muted-foreground">
                                        Nema događaja.
                                    </Typography>
                                ) : (
                                    <ol
                                        aria-live="polite"
                                        className="max-h-80 space-y-1 overflow-auto rounded-lg border bg-muted/30 p-3 font-mono text-xs leading-5"
                                    >
                                        {log.map((entry) => (
                                            <li
                                                key={entry.id}
                                                className={
                                                    logToneClassNames[
                                                        entry.tone
                                                    ]
                                                }
                                            >
                                                <span className="text-muted-foreground">
                                                    {entry.at.toLocaleTimeString(
                                                        'hr-HR',
                                                    )}
                                                </span>{' '}
                                                {entry.message}
                                            </li>
                                        ))}
                                    </ol>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Trenutno stanje</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <pre className="overflow-auto rounded-lg border bg-muted/30 p-4 text-xs leading-6 text-foreground">
                                    {JSON.stringify(snapshot, null, 2)}
                                </pre>
                            </CardContent>
                        </Card>
                    </Stack>
                </div>
            </div>
        </div>
    );
}
