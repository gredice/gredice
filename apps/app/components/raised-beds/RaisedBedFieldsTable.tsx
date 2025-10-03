import { getEntitiesFormatted, getRaisedBed } from '@gredice/storage';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import Image from 'next/image';
import { RaisedBedFieldPlantSortSelector } from '../../app/admin/raised-beds/[raisedBedId]/RaisedBedFieldPlantSortSelector';
import { RaisedBedFieldPlantStatusSelector } from '../../app/admin/raised-beds/[raisedBedId]/RaisedBedFieldPlantStatusSelector';
import type { EntityStandardized } from '../../lib/@types/EntityStandardized';
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

function resolveImageUrl(url?: string | null) {
    if (!url) {
        return null;
    }

    if (url.startsWith('http')) {
        return url;
    }

    if (url.startsWith('//')) {
        return `https:${url}`;
    }

    return `https://www.gredice.com${url.startsWith('/') ? '' : '/'}${url}`;
}

function getSortImage(sort?: EntityStandardized) {
    const url = sort?.images?.cover?.url ?? sort?.image?.cover?.url;
    return resolveImageUrl(url);
}

function getSortLabel(sort?: EntityStandardized, plantSortId?: number | null) {
    return (
        sort?.information?.label ||
        sort?.information?.name ||
        (plantSortId ? `Biljka ${plantSortId}` : 'Nepoznata biljka')
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
    const sortsData =
        await getEntitiesFormatted<EntityStandardized>('plantSort');
    const raisedBed = await getRaisedBed(raisedBedId);
    const fields = raisedBed?.fields ?? [];

    if (!raisedBed || fields.length === 0) {
        return <NoDataPlaceholder />;
    }

    const removedFieldsDetails: RemovedFieldDetails[] = fields
        .filter((field) => !field.active)
        .sort((a, b) => b.positionIndex - a.positionIndex)
        .map((field) => {
            const sort = sortsData?.find(
                (item) => item.id === field.plantSortId,
            );
            const statusMeta = getStatusMeta(field.plantStatus);
            return {
                id: field.id,
                positionIndex: field.positionIndex,
                plantLabel: getSortLabel(sort, field.plantSortId),
                plantStatusLabel: statusMeta?.label ?? null,
                plantStatusIcon: statusMeta?.icon ?? null,
                imageUrl: getSortImage(sort),
                createdAt: normalizeDate(field.createdAt),
                plantScheduledDate: normalizeDate(field.plantScheduledDate),
                plantSowDate: normalizeDate(field.plantSowDate),
                plantGrowthDate: normalizeDate(field.plantGrowthDate),
                plantReadyDate: normalizeDate(field.plantReadyDate),
                plantHarvestedDate: normalizeDate(field.plantHarvestedDate),
                plantDeadDate: normalizeDate(field.plantDeadDate),
                plantRemovedDate: normalizeDate(field.plantRemovedDate),
            } satisfies RemovedFieldDetails;
        });

    const highestPositionIndex = fields.reduce(
        (max, field) => Math.max(max, field.positionIndex),
        -1,
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
            {removedFieldsDetails.length > 0 && (
                <div className="flex justify-end">
                    <RaisedBedRemovedFieldsModal
                        fields={removedFieldsDetails}
                    />
                </div>
            )}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {orderedPositions.map((positionIndex) => {
                    const field = fields.find(
                        (item) => item.positionIndex === positionIndex,
                    );
                    return (
                        <RaisedBedFieldTile
                            key={positionIndex}
                            field={field}
                            positionIndex={positionIndex}
                            plantSorts={sortsData ?? []}
                            raisedBedId={raisedBedId}
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
    plantSorts: EntityStandardized[];
    raisedBedId: number;
};

function RaisedBedFieldTile({
    field,
    positionIndex,
    plantSorts,
    raisedBedId,
}: RaisedBedFieldTileProps) {
    const sort = field?.plantSortId
        ? plantSorts.find((item) => item.id === field.plantSortId)
        : undefined;
    const plantLabel = field?.active
        ? getSortLabel(sort, field?.plantSortId)
        : 'Prazno polje';
    const imageUrl = field?.active ? getSortImage(sort) : null;
    const statusMeta = getStatusMeta(field?.plantStatus);
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
            <div className="relative aspect-square bg-muted/40">
                {imageUrl ? (
                    <Image
                        src={imageUrl}
                        alt={plantLabel}
                        fill
                        className="object-cover"
                        sizes="(min-width: 1280px) 18rem, (min-width: 768px) 16rem, 100vw"
                    />
                ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                        <Typography level="body2">Nema slike</Typography>
                    </div>
                )}
                <div className="absolute bottom-2 right-2 rounded-full bg-background/90 px-2 py-1 text-xs font-semibold shadow">
                    #{positionIndex + 1}
                </div>
            </div>
            <div className="flex flex-1 flex-col gap-3 p-4">
                <Stack spacing={0.5}>
                    <Typography level="body2" uppercase semiBold>
                        Polje {positionIndex + 1}
                    </Typography>
                    <Typography level="body1" semiBold>
                        {plantLabel}
                    </Typography>
                    {field?.active && statusMeta && (
                        <Typography
                            level="body2"
                            className="text-muted-foreground"
                        >
                            {statusMeta.icon ? `${statusMeta.icon} ` : ''}
                            {statusMeta.label}
                        </Typography>
                    )}
                </Stack>
                {field?.active ? (
                    <Stack spacing={2} className="flex-1">
                        <Stack spacing={1}>
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                Biljka
                            </Typography>
                            <RaisedBedFieldPlantSortSelector
                                raisedBedId={raisedBedId}
                                positionIndex={positionIndex}
                                status={field.plantStatus ?? null}
                                plantSortId={field.plantSortId}
                                plantSorts={plantSorts}
                            />
                        </Stack>
                        <Stack spacing={1}>
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                Status
                            </Typography>
                            {field.plantStatus ? (
                                <RaisedBedFieldPlantStatusSelector
                                    raisedBedId={raisedBedId}
                                    positionIndex={positionIndex}
                                    status={field.plantStatus}
                                />
                            ) : (
                                <Typography
                                    level="body3"
                                    className="text-muted-foreground"
                                >
                                    -
                                </Typography>
                            )}
                        </Stack>
                        <Stack spacing={1} className="flex-1">
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                Datumi
                            </Typography>
                            <Stack spacing={0.5}>
                                {dateItems.map(({ label, value }) => (
                                    <Row
                                        key={label}
                                        spacing={1}
                                        alignItems="center"
                                    >
                                        <Typography
                                            level="body4"
                                            className="w-24 text-muted-foreground"
                                        >
                                            {label}
                                        </Typography>
                                        {value ? (
                                            <LocalDateTime time={false}>
                                                {value}
                                            </LocalDateTime>
                                        ) : (
                                            <Typography
                                                level="body4"
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
                ) : (
                    <Typography level="body3" className="text-muted-foreground">
                        Ovo polje trenutačno nema aktivnu biljku. Povijest je
                        dostupna u odjeljku „Uklonjena polja”.
                    </Typography>
                )}
            </div>
        </div>
    );
}
