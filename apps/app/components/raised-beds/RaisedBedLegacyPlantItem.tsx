import type { PlantSortData } from '@gredice/client';
import type {
    getRaisedBed,
    getRaisedBedFieldPlantCycles,
} from '@gredice/storage';
import {
    RaisedBedPlantDetails,
    RaisedBedPlantItem,
} from '@gredice/ui/raisedBeds';
import { RaisedBedFieldLocationSelector } from '../../app/admin/raised-beds/[raisedBedId]/RaisedBedFieldLocationSelector';
import { MoveRaisedBedFieldPlantModal } from './MoveRaisedBedFieldPlantModal';
import {
    raisedBedFieldCardButtonClassName,
    raisedBedFieldCardChipClassName,
} from './RaisedBedFieldCard';
import type { RaisedBedFieldDateItem } from './RaisedBedFieldDatesPopover';
import { RaisedBedFieldStatusDateChip } from './RaisedBedFieldStatusDateChip';
import { RaisedBedPlantSortCorrection } from './RaisedBedPlantSortCorrection';

type RaisedBedField = NonNullable<
    Awaited<ReturnType<typeof getRaisedBed>>
>['fields'][number];
type RaisedBedFieldPlantCycle = Awaited<
    ReturnType<typeof getRaisedBedFieldPlantCycles>
>[number];

const STATUSES_BEFORE_TRANSPLANT = new Set([
    'new',
    'planned',
    'pendingVerification',
    'sowed',
    'sprouted',
]);

function canFieldCurrentlyBeInGreenhouse(field: RaisedBedField) {
    if (
        field.active &&
        STATUSES_BEFORE_TRANSPLANT.has(field.plantStatus ?? '') &&
        !field.plantDeadDate &&
        !field.plantHarvestedDate &&
        !field.plantRemovedDate
    ) {
        return true;
    }

    return false;
}

function getCurrentLocation(field: RaisedBedField): 'greenhouse' | 'raisedBed' {
    if (
        field.sowingLocation === 'greenhouse' &&
        canFieldCurrentlyBeInGreenhouse(field)
    ) {
        return 'greenhouse';
    }

    return 'raisedBed';
}

function getSortLabel(sort?: PlantSortData, plantSortId?: number | null) {
    return (
        sort?.information?.name ||
        (plantSortId ? `Sorta biljke ${plantSortId}` : 'Nepoznata biljka')
    );
}

function getCurrentDateKey(status?: string | null) {
    switch (status) {
        case 'planned':
            return 'plantScheduledDate';
        case 'pendingVerification':
        case 'sowed':
            return 'plantSowDate';
        case 'sprouted':
            return 'plantGrowthDate';
        case 'firstFlowers':
            return 'plantFirstFlowersDate';
        case 'firstFruitSet':
            return 'plantFirstFruitSetDate';
        case 'ready':
            return 'plantReadyDate';
        case 'harvested':
            return 'plantHarvestedDate';
        case 'notSprouted':
        case 'died':
            return 'plantDeadDate';
        case 'removed':
            return 'plantRemovedDate';
        case 'new':
            return 'createdAt';
        default:
            return null;
    }
}

