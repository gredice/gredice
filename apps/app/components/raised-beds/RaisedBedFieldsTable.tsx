import type { PlantSortData } from '@gredice/client';
import { getEntitiesFormatted, getRaisedBed } from '@gredice/storage';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { RaisedBedFieldPlantSortSelector } from '../../app/admin/raised-beds/[raisedBedId]/RaisedBedFieldPlantSortSelector';
import { RaisedBedFieldPlantStatusSelector } from '../../app/admin/raised-beds/[raisedBedId]/RaisedBedFieldPlantStatusSelector';
import { NoDataPlaceholder } from '../shared/placeholders/NoDataPlaceholder';
import {
    RaisedBedRemovedFieldsModal,
    type RemovedFieldDetails,
} from './RaisedBedRemovedFieldsModal';

type RaisedBedField = NonNullable<
    Awaited<ReturnType<typeof getRaisedBed>>
>['fields'][number];

const fieldStatusMetadata: Record<string, { label: string; icon: string }> = {
    new: { label: 'Novo', icon: '🆕' },
    planned: { label: 'Planirano', icon: '🗓️' },
    sowed: { label: 'Sijano', icon: '🫘' },
    sprouted: { label: 'Proklijalo', icon: '🌱' },
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
    const sortsData = await getEntitiesFormatted<PlantSortData>('plantSort');
    const raisedBed = await getRaisedBed(raisedBedId);
    const fields = raisedBed?.fields ?? [];

    if (!raisedBed || fields.length === 0) {
        return <NoDataPlaceholder />;
    }

    // Currently fixed to 9 positions (0-8)
    const highestPositionIndex = 8;
    const orderedPositions = Array.from(
        { length: highestPositionIndex + 1 },
        (_, index) => index,
    ).sort((a, b) => b - a);

    if (orderedPositions.length === 0) {
        return <NoDataPlaceholder />;
    }

    return (
        <Stack spacing={3}>
            <div className="grid grid-cols-3">
                {orderedPositions.map((positionIndex) => {
                    const field = fields.find(
                        (item) =>
                            item.positionIndex === positionIndex && item.active,
                    );
                    const removedFieldsAtPosition = fields
                        .filter(
                            (f) =>
                                !f.active && f.positionIndex === positionIndex,
                        )
                        .sort((a, b) => {
                            const dateA = a.plantRemovedDate ?? a.createdAt;
                            const dateB = b.plantRemovedDate ?? b.createdAt;
                            if (!dateA || !dateB) return 0;
                            return (
                                new Date(dateB).getTime() -
                                new Date(dateA).getTime()
                            );
                        })
                        .map((f) => {
                            const sort = sortsData?.find(
                                (item) => item.id === f.plantSortId,
                            );
                            const statusMeta = getStatusMeta(f.plantStatus);
                            return {
                                id: f.id,
                                positionIndex: f.positionIndex,
                                plantLabel: getSortLabel(sort, f.plantSortId),
                                plantStatusLabel: statusMeta?.label ?? null,
                                plantStatusIcon: statusMeta?.icon ?? null,
                                sortData: sort,
                                createdAt: normalizeDate(f.createdAt),
                                plantScheduledDate: normalizeDate(
                                    f.plantScheduledDate,
                                ),
                                plantSowDate: normalizeDate(f.plantSowDate),
                                plantGrowthDate: normalizeDate(
                                    f.plantGrowthDate,
                                ),
                                plantReadyDate: normalizeDate(f.plantReadyDate),
                                plantHarvestedDate: normalizeDate(
                                    f.plantHarvestedDate,
                                ),
                                plantDeadDate: normalizeDate(f.plantDeadDate),
                                plantRemovedDate: normalizeDate(
                                    f.plantRemovedDate,
                                ),
                            } satisfies RemovedFieldDetails;
                        });

                    return (
                        <RaisedBedFieldTile
                            key={positionIndex}
                            field={field}
                            positionIndex={positionIndex}
                            plantSorts={sortsData ?? []}
                            raisedBedId={raisedBedId}
                            removedFields={removedFieldsAtPosition}
                        />
                    );
                })}
            </div>
        </Stack>
    );
}

type RaisedBedFieldTileProps = {
    field?: RaisedBedField;
    positionIndex: number;
    plantSorts: PlantSortData[];
    raisedBedId: number;
    removedFields: RemovedFieldDetails[];
};

function RaisedBedFieldTile({
    field,
    positionIndex,
    plantSorts,
    raisedBedId,
    removedFields,
}: RaisedBedFieldTileProps) {
    const sort = field?.plantSortId
        ? plantSorts.find((item) => item.id === field.plantSortId)
        : undefined;
    const plantLabel = field?.active
        ? getSortLabel(sort, field?.plantSortId)
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
            <div className="relative aspect-square bg-muted/40">
                {field?.active && sort ? (
                    <PlantOrSortImage
                        plantSort={sort}
                        alt={plantLabel}
                        fill
                        className="object-cover p-4 md:p-6"
                        sizes="(min-width: 1280px) 18rem, (min-width: 768px) 16rem, 100vw"
                    />
                ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                        <Typography level="body2">Nema slike</Typography>
                    </div>
                )}
                {removedFields.length > 0 && (
                    <div className="absolute bottom-2 left-2">
                        <RaisedBedRemovedFieldsModal fields={removedFields} />
                    </div>
                )}
                <div className="absolute bottom-2 right-2 rounded-full bg-background/90 px-2 py-1 text-xs font-semibold shadow">
                    #{positionIndex + 1}
                </div>
            </div>
            <div className="flex flex-1 flex-col gap-3 p-2">
                {field?.active && (
                    <Stack spacing={1} className="flex-1">
                        {field.plantStatus && (
                            <RaisedBedFieldPlantStatusSelector
                                raisedBedId={raisedBedId}
                                positionIndex={positionIndex}
                                status={field.plantStatus}
                            />
                        )}
                        <Stack spacing={1} className="flex-1">
                            <Typography
                                level="body2"
                                className="text-muted-foreground"
                            >
                                Datumi
                            </Typography>
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
                    </Stack>
                )}
            </div>
        </div>
    );
}
