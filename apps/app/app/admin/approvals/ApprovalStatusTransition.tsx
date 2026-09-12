import { plantFieldStatusLabel } from '@gredice/js/plants';
import { GamePlantStatusIcon } from '@gredice/ui/GameIcons';
import { ArrowRight } from '@gredice/ui/icons';

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
                <GamePlantStatusIcon
                    status={currentStatus}
                    className="size-5 shrink-0"
                    aria-hidden
                />
                {plantFieldStatusLabel(currentStatus ?? undefined).shortLabel}
            </span>
            <ArrowRight
                className="size-3 shrink-0 text-muted-foreground"
                aria-hidden="true"
            />
            <span className="sr-only">u</span>
            <span className="inline-flex items-center gap-1 font-medium">
                <GamePlantStatusIcon
                    status={requestedStatus}
                    className="size-5 shrink-0"
                    aria-hidden
                />
                {plantFieldStatusLabel(requestedStatus).shortLabel}
            </span>
        </div>
    );
}
