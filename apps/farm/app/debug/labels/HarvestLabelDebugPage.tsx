'use client';

import {
    DEFAULT_HARVEST_LABEL_PRESET,
    getHarvestLabelCanvasSize,
    HARVEST_LABEL_PRINT_TASK_TYPE,
    type HarvestLabelData,
} from '@gredice/label-printer';
import { Button } from '@signalco/ui-primitives/Button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useState } from 'react';
import { HomeButton } from '../../../components/HomeButton';
import { HarvestLabelPreviewCanvas } from '../../../components/labels/HarvestLabelPreviewCanvas';
import { DebugFieldLabel } from './DebugFieldLabel';
import { DebugTextInput } from './DebugTextInput';

const DEFAULT_LABEL_DATA: HarvestLabelData = {
    raisedBedPhysicalId: '12B',
    fieldIndex: 4,
    plantSortName: 'Salata Batavia',
};

const LABEL_SAMPLES: Array<{
    label: string;
    data: HarvestLabelData;
}> = [
    {
        label: 'Salata',
        data: DEFAULT_LABEL_DATA,
    },
    {
        label: 'Špinat',
        data: {
            raisedBedPhysicalId: '3A',
            fieldIndex: 2,
            plantSortName: 'Mladi špinat',
        },
    },
    {
        label: 'Rajčica',
        data: {
            raisedBedPhysicalId: '18',
            fieldIndex: 7,
            plantSortName: 'Cherry rajčica',
        },
    },
];

function parseIntegerInput(value: string, fallback: number) {
    const nextValue = Number.parseInt(value, 10);
    if (!Number.isFinite(nextValue)) {
        return fallback;
    }

    return Math.max(1, nextValue);
}

