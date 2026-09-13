import type { ComponentProps, ReactNode } from 'react';
import { PlantOrSortImage } from '../plants';
import { cx } from '../utils';

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
    showPositionLabel = true,
    compact = false,
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
    showPositionLabel?: boolean;
    compact?: boolean;
}) {
    return (
        <article
            aria-label={name}
            className={cx(
                'min-w-0 space-y-2',
                compact ? 'p-1.5 sm:p-2' : 'p-3',
            )}
        >
            <div
                className={cx(
                    'flex min-w-0 gap-2',
                    compact
                        ? 'flex-col items-start sm:flex-row sm:items-center'
                        : 'items-center',
                )}
            >
                <PlantOrSortImage
                    plantSort={plantSort}
                    alt={name}
                    width={40}
                    height={40}
                    className={cx(
                        'shrink-0 object-contain',
                        compact ? 'size-8 sm:size-10' : 'size-10',
                    )}
                />
                <div className="min-w-0 flex-1">
                    <div
                        className={cx(
                            'flex min-w-0 items-center font-medium',
                            compact ? 'text-xs sm:text-sm' : 'min-h-8 text-sm',
                        )}
                    >
                        <span className="[overflow-wrap:anywhere]">{name}</span>
                    </div>
                    {showPositionLabel && (
                        <div className="text-xs text-muted-foreground">
                            {positionNumbers.length === 1 ? 'Polje' : 'Polja'}{' '}
                            {positionNumbers.join(', ')}
                        </div>
                    )}
                </div>
            </div>
            {(statusControl || locationControl) && (
                <div className="flex flex-wrap items-center gap-1 text-xs">
                    {statusControl}
                    {locationControl}
                </div>
            )}
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
