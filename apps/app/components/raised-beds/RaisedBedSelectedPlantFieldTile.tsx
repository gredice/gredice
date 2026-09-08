import type { PlantSortData } from '@gredice/client';
import { plantFieldStatusLabel } from '@gredice/js/plants';
import type { RaisedBedPlantOccupancy } from '@gredice/storage';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { RaisedBedFieldCard } from './RaisedBedFieldCard';

export function RaisedBedSelectedPlantFieldTile({
    positionIndex,
    plants,
    plantSorts,
}: {
    positionIndex: number;
    plants: Array<
        Pick<
            RaisedBedPlantOccupancy,
            'key' | 'plantSortId' | 'plantStatus' | 'positionNumbers'
        > & {
            locationLabel: string;
            plantCount: number | null;
            spacingCm: number | null;
        }
    >;
    plantSorts: PlantSortData[];
}) {
    return (
        <RaisedBedFieldCard
            className="aspect-auto"
            image={<div className="size-full bg-muted/40" />}
            fieldBadge={
                <span className="rounded-full border bg-background px-2 py-1 text-xs font-semibold">
                    {positionIndex + 1}
                </span>
            }
            plantSortControl={
                <div className="space-y-2">
                    {plants.map((plant) => {
                        const sort = plantSorts.find(
                            (item) => item.id === plant.plantSortId,
                        );
                        const name =
                            sort?.information.name ??
                            `Sorta #${plant.plantSortId}`;
                        return (
                            <div
                                key={plant.key}
                                className="rounded-md border bg-background p-2 text-xs"
                            >
                                <div className="flex items-center gap-2">
                                    <PlantOrSortImage
                                        plantSort={sort}
                                        alt={name}
                                        width={32}
                                        height={32}
                                        className="size-8 shrink-0 object-contain"
                                    />
                                    <span className="min-w-0 break-words font-medium">
                                        {name}
                                    </span>
                                </div>
                                <div className="mt-1">
                                    {
                                        plantFieldStatusLabel(plant.plantStatus)
                                            .shortLabel
                                    }{' '}
                                    · {plant.locationLabel}
                                </div>
                                {plant.positionNumbers.length > 1 && (
                                    <div>
                                        Polja {plant.positionNumbers.join(', ')}
                                    </div>
                                )}
                                {plant.plantCount != null && (
                                    <div>
                                        Broj biljaka: {plant.plantCount} ·{' '}
                                        {plant.spacingCm} cm
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            }
        />
    );
}
