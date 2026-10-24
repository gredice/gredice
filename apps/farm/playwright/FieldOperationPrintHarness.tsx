import type { FieldOperationLabelData } from '@gredice/label-printer';
import { useEffect, useState } from 'react';
import { FieldOperationPrintModal } from '../app/schedule/FieldOperationPrintModal';
import { sharedLabelPrinter } from '../components/labels/sharedLabelPrinter';

export function FieldOperationPrintHarness({
    labels,
}: {
    labels: FieldOperationLabelData[];
}) {
    const [printedLabels, setPrintedLabels] = useState<
        FieldOperationLabelData[]
    >([]);
    const [printedTraceIds, setPrintedTraceIds] = useState<number[]>([]);
    const [originals] = useState(() => {
        const methods = {
            getSnapshot: sharedLabelPrinter.getSnapshot,
            subscribe: sharedLabelPrinter.subscribe,
            refresh: sharedLabelPrinter.refresh,
            printFieldOperationLabel:
                sharedLabelPrinter.printFieldOperationLabel,
            printFieldOperationLabels:
                sharedLabelPrinter.printFieldOperationLabels,
        };
        sharedLabelPrinter.getSnapshot = () => ({
            availability: { supported: true },
            isConnected: true,
            isConnecting: false,
            isPrinting: false,
            paperInserted: true,
            lidClosed: true,
        });
        sharedLabelPrinter.subscribe = () => () => {};
        sharedLabelPrinter.refresh = async () =>
            sharedLabelPrinter.getSnapshot();
        sharedLabelPrinter.printFieldOperationLabel = async (label) => {
            setPrintedLabels([label]);
        };
        sharedLabelPrinter.printFieldOperationLabels = async (items) => {
            setPrintedLabels(items);
        };
        return methods;
    });
    useEffect(
        () => () => {
            Object.assign(sharedLabelPrinter, originals);
        },
        [originals],
    );
    return (
        <>
            <FieldOperationPrintModal
                title="Ispis grupe berbe"
                description="Odaberite etikete i broj primjeraka."
                labelData={labels}
                triggerLabel="Otvori ispis grupe"
                onPrintSuccess={async (ids) => {
                    setPrintedTraceIds(ids);
                }}
            />
            <output aria-label="Poslane etikete">
                {JSON.stringify(printedLabels.map((label) => label.fieldLabel))}
            </output>
            <output aria-label="Evidentirani tragovi">
                {JSON.stringify(printedTraceIds)}
            </output>
        </>
    );
}