function normalizeDate(value?: Date | string | null) {
    if (!value) {
        return null;
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    return value;
}

function getPlantStatusDate(
    plantCycle: RaisedBedFieldPlantCycle | undefined,
    status: string,
) {
    const statusChanges = plantCycle?.statusChanges ?? [];
    for (let index = statusChanges.length - 1; index >= 0; index -= 1) {
        const statusChange = statusChanges[index];
        if (statusChange?.status === status) {
            return statusChange.occurredAt;
        }
    }

    return null;
}

type RaisedBedFieldTileProps = {
    field?: RaisedBedField;
    activePlantCycle?: RaisedBedFieldPlantCycle;
    positionIndex: number;
    plantSorts: PlantSortData[];
    raisedBedId: number;
    moveTargetOptions: Array<{
        value: string;
        label: string;
    }>;
};

export function RaisedBedLegacyPlantItem({
    field,
    activePlantCycle,
    positionIndex,
    plantSorts,
    raisedBedId,
    moveTargetOptions,
}: RaisedBedFieldTileProps) {
    const sort = field?.plantSortId
        ? plantSorts.find((item) => item.id === field.plantSortId)
        : undefined;
    const plantLabel = field
        ? getSortLabel(sort, field.plantSortId)
        : 'Prazno polje';
    const currentDateKey = getCurrentDateKey(field?.plantStatus);
    const dateItems: RaisedBedFieldDateItem[] = [
        {
            key: 'createdAt',
            label: 'Stvoreno',
            value: normalizeDate(field?.createdAt),
            current: currentDateKey === 'createdAt',
        },
        {
            key: 'plantScheduledDate',
            label: 'Planirano',
            value: normalizeDate(field?.plantScheduledDate),
            current: currentDateKey === 'plantScheduledDate',
        },
        {
            key: 'plantSowDate',
            label: 'Sijano',
            value: normalizeDate(field?.plantSowDate),
            current: currentDateKey === 'plantSowDate',
        },
        {
            key: 'plantGrowthDate',
            label: 'Proklijalo',
            value: normalizeDate(field?.plantGrowthDate),
            current: currentDateKey === 'plantGrowthDate',
        },
        {
            key: 'plantFirstFlowersDate',
            label: 'Prvi cvjetovi',
            value: normalizeDate(
                getPlantStatusDate(activePlantCycle, 'firstFlowers'),
            ),
            current: currentDateKey === 'plantFirstFlowersDate',
        },
        {
            key: 'plantFirstFruitSetDate',
            label: 'Prvi plodovi',
            value: normalizeDate(
                getPlantStatusDate(activePlantCycle, 'firstFruitSet'),
            ),
            current: currentDateKey === 'plantFirstFruitSetDate',
        },
        {
            key: 'plantReadyDate',
            label: 'Spremno',
            value: normalizeDate(field?.plantReadyDate),
            current: currentDateKey === 'plantReadyDate',
        },
        {
            key: 'plantHarvestedDate',
            label: 'Ubrano',
            value: normalizeDate(field?.plantHarvestedDate),
            current: currentDateKey === 'plantHarvestedDate',
        },
        {
            key: 'plantDeadDate',
            label: 'Uginulo',
            value: normalizeDate(field?.plantDeadDate),
            current: currentDateKey === 'plantDeadDate',
        },
        {
            key: 'plantRemovedDate',
            label: 'Uklonjeno',
            value: normalizeDate(field?.plantRemovedDate),
            current: currentDateKey === 'plantRemovedDate',
        },
    ];

    const locationControl =
        field?.active && field.plantSortId && activePlantCycle ? (
            <RaisedBedFieldLocationSelector
                raisedBedId={raisedBedId}
                positionIndex={positionIndex}
                expectedPlantCycleEventId={activePlantCycle.plantPlaceEventId}
                expectedPlantCycleVersionEventId={activePlantCycle.endedEventId}
                expectedPlantSortId={field.plantSortId}
                sowingLocation={field.sowingLocation}
                currentLocation={getCurrentLocation(field)}
                greenhouseCurrentLocationEligible={canFieldCurrentlyBeInGreenhouse(
                    field,
                )}
                className={raisedBedFieldCardChipClassName}
            />
        ) : undefined;
    const fieldBadge =
        field?.active && activePlantCycle ? (
            <MoveRaisedBedFieldPlantModal
                raisedBedId={raisedBedId}
                sourcePositionIndex={positionIndex}
                sourcePlantPlaceEventId={activePlantCycle.plantPlaceEventId}
                sourcePlantLabel={plantLabel}
                targetOptions={moveTargetOptions}
                triggerVariant="icon"
            />
        ) : (
            <div
                className={`rounded-full px-2 py-1 text-xs font-semibold ${raisedBedFieldCardButtonClassName}`}
            >
                {positionIndex + 1}
            </div>
        );
    const statusControl =
        field?.active &&
        field.plantStatus &&
        field.plantSortId &&
        activePlantCycle ? (
            <RaisedBedFieldStatusDateChip
                raisedBedId={raisedBedId}
                positionIndex={positionIndex}
                status={field.plantStatus}
                expectedPlantCycleEventId={activePlantCycle.plantPlaceEventId}
                expectedPlantCycleVersionEventId={activePlantCycle.endedEventId}
                expectedPlantSortId={field.plantSortId}
                expectedPlantStatusEventId={field.plantStatusEventId ?? null}
                date={dateItems.find((item) => item.current)?.value ?? null}
                dateItems={dateItems}
                compact
                className={raisedBedFieldCardButtonClassName}
            />
        ) : undefined;
    return (
        <RaisedBedPlantItem
            name={plantLabel}
            plantSort={sort}
            positionNumbers={[positionIndex + 1]}
            statusControl={statusControl}
            locationControl={locationControl}
            details={
                field && (
                    <RaisedBedPlantDetails
                        name={plantLabel}
                        positionNumbers={[positionIndex + 1]}
                        dates={dateItems.flatMap((item) =>
                            item.value
                                ? [{ label: item.label, value: item.value }]
                                : [],
                        )}
                    />
                )
            }
            actions={
                field?.active ? (
                    <>
                        {fieldBadge}
                        {activePlantCycle && field.plantSortId && (
                            <RaisedBedPlantSortCorrection
                                identity={{
                                    kind: 'legacy',
                                    raisedBedId,
                                    positionIndex,
                                    expectedPlantSortId: field.plantSortId,
                                    expectedPlantCycleEventId:
                                        activePlantCycle.plantPlaceEventId,
                                    expectedPlantCycleVersionEventId:
                                        activePlantCycle.endedEventId,
                                }}
                                name={
                                    sort?.information?.name ??
                                    `Sorta #${field.plantSortId}`
                                }
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
                    </>
                ) : undefined
            }
        />
    );
}
