import {
    plantFieldStatusEmoji,
    plantFieldStatusLabel,
} from '@gredice/js/plants';
import {
    type EntityStandardized,
    getEntitiesFormatted,
    getFarmUserRaisedBeds,
} from '@gredice/storage';
import { AuthProtectedSection, SignedOut } from '@gredice/ui/auth/server';
import {
    Card,
    CardContent,
    CardHeader,
    CardOverflow,
    CardTitle,
} from '@gredice/ui/Card';
import { Chip, type ColorPaletteProp } from '@gredice/ui/Chip';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { RaisedBedIdentifierIcon } from '@gredice/ui/RaisedBedIdentifierIcon';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Table } from '@gredice/ui/Table';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import LoginDialog from '../../components/auth/LoginDialog';
import { HomeButton } from '../../components/HomeButton';
import { auth } from '../../lib/auth/auth';
import { KnownPages } from '../../src/KnownPages';

export const dynamic = 'force-dynamic';

const GREENHOUSE_PLANT_STATUSES = new Set([
    'new',
    'planned',
    'pendingVerification',
    'sowed',
    'sprouted',
]);

type FarmRaisedBed = Awaited<ReturnType<typeof getFarmUserRaisedBeds>>[number];
type FarmRaisedBedField = FarmRaisedBed['fields'][number];
type GreenhouseRaisedBedField = FarmRaisedBedField & { plantSortId: number };
type GreenhouseRaisedBed = Omit<FarmRaisedBed, 'fields'> & {
    fields: GreenhouseRaisedBedField[];
};

function canFieldCurrentlyBeInGreenhouse(
    field: FarmRaisedBedField,
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

function comparePhysicalIdsDescending(
    left: string | null,
    right: string | null,
) {
    if (left && right) {
        const leftNumber = Number(left);
        const rightNumber = Number(right);

        if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
            return rightNumber - leftNumber;
        }

        return right.localeCompare(left, 'hr-HR', { numeric: true });
    }

    if (left) {
        return -1;
    }

    if (right) {
        return 1;
    }

    return 0;
}

function compareRaisedBeds(left: FarmRaisedBed, right: FarmRaisedBed) {
    const physicalIdComparison = comparePhysicalIdsDescending(
        left.physicalId,
        right.physicalId,
    );

    if (physicalIdComparison !== 0) {
        return physicalIdComparison;
    }

    return (left.name ?? left.id.toString()).localeCompare(
        right.name ?? right.id.toString(),
        'hr-HR',
        {
            numeric: true,
            sensitivity: 'base',
        },
    );
}

