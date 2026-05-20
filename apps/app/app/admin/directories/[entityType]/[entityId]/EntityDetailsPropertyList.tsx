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
        <dl className="space-y-1">
            {items.map((item) => (
                <div
                    key={item.id}
                    className="grid grid-cols-[minmax(6rem,0.85fr)_minmax(0,1.15fr)] gap-3 px-3 py-2 text-sm"
                >
                    <dt className="flex min-w-0 items-center gap-2 text-muted-foreground">
                        {item.visual && (
                            <span className="shrink-0" aria-hidden>
                                {item.visual}
                            </span>
                        )}
                        <span className="min-w-0 truncate">{item.label}</span>
                    </dt>
                    <dd className="flex min-w-0 items-center gap-2 text-foreground">
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
        return renderBooleanValueToggle(value);
    }

    return value ?? '-';
}

function isCompactValue(value: EntityDetailsPropertyListItem['value']) {
    return typeof value === 'string' || typeof value === 'number';
}

function renderBooleanValueToggle(value: boolean) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={value}
            disabled
            className={cx(
                'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:cursor-default disabled:opacity-100',
                value ? 'bg-primary' : 'bg-muted',
            )}
        >
            <span
                className={cx(
                    'inline-block size-4 rounded-full bg-background shadow-sm transition-transform',
                    value ? 'translate-x-4' : 'translate-x-0.5',
                )}
            />
            <span className="sr-only">{value ? 'Da' : 'Ne'}</span>
        </button>
    );
}
