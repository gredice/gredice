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
    fields: FarmRaisedBed['fields'],
    sorts: EntityStandardized[] | null | undefined,
) {
    const plantSortsById = new Map<number, EntityStandardized>();
    if (sorts) {
        for (const sort of sorts) {
            plantSortsById.set(sort.id, sort);
        }
    }

    const activeFieldsByPosition = new Map(
        fields
            .filter((field) => field.active)
            .map((field) => [field.positionIndex, field]),
    );
    return getRaisedBedPositionIndexesDescending(
        fields.map((field) => field.positionIndex),
    ).map((positionIndex) => {
        const field = activeFieldsByPosition.get(positionIndex);
        const plantSortId = field?.plantSortId;
        const hasPlant = typeof plantSortId === 'number';
        const plantSort = hasPlant ? plantSortsById.get(plantSortId) : null;
        const status = hasPlant ? field?.plantStatus : undefined;
        const statusLabel = status
            ? plantFieldStatusLabel(status).shortLabel
            : null;

        if (!hasPlant) {
            return {
                hasPlant,
                key: `position-${positionIndex}`,
                label: `Polje ${positionIndex + 1} prazno`,
                plantSort: null,
                status: null,
                statusLabel: null,
            };
        }

        return {
            hasPlant,
            key: field ? `field-${field.id}` : `position-${positionIndex}`,
            label:
                plantSort?.information?.label ??
                plantSort?.information?.name ??
                `Sorta #${plantSortId}`,
            plantSort: plantSort ?? null,
            status,
            statusLabel,
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
                        const fields = getFieldPreviews(
                            raisedBed.fields,
                            plantSorts,
                        );

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
                                                    title={
                                                        field.statusLabel
                                                            ? `${field.label} - ${field.statusLabel}`
                                                            : field.label
                                                    }
                                                    className={
                                                        field.hasPlant
                                                            ? 'relative flex aspect-square items-center justify-center rounded-md border bg-muted/40 p-1'
                                                            : 'aspect-square rounded-md border border-dashed bg-muted/20'
                                                    }
                                                >
                                                    {field.plantSort ? (
                                                        <PlantOrSortImage
                                                            plantSort={
                                                                field.plantSort
                                                            }
                                                            width={40}
                                                            height={40}
                                                            className="size-10 rounded-md object-cover"
                                                        />
                                                    ) : field.hasPlant ? (
                                                        <Sprout className="size-6 text-primary" />
                                                    ) : null}
                                                    {field.status ? (
                                                        <span
                                                            aria-hidden="true"
                                                            className="absolute right-1 top-1 inline-flex size-5 items-center justify-center rounded-full bg-white/90 text-xs leading-none shadow-xs"
                                                            title={
                                                                field.statusLabel ??
                                                                undefined
                                                            }
                                                        >
                                                            {plantFieldStatusEmoji(
                                                                field.status,
                                                            )}
                                                        </span>
                                                    ) : null}
                                                    <span className="sr-only">
                                                        {field.statusLabel
                                                            ? `${field.label}, ${field.statusLabel}`
                                                            : field.label}
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
