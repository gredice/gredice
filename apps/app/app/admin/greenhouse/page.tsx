import {
    getAllRaisedBeds,
    getEntitiesFormatted,
    getOperations,
} from '@gredice/storage';
import { Card, CardHeader, CardOverflow } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@gredice/ui/Row';
import { RaisedBedLabel } from '@gredice/ui/raisedBeds';
import { Stack } from '@gredice/ui/Stack';
import { Table } from '@gredice/ui/Table';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import type { EntityStandardized } from '../../../lib/@types/EntityStandardized';
import { auth } from '../../../lib/auth/auth';
import { KnownPages } from '../../../src/KnownPages';
import { SEEDLING_TRANSPLANTING_OPERATION_ENTITY_ID } from './constants';
import { SeedlingTransplantingQuickAction } from './SeedlingTransplantingQuickAction';
import { SproutedDateQuickAction } from './SproutedDateQuickAction';

export const dynamic = 'force-dynamic';

type RaisedBed = Awaited<ReturnType<typeof getAllRaisedBeds>>[number];
type RaisedBedField = RaisedBed['fields'][number];
type GreenhouseRaisedBedField = RaisedBedField & {
    plantSortId: number;
};

const greenhouseStatuses = new Set([
    'new',
    'planned',
    'pendingVerification',
    'sowed',
    'sprouted',
]);

const fieldStatusMetadata: Record<
    string,
    { label: string; color?: 'success' }
> = {
    new: { label: 'Novo' },
    planned: { label: 'Planirano' },
    pendingVerification: { label: 'Čeka verifikaciju' },
    sowed: { label: 'Sijano' },
    sprouted: { label: 'Proklijalo', color: 'success' },
};

function isGreenhouseField(
    field: RaisedBedField,
): field is GreenhouseRaisedBedField {
    return (
        field.active &&
        field.sowingLocation === 'greenhouse' &&
        greenhouseStatuses.has(field.plantStatus ?? '') &&
        typeof field.plantSortId === 'number' &&
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

function getPlantSortName(
    plantSortNames: Map<number, string>,
    plantSortId: number,
) {
    return plantSortNames.get(plantSortId) ?? `Sorta ${plantSortId}`;
}

function getStatusLabel(status: string | null | undefined) {
    if (!status) {
        return 'Nepoznato';
    }

    return fieldStatusMetadata[status]?.label ?? status;
}

export default async function AdminGreenhousePage() {
    await auth(['admin']);

    const [raisedBeds, plantSorts] = await Promise.all([
        getAllRaisedBeds(),
        getEntitiesFormatted<EntityStandardized>('plantSort'),
    ]);
    const plantSortNames = new Map(
        (plantSorts ?? []).map((plantSort) => [
            plantSort.id,
            plantSort.information?.name?.trim() || `Sorta ${plantSort.id}`,
        ]),
    );
    const greenhouseRaisedBeds = raisedBeds
        .map((raisedBed) => ({
            ...raisedBed,
            fields: raisedBed.fields
                .filter(isGreenhouseField)
                .sort(
                    (left, right) => left.positionIndex - right.positionIndex,
                ),
        }))
        .filter((raisedBed) => raisedBed.fields.length > 0)
        .sort(compareRaisedBeds);

    if (greenhouseRaisedBeds.length === 0) {
        return (
            <NoDataPlaceholder>
                Nema aktivnih biljaka u stakleniku.
            </NoDataPlaceholder>
        );
    }

    const transplantingOperationIdsByFieldId = new Map<number, number>();
    const transplantingOperations = (
        await Promise.all(
            greenhouseRaisedBeds.map((raisedBed) => {
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
    for (const operation of transplantingOperations) {
        if (
            operation.entityTypeName === 'operation' &&
            operation.entityId === SEEDLING_TRANSPLANTING_OPERATION_ENTITY_ID &&
            operation.status !== 'canceled' &&
            operation.raisedBedFieldId != null &&
            !transplantingOperationIdsByFieldId.has(operation.raisedBedFieldId)
        ) {
            transplantingOperationIdsByFieldId.set(
                operation.raisedBedFieldId,
                operation.id,
            );
        }
    }

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
                            <Typography
                                level="body2"
                                className="shrink-0 text-muted-foreground"
                            >
                                {raisedBed.fields.length} polja
                            </Typography>
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
                                    <Table.Head>Sijano</Table.Head>
                                    <Table.Head>Proklijalo</Table.Head>
                                    <Table.Head>Presađivanje</Table.Head>
                                    <Table.Head>Status</Table.Head>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {raisedBed.fields.map((field) => {
                                    const statusMeta =
                                        field.plantStatus != null
                                            ? fieldStatusMetadata[
                                                  field.plantStatus
                                              ]
                                            : undefined;

                                    return (
                                        <Table.Row
                                            key={`${raisedBed.id}-${field.positionIndex}`}
                                        >
                                            <Table.Cell className="font-medium">
                                                {field.positionIndex + 1}
                                            </Table.Cell>
                                            <Table.Cell>
                                                {getPlantSortName(
                                                    plantSortNames,
                                                    field.plantSortId,
                                                )}
                                            </Table.Cell>
                                            <Table.Cell>
                                                {field.plantSowDate ? (
                                                    <LocalDateTime time={false}>
                                                        {field.plantSowDate}
                                                    </LocalDateTime>
                                                ) : (
                                                    '-'
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
                                            <Table.Cell>
                                                <Chip
                                                    color={statusMeta?.color}
                                                    size="sm"
                                                >
                                                    {getStatusLabel(
                                                        field.plantStatus,
                                                    )}
                                                </Chip>
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
