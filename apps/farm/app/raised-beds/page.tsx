import {
    type EntityStandardized,
    getEntitiesFormatted,
    getFarmUserRaisedBeds,
} from '@gredice/storage';
import {
    AuthProtectedSection,
    SignedOut,
} from '@signalco/auth-server/components';
import { Fence } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { Chip } from '@signalco/ui-primitives/Chip';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import LoginDialog from '../../components/auth/LoginDialog';
import { HomeButton } from '../../components/HomeButton';
import { auth } from '../../lib/auth/auth';

export const dynamic = 'force-dynamic';

function getPlantPreview(
    fields: Awaited<ReturnType<typeof getFarmUserRaisedBeds>>[number]['fields'],
    sorts: EntityStandardized[] | null | undefined,
) {
    const plantSortNamesById = new Map<number, string>();
    if (sorts) {
        for (const sort of sorts) {
            const name = sort.information?.name;
            if (name) {
                plantSortNamesById.set(sort.id, name);
            }
        }
    }

    const activePlants = fields
        .filter(
            (field): field is typeof field & { plantSortId: number } =>
                field.active && typeof field.plantSortId === 'number',
        )
        .map((field) => {
            const plantName = plantSortNamesById.get(field.plantSortId);

            return plantName
                ? String(plantName)
                : `Sorta #${field.plantSortId}`;
        });

    return Array.from(new Set(activePlants));
}

async function RaisedBedsPageContent() {
    const { userId } = await auth(['farmer', 'admin']);
    const [raisedBeds, plantSorts] = await Promise.all([
        getFarmUserRaisedBeds(userId),
        getEntitiesFormatted<EntityStandardized>('plantSort'),
    ]);

    return (
        <div className="max-w-5xl mx-auto w-full p-4 space-y-4">
            <Row spacing={1}>
                <HomeButton />
                <Typography level="h4" component="h1">
                    Gredice
                </Typography>
            </Row>

            {raisedBeds.length === 0 ? (
                <Card>
                    <CardContent noHeader>
                        <Typography
                            level="body2"
                            className="text-muted-foreground"
                        >
                            Trenutno nema dostupnih gredica za vaš korisnički
                            račun.
                        </Typography>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                    {raisedBeds.map((raisedBed) => {
                        const plantPreview = getPlantPreview(
                            raisedBed.fields,
                            plantSorts,
                        );
                        const previewVisible = plantPreview.slice(0, 4);
                        const hiddenCount = Math.max(
                            plantPreview.length - previewVisible.length,
                            0,
                        );

                        return (
                            <Card key={raisedBed.id}>
                                <CardHeader>
                                    <Stack spacing={1}>
                                        <CardTitle>
                                            <Row
                                                spacing={1}
                                                alignItems="center"
                                            >
                                                <Fence className="size-4" />
                                                <Typography level="h6" semiBold>
                                                    {raisedBed.name ||
                                                        `Gredica #${raisedBed.id}`}
                                                </Typography>
                                            </Row>
                                        </CardTitle>
                                        <Typography
                                            level="body3"
                                            className="text-muted-foreground"
                                        >
                                            ID: {raisedBed.id} · Polja:{' '}
                                            {raisedBed.fields.length}
                                        </Typography>
                                    </Stack>
                                </CardHeader>
                                <CardContent>
                                    <Stack spacing={2}>
                                        <Row spacing={1} className="flex-wrap">
                                            {previewVisible.length > 0 ? (
                                                previewVisible.map((label) => (
                                                    <Chip
                                                        key={`${raisedBed.id}-${label}`}
                                                        color="success"
                                                        className="max-w-full"
                                                    >
                                                        {label}
                                                    </Chip>
                                                ))
                                            ) : (
                                                <Chip color="neutral">
                                                    Nema aktivnih biljaka
                                                </Chip>
                                            )}
                                            {hiddenCount > 0 && (
                                                <Chip color="neutral">
                                                    +{hiddenCount} više
                                                </Chip>
                                            )}
                                        </Row>
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
