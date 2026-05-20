import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { cx } from '@signalco/ui-primitives/cx';
import type { ReactNode } from 'react';

export type EntityDetailsPropertyListItem = {
    id: string;
    label: string;
    value: Date | boolean | string | number | ReactNode | null | undefined;
    mono?: boolean;
    visual?: ReactNode;
};

export function EntityDetailsPropertyList({
    items,
}: {
    items: EntityDetailsPropertyListItem[];
}) {
    return (
        <dl className="overflow-hidden rounded-lg border bg-background">
            {items.map((item) => (
                <div
                    key={item.id}
                    className="grid grid-cols-[minmax(6rem,0.85fr)_minmax(0,1.15fr)] gap-3 border-b px-3 py-2.5 text-sm last:border-b-0"
                >
                    <dt className="min-w-0 truncate text-muted-foreground">
                        {item.label}
                    </dt>
                    <dd className="flex min-w-0 items-center gap-2 text-foreground">
                        {item.visual && (
                            <span className="shrink-0 text-muted-foreground">
                                {item.visual}
                            </span>
                        )}
                        <span
                            className={cx(
                                'min-w-0',
                                isCompactValue(item.value) && 'truncate',
                                item.mono && 'font-mono',
                            )}
                            title={
                                isCompactValue(item.value)
                                    ? String(item.value)
                                    : undefined
                            }
                        >
                            {renderPropertyValue(item.value)}
                        </span>
                    </dd>
                </div>
            ))}
        </dl>
    );
}

function renderPropertyValue(value: EntityDetailsPropertyListItem['value']) {
    if (value instanceof Date) {
        return <LocalDateTime>{value}</LocalDateTime>;
    }

    if (typeof value === 'boolean') {
        return value ? 'Da' : 'Ne';
    }

    return value ?? '-';
}

function isCompactValue(value: EntityDetailsPropertyListItem['value']) {
    return typeof value === 'string' || typeof value === 'number';
}
