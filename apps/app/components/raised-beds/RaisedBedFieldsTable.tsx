import type { PlantSortData } from '@gredice/client';
import {
    getEntitiesFormatted,
    getRaisedBed,
    getRaisedBedFieldPlantCycles,
} from '@gredice/storage';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { RaisedBedFieldPlantSortSelector } from '../../app/admin/raised-beds/[raisedBedId]/RaisedBedFieldPlantSortSelector';
import { RaisedBedFieldPlantStatusSelector } from '../../app/admin/raised-beds/[raisedBedId]/RaisedBedFieldPlantStatusSelector';
import { NoDataPlaceholder } from '../shared/placeholders/NoDataPlaceholder';
import { MoveRaisedBedFieldPlantModal } from './MoveRaisedBedFieldPlantModal';
import {
    RaisedBedRemovedFieldsModal,
    type RemovedFieldDetails,
} from './RaisedBedRemovedFieldsModal';

type RaisedBedField = NonNullable<
    Awaited<ReturnType<typeof getRaisedBed>>
>['fields'][number];
type RaisedBedFieldPlantCycle = Awaited<
    ReturnType<typeof getRaisedBedFieldPlantCycles>
>[number];

const fieldStatusMetadata: Record<string, { label: string; icon: string }> = {
    new: { label: 'Novo', icon: '🆕' },
    planned: { label: 'Planirano', icon: '🗓️' },
    pendingVerification: { label: 'Čeka verifikaciju', icon: '🔍' },
    sowed: { label: 'Sijano', icon: '🫘' },
    sprouted: { label: 'Proklijalo', icon: '🌱' },
    firstFlowers: { label: 'Prvi cvjetovi', icon: '🌸' },
    firstFruitSet: { label: 'Prvi plodovi', icon: '🍅' },
    notSprouted: { label: 'Nije proklijalo', icon: '❌' },
    died: { label: 'Uginulo', icon: '💀' },
    ready: { label: 'Spremno', icon: '🥕' },
    harvested: { label: 'Ubrano', icon: '🌾' },
    removed: { label: 'Uklonjeno', icon: '🗑️' },
};

function getStatusMeta(status?: string | null) {
    if (!status) {
        return undefined;
    }

    return fieldStatusMetadata[status] ?? { label: status, icon: '' };
}

