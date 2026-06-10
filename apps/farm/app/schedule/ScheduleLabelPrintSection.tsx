import { Printer } from '@gredice/ui/icons';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { markHarvestTraceLabelsPrintedAction } from './actions';
import { FieldOperationPrintModal } from './FieldOperationPrintModal';
import type {
    FarmScheduleDayData,
    getFarmScheduleOperationsData,
    getFarmSchedulePlantSorts,
} from './scheduleData';
import { buildScheduleLabelPrintData } from './scheduleLabels';

interface ScheduleLabelPrintSectionProps {
    dayDataPromise: Promise<FarmScheduleDayData>;
    operationsDataPromise: ReturnType<typeof getFarmScheduleOperationsData>;
    plantSortsPromise: ReturnType<typeof getFarmSchedulePlantSorts>;
    date: Date;
}

function formatLabelCount(count: number) {
    if (count === 1) {
        return '1 etiketa';
    }

    if (count > 1 && count < 5) {
        return `${count} etikete`;
    }

    return `${count} etiketa`;
}

function formatLabelSummary(
    sowingLabelCount: number,
    harvestLabelCount: number,
    traceLabelCount: number,
) {
    const parts = [];
    if (sowingLabelCount > 0) {
        parts.push(`sijanje: ${formatLabelCount(sowingLabelCount)}`);
    }
    if (harvestLabelCount > 0) {
        parts.push(`berba: ${formatLabelCount(harvestLabelCount)}`);
    }
    if (traceLabelCount > 0) {
        parts.push(`QR trag: ${formatLabelCount(traceLabelCount)}`);
    }

    return parts.join(' · ');
}

export async function ScheduleLabelPrintSection({
    dayDataPromise,
    operationsDataPromise,
    plantSortsPromise,
    date,
}: ScheduleLabelPrintSectionProps) {
    const [dayData, operationsData, plantSorts] = await Promise.all([
        dayDataPromise,
        operationsDataPromise,
        plantSortsPromise,
    ]);
    const printData = await buildScheduleLabelPrintData(
        dayData,
        plantSorts,
        operationsData,
        date,
    );

    if (printData.labels.length === 0) {
        return null;
    }

    const labelSummary = formatLabelSummary(
        printData.sowingLabelCount,
        printData.harvestLabelCount,
        printData.traceLabelCount,
    );

    return (
        <FieldOperationPrintModal
            title="Ispis dnevnih etiketa"
            labelData={printData.labels}
            triggerLabel={`Ispiši sve etikete (${printData.labels.length})`}
            triggerStartDecorator={<Printer aria-hidden className="size-4" />}
            triggerVariant="solid"
            triggerSize="sm"
            triggerClassName="whitespace-nowrap"
            printButtonLabel="Ispiši sve etikete"
            onPrintSuccess={markHarvestTraceLabelsPrintedAction}
            description={
                <Stack spacing={1}>
                    <Typography>
                        Ispis uključuje sve etikete za odabrani dan.
                    </Typography>
                    {labelSummary && (
                        <Typography
                            level="body2"
                            className="text-muted-foreground"
                        >
                            {labelSummary}
                        </Typography>
                    )}
                </Stack>
            }
        />
    );
}
