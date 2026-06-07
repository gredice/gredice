import type { PlantSortData } from '@gredice/client';
import { getAllRaisedBeds, getEntitiesFormatted } from '@gredice/storage';
import { Card, CardHeader, CardOverflow } from '@gredice/ui/Card';
import { Chip, type ColorPaletteProp } from '@gredice/ui/Chip';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@gredice/ui/Row';
import { RaisedBedLabel } from '@gredice/ui/raisedBeds';
import { Stack } from '@gredice/ui/Stack';
import { Table } from '@gredice/ui/Table';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import { auth } from '../../../lib/auth/auth';
import { KnownPages } from '../../../src/KnownPages';

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

type GreenhousePlant = {
    raisedBed: RaisedBed;
    field: GreenhouseRaisedBedField;
    plantName: string;
};

type GreenhouseGroup = {
    key: string;
    physicalId: string | null;
    plants: GreenhousePlant[];
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

function comparePhysicalIds(left: string | null, right: string | null) {
    if (left && right) {
        const leftNumber = Number(left);
        const rightNumber = Number(right);

        if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
            return leftNumber - rightNumber;
        }

        return left.localeCompare(right, 'hr-HR', { numeric: true });
    }

    if (left) return -1;
    if (right) return 1;
    return 0;
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
    plantSortNameById: Map<number, string>,
    plantSortId: number,
) {
    return (
        plantSortNameById.get(plantSortId) ?? `Nepoznata sorta #${plantSortId}`
    );
}

function dateCell(date: Date | undefined) {
    if (!date) {
        return <span className="text-muted-foreground">-</span>;
    }

    return <LocalDateTime time={false}>{date}</LocalDateTime>;
}

function getGreenhouseGroups(
    raisedBeds: RaisedBed[],
    plantSortNameById: Map<number, string>,
) {
    const plants = raisedBeds.flatMap((raisedBed) =>
        raisedBed.fields
            .filter(canFieldCurrentlyBeInGreenhouse)
            .map((field) => ({
                raisedBed,
                field,
                plantName: getPlantName(plantSortNameById, field.plantSortId),
            })),
    );
    const groups = new Map<string, GreenhouseGroup>();

    for (const plant of plants) {
        const physicalId = plant.raisedBed.physicalId?.trim() || null;
        const key = physicalId ?? 'no-physical-id';
        const existingGroup = groups.get(key);

        if (existingGroup) {
            existingGroup.plants.push(plant);
            continue;
        }

        groups.set(key, {
            key,
            physicalId,
            plants: [plant],
        });
    }

    return [...groups.values()]
        .map((group) => ({
            ...group,
            plants: [...group.plants].sort((left, right) => {
                if (left.raisedBed.id !== right.raisedBed.id) {
                    return left.raisedBed.id - right.raisedBed.id;
                }

                return left.field.positionIndex - right.field.positionIndex;
            }),
        }))
        .sort((left, right) => {
            const physicalIdComparison = comparePhysicalIds(
                left.physicalId,
                right.physicalId,
            );
            if (physicalIdComparison !== 0) {
                return physicalIdComparison;
            }

            return (
                (left.plants[0]?.raisedBed.id ?? 0) -
                (right.plants[0]?.raisedBed.id ?? 0)
            );
        });
}

export default async function GreenhousePage() {
    await auth(['admin']);

    const [raisedBeds, plantSorts] = await Promise.all([
        getAllRaisedBeds(),
        getEntitiesFormatted<PlantSortData>('plantSort'),
    ]);
    const plantSortNameById = new Map(
        (plantSorts ?? []).map((plantSort) => [
            plantSort.id,
            plantSort.information?.name?.trim() || `Sorta ${plantSort.id}`,
        ]),
    );
    const greenhouseGroups = getGreenhouseGroups(raisedBeds, plantSortNameById);
    const totalPlants = greenhouseGroups.reduce(
        (sum, group) => sum + group.plants.length,
        0,
    );

    return (
        <Stack spacing={4}>
            <Stack spacing={2}>
                <Typography level="h4" component="h1">
                    Staklenik
                </Typography>
                <Row spacing={2} className="flex-wrap">
                    <Chip color="success">Biljaka: {totalPlants}</Chip>
                    <Chip>Fizičkih gredica: {greenhouseGroups.length}</Chip>
                </Row>
            </Stack>

            {greenhouseGroups.length === 0 ? (
                <Card>
                    <NoDataPlaceholder>
                        Nema biljaka koje su trenutno u stakleniku.
                    </NoDataPlaceholder>
                </Card>
            ) : (
                greenhouseGroups.map((group) => (
                    <Card key={group.key}>
                        <CardHeader>
                            <Row
                                spacing={2}
                                className="flex-wrap"
                                justifyContent="space-between"
                            >
                                <RaisedBedLabel
                                    physicalId={group.physicalId}
                                    size="compact"
                                />
                                <Chip size="sm">
                                    Biljaka: {group.plants.length}
                                </Chip>
                            </Row>
                        </CardHeader>
                        <CardOverflow>
                            <Table>
                                <Table.Header>
                                    <Table.Row>
                                        <Table.Head>Polje</Table.Head>
                                        <Table.Head>Biljka</Table.Head>
                                        <Table.Head>Status</Table.Head>
                                        <Table.Head>Planirano</Table.Head>
                                        <Table.Head>Sijano</Table.Head>
                                        <Table.Head>Proklijalo</Table.Head>
                                        <Table.Head>Gredica</Table.Head>
                                    </Table.Row>
                                </Table.Header>
                                <Table.Body>
                                    {group.plants.map((plant) => (
                                        <Table.Row
                                            key={`${plant.raisedBed.id}-${plant.field.id}`}
                                        >
                                            <Table.Cell>
                                                {plant.field.positionIndex + 1}
                                            </Table.Cell>
                                            <Table.Cell>
                                                <span className="font-medium">
                                                    {plant.plantName}
                                                </span>
                                            </Table.Cell>
                                            <Table.Cell>
                                                <Chip
                                                    size="sm"
                                                    color={getStatusColor(
                                                        plant.field.plantStatus,
                                                    )}
                                                >
                                                    {statusLabels[
                                                        plant.field
                                                            .plantStatus ?? ''
                                                    ] ??
                                                        plant.field
                                                            .plantStatus ??
                                                        'Nepoznato'}
                                                </Chip>
                                            </Table.Cell>
                                            <Table.Cell>
                                                {dateCell(
                                                    plant.field
                                                        .plantScheduledDate,
                                                )}
                                            </Table.Cell>
                                            <Table.Cell>
                                                {dateCell(
                                                    plant.field.plantSowDate,
                                                )}
                                            </Table.Cell>
                                            <Table.Cell>
                                                {dateCell(
                                                    plant.field.plantGrowthDate,
                                                )}
                                            </Table.Cell>
                                            <Table.Cell>
                                                <Link
                                                    href={KnownPages.RaisedBed(
                                                        plant.raisedBed.id,
                                                    )}
                                                    className="font-medium text-primary hover:underline"
                                                >
                                                    {plant.raisedBed.name}
                                                </Link>
                                            </Table.Cell>
                                        </Table.Row>
                                    ))}
                                </Table.Body>
                            </Table>
                        </CardOverflow>
                    </Card>
                ))
            )}
        </Stack>
    );
}
