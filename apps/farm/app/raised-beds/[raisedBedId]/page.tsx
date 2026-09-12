import {
    buildRaisedBedPlantingReadModels,
    getRaisedBedFieldGroups,
    plantFieldStatusLabel,
} from '@gredice/js/plants';
import {
    type ApprovalRequest,
    type EntityStandardized,
    getApprovalRequests,
    getEntitiesFormatted,
    getFarmUserRaisedBeds,
    getRaisedBedPlantOccupancy,
    isRaisedBedPlantInGreenhouse,
} from '@gredice/storage';
import { AuthProtectedSection, SignedOut } from '@gredice/ui/auth/server';
import { Chip } from '@gredice/ui/Chip';
import { GamePlantStatusIcon } from '@gredice/ui/GameIcons';
import {
    RaisedBedFieldsGrid,
    RaisedBedPlantDetails,
    RaisedBedPlantItem,
    RaisedBedPlantingsReadOnly,
} from '@gredice/ui/raisedBeds';
import { Typography } from '@gredice/ui/Typography';
import { notFound } from 'next/navigation';
import LoginDialog from '../../../components/auth/LoginDialog';
import { HomeButton } from '../../../components/HomeButton';
import { auth } from '../../../lib/auth/auth';
import { getRaisedBedPositionIndexesDescending } from '../raisedBedPositionOrder';
import { PlantStateRequestForm } from './PlantStateRequestForm';

