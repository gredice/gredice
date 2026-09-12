import type { getRaisedBedFieldGroups } from '@gredice/js/plants';
import type { ReactNode } from 'react';
import { cx } from '../utils';

export function RaisedBedFieldsGrid({
    groups,
    compact = false,
}: {
    compact?: boolean;
    groups: Array<
        ReturnType<typeof getRaisedBedFieldGroups>[number] & {
            fields: Array<{ position: number; controls?: ReactNode }>;
            children: ReactNode;
        }
    >;
}) {
    return (
        <section className="min-w-0" aria-label="Raspored polja u gredici">
            <div
                className={cx(
                    'grid min-w-0 rounded-lg border-b border-r',
                    compact ? 'grid-cols-3' : 'grid-cols-1 sm:grid-cols-3',
                )}
            >
                {groups.map((group) => (
                    <section
                        key={group.positionNumbers.join('-')}
                        aria-label={`Polja ${group.positionNumbers.join(', ')}`}
                        className={cx(
                            'min-w-0 border-l border-t bg-background',
                            !compact && 'max-sm:col-auto! max-sm:row-auto!',
                        )}
                        style={{
                            gridRow: `${group.row} / span ${group.rowSpan}`,
                            gridColumn: `${group.column} / span ${group.columnSpan}`,
                        }}
                    >
                        <div
                            className="grid border-b bg-muted/30"
                            style={{
                                gridTemplateColumns: `repeat(${group.columnSpan}, minmax(0, 1fr))`,
                            }}
                        >
                            {group.fields.map((field) => (
                                <div
                                    key={field.position}
                                    className={cx(
                                        'flex min-w-0 flex-wrap items-center justify-between gap-1',
                                        compact
                                            ? 'min-h-14 px-1.5 py-1 sm:min-h-9 sm:px-2'
                                            : 'px-3 py-2',
                                    )}
                                >
                                    <span className="text-xs font-semibold">
                                        Polje {field.position}
                                    </span>
                                    <div className="flex min-w-0 flex-wrap items-center gap-1">
                                        {field.controls}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="divide-y">{group.children}</div>
                    </section>
                ))}
            </div>
        </section>
    );
}
