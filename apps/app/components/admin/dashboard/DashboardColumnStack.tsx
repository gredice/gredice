import { cx } from '@gredice/ui/utils';

/** One stacked column, growing up from or down below the chart baseline. */
export function DashboardColumnStack({
    segments,
    heightPercent,
    direction,
}: {
    segments: { key: string; value: number; colorClassName: string }[];
    heightPercent: number;
    direction: 'up' | 'down';
}) {
    const visibleSegments = segments.filter((segment) => segment.value > 0);
    if (visibleSegments.length === 0) {
        return null;
    }

    return (
        <div
            className={cx(
                'flex min-h-0.5 w-full max-w-8 gap-0.5 overflow-hidden',
                direction === 'up'
                    ? 'flex-col-reverse rounded-t-[4px]'
                    : 'flex-col rounded-b-[4px]',
            )}
            style={{ height: `${heightPercent}%` }}
        >
            {visibleSegments.map((segment) => (
                <div
                    key={segment.key}
                    className={cx('min-h-px', segment.colorClassName)}
                    style={{ flexGrow: segment.value, flexBasis: 0 }}
                />
            ))}
        </div>
    );
}
