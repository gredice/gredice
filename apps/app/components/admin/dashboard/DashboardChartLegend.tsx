import { cx } from '@gredice/ui/utils';

export function DashboardChartLegend({
    items,
}: {
    items: {
        key: string;
        label: string;
        colorClassName: string;
        value?: string;
    }[];
}) {
    return (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {items.map((item) => (
                <li key={item.key} className="inline-flex items-center gap-1.5">
                    <span
                        aria-hidden
                        className={cx(
                            'size-2.5 shrink-0 rounded-xs',
                            item.colorClassName,
                        )}
                    />
                    <span>{item.label}</span>
                    {item.value ? (
                        <span className="font-medium text-foreground">
                            {item.value}
                        </span>
                    ) : null}
                </li>
            ))}
        </ul>
    );
}
