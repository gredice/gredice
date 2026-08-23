import { plantFieldStatusLabel } from '@gredice/js/plants';
import { PlantGridIcon } from '@gredice/ui/GridIcons';
import { MapPin, Sprout } from '@gredice/ui/icons';
import type { AdvancedSowingGardenPlantingVisual } from './advancedSowingGardenVisuals';
import { RaisedBedSelectedPlantingOwnerControls } from './RaisedBedSelectedPlantingOwnerControls';

export function advancedSowingPlantingFieldsLabel(
    planting: AdvancedSowingGardenPlantingVisual,
) {
    return planting.memberships
        .map((membership) => membership.positionIndex + 1)
        .sort((left, right) => left - right)
        .join(', ');
}

export function advancedSowingPlantingFieldsHeading(
    planting: AdvancedSowingGardenPlantingVisual,
) {
    const fields = advancedSowingPlantingFieldsLabel(planting);
    return planting.memberships.length === 1
        ? `Polje ${fields}`
        : `Polja ${fields}`;
}

export function RaisedBedAdvancedSowingPlantingDetails({
    gardenId,
    planting,
    raisedBedId,
}: {
    gardenId: number;
    planting: AdvancedSowingGardenPlantingVisual;
    raisedBedId: number;
}) {
    return (
        <div
            className="space-y-4"
            data-advanced-sowing-planting-id={planting.id}
        >
            <dl className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex min-w-0 items-center gap-3 rounded-lg bg-muted/60 p-3">
                    <PlantGridIcon
                        aria-hidden
                        className="size-7 shrink-0 text-emerald-700 dark:text-emerald-300"
                        totalPlants={planting.plantCount}
                    />
                    <div className="min-w-0">
                        <dt className="text-xs text-muted-foreground">
                            Gustoća
                        </dt>
                        <dd className="font-semibold">
                            {planting.plantsPerAxis.toString()} ×{' '}
                            {planting.plantsPerAxis.toString()}
                        </dd>
                    </div>
                </div>
                <div className="flex min-w-0 items-center gap-3 rounded-lg bg-muted/60 p-3">
                    <MapPin
                        aria-hidden
                        className="size-7 shrink-0 text-emerald-700 dark:text-emerald-300"
                    />
                    <div className="min-w-0">
                        <dt className="text-xs text-muted-foreground">
                            {planting.memberships.length === 1
                                ? 'Polje'
                                : 'Polja'}
                        </dt>
                        <dd className="truncate font-semibold">
                            {advancedSowingPlantingFieldsLabel(planting)}
                        </dd>
                    </div>
                </div>
                {planting.lifecycleStatus ? (
                    <div className="col-span-2 flex min-w-0 items-center gap-3 rounded-lg bg-muted/60 p-3">
                        <Sprout
                            aria-hidden
                            className="size-7 shrink-0 text-emerald-700 dark:text-emerald-300"
                        />
                        <div className="min-w-0">
                            <dt className="text-xs text-muted-foreground">
                                Status
                            </dt>
                            <dd className="font-semibold">
                                {
                                    plantFieldStatusLabel(
                                        planting.lifecycleStatus,
                                    ).shortLabel
                                }
                            </dd>
                        </div>
                    </div>
                ) : null}
            </dl>
            {planting.selectedTask ? (
                <RaisedBedSelectedPlantingOwnerControls
                    gardenId={gardenId}
                    key={`${planting.id.toString()}:${planting.expectedLifecycleVersionEventId?.toString() ?? 'unknown'}`}
                    planting={planting}
                    raisedBedId={raisedBedId}
                />
            ) : null}
        </div>
    );
}