function getSortLabel(sort?: PlantSortData, plantSortId?: number | null) {
    return (
        sort?.information?.name ||
        (plantSortId ? `Sorta biljke ${plantSortId}` : 'Nepoznata biljka')
    );
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

interface RaisedBedFieldsTableProps {
    raisedBedId: number;
}

export async function RaisedBedFieldsTable({
    raisedBedId,
}: RaisedBedFieldsTableProps) {
    const [sortsData, raisedBed, plantCycles] = await Promise.all([
        getEntitiesFormatted<PlantSortData>('plantSort'),
        getRaisedBed(raisedBedId),
        getRaisedBedFieldPlantCycles(raisedBedId),
    ]);
    const fields = raisedBed?.fields ?? [];

    if (!raisedBed || fields.length === 0) {
        return <NoDataPlaceholder />;
    }

    const plantCyclesByPosition = new Map<number, RaisedBedFieldPlantCycle[]>();
    for (const plantCycle of plantCycles) {
        const positionPlantCycles = plantCyclesByPosition.get(
            plantCycle.positionIndex,
        );
        if (positionPlantCycles) {
            positionPlantCycles.push(plantCycle);
        } else {
            plantCyclesByPosition.set(plantCycle.positionIndex, [plantCycle]);
        }
    }

    const highestPositionIndex = Math.max(
        8,
        ...fields.map((f) => f.positionIndex),
    );
    const orderedPositions = Array.from(
        { length: highestPositionIndex + 1 },
        (_, index) => index,
    ).sort((a, b) => b - a);

    if (orderedPositions.length === 0) {
        return <NoDataPlaceholder />;
    }

    return (
        <Stack spacing={3}>
            <div className="grid gap-3 grid-cols-3">
                {orderedPositions.map((positionIndex) => {
                    const positionPlantCycles = [
                        ...(plantCyclesByPosition.get(positionIndex) ?? []),
                    ].sort(
                        (left, right) =>
                            new Date(right.startedAt).getTime() -
                            new Date(left.startedAt).getTime(),
                    );
                    const activePlantCycle = positionPlantCycles.find(
                        (plantCycle) => plantCycle.active,
                    );
                    const field = fields.find(
                        (item) =>
                            item.positionIndex === positionIndex &&
                            item.active &&
                            typeof item.plantSortId === 'number',
                    );
                    const moveTargetOptions = [...orderedPositions]
                        .sort((a, b) => a - b)
                        .filter(
                            (targetPositionIndex) =>
                                targetPositionIndex !== positionIndex,
                        )
                        .map((targetPositionIndex) => {
                            const targetField = fields.find(
                                (item) =>
                                    item.positionIndex ===
                                        targetPositionIndex &&
                                    item.active &&
                                    typeof item.plantSortId === 'number',
                            );
                            const targetSort = targetField?.plantSortId
                                ? sortsData?.find(
                                      (item) =>
                                          item.id === targetField.plantSortId,
                                  )
                                : undefined;

                            return {
                                value: targetPositionIndex.toString(),
                                label: `Polje ${targetPositionIndex + 1} · ${
                                    targetField
                                        ? getSortLabel(
                                              targetSort,
                                              targetField.plantSortId,
                                          )
                                        : 'Prazno'
                                }`,
                            };
                        });
                    const removedFieldsAtPosition = positionPlantCycles
                        .filter((plantCycle) => !plantCycle.active)
                        .map((plantCycle) => {
                            const sort = sortsData?.find(
                                (item) => item.id === plantCycle.plantSortId,
                            );
                            const statusMeta = getStatusMeta(
                                plantCycle.plantStatus,
                            );
                            return {
                                id: plantCycle.plantPlaceEventId,
                                positionIndex: plantCycle.positionIndex,
                                plantPlaceEventId: plantCycle.plantPlaceEventId,
                                plantLabel: getSortLabel(
                                    sort,
                                    plantCycle.plantSortId,
                                ),
                                plantStatusLabel: statusMeta?.label ?? null,
                                plantStatusIcon: statusMeta?.icon ?? null,
                                sortData: sort,
                                createdAt: normalizeDate(plantCycle.startedAt),
                                plantScheduledDate: normalizeDate(
                                    plantCycle.plantScheduledDate,
                                ),
                                plantSowDate: normalizeDate(
                                    plantCycle.plantSowDate,
                                ),
                                plantGrowthDate: normalizeDate(
                                    plantCycle.plantGrowthDate,
                                ),
                                plantReadyDate: normalizeDate(
                                    plantCycle.plantReadyDate,
                                ),
                                plantHarvestedDate: normalizeDate(
                                    plantCycle.plantHarvestedDate,
                                ),
                                plantDeadDate: normalizeDate(
                                    plantCycle.plantDeadDate,
                                ),
                                plantRemovedDate: normalizeDate(
                                    plantCycle.plantRemovedDate ??
                                        plantCycle.endedAt,
                                ),
                            } satisfies RemovedFieldDetails;
                        })
                        .sort((a, b) => {
                            const dateA = a.plantRemovedDate ?? a.createdAt;
                            const dateB = b.plantRemovedDate ?? b.createdAt;
                            if (!dateA || !dateB) return 0;
                            return (
                                new Date(dateB).getTime() -
                                new Date(dateA).getTime()
                            );
                        });

                    return (
                        <RaisedBedFieldTile
                            key={positionIndex}
                            field={field}
                            activePlantCycle={activePlantCycle}
                            positionIndex={positionIndex}
                            plantSorts={sortsData ?? []}
                            raisedBedId={raisedBedId}
                            removedFields={removedFieldsAtPosition}
                            moveTargetOptions={moveTargetOptions}
                        />
                    );
                })}
            </div>
        </Stack>
    );
}

type RaisedBedFieldTileProps = {
    field?: RaisedBedField;
    activePlantCycle?: RaisedBedFieldPlantCycle;
    positionIndex: number;
    plantSorts: PlantSortData[];
    raisedBedId: number;
    removedFields: RemovedFieldDetails[];
    moveTargetOptions: Array<{
        value: string;
        label: string;
    }>;
};

function RaisedBedFieldTile({
    field,
    activePlantCycle,
    positionIndex,
    plantSorts,
    raisedBedId,
    removedFields,
    moveTargetOptions,
}: RaisedBedFieldTileProps) {
    const sort = field?.plantSortId
        ? plantSorts.find((item) => item.id === field.plantSortId)
        : undefined;
    const plantLabel = field
        ? getSortLabel(sort, field.plantSortId)
        : 'Prazno polje';
    const dateItems: {
        label: string;
        value: Date | string | null | undefined;
    }[] = [
        { label: 'Stvoreno', value: field?.createdAt },
        { label: 'Planirano', value: field?.plantScheduledDate },
        { label: 'Sijano', value: field?.plantSowDate },
        { label: 'Proklijalo', value: field?.plantGrowthDate },
        { label: 'Spremno', value: field?.plantReadyDate },
        { label: 'Ubrano', value: field?.plantHarvestedDate },
        { label: 'Uginulo', value: field?.plantDeadDate },
        { label: 'Uklonjeno', value: field?.plantRemovedDate },
    ];

    return (
        <div className="flex h-full flex-col overflow-hidden rounded-lg border bg-background shadow-sm">
            <RaisedBedFieldPlantSortSelector
                raisedBedId={raisedBedId}
                positionIndex={positionIndex}
                status={field?.plantStatus ?? null}
                plantSortId={field?.plantSortId}
                plantSorts={plantSorts}
            />
            <div className="relative aspect-[4/3] bg-muted/40">
                {field?.active && sort ? (
                    <PlantOrSortImage
                        plantSort={sort}
                        alt={plantLabel}
                        fill
                        className="object-cover p-2 md:p-3"
                        sizes="(min-width: 1536px) 14rem, (min-width: 1280px) 16rem, (min-width: 768px) 18rem, 50vw"
                    />
                ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                        <Typography level="body2">Nema slike</Typography>
                    </div>
                )}
                {removedFields.length > 0 && (
                    <div className="absolute bottom-2 left-2">
                        <RaisedBedRemovedFieldsModal
                            raisedBedId={raisedBedId}
                            fields={removedFields}
                            targetOptions={moveTargetOptions}
                        />
                    </div>
                )}
                <div className="absolute bottom-2 right-2 rounded-full bg-background/90 px-2 py-1 text-xs font-semibold shadow">
                    #{positionIndex + 1}
                </div>
            </div>
            <div className="flex flex-1 flex-col gap-2 p-2">
                {field?.active && (
                    <Stack spacing={1} className="flex-1">
                        {field.plantStatus && (
                            <RaisedBedFieldPlantStatusSelector
                                raisedBedId={raisedBedId}
                                positionIndex={positionIndex}
                                status={field.plantStatus}
                            />
                        )}
                        {activePlantCycle && (
                            <MoveRaisedBedFieldPlantModal
                                raisedBedId={raisedBedId}
                                sourcePositionIndex={positionIndex}
                                sourcePlantPlaceEventId={
                                    activePlantCycle.plantPlaceEventId
                                }
                                sourcePlantLabel={plantLabel}
                                targetOptions={moveTargetOptions}
                            />
                        )}
                        <Stack>
                            {dateItems.map(({ label, value }) => (
                                <Row
                                    key={label}
                                    spacing={1}
                                    alignItems="center"
                                >
                                    <Typography
                                        level="body3"
                                        className="w-20 text-muted-foreground"
                                    >
                                        {label}
                                    </Typography>
                                    {value ? (
                                        <Typography level="body3" noWrap>
                                            <LocalDateTime time={false}>
                                                {value}
                                            </LocalDateTime>
                                        </Typography>
                                    ) : (
                                        <Typography
                                            level="body3"
                                            className="text-muted-foreground"
                                        >
                                            -
                                        </Typography>
                                    )}
                                </Row>
                            ))}
                        </Stack>
                    </Stack>
                )}
            </div>
        </div>
    );
}
