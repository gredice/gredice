import type { getRaisedBedFieldGroups } from '@gredice/js/plants';
import type { ReactNode } from 'react';

export function RaisedBedFieldsGrid({
    groups,
}: {
    groups: Array<
        ReturnType<typeof getRaisedBedFieldGroups>[number] & {
            fields: Array<{
                position: number;
                controls?: ReactNode;
                addons?: ReactNode;
            }>;
            children: ReactNode;
        }
    >;
}) {
    return (
        <section className="min-w-0" aria-label="Raspored polja u gredici">
            <div className="grid min-w-0 grid-cols-1 sm:grid-cols-3 rounded-lg border-b border-r">
                {groups.map((group) => (
                    <section
                        key={group.positionNumbers.join('-')}
                        aria-label={`Polja ${group.positionNumbers.join(', ')}`}
                        className="min-w-0 border-l border-t bg-background max-sm:col-auto! max-sm:row-auto!"
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
                                    className="flex min-w-0 flex-wrap items-center justify-between gap-1 px-3 py-2"
                                >
                                    <span className="text-xs font-semibold">
                                        Polje {field.position}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        {field.controls}
                                    </div>
                                    {field.addons && (
                                        <div className="w-full">
                                            {field.addons}
                                        </div>
                                    )}
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
