import type { PlantSortData } from '@gredice/client';
import {
    getAllRaisedBeds,
    getEntitiesFormatted,
    getOperations,
} from '@gredice/storage';
import { Card, CardHeader, CardOverflow } from '@gredice/ui/Card';
import { Chip, type ColorPaletteProp } from '@gredice/ui/Chip';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { Row } from '@gredice/ui/Row';
import { RaisedBedLabel } from '@gredice/ui/raisedBeds';
import { Stack } from '@gredice/ui/Stack';
import { Table } from '@gredice/ui/Table';
import Link from 'next/link';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import { auth } from '../../../lib/auth/auth';
import { KnownPages } from '../../../src/KnownPages';
import { SEEDLING_TRANSPLANTING_OPERATION_ENTITY_ID } from './constants';
import { isOperationInActivePlantCycle } from './operationMatching';
import { SeedlingTransplantingQuickAction } from './SeedlingTransplantingQuickAction';
import { SproutedDateQuickAction } from './SproutedDateQuickAction';

export const dynamic = 'force-dynamic';

const GREENHOUSE_PLANT_STATUSES = new Set([
    'new',
    'planned',
    'pendingVerification',
    'sowed',
    'sprouted',
]);

const statusLabels: Record<string, string> = {
    new: 'Novo',
    planned: 'Planirano',
    pendingVerification: 'Čeka verifikaciju',
    sowed: 'Sijano',
    sprouted: 'Proklijalo',
};

type RaisedBed = Awaited<ReturnType<typeof getAllRaisedBeds>>[number];
type RaisedBedField = RaisedBed['fields'][number];
type GreenhouseRaisedBedField = RaisedBedField & { plantSortId: number };
type GreenhouseRaisedBed = Omit<RaisedBed, 'fields'> & {
    fields: GreenhouseRaisedBedField[];
};

function canFieldCurrentlyBeInGreenhouse(
    field: RaisedBedField,
): field is GreenhouseRaisedBedField {
    return (
        field.active &&
        field.sowingLocation === 'greenhouse' &&
        typeof field.plantSortId === 'number' &&
        GREENHOUSE_PLANT_STATUSES.has(field.plantStatus ?? '') &&
        !field.plantDeadDate &&
        !field.plantHarvestedDate &&
        !field.plantRemovedDate
    );
}

function compareRaisedBeds(left: RaisedBed, right: RaisedBed) {
    const leftLabel = left.physicalId ?? left.name ?? left.id.toString();
    const rightLabel = right.physicalId ?? right.name ?? right.id.toString();

    return leftLabel.localeCompare(rightLabel, 'hr-HR', {
        numeric: true,
        sensitivity: 'base',
    });
}

function getStatusColor(status?: string | null): ColorPaletteProp {
    switch (status) {
        case 'planned':
            return 'info';
        case 'pendingVerification':
            return 'warning';
        case 'sowed':
            return 'primary';
        case 'sprouted':
            return 'success';
        default:
            return 'neutral';
    }
}

function getPlantName(
    plantSort: PlantSortData | undefined,
    plantSortId: number,
) {
    return (
        plantSort?.information?.name?.trim() ??
        `Nepoznata sorta #${plantSortId}`
    );
}

function localCalendarDayIndex(date: Date) {
    const millisecondsPerDay = 24 * 60 * 60 * 1000;

    return (
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) /
        millisecondsPerDay
    );
}

function formatDayCount(days: number) {
    return days === 1 ? '1 dan' : `${days} dana`;
}

function daysBetweenDates(startDate: Date, endDate: Date) {
    const difference =
        localCalendarDayIndex(endDate) - localCalendarDayIndex(startDate);

    return Math.max(0, difference);
}

function sowingDateCell(
    sowDate: Date | undefined,
    sproutedDate: Date | undefined,
    today: Date,
) {
    if (!sowDate) {
        return <span className="text-muted-foreground">-</span>;
    }

    const targetDate = sproutedDate ?? today;
    const dayCount = daysBetweenDates(sowDate, targetDate);
    const label = sproutedDate
        ? `${formatDayCount(dayCount)} do klijanja`
        : `${formatDayCount(dayCount)} do danas`;

    return (
        <div className="space-y-0.5">
            <LocalDateTime time={false}>{sowDate}</LocalDateTime>
            <div className="text-xs tabular-nums text-muted-foreground">
                {label}
            </div>
        </div>
    );
}

function getGreenhouseRaisedBeds(
    raisedBeds: RaisedBed[],
): GreenhouseRaisedBed[] {
    return raisedBeds
        .map((raisedBed) => ({
            ...raisedBed,
            fields: raisedBed.fields
                .filter(canFieldCurrentlyBeInGreenhouse)
                .sort(
                    (left, right) => left.positionIndex - right.positionIndex,
                ),
        }))
        .filter((raisedBed) => raisedBed.fields.length > 0)
        .sort(compareRaisedBeds);
}

