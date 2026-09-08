import {
    plantFieldStatusEmoji,
    plantFieldStatusLabel,
} from '@gredice/js/plants';
import {
    type EntityStandardized,
    getEntitiesFormatted,
    getFarmUserRaisedBeds,
    getRaisedBedPlantOccupancy,
} from '@gredice/storage';
import { AuthProtectedSection, SignedOut } from '@gredice/ui/auth/server';
import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Sprout } from '@gredice/ui/icons';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { RaisedBedIdentifierIcon } from '@gredice/ui/RaisedBedIdentifierIcon';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import LoginDialog from '../../components/auth/LoginDialog';
import { auth } from '../../lib/auth/auth';
import { getRaisedBedPositionIndexesDescending } from './raisedBedPositionOrder';

export const dynamic = 'force-dynamic';

type FarmRaisedBed = Awaited<ReturnType<typeof getFarmUserRaisedBeds>>[number];

function getFieldPreviews(
    raisedBed: FarmRaisedBed,
    sorts: EntityStandardized[] | null | undefined,
) {
    const plantSortsById = new Map<number, EntityStandardized>();
    if (sorts) {
        for (const sort of sorts) {
            plantSortsById.set(sort.id, sort);
        }
    }

    const plants = getRaisedBedPlantOccupancy(raisedBed);
    return getRaisedBedPositionIndexesDescending([
        ...raisedBed.fields.map((field) => field.positionIndex),
        ...plants.flatMap((plant) =>
            plant.positionNumbers.map((position) => position - 1),
        ),
    ]).map((positionIndex) => {
        const occupants = plants.filter((plant) =>
            plant.positionNumbers.includes(positionIndex + 1),
        );
        return {
            key: `position-${positionIndex}`,
            hasPlant: occupants.length > 0,
            label: occupants.length
                ? occupants
                      .map((plant) => {
                          const sort = plantSortsById.get(plant.plantSortId);
                          return (
                              sort?.information?.label ??
                              sort?.information?.name ??
                              `Sorta #${plant.plantSortId}`
                          );
                      })
                      .join(', ')
                : `Polje ${positionIndex + 1} prazno`,
            plants: occupants.map((plant) => ({
                key: plant.key,
                plantSort: plantSortsById.get(plant.plantSortId),
                status: plant.plantStatus,
                statusLabel: plant.plantStatus
                    ? plantFieldStatusLabel(plant.plantStatus).shortLabel
                    : null,
            })),
        };
    });
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

async function RaisedBedsPageContent() {
    const { userId } = await auth(['farmer', 'admin']);
    const [raisedBeds, plantSorts] = await Promise.all([
        getFarmUserRaisedBeds(userId),
        getEntitiesFormatted<EntityStandardized>('plantSort'),
    ]);

    const activeRaisedBeds = raisedBeds
        .filter(
            (raisedBed) =>
                raisedBed.status === 'active' && Boolean(raisedBed.physicalId),
        )
        .sort((left, right) => {
            const physicalIdComparison = comparePhysicalIdsDescending(
                left.physicalId,
                right.physicalId,
            );

            if (physicalIdComparison !== 0) {
                return physicalIdComparison;
            }

            return right.id - left.id;
        });

    return (
        <div className="max-w-5xl mx-auto w-full p-4 space-y-4">
            <Typography component="h1" level="h5" semiBold>
                Gredice
            </Typography>

            {activeRaisedBeds.length === 0 ? (
                <Card>
                    <CardContent noHeader>
                        <Typography
                            level="body2"
                            className="text-muted-foreground"
                        >
                            Trenutno nema aktivnih gredica s fizičkim
                            identifikatorom za vaš korisnički račun.
                        </Typography>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {activeRaisedBeds.map((raisedBed) => {
                        const fields = getFieldPreviews(raisedBed, plantSorts);

                        return (
                            <Card
                                key={raisedBed.id}
                                href={`/raised-beds/${raisedBed.id}`}
                                className="cursor-pointer"
                            >
                                <CardHeader>
                                    <Stack spacing={2}>
                                        <CardTitle>
                                            <Row
                                                spacing={2}
                                                alignItems="center"
                                            >
                                                <RaisedBedIdentifierIcon
                                                    className="text-primary"
                                                    physicalId={
                                                        raisedBed.physicalId
                                                    }
                                                />
                                                <Typography level="h6" semiBold>
                                                    {raisedBed.name ||
                                                        `Gredica ${raisedBed.physicalId}`}
                                                </Typography>
                                            </Row>
                                        </CardTitle>
                                    </Stack>
                                </CardHeader>
                                <CardContent>
                                    <Stack spacing={4}>
                                        <div className="grid grid-cols-3 gap-2">
                                            {fields.map((field) => (
                                                <div
                                                    key={`${raisedBed.id}-${field.key}`}
                                                    title={field.label}
                                                    className={
                                                        field.hasPlant
                                                            ? 'relative flex aspect-square items-center justify-center rounded-md border bg-muted/40 p-1'
                                                            : 'aspect-square rounded-md border border-dashed bg-muted/20'
                                                    }
                                                >
                                                    {field.plants.map(
                                                        (plant) => (
                                                            <div
                                                                key={plant.key}
                                                                className="relative flex min-w-0 flex-1 items-center justify-center"
                                                                title={
                                                                    plant.statusLabel ??
                                                                    undefined
                                                                }
                                                            >
                                                                {plant.plantSort ? (
                                                                    <PlantOrSortImage
                                                                        plantSort={
                                                                            plant.plantSort
                                                                        }
                                                                        width={
                                                                            40
                                                                        }
                                                                        height={
                                                                            40
                                                                        }
                                                                        className="size-10 max-w-full rounded-md object-cover"
                                                                    />
                                                                ) : (
                                                                    <Sprout className="size-6 text-primary" />
                                                                )}
                                                                {plant.status ? (
                                                                    <span className="absolute right-0 top-0 text-xs">
                                                                        {plantFieldStatusEmoji(
                                                                            plant.status,
                                                                        )}
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                        ),
                                                    )}
                                                    <span className="sr-only">
                                                        {field.label}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </Stack>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default async function RaisedBedsPage() {
    const authFarmer = auth.bind(null, ['farmer', 'admin']);

    return (
        <div className="min-h-[100dvh] w-full bg-background">
            <AuthProtectedSection auth={authFarmer}>
                <RaisedBedsPageContent />
            </AuthProtectedSection>
            <SignedOut auth={authFarmer}>
                <LoginDialog />
            </SignedOut>
        </div>
    );
}
