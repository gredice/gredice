import { AuthProtectedSection, SignedOut } from '@gredice/ui/auth/server';
import { Button } from '@gredice/ui/Button';
import { ExternalLink } from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import { notFound } from 'next/navigation';
import LoginDialog from '../../../components/auth/LoginDialog';
import { HomeButton } from '../../../components/HomeButton';
import { auth } from '../../../lib/auth/auth';
import { getFarmSchedulePlantSorts } from '../../schedule/scheduleData';
import { PlantSortDetails } from '../PlantSortDetails';
import { getPlantSortLabel, getPlantSortPublicUrl } from '../plantUtils';

export const dynamic = 'force-dynamic';

async function PlantSortDetailPageContent({
    plantSortId,
}: {
    plantSortId: number;
}) {
    await auth(['farmer', 'admin']);
    const plantSortsData = (await getFarmSchedulePlantSorts()) ?? [];
    const plantSort =
        plantSortsData.find((candidate) => candidate.id === plantSortId) ??
        null;

    if (!plantSort) {
        notFound();
    }

    const plantSortLabel = getPlantSortLabel(plantSort);
    const publicUrl = getPlantSortPublicUrl(plantSort);

    return (
        <div className="max-w-5xl mx-auto w-full p-4 space-y-4">
            <div className="flex min-w-0 items-center gap-2">
                <HomeButton href="/plants" title="Povratak na biljke" />
                <Typography
                    level="h4"
                    component="h1"
                    semiBold
                    className="min-w-0 flex-1 truncate"
                >
                    {plantSortLabel}
                </Typography>
                {publicUrl && (
                    <Button
                        href={publicUrl}
                        rel="noreferrer"
                        size="sm"
                        startDecorator={
                            <ExternalLink className="size-4 shrink-0" />
                        }
                        target="_blank"
                        title="Otvori javnu stranicu sorte"
                        variant="plain"
                    >
                        www
                    </Button>
                )}
            </div>
            <PlantSortDetails plantSort={plantSort} />
        </div>
    );
}

export default async function PlantSortDetailPage({
    params,
}: {
    params: Promise<{ plantSortId: string }>;
}) {
    const { plantSortId } = await params;
    const parsedPlantSortId = Number(plantSortId);
    if (!Number.isInteger(parsedPlantSortId) || parsedPlantSortId <= 0) {
        notFound();
    }

    const authFarmer = auth.bind(null, ['farmer', 'admin']);

    return (
        <div className="min-h-[100dvh] w-full bg-muted">
            <AuthProtectedSection auth={authFarmer}>
                <PlantSortDetailPageContent plantSortId={parsedPlantSortId} />
            </AuthProtectedSection>
            <SignedOut auth={authFarmer}>
                <LoginDialog />
            </SignedOut>
        </div>
    );
}
