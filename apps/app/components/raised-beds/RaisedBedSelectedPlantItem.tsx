import type { PlantSortData } from '@gredice/client';
import { plantFieldStatusLabel } from '@gredice/js/plants';
import type { RaisedBedPlantingWithFields } from '@gredice/storage';
import { Chip } from '@gredice/ui/Chip';
import { GamePlantStatusIcon } from '@gredice/ui/GameIcons';
import {
    RaisedBedPlantDetails,
    RaisedBedPlantItem,
} from '@gredice/ui/raisedBeds';
import { RaisedBedPlantSortCorrection } from './RaisedBedPlantSortCorrection';
import { SelectedPlantingOperationControl } from './SelectedPlantingOperationControl';
import { SelectedPlantingStatusControl } from './SelectedPlantingStatusControl';
import { getSelectedPlantingStatusControl } from './selectedPlantingStatusControls';

export function RaisedBedSelectedPlantItem({
    planting,
    plantSorts = [],
    positionNumbers,
    plantSort,
    locationLabel,
    operationOptions = [],
}: {
    planting: RaisedBedPlantingWithFields;
    plantSorts?: PlantSortData[];
    positionNumbers: number[];
    plantSort?: PlantSortData;
    locationLabel?: string;
    operationOptions?: Array<{ value: string; label: string }>;
}) {
    const name =
        plantSort?.information.name ?? `Sorta #${planting.plantSortId}`;
    const control = getSelectedPlantingStatusControl(planting);
    const dates = [
        {
            label: 'Početak sadnje',
            value: planting.lifecycleStartedAt.toISOString(),
        },
        ...planting.lifecycleStatusChanges.map((change) => ({
            label: plantFieldStatusLabel(change.status).shortLabel,
            value: change.occurredAt.toISOString(),
        })),
        ...(planting.lifecycleStoppedAt
            ? [
                  {
                      label: 'Završetak sadnje',
                      value: planting.lifecycleStoppedAt.toISOString(),
                  },
              ]
            : []),
    ];
    return (
        <RaisedBedPlantItem
            name={name}
            plantSort={plantSort}
            positionNumbers={positionNumbers}
            plantCount={planting.plantCount}
            spacingCm={planting.selectedSeedingDistanceCm}
            statusControl={
                control ? (
                    <SelectedPlantingStatusControl control={control} compact />
                ) : (
                    <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1">
                        {planting.lifecycleStatus && (
                            <GamePlantStatusIcon
                                status={planting.lifecycleStatus}
                                className="size-5 shrink-0"
                                aria-hidden
                            />
                        )}
                        {planting.lifecycleStatus
                            ? plantFieldStatusLabel(planting.lifecycleStatus)
                                  .shortLabel
                            : planting.isActive
                              ? 'Aktivno'
                              : 'Završeno'}
                    </span>
                )
            }
            locationControl={
                locationLabel && (
                    <Chip
                        size="sm"
                        variant="solid"
                        color={
                            locationLabel === 'Staklenik'
                                ? 'success'
                                : 'neutral'
                        }
                        startDecorator={
                            <span aria-hidden>
                                {locationLabel === 'Staklenik' ? '🏡' : '🪴'}
                            </span>
                        }
                    >
                        {locationLabel}
                    </Chip>
                )
            }
            details={
                <RaisedBedPlantDetails
                    name={name}
                    positionNumbers={positionNumbers}
                    layout={planting}
                    dates={dates}
                />
            }
            actions={
                <>
                    {planting.isActive &&
                        planting.selectedTask &&
                        plantSorts.length > 0 && (
                            <RaisedBedPlantSortCorrection
                                identity={planting.selectedTask.identity}
                                name={name}
                                options={plantSorts
                                    .map((sort) => ({
                                        value: String(sort.id),
                                        label:
                                            sort.information?.name ??
                                            `Sorta #${sort.id}`,
                                    }))
                                    .sort((a, b) =>
                                        a.label.localeCompare(b.label, 'hr'),
                                    )}
                            />
                        )}
                    {control && (
                        <SelectedPlantingOperationControl
                            identity={control.identity}
                            options={operationOptions.filter((option) =>
                                ['died', 'notSprouted', 'harvested'].includes(
                                    planting.lifecycleStatus ?? '',
                                )
                                    ? option.value === '346'
                                    : option.value !== '346' &&
                                      (option.value !== '593' ||
                                          (locationLabel === 'Staklenik' &&
                                              planting.lifecycleStatus ===
                                                  'sprouted')),
                            )}
                        />
                    )}
                </>
            }
        />
    );
}