export function HarvestLabelDebugPage() {
    const [labelData, setLabelData] =
        useState<HarvestLabelData>(DEFAULT_LABEL_DATA);
    const [zoom, setZoom] = useState(150);

    const canvasSize = getHarvestLabelCanvasSize(DEFAULT_HARVEST_LABEL_PRESET);
    const scaledWidth = Math.round((canvasSize.width * zoom) / 100);
    const scaledHeight = Math.round((canvasSize.height * zoom) / 100);

    return (
        <div className="min-h-[100dvh] w-full bg-muted">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4">
                <Row spacing={2} justifyContent="space-between">
                    <Row spacing={1} className="items-start">
                        <HomeButton />
                        <Stack spacing={0.5}>
                            <Typography level="h4" component="h1">
                                Debug etiketa
                            </Typography>
                            <Typography className="text-muted-foreground">
                                Pregled koristi isti canvas renderer i isti
                                fiksni profil ispisa kao etiketa u rasporedu
                                berbe.
                            </Typography>
                        </Stack>
                    </Row>
                    <Button variant="outlined" href="/schedule">
                        Otvori raspored
                    </Button>
                </Row>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
                    <Stack spacing={4}>
                        <Card>
                            <CardHeader>
                                <Stack spacing={1}>
                                    <CardTitle>Sadržaj etikete</CardTitle>
                                    <Typography className="text-sm text-muted-foreground">
                                        Mijenjaj podatke operacije i odmah vidi
                                        kako će izgledati generirana etiketa.
                                    </Typography>
                                </Stack>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <DebugTextInput
                                        label="Broj gredice"
                                        value={labelData.raisedBedPhysicalId}
                                        onChange={(value) =>
                                            setLabelData((current) => ({
                                                ...current,
                                                raisedBedPhysicalId: value,
                                            }))
                                        }
                                    />
                                    <DebugTextInput
                                        label="Polje"
                                        type="number"
                                        min={1}
                                        value={labelData.fieldIndex}
                                        onChange={(value) =>
                                            setLabelData((current) => ({
                                                ...current,
                                                fieldIndex: parseIntegerInput(
                                                    value,
                                                    current.fieldIndex,
                                                ),
                                            }))
                                        }
                                    />
                                </div>
                                <DebugTextInput
                                    label="Sorta biljke"
                                    value={labelData.plantSortName}
                                    onChange={(value) =>
                                        setLabelData((current) => ({
                                            ...current,
                                            plantSortName: value,
                                        }))
                                    }
                                />

                                <Stack spacing={1.5}>
                                    <DebugFieldLabel title="Brzi primjeri" />
                                    <div className="flex flex-wrap gap-2">
                                        {LABEL_SAMPLES.map((sample) => (
                                            <Button
                                                key={sample.label}
                                                variant="outlined"
                                                type="button"
                                                onClick={() =>
                                                    setLabelData(sample.data)
                                                }
                                            >
                                                {sample.label}
                                            </Button>
                                        ))}
                                    </div>
                                </Stack>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <Stack spacing={1}>
                                    <CardTitle>Fiksni profil ispisa</CardTitle>
                                    <Typography className="text-sm text-muted-foreground">
                                        Farma koristi samo profil{' '}
                                        {HARVEST_LABEL_PRINT_TASK_TYPE} s
                                        etiketom 50 × 30 mm. Ovdje su zato
                                        dostupne samo promjene sadržaja i
                                        pregled izgleda.
                                    </Typography>
                                </Stack>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="rounded-lg border bg-background p-4">
                                        <DebugFieldLabel
                                            title="Tip ispisa"
                                            description={
                                                HARVEST_LABEL_PRINT_TASK_TYPE
                                            }
                                        />
                                    </div>
                                    <div className="rounded-lg border bg-background p-4">
                                        <DebugFieldLabel
                                            title="Veličina etikete"
                                            description={`${DEFAULT_HARVEST_LABEL_PRESET.widthMm} × ${DEFAULT_HARVEST_LABEL_PRESET.heightMm} mm`}
                                        />
                                    </div>
                                    <div className="rounded-lg border bg-background p-4">
                                        <DebugFieldLabel
                                            title="Gustoća"
                                            description={`${DEFAULT_HARVEST_LABEL_PRESET.dpmm} dpmm`}
                                        />
                                    </div>
                                    <div className="rounded-lg border bg-background p-4">
                                        <DebugFieldLabel
                                            title="Smjer ispisa"
                                            description={
                                                DEFAULT_HARVEST_LABEL_PRESET.printDirection
                                            }
                                        />
                                    </div>
                                </div>

                                <Button
                                    variant="solid"
                                    type="button"
                                    onClick={() => {
                                        setLabelData(DEFAULT_LABEL_DATA);
                                        setZoom(150);
                                    }}
                                >
                                    Vrati zadano
                                </Button>
                            </CardContent>
                        </Card>
                    </Stack>

                    <Stack spacing={4}>
                        <Card>
                            <CardHeader>
                                <Stack spacing={1}>
                                    <CardTitle>Pregled etikete</CardTitle>
                                    <Typography className="text-sm text-muted-foreground">
                                        Trenutni canvas: {canvasSize.width} ×{' '}
                                        {canvasSize.height} px, što odgovara
                                        etiketi{' '}
                                        {DEFAULT_HARVEST_LABEL_PRESET.widthMm} ×{' '}
                                        {DEFAULT_HARVEST_LABEL_PRESET.heightMm}{' '}
                                        mm pri{' '}
                                        {DEFAULT_HARVEST_LABEL_PRESET.dpmm}{' '}
                                        dpmm.
                                    </Typography>
                                </Stack>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <label className="space-y-2">
                                    <Row justifyContent="space-between">
                                        <Typography level="body2" semiBold>
                                            Uvećanje
                                        </Typography>
                                        <Typography
                                            level="body2"
                                            className="text-muted-foreground"
                                        >
                                            {zoom}%
                                        </Typography>
                                    </Row>
                                    <input
                                        type="range"
                                        min={50}
                                        max={250}
                                        step={10}
                                        value={zoom}
                                        onChange={(event) =>
                                            setZoom(
                                                parseIntegerInput(
                                                    event.target.value,
                                                    zoom,
                                                ),
                                            )
                                        }
                                        className="w-full accent-primary"
                                    />
                                </label>

                                <div className="overflow-auto rounded-xl border bg-[linear-gradient(45deg,rgba(120,113,108,0.08)_25%,transparent_25%,transparent_75%,rgba(120,113,108,0.08)_75%,rgba(120,113,108,0.08)),linear-gradient(45deg,rgba(120,113,108,0.08)_25%,transparent_25%,transparent_75%,rgba(120,113,108,0.08)_75%,rgba(120,113,108,0.08))] bg-[length:24px_24px] bg-[position:0_0,12px_12px] p-6">
                                    <div className="flex min-h-[24rem] items-center justify-center">
                                        <HarvestLabelPreviewCanvas
                                            labelData={labelData}
                                            preset={
                                                DEFAULT_HARVEST_LABEL_PRESET
                                            }
                                            className="rounded border border-black bg-white shadow-xl"
                                            style={{
                                                width: `${scaledWidth}px`,
                                                height: `${scaledHeight}px`,
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="rounded-lg border bg-background p-4">
                                    <Stack spacing={1.5}>
                                        <DebugFieldLabel
                                            title="Stvarna veličina"
                                            description="Ovaj pregled koristi fizičke dimenzije canvasa bez dodatnog povećanja za provjeru omjera i gustoće sadržaja."
                                        />
                                        <div className="overflow-auto rounded-lg border bg-muted/20 p-4">
                                            <HarvestLabelPreviewCanvas
                                                labelData={labelData}
                                                preset={
                                                    DEFAULT_HARVEST_LABEL_PRESET
                                                }
                                                className="rounded border border-black bg-white shadow-sm"
                                            />
                                        </div>
                                    </Stack>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Trenutna konfiguracija</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <pre className="overflow-auto rounded-lg border bg-muted/30 p-4 text-xs leading-6 text-foreground">
                                    {JSON.stringify(
                                        {
                                            labelData,
                                            printTaskType:
                                                HARVEST_LABEL_PRINT_TASK_TYPE,
                                            preset: DEFAULT_HARVEST_LABEL_PRESET,
                                            canvasSize,
                                        },
                                        null,
                                        2,
                                    )}
                                </pre>
                            </CardContent>
                        </Card>
                    </Stack>
                </div>
            </div>
        </div>
    );
}
