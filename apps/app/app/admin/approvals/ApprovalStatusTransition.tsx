import { plantFieldStatusLabel } from '@gredice/js/plants';
import { ArrowRight } from '@gredice/ui/icons';
import { raisedBedFieldPlantStatusItems } from '../../../src/raisedBedFieldPlantStatusItems';

export function ApprovalStatusTransition({
    currentStatus,
    requestedStatus,
}: {
    currentStatus?: string | null;
    requestedStatus: string;
}) {
    return (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1 text-muted-foreground">
                <span aria-hidden="true">
                    {raisedBedFieldPlantStatusItems.find(
                        (item) => item.value === currentStatus,
                    )?.icon ?? '❔'}
                </span>
                {plantFieldStatusLabel(currentStatus ?? undefined).shortLabel}
            </span>
            <ArrowRight
                className="size-3 shrink-0 text-muted-foreground"
                aria-hidden="true"
            />
            <span className="sr-only">u</span>
            <span className="inline-flex items-center gap-1 font-medium">
                <span aria-hidden="true">
                    {raisedBedFieldPlantStatusItems.find(
                        (item) => item.value === requestedStatus,
                    )?.icon ?? '❔'}
                </span>
                {plantFieldStatusLabel(requestedStatus).shortLabel}
            </span>
        </div>
    );
}