export const dynamic = 'force-dynamic';

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

    const occupants = getRaisedBedPlantOccupancy(raisedBed);
    const orderedPositions = getRaisedBedPositionIndexesDescending([
        ...raisedBed.fields.map((field) => field.positionIndex),
        ...occupants.flatMap((plant) =>
            plant.positionNumbers.map((position) => position - 1),
        ),
    ]);
    const groups = getRaisedBedFieldGroups(orderedPositions, occupants);
    const plantingItems = buildRaisedBedPlantingReadModels(
        raisedBed.plantings.filter((planting) => !planting.isActive),
    ).map((planting) => ({
        ...planting,
        plantName: resolvePlantName(
            planting.plantSortId,
            plantSortsById.get(planting.plantSortId),
        ),
    }));

    const plantDetails = new Map(
        occupants.map((plant) => {
            const name = resolvePlantName(
                plant.plantSortId,
                plantSortsById.get(plant.plantSortId),
            );
            const dates = [
                {
                    label: 'Početak sadnje',
                    value:
                        plant.planting?.lifecycleStartedAt ??
                        plant.legacyField?.createdAt,
                },
                {
                    label: 'Planirano',
                    value: plant.plantScheduledDate,
                },
                {
                    label: 'Posijano',
                    value: plant.plantSowDate,
                },
                {
                    label: 'Proklijalo',
                    value: plant.plantGrowthDate,
                },
                {
                    label: 'Spremno',
                    value: plant.plantReadyDate,
                },
                {
                    label: 'Ubrano',
                    value: plant.plantHarvestedDate,
                },
                {
                    label: 'Uginulo',
                    value: plant.plantDeadDate,
                },
                {
                    label: 'Uklonjeno',
                    value: plant.plantRemovedDate,
                },
            ].flatMap((date) =>
                date.value
                    ? [
                          {
                              label: date.label,
                              value: new Date(date.value).toISOString(),
                          },
                      ]
                    : [],
            );

            return [
                plant.key,
                <RaisedBedPlantDetails
                    key={plant.key}
                    name={name}
                    positionNumbers={plant.positionNumbers}
                    layout={plant.planting ?? undefined}
                    dates={dates}
                    sowingDate={
                        plant.plantSowDate
                            ? new Date(plant.plantSowDate).toISOString()
                            : null
                    }
                />,
            ];
        }),
    );

    return (
        <div className="max-w-5xl mx-auto w-full p-4 space-y-4">
            <div className="flex min-w-0 items-center gap-2">
                <HomeButton href="/raised-beds" title="Povratak na gredice" />
                <Typography component="h1" level="h5" semiBold>
                    Gredica {raisedBed.physicalId ?? raisedBed.id}
                </Typography>
            </div>

            <RaisedBedFieldsGrid
                compact
                groups={groups.map((group) => ({
                    ...group,
                    fields: group.positionNumbers.map((position) => ({
                        position,
                        controls: occupants
                            .filter(
                                (plant) => plant.positionIndex === position - 1,
                            )
                            .map((plant) => plantDetails.get(plant.key)),
                    })),
                    children: (
                        <>
                            {occupants
                                .filter((plant) =>
                                    plant.positionNumbers.some((position) =>
                                        group.positionNumbers.includes(
                                            position,
                                        ),
                                    ),
                                )
                                .map((plant) => {
                                    const plantSort = plantSortsById.get(
                                        plant.plantSortId,
                                    );
                                    const name = resolvePlantName(
                                        plant.plantSortId,
                                        plantSort,
                                    );
                                    const pending = plant.legacyField
                                        ? getPendingPlantStatusRequest(
                                              pendingPlantStatusRequests,
                                              raisedBed.id,
                                              plant.positionIndex,
                                          )
                                        : undefined;
                                    const pendingStatus =
                                        isRequestForCurrentStatus(
                                            pending,
                                            plant.plantStatus,
                                        ) &&
                                        pending?.target.kind ===
                                            'raisedBedField.plantStatus'
                                            ? pending.target.requestedStatus
                                            : null;
                                    const inGreenhouse =
                                        isRaisedBedPlantInGreenhouse(plant);
                                    return (
                                        <RaisedBedPlantItem
                                            key={plant.key}
                                            name={name}
                                            compact
                                            showPositionLabel={
                                                group.positionNumbers.length > 1
                                            }
                                            plantSort={plantSort}
                                            positionNumbers={
                                                plant.positionNumbers
                                            }
                                            plantCount={
                                                plant.planting?.plantCount
                                            }
                                            spacingCm={
                                                plant.planting
                                                    ?.selectedSeedingDistanceCm
                                            }
                                            statusControl={
                                                plant.plantStatus &&
                                                (plant.legacyField ? (
                                                    <PlantStateRequestForm
                                                        raisedBedId={
                                                            raisedBed.id
                                                        }
                                                        positionIndex={
                                                            plant.positionIndex
                                                        }
                                                        currentStatus={
                                                            plant.plantStatus
                                                        }
                                                        pendingRequestedStatus={
                                                            pendingStatus
                                                        }
                                                    />
                                                ) : (
                                                    <Chip
                                                        size="sm"
                                                        variant="outlined"
                                                        className="whitespace-normal text-left"
                                                        startDecorator={
                                                            <GamePlantStatusIcon
                                                                status={
                                                                    plant.plantStatus
                                                                }
                                                                className="size-5! shrink-0"
                                                                aria-hidden
                                                            />
                                                        }
                                                    >
                                                        <span className="min-w-0 [overflow-wrap:anywhere]">
                                                            {
                                                                plantFieldStatusLabel(
                                                                    plant.plantStatus,
                                                                ).shortLabel
                                                            }
                                                        </span>
                                                    </Chip>
                                                ))
                                            }
                                            locationControl={
                                                <Chip
                                                    size="sm"
                                                    variant="outlined"
                                                    className="whitespace-normal text-left"
                                                    color={
                                                        inGreenhouse
                                                            ? 'success'
                                                            : 'neutral'
                                                    }
                                                    startDecorator={
                                                        <span aria-hidden>
                                                            {inGreenhouse
                                                                ? '🏡'
                                                                : '🪴'}
                                                        </span>
                                                    }
                                                >
                                                    <span className="min-w-0 [overflow-wrap:anywhere]">
                                                        {inGreenhouse
                                                            ? 'Staklenik'
                                                            : 'Gredica'}
                                                    </span>
                                                </Chip>
                                            }
                                        />
                                    );
                                })}
                            {group.positionNumbers
                                .filter(
                                    (position) =>
                                        !occupants.some((plant) =>
                                            plant.positionNumbers.includes(
                                                position,
                                            ),
                                        ),
                                )
                                .map((position) => (
                                    <RaisedBedPlantItem
                                        key={`empty-${position}`}
                                        name="Prazno polje"
                                        compact
                                        showPositionLabel={
                                            group.positionNumbers.length > 1
                                        }
                                        positionNumbers={[position]}
                                    />
                                ))}
                        </>
                    ),
                }))}
            />
            {plantingItems.length > 0 && (
                <details className="mt-3 rounded-md border p-3">
                    <summary className="cursor-pointer text-sm font-medium">
                        Povijest sadnji ({plantingItems.length})
                    </summary>
                    <div className="mt-3">
                        <RaisedBedPlantingsReadOnly items={plantingItems} />
                    </div>
                </details>
            )}
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
