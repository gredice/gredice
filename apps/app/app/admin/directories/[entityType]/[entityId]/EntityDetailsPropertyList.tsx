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
        <dl className="min-w-0 overflow-hidden">
            {items.map((item) => (
                <div
                    key={item.id}
                    className="grid min-w-0 grid-cols-[minmax(5.5rem,0.85fr)_minmax(0,1.15fr)] items-center gap-2 px-4 py-1.5 text-sm"
                >
                    <dt className="flex min-w-0 items-center gap-2 text-muted-foreground">
                        {item.visual && (
                            <span className="shrink-0 text-muted-foreground">
                                {item.visual}
                            </span>
                        )}
                        <span className="min-w-0 truncate">{item.label}</span>
                    </dt>
                    <dd className="flex min-w-0 items-center overflow-hidden text-foreground">
                        <span
                            className={cx(
                                'block min-w-0 max-w-full overflow-hidden',
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
