import {
    type EntityStandardized,
    getEntitiesFormatted,
    getFarmUserRaisedBeds,
} from '@gredice/storage';
import {
    AuthProtectedSection,
    SignedOut,
} from '@signalco/auth-server/components';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Table } from '@signalco/ui-primitives/Table';
import { Typography } from '@signalco/ui-primitives/Typography';
import { notFound } from 'next/navigation';
import LoginDialog from '../../../components/auth/LoginDialog';
import { HomeButton } from '../../../components/HomeButton';
import { auth } from '../../../lib/auth/auth';

export const dynamic = 'force-dynamic';

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

function resolvePlantName(
    plantSortId: number | null | undefined,
    sorts: EntityStandardized[] | null | undefined,
) {
    if (!plantSortId) {
        return 'Prazno';
    }

    const name = sorts?.find((sort) => sort.id === plantSortId)?.attributes
        ?.information?.name;

    return name ? String(name) : `Sorta #${plantSortId}`;
}

async function RaisedBedDetailPageContent({
    raisedBedId,
}: {
    raisedBedId: number;
}) {
    const { userId } = await auth(['farmer', 'admin']);
    const [raisedBeds, plantSorts] = await Promise.all([
        getFarmUserRaisedBeds(userId),
        getEntitiesFormatted<EntityStandardized>('plantSort'),
    ]);

    const raisedBed = raisedBeds.find((item) => item.id === raisedBedId);
    if (!raisedBed) {
        notFound();
    }

    const highestPositionIndex = Math.max(
        8,
        ...raisedBed.fields.map((field) => field.positionIndex),
    );
    const orderedPositions = Array.from(
        { length: highestPositionIndex + 1 },
        (_, index) => index,
    );

    return (
        <div className="max-w-5xl mx-auto w-full p-4 space-y-4">
            <Row spacing={1}>
                <HomeButton />
                <Typography level="h4" component="h1">
                    {raisedBed.name || `Gredica #${raisedBed.id}`}
                </Typography>
            </Row>

            <Card>
                <CardHeader>
                    <CardTitle>Detalji polja</CardTitle>
                </CardHeader>
                <CardContent>
                    <Stack spacing={2}>
                        <Typography
                            level="body2"
                            className="text-muted-foreground"
                        >
                            Pregled svih pozicija i stanja biljaka u odabranoj
                            gredici.
                        </Typography>
                        <Table>
                            <Table.Header>
                                <Table.Row>
                                    <Table.Head>Pozicija</Table.Head>
                                    <Table.Head>Biljka</Table.Head>
                                    <Table.Head>Status</Table.Head>
                                    <Table.Head>Planirano</Table.Head>
                                    <Table.Head>Posijano</Table.Head>
                                    <Table.Head>Spremno</Table.Head>
                                    <Table.Head>Ubrano</Table.Head>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {orderedPositions.map((positionIndex) => {
                                    const field = raisedBed.fields.find(
                                        (item) =>
                                            item.positionIndex ===
                                                positionIndex && item.active,
                                    );

                                    return (
                                        <Table.Row key={positionIndex}>
                                            <Table.Cell>
                                                {positionIndex + 1}
                                            </Table.Cell>
                                            <Table.Cell>
                                                {resolvePlantName(
                                                    field?.plantSortId,
                                                    plantSorts,
                                                )}
                                            </Table.Cell>
                                            <Table.Cell>
                                                {field?.plantStatus || '—'}
                                            </Table.Cell>
                                            <Table.Cell>
                                                {formatDate(
                                                    field?.plantScheduledDate,
                                                )}
                                            </Table.Cell>
                                            <Table.Cell>
                                                {formatDate(
                                                    field?.plantSowDate,
                                                )}
                                            </Table.Cell>
                                            <Table.Cell>
                                                {formatDate(
                                                    field?.plantReadyDate,
                                                )}
                                            </Table.Cell>
                                            <Table.Cell>
                                                {formatDate(
                                                    field?.plantHarvestedDate,
                                                )}
                                            </Table.Cell>
                                        </Table.Row>
                                    );
                                })}
                            </Table.Body>
                        </Table>
                    </Stack>
                </CardContent>
            </Card>
        </div>
    );
}

export default async function RaisedBedDetailPage({
    params,
}: {
    params: Promise<{ raisedBedId: string }>;
}) {
    const { raisedBedId } = await params;
    const parsedRaisedBedId = Number(raisedBedId);
    if (!Number.isInteger(parsedRaisedBedId)) {
        notFound();
    }

    const authFarmer = auth.bind(null, ['farmer', 'admin']);

    return (
        <div className="min-h-[100dvh] w-full bg-muted">
            <AuthProtectedSection auth={authFarmer}>
                <RaisedBedDetailPageContent raisedBedId={parsedRaisedBedId} />
            </AuthProtectedSection>
            <SignedOut auth={authFarmer}>
                <LoginDialog />
            </SignedOut>
        </div>
    );
}
