import { ArrowDown, ArrowUp, Remove } from '@gredice/ui/icons';
import { cx } from '@gredice/ui/utils';
import {
    formatDashboardSignedNumber,
    formatDashboardSignedPercent,
} from './dashboardFormat';

export function DashboardChange({
    current,
    previous,
}: {
    current: number;
    previous: number;
}) {
    const change = current - previous;
    const ratio = previous > 0 ? change / previous : null;
    const Icon = change > 0 ? ArrowUp : change < 0 ? ArrowDown : Remove;

    return (
        <p
            className={cx(
                'flex flex-wrap items-center gap-x-1 text-xs font-medium',
                change > 0 && 'text-green-700 dark:text-green-500',
                change < 0 && 'text-red-700 dark:text-red-400',
                change === 0 && 'text-muted-foreground',
            )}
        >
            <Icon aria-hidden className="size-3.5 shrink-0" />
            <span>{formatDashboardSignedNumber(change)}</span>
            {ratio !== null ? (
                <span className="font-normal">
                    ({formatDashboardSignedPercent(ratio)})
                </span>
            ) : null}
            <span className="font-normal text-muted-foreground">u periodu</span>
        </p>
    );
}
