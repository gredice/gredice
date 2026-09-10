import type { ComponentProps, ReactNode } from 'react';
import { PlantOrSortImage } from '../plants';

/** The same plant presentation regardless of how its planting was recorded. */
export function RaisedBedPlantItem({
    name,
    plantSort,
    positionNumbers,
    statusControl,
    locationControl,
    actions,
    details,
    plantCount,
    spacingCm,
}: {
    name: string;
    plantSort?: ComponentProps<typeof PlantOrSortImage>['plantSort'];
    positionNumbers: number[];
    statusControl?: ReactNode;
    locationControl?: ReactNode;
    actions?: ReactNode;
    details?: ReactNode;
    plantCount?: number | null;
    spacingCm?: number | null;
}) {
    return (
        <article aria-label={name} className="min-w-0 space-y-2 p-3">
            <div className="flex min-w-0 items-center gap-2">
                <PlantOrSortImage
                    plantSort={plantSort}
                    alt={name}
                    width={40}
                    height={40}
                    className="size-10 shrink-0 object-contain"
                />
                <div className="min-w-0 flex-1">
                    <div className="flex min-h-8 min-w-0 items-center text-sm font-medium">
                        <span className="break-words">{name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                        {positionNumbers.length === 1 ? 'Polje' : 'Polja'}{' '}
                        {positionNumbers.join(', ')}
                    </div>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-1 text-xs">
                {statusControl}
                {locationControl}
            </div>
            {(plantCount != null || spacingCm != null) && (
                <div className="text-xs text-muted-foreground">
                    {plantCount != null && `Broj biljaka: ${plantCount}`}
                    {plantCount != null && spacingCm != null && ' · '}
                    {spacingCm != null && `${spacingCm} cm`}
                </div>
            )}
            {(details || actions) && (
                <div className="flex flex-wrap items-center gap-1">
                    {details}
                    {actions}
                </div>
            )}
        </article>
    );
}
