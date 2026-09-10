'use client';

import type { ReactNode } from 'react';
import { Button } from '../Button';
import { LocalDateTime } from '../LocalDateTime';
import { Popper } from '../Popper';

export function RaisedBedPlantDetails({
    name,
    positionNumbers,
    layout,
    dates,
    controls,
}: {
    name: string;
    positionNumbers: number[];
    layout?: {
        plantsPerAxis: number | null;
        spanRows: number | null;
        spanColumns: number | null;
    };
    controls?: ReactNode;
    dates: Array<{ label: string; value: string }>;
}) {
    return (
        <Popper
            align="start"
            aria-label={`Detalji sadnje: ${name}`}
            className="w-72 max-w-[calc(100vw-2rem)] space-y-3 p-3"
            trigger={
                <Button
                    size="sm"
                    variant="plain"
                    aria-label={`Detalji sadnje: ${name}`}
                >
                    Detalji
                </Button>
            }
        >
            <div className="text-sm font-medium">{name}</div>
            <dl className="space-y-2 text-xs">
                <div>
                    <dt className="text-muted-foreground">Polja</dt>
                    <dd>{positionNumbers.join(', ')}</dd>
                </div>
                {layout?.plantsPerAxis != null && (
                    <div>
                        <dt className="text-muted-foreground">
                            Raspored biljaka
                        </dt>
                        <dd>
                            {layout.plantsPerAxis} × {layout.plantsPerAxis}
                        </dd>
                    </div>
                )}
                {layout?.spanRows != null && layout.spanColumns != null && (
                    <div>
                        <dt className="text-muted-foreground">Zauzima</dt>
                        <dd>
                            {layout.spanRows} × {layout.spanColumns} polja
                        </dd>
                    </div>
                )}
                {dates.map((date) => (
                    <div key={`${date.label}-${date.value}`}>
                        <dt className="text-muted-foreground">{date.label}</dt>
                        <dd>
                            <LocalDateTime>{date.value}</LocalDateTime>
                        </dd>
                    </div>
                ))}
            </dl>
            {controls}
        </Popper>
    );
}
