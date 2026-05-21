import {
    type EntityStandardized,
    getEntitiesFormatted,
    getFarmUserRaisedBeds,
} from '@gredice/storage';
import { AuthProtectedSection, SignedOut } from '@gredice/ui/auth/server';
import { Button } from '@gredice/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { Sprout } from '@gredice/ui/icons';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { RaisedBedIdentifierIcon } from '@gredice/ui/RaisedBedIdentifierIcon';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import LoginDialog from '../../components/auth/LoginDialog';
import { HomeButton } from '../../components/HomeButton';
import { auth } from '../../lib/auth/auth';

export const dynamic = 'force-dynamic';

function getPlantPreview(
    fields: Awaited<ReturnType<typeof getFarmUserRaisedBeds>>[number]['fields'],
    sorts: EntityStandardized[] | null | undefined,
) {
    const plantSortsById = new Map<number, EntityStandardized>();
    if (sorts) {
        for (const sort of sorts) {
            plantSortsById.set(sort.id, sort);
        }
    }

    return fields
        .filter(
            (field): field is typeof field & { plantSortId: number } =>
                field.active && typeof field.plantSortId === 'number',
        )
        .map((field) => {
            const plantSort = plantSortsById.get(field.plantSortId);

            return {
                fieldId: field.id,
                plantSortId: field.plantSortId,
                label:
                    plantSort?.information?.label ??
                    plantSort?.information?.name ??
                    `Sorta #${field.plantSortId}`,
                plantSort: plantSort ?? null,
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
            <Row spacing={2}>
                <HomeButton />
                <Typography level="h4" component="h1">
                    Gredice
                </Typography>
            </Row>

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
                        const plants = getPlantPreview(
                            raisedBed.fields,
                            plantSorts,
                        );

                        return (
                            <Card key={raisedBed.id}>
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
                                        {plants.length > 0 ? (
                                            <div className="grid grid-cols-3 gap-2">
                                                {plants.map((plant) => (
                                                    <div
                                                        key={`${raisedBed.id}-${plant.fieldId}`}
                                                        title={plant.label}
                                                        className="flex aspect-square items-center justify-center rounded-md border bg-muted/40 p-1"
                                                    >
                                                        {plant.plantSort ? (
                                                            <PlantOrSortImage
                                                                plantSort={
                                                                    plant.plantSort
                                                                }
                                                                width={40}
                                                                height={40}
                                                                className="size-10 rounded-md object-cover"
                                                            />
                                                        ) : (
                                                            <Sprout className="size-6 text-primary" />
                                                        )}
                                                        <span className="sr-only">
                                                            {plant.label}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <Row>
                                                <Chip color="neutral">
                                                    Nema aktivnih biljaka
                                                </Chip>
                                            </Row>
                                        )}
                                        <Button
                                            href={`/raised-beds/${raisedBed.id}`}
                                        >
                                            Otvori detalje
                                        </Button>
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
        <div className="min-h-[100dvh] w-full bg-muted">
            <AuthProtectedSection auth={authFarmer}>
                <RaisedBedsPageContent />
            </AuthProtectedSection>
            <SignedOut auth={authFarmer}>
                <LoginDialog />
            </SignedOut>
        </div>
    );
}
