import { AuthProtectedSection, SignedOut } from '@gredice/ui/auth/server';
import type { Route } from 'next';
import { notFound } from 'next/navigation';
import LoginDialog from '../../../components/auth/LoginDialog';
import { auth } from '../../../lib/auth/auth';
import { ScheduleGuidanceHeader } from '../../schedule/ScheduleGuidanceHeader';
import { getFarmSchedulePlantSorts } from '../../schedule/scheduleData';
import { getScheduleTaskReturnHref } from '../../schedule/scheduleTaskNavigation';
import { PlantSortDetails } from '../PlantSortDetails';
import { PlantSortPublicLink } from '../PlantSortPublicLink';
import { getPlantSortLabel, getPlantSortPublicUrl } from '../plantUtils';

export const dynamic = 'force-dynamic';

async function PlantSortDetailPageContent({
    plantSortId,
    scheduleReturnHref,
}: {
    plantSortId: number;
    scheduleReturnHref: Route | null;
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
            <ScheduleGuidanceHeader
                fallbackHref="/plants"
                fallbackTitle="Povratak na biljke"
                scheduleReturnHref={scheduleReturnHref}
                title={plantSortLabel}
                trailingAction={
                    publicUrl ? (
                        <PlantSortPublicLink
                            label={plantSortLabel}
                            publicUrl={publicUrl}
                        />
                    ) : undefined
                }
            />
            <PlantSortDetails plantSort={plantSort} />
        </div>
    );
}

export default async function PlantSortDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{ plantSortId: string }>;
    searchParams: Promise<{
        scheduleDate?: string | string[];
        scheduleTask?: string | string[];
    }>;
}) {
    const [{ plantSortId }, scheduleContext] = await Promise.all([
        params,
        searchParams,
    ]);
    const parsedPlantSortId = Number(plantSortId);
    if (!Number.isInteger(parsedPlantSortId) || parsedPlantSortId <= 0) {
        notFound();
    }

    const authFarmer = auth.bind(null, ['farmer', 'admin']);
    const scheduleReturnHref = getScheduleTaskReturnHref({
        dateKey: scheduleContext.scheduleDate,
        kind: 'planting',
        taskId: scheduleContext.scheduleTask,
    });

    return (
        <div className="min-h-[100dvh] w-full bg-background">
            <AuthProtectedSection auth={authFarmer}>
                <PlantSortDetailPageContent
                    plantSortId={parsedPlantSortId}
                    scheduleReturnHref={scheduleReturnHref}
                />
            </AuthProtectedSection>
            <SignedOut auth={authFarmer}>
                <LoginDialog />
            </SignedOut>
        </div>
    );
}