async function getTransplantingOperationIdsByFieldId(
    raisedBeds: GreenhouseRaisedBed[],
) {
    const fieldsById = new Map(
        raisedBeds.flatMap((raisedBed) =>
            raisedBed.fields.map((field) => [field.id, field] as const),
        ),
    );
    const operations = (
        await Promise.all(
            raisedBeds.map((raisedBed) => {
                if (!raisedBed.accountId) {
                    return Promise.resolve([]);
                }

                return getOperations(
                    raisedBed.accountId,
                    raisedBed.gardenId ?? undefined,
                    raisedBed.id,
                    raisedBed.fields.map((field) => field.id),
                );
            }),
        )
    ).flat();
    const operationIdsByFieldId = new Map<number, number>();

    for (const operation of operations) {
        const field =
            operation.raisedBedFieldId != null
                ? fieldsById.get(operation.raisedBedFieldId)
                : undefined;

        if (
            field &&
            operation.entityTypeName === 'operation' &&
            operation.entityId === SEEDLING_TRANSPLANTING_OPERATION_ENTITY_ID &&
            isOperationInActivePlantCycle(operation, field) &&
            !operationIdsByFieldId.has(field.id)
        ) {
            operationIdsByFieldId.set(field.id, operation.id);
        }
    }

    return operationIdsByFieldId;
}

export default async function GreenhousePage() {
    await auth(['admin']);

    const [raisedBeds, plantSorts] = await Promise.all([
        getAllRaisedBeds(),
        getEntitiesFormatted<PlantSortData>('plantSort'),
    ]);
    const plantSortById = new Map(
        (plantSorts ?? []).map((plantSort) => [plantSort.id, plantSort]),
    );
    const greenhouseRaisedBeds = getGreenhouseRaisedBeds(raisedBeds);

    if (greenhouseRaisedBeds.length === 0) {
        return (
            <NoDataPlaceholder>
                Nema biljaka koje su trenutno u stakleniku.
            </NoDataPlaceholder>
        );
    }

    const transplantingOperationIdsByFieldId =
        await getTransplantingOperationIdsByFieldId(greenhouseRaisedBeds);
    const today = new Date();

    return (
        <Stack spacing={3}>
            {greenhouseRaisedBeds.map((raisedBed) => (
                <Card key={raisedBed.id}>
                    <CardHeader>
                        <Row
                            spacing={2}
                            className="items-center justify-between gap-y-2"
                        >
                            <Link
                                href={KnownPages.RaisedBed(raisedBed.id)}
                                className="rounded-md outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            >
                                <RaisedBedLabel
                                    name={raisedBed.name}
                                    physicalId={raisedBed.physicalId}
                                    size="compact"
                                />
                            </Link>
                            <Chip size="sm">
                                Biljaka: {raisedBed.fields.length}
                            </Chip>
                        </Row>
                    </CardHeader>
                    <CardOverflow>
                        <Table>
                            <Table.Header>
                                <Table.Row>
                                    <Table.Head className="w-20">
                                        Polje
                                    </Table.Head>
                                    <Table.Head>Biljka</Table.Head>
                                    <Table.Head>Status</Table.Head>
                                    <Table.Head>Sijano</Table.Head>
                                    <Table.Head>Proklijalo</Table.Head>
                                    <Table.Head>Presađivanje</Table.Head>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {raisedBed.fields.map((field) => {
                                    const plantSort = plantSortById.get(
                                        field.plantSortId,
                                    );
                                    const plantName = getPlantName(
                                        plantSort,
                                        field.plantSortId,
                                    );

                                    return (
                                        <Table.Row
                                            key={`${raisedBed.id}-${field.id}`}
                                        >
                                            <Table.Cell className="font-medium">
                                                {field.positionIndex + 1}
                                            </Table.Cell>
                                            <Table.Cell>
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <div className="relative size-9 shrink-0 overflow-hidden rounded-md border bg-muted/30">
                                                        <PlantOrSortImage
                                                            plantSort={
                                                                plantSort
                                                            }
                                                            alt={plantName}
                                                            fill
                                                            className="object-contain"
                                                            sizes="36px"
                                                        />
                                                    </div>
                                                    <span className="min-w-0 font-medium">
                                                        {plantName}
                                                    </span>
                                                </div>
                                            </Table.Cell>
                                            <Table.Cell>
                                                <Chip
                                                    color={getStatusColor(
                                                        field.plantStatus,
                                                    )}
                                                    size="sm"
                                                >
                                                    {statusLabels[
                                                        field.plantStatus ?? ''
                                                    ] ??
                                                        field.plantStatus ??
                                                        'Nepoznato'}
                                                </Chip>
                                            </Table.Cell>
                                            <Table.Cell>
                                                {sowingDateCell(
                                                    field.plantSowDate,
                                                    field.plantGrowthDate,
                                                    today,
                                                )}
                                            </Table.Cell>
                                            <Table.Cell>
                                                <SproutedDateQuickAction
                                                    raisedBedId={raisedBed.id}
                                                    positionIndex={
                                                        field.positionIndex
                                                    }
                                                    sproutedDate={
                                                        field.plantGrowthDate ??
                                                        null
                                                    }
                                                />
                                            </Table.Cell>
                                            <Table.Cell>
                                                {field.plantStatus ===
                                                    'sprouted' &&
                                                raisedBed.accountId ? (
                                                    <SeedlingTransplantingQuickAction
                                                        raisedBedId={
                                                            raisedBed.id
                                                        }
                                                        positionIndex={
                                                            field.positionIndex
                                                        }
                                                        existingOperationId={
                                                            transplantingOperationIdsByFieldId.get(
                                                                field.id,
                                                            ) ?? null
                                                        }
                                                    />
                                                ) : (
                                                    '-'
                                                )}
                                            </Table.Cell>
                                        </Table.Row>
                                    );
                                })}
                            </Table.Body>
                        </Table>
                    </CardOverflow>
                </Card>
            ))}
        </Stack>
    );
}