function getGreenhouseRaisedBeds(
    raisedBeds: FarmRaisedBed[],
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

function formatDate(value?: Date | string | null) {
    if (!value) {
        return '—';
    }

    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) {
        return '—';
    }

    return date.toLocaleDateString('hr-HR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

function localCalendarDayIndex(date: Date) {
    const millisecondsPerDay = 24 * 60 * 60 * 1000;

    return (
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) /
        millisecondsPerDay
    );
}

function daysBetweenDates(startDate: Date, endDate: Date) {
    const difference =
        localCalendarDayIndex(endDate) - localCalendarDayIndex(startDate);

    return Math.max(0, difference);
}

function formatDayCount(days: number) {
    return days === 1 ? '1 dan' : `${days} dana`;
}

function sowingDateCell(
    sowDate: Date | string | null | undefined,
    sproutedDate: Date | string | null | undefined,
    today: Date,
) {
    if (!sowDate) {
        return <span className="text-muted-foreground">—</span>;
    }

    const parsedSowDate =
        typeof sowDate === 'string' ? new Date(sowDate) : sowDate;
    const parsedSproutedDate = sproutedDate
        ? typeof sproutedDate === 'string'
            ? new Date(sproutedDate)
            : sproutedDate
        : null;

    if (Number.isNaN(parsedSowDate.getTime())) {
        return <span className="text-muted-foreground">—</span>;
    }

    const targetDate =
        parsedSproutedDate && !Number.isNaN(parsedSproutedDate.getTime())
            ? parsedSproutedDate
            : today;
    const dayCount = daysBetweenDates(parsedSowDate, targetDate);
    const label =
        parsedSproutedDate && !Number.isNaN(parsedSproutedDate.getTime())
            ? `${formatDayCount(dayCount)} do klijanja`
            : `${formatDayCount(dayCount)} do danas`;

    return (
        <div className="space-y-0.5">
            <span className="tabular-nums">{formatDate(parsedSowDate)}</span>
            <div className="text-sm tabular-nums text-muted-foreground">
                {label}
            </div>
        </div>
    );
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

function getStatusLabel(status?: string | null) {
    if (status === 'pendingVerification') {
        return 'Čeka potvrdu';
    }

    return plantFieldStatusLabel(status ?? undefined).shortLabel;
}

function getPlantName(
    plantSort: EntityStandardized | undefined,
    plantSortId: number,
) {
    return (
        plantSort?.information?.label?.trim() ??
        plantSort?.information?.name?.trim() ??
        `Sorta #${plantSortId}`
    );
}

async function GreenhousePageContent() {
    const { userId } = await auth(['farmer', 'admin']);
    const [raisedBeds, plantSorts] = await Promise.all([
        getFarmUserRaisedBeds(userId),
        getEntitiesFormatted<EntityStandardized>('plantSort'),
    ]);
    const plantSortById = new Map(
        (plantSorts ?? []).map((plantSort) => [plantSort.id, plantSort]),
    );
    const greenhouseRaisedBeds = getGreenhouseRaisedBeds(raisedBeds);
    const greenhouseFieldCount = greenhouseRaisedBeds.reduce(
        (total, raisedBed) => total + raisedBed.fields.length,
        0,
    );
    const today = new Date();

    return (
        <div className="mx-auto w-full max-w-5xl space-y-4 p-4">
            <div className="flex min-w-0 items-center">
                <HomeButton />
            </div>

            <Card>
                <CardContent noHeader>
                    <Row
                        justifyContent="space-between"
                        className="flex-wrap items-start gap-3"
                    >
                        <Stack spacing={1} className="min-w-0">
                            <Typography level="h3" semiBold>
                                Staklenik
                            </Typography>
                            <Typography
                                level="body2"
                                className="text-muted-foreground"
                            >
                                Biljke koje su posijane u stakleniku i još nisu
                                presađene u gredicu.
                            </Typography>
                        </Stack>
                        <Row spacing={2} className="shrink-0 flex-wrap">
                            <Chip color="neutral">
                                Gredice: {greenhouseRaisedBeds.length}
                            </Chip>
                            <Chip color="success">
                                Biljaka: {greenhouseFieldCount}
                            </Chip>
                        </Row>
                    </Row>
                </CardContent>
            </Card>

            {greenhouseRaisedBeds.length === 0 ? (
                <Card>
                    <CardContent noHeader>
                        <Typography
                            level="body2"
                            className="text-muted-foreground"
                        >
                            Trenutno nema biljaka koje su u stakleniku za vaše
                            farme.
                        </Typography>
                    </CardContent>
                </Card>
            ) : (
                <Stack spacing={4}>
                    {greenhouseRaisedBeds.map((raisedBed) => (
                        <Card key={raisedBed.id}>
                            <CardHeader>
                                <Row
                                    spacing={2}
                                    className="items-center justify-between gap-y-2"
                                >
                                    <Link
                                        href={KnownPages.RaisedBed(
                                            raisedBed.id,
                                        )}
                                        className="min-w-0 rounded-md outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    >
                                        <CardTitle className="flex min-w-0 items-center gap-2 text-lg">
                                            <RaisedBedIdentifierIcon
                                                className="shrink-0 text-primary"
                                                physicalId={
                                                    raisedBed.physicalId
                                                }
                                            />
                                            <span className="min-w-0 truncate">
                                                {raisedBed.name ||
                                                    `Gredica ${raisedBed.physicalId ?? raisedBed.id}`}
                                            </span>
                                        </CardTitle>
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
                                            <Table.Head>Posijano</Table.Head>
                                            <Table.Head>Proklijalo</Table.Head>
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
                                                        {field.positionIndex +
                                                            1}
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <div className="flex min-w-0 items-center gap-3">
                                                            <div className="relative size-10 shrink-0 overflow-hidden rounded-md border bg-muted/30">
                                                                <PlantOrSortImage
                                                                    plantSort={
                                                                        plantSort
                                                                    }
                                                                    alt={
                                                                        plantName
                                                                    }
                                                                    width={40}
                                                                    height={40}
                                                                    className="size-10 object-cover"
                                                                />
                                                            </div>
                                                            <span className="min-w-0 font-medium [overflow-wrap:anywhere]">
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
                                                            startDecorator={
                                                                <span aria-hidden="true">
                                                                    {plantFieldStatusEmoji(
                                                                        field.plantStatus ??
                                                                            undefined,
                                                                    )}
                                                                </span>
                                                            }
                                                        >
                                                            {getStatusLabel(
                                                                field.plantStatus,
                                                            )}
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
                                                        {formatDate(
                                                            field.plantGrowthDate,
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
            )}
        </div>
    );
}

export default function GreenhousePage() {
    const authFarmer = auth.bind(null, ['farmer', 'admin']);

    return (
        <div className="min-h-[100dvh] w-full bg-background">
            <AuthProtectedSection auth={authFarmer}>
                <GreenhousePageContent />
            </AuthProtectedSection>
            <SignedOut auth={authFarmer}>
                <LoginDialog />
            </SignedOut>
        </div>
    );
}
