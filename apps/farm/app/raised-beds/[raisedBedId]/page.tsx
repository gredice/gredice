import {
    plantFieldStatusLabel,
    userAllowedPlantStatusTransitions,
} from '@gredice/js/plants';
import {
    type ApprovalRequest,
    type EntityStandardized,
    getApprovalRequests,
    getEntitiesFormatted,
    getFarmUserRaisedBeds,
} from '@gredice/storage';
import { AuthProtectedSection, SignedOut } from '@gredice/ui/auth/server';
import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Table } from '@gredice/ui/Table';
import { Typography } from '@gredice/ui/Typography';
import { notFound } from 'next/navigation';
import LoginDialog from '../../../components/auth/LoginDialog';
import { HomeButton } from '../../../components/HomeButton';
import { auth } from '../../../lib/auth/auth';
import { PlantStateRequestForm } from './PlantStateRequestForm';

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
    plantSortNamesById: Map<number, string>,
) {
    if (!plantSortId) {
        return 'Prazno';
    }

    const name = plantSortNamesById.get(plantSortId);

    return name ? String(name) : `Sorta #${plantSortId}`;
}

function statusLabel(status?: string | null) {
    if (!status) {
        return '—';
    }

    return plantFieldStatusLabel(status).shortLabel;
}

function getPendingPlantStatusRequest(
    requests: ApprovalRequest[],
    raisedBedId: number,
    positionIndex: number,
) {
    return requests.find(
        (request) =>
            request.target.kind === 'raisedBedField.plantStatus' &&
            request.target.raisedBedId === raisedBedId &&
            request.target.positionIndex === positionIndex,
    );
}

async function RaisedBedDetailPageContent({
    raisedBedId,
}: {
    raisedBedId: number;
}) {
    const { userId } = await auth(['farmer', 'admin']);
    const [raisedBeds, plantSorts, pendingPlantStatusRequests] =
        await Promise.all([
            getFarmUserRaisedBeds(userId),
            getEntitiesFormatted<EntityStandardized>('plantSort'),
            getApprovalRequests({
                status: 'pending',
                kind: 'raisedBedField.plantStatus',
            }),
        ]);
    const plantSortNamesById = new Map<number, string>();
    if (plantSorts) {
        for (const plantSort of plantSorts) {
            const name = plantSort.information?.name;
            if (name) {
                plantSortNamesById.set(plantSort.id, name);
            }
        }
    }

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
    const activeFieldsByPosition = new Map(
        raisedBed.fields
            .filter((field) => field.active)
            .map((field) => [field.positionIndex, field]),
    );

    return (
        <div className="max-w-5xl mx-auto w-full p-4 space-y-4">
            <Row spacing={2}>
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
                    <Stack spacing={4}>
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
                                    <Table.Head>Promjena</Table.Head>
                                    <Table.Head>Planirano</Table.Head>
                                    <Table.Head>Posijano</Table.Head>
                                    <Table.Head>Spremno</Table.Head>
                                    <Table.Head>Ubrano</Table.Head>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {orderedPositions.map((positionIndex) => {
                                    const field =
                                        activeFieldsByPosition.get(
                                            positionIndex,
                                        );
                                    const pendingRequest =
                                        getPendingPlantStatusRequest(
                                            pendingPlantStatusRequests,
                                            raisedBed.id,
                                            positionIndex,
                                        );
                                    const displayStatus =
                                        pendingRequest?.target.kind ===
                                        'raisedBedField.plantStatus'
                                            ? pendingRequest.target
                                                  .requestedStatus
                                            : field?.plantStatus;
                                    const hasAllowedChange =
                                        Boolean(field?.plantStatus) &&
                                        Boolean(
                                            field?.plantStatus
                                                ? userAllowedPlantStatusTransitions[
                                                      field.plantStatus
                                                  ]?.length
                                                : false,
                                        );

                                    return (
                                        <Table.Row key={positionIndex}>
                                            <Table.Cell>
                                                {positionIndex + 1}
                                            </Table.Cell>
                                            <Table.Cell>
                                                {resolvePlantName(
                                                    field?.plantSortId,
                                                    plantSortNamesById,
                                                )}
                                            </Table.Cell>
                                            <Table.Cell>
                                                <Row
                                                    spacing={1}
                                                    className="items-center flex-wrap"
                                                >
                                                    <Typography level="body2">
                                                        {statusLabel(
                                                            displayStatus,
                                                        )}
                                                    </Typography>
                                                    {pendingRequest && (
                                                        <Chip
                                                            color="warning"
                                                            size="sm"
                                                            variant="soft"
                                                        >
                                                            Čeka odobrenje
                                                        </Chip>
                                                    )}
                                                </Row>
                                            </Table.Cell>
                                            <Table.Cell>
                                                {field && hasAllowedChange ? (
                                                    <PlantStateRequestForm
                                                        raisedBedId={
                                                            raisedBed.id
                                                        }
                                                        positionIndex={
                                                            positionIndex
                                                        }
                                                        currentStatus={
                                                            field.plantStatus
                                                        }
                                                        pendingRequestedStatus={
                                                            pendingRequest
                                                                ?.target
                                                                .kind ===
                                                            'raisedBedField.plantStatus'
                                                                ? pendingRequest
                                                                      .target
                                                                      .requestedStatus
                                                                : null
                                                        }
                                                    />
                                                ) : (
                                                    <Typography
                                                        level="body3"
                                                        className="text-muted-foreground"
                                                    >
                                                        —
                                                    </Typography>
                                                )}
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
