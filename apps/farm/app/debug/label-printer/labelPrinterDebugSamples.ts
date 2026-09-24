import type {
    FieldOperationLabelData,
    HarvestLabelData,
    LabelPrinterSnapshot,
} from '@gredice/label-printer';

export const DEBUG_HARVEST_LABEL: HarvestLabelData = {
    raisedBedPhysicalId: '12B',
    fieldIndex: 4,
    operationLabel: 'Berba',
    plantSortName: 'Salata Batavia',
    dateLabel: '02.06.2026.',
    traceUrl: 'https://www.gredice.com/trag/demo-berba-2026',
};

export const DEBUG_FIELD_OPERATION_LABEL: FieldOperationLabelData = {
    raisedBedPhysicalId: '12B',
    fieldLabel: '4',
    detailLabel: '6 KOMADA',
    plantSortName: 'Salata Batavia',
    dateLabel: '02.06.2026.',
};

export const DEBUG_FIELD_OPERATION_BATCH: FieldOperationLabelData[] = [
    {
        raisedBedPhysicalId: '3A',
        fieldLabel: '1',
        detailLabel: '1 KOMAD',
        plantSortName: 'Mladi špinat',
        dateLabel: '02.06.2026.',
    },
    {
        raisedBedPhysicalId: '3A',
        fieldLabel: '2-5',
        detailLabel: '12 KOMADA',
        plantSortName: 'Rajčica cherry',
        dateLabel: '02.06.2026.',
        traceUrl: 'https://www.gredice.com/trag/demo-sjetva-3a-2-5',
    },
    {
        raisedBedPhysicalId: '18',
        fieldLabel: '7',
        detailLabel: 'Branje 25% najzrelijih plodova',
        plantSortName: 'Grah mahunar Meraviglia di Veneya a grano nero',
        dateLabel: '02.06.2026.',
    },
];

function formatBoolean(value: boolean | undefined, yes: string, no: string) {
    if (value === undefined) {
        return 'nepoznato';
    }

    return value ? yes : no;
}

/**
 * Human readable list of the status fields that changed between snapshots.
 * Print progress is intentionally skipped because it changes many times per page.
 */
export function describeSnapshotChanges(
    previous: LabelPrinterSnapshot | null,
    next: LabelPrinterSnapshot,
) {
    if (!previous) {
        return [
            `Početno stanje: ${next.isConnected ? 'povezan' : 'nije povezan'}`,
        ];
    }

    const changes: string[] = [];

    if (previous.isConnecting !== next.isConnecting && next.isConnecting) {
        changes.push('Povezivanje…');
    }
    if (previous.isConnected !== next.isConnected) {
        changes.push(next.isConnected ? 'Povezan' : 'Nije povezan');
    }
    if (previous.isPrinting !== next.isPrinting) {
        changes.push(next.isPrinting ? 'Ispis započet' : 'Ispis završen');
    }
    if (previous.batteryPercent !== next.batteryPercent) {
        changes.push(
            `Baterija ${next.batteryPercent === undefined ? 'nepoznato' : `${next.batteryPercent}%`}`,
        );
    }
    if (previous.paperInserted !== next.paperInserted) {
        changes.push(
            `Etikete: ${formatBoolean(next.paperInserted, 'umetnute', 'nisu umetnute')}`,
        );
    }
    if (previous.paperRfidDetected !== next.paperRfidDetected) {
        changes.push(
            `RFID: ${formatBoolean(next.paperRfidDetected, 'očitan', 'nije očitan')}`,
        );
    }
    if (previous.lidClosed !== next.lidClosed) {
        changes.push(
            `Poklopac: ${formatBoolean(next.lidClosed, 'zatvoren', 'otvoren')}`,
        );
    }
    if (
        previous.consumableUsage?.remaining !==
            next.consumableUsage?.remaining ||
        previous.consumableUsage?.total !== next.consumableUsage?.total
    ) {
        changes.push(
            next.consumableUsage
                ? `Preostalo etiketa ${next.consumableUsage.remaining} / ${next.consumableUsage.total}`
                : 'Preostale etikete nepoznate',
        );
    }
    if (previous.lastError !== next.lastError && next.lastError) {
        changes.push(`Greška: ${next.lastError}`);
    }

    return changes;
}
