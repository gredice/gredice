import {
    type ApprovalRequest,
    type EntityStandardized,
    getApprovalRequests,
    getEntitiesFormatted,
    getFarmUserRaisedBeds,
} from '@gredice/storage';
import { AuthProtectedSection, SignedOut } from '@gredice/ui/auth/server';
import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { PlantOrSortImage } from '@gredice/ui/plants';
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
    plantSort: EntityStandardized | null | undefined,
) {
    if (!plantSortId) {
        return 'Prazno';
    }

    const name = plantSort?.information?.name;

    return name ? String(name) : `Sorta #${plantSortId}`;
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

function isRequestForCurrentStatus(
    request: ApprovalRequest | undefined,
    currentStatus?: string | null,
) {
    if (
        !request ||
        !currentStatus ||
        request.target.kind !== 'raisedBedField.plantStatus'
    ) {
        return false;
    }

    return (
        !request.target.currentStatus ||
        request.target.currentStatus === currentStatus
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
    const plantSortsById = new Map<number, EntityStandardized>();
    if (plantSorts) {
        for (const plantSort of plantSorts) {
            plantSortsById.set(plantSort.id, plantSort);
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
            <div className="flex min-w-0 items-center">
                <HomeButton href="/raised-beds" title="Povratak na gredice" />
            </div>

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
                                    const currentStatus =
                                        field?.plantStatus ?? null;
                                    const activePendingRequest =
                                        isRequestForCurrentStatus(
                                            pendingRequest,
                                            currentStatus,
                                        )
                                            ? pendingRequest
                                            : undefined;
                                    const pendingRequestedStatus =
                                        activePendingRequest?.target.kind ===
                                        'raisedBedField.plantStatus'
                                            ? activePendingRequest.target
                                                  .requestedStatus
                                            : null;
                                    const plantSort = field?.plantSortId
                                        ? (plantSortsById.get(
                                              field.plantSortId,
                                          ) ?? null)
                                        : null;
                                    const plantName = resolvePlantName(
                                        field?.plantSortId,
                                        plantSort,
                                    );

                                    return (
                                        <Table.Row key={positionIndex}>
                                            <Table.Cell>
                                                {positionIndex + 1}
                                            </Table.Cell>
                                            <Table.Cell>
                                                {plantSort ? (
                                                    <div className="flex min-w-0 items-center gap-3">
                                                        <PlantOrSortImage
                                                            plantSort={
                                                                plantSort
                                                            }
                                                            width={40}
                                                            height={40}
                                                            className="size-10 shrink-0 rounded-md object-cover"
                                                        />
                                                        <Typography
                                                            level="body2"
                                                            className="min-w-0 [overflow-wrap:anywhere]"
                                                        >
                                                            {plantName}
                                                        </Typography>
                                                    </div>
                                                ) : (
                                                    plantName
                                                )}
                                            </Table.Cell>
                                            <Table.Cell>
                                                {field?.plantStatus ? (
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
                                                            pendingRequestedStatus
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
        <div className="min-h-[100dvh] w-full bg-background">
            <AuthProtectedSection auth={authFarmer}>
                <RaisedBedDetailPageContent raisedBedId={parsedRaisedBedId} />
            </AuthProtectedSection>
            <SignedOut auth={authFarmer}>
                <LoginDialog />
            </SignedOut>
        </div>
    );
}
