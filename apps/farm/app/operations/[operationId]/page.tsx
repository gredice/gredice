import { AuthProtectedSection, SignedOut } from '@gredice/ui/auth/server';
import type { Route } from 'next';
import { notFound } from 'next/navigation';
import LoginDialog from '../../../components/auth/LoginDialog';
import { auth } from '../../../lib/auth/auth';
import { ScheduleGuidanceHeader } from '../../schedule/ScheduleGuidanceHeader';
import { getFarmScheduleOperationsData } from '../../schedule/scheduleData';
import { getScheduleTaskReturnHref } from '../../schedule/scheduleTaskNavigation';
import { OperationDetails } from '../OperationDetails';
import { getOperationLabel } from '../operationUtils';

export const dynamic = 'force-dynamic';

async function OperationDetailPageContent({
    operationId,
    scheduleReturnHref,
}: {
    operationId: number;
    scheduleReturnHref: Route | null;
}) {
    await auth(['farmer', 'admin']);
    const operationsData = (await getFarmScheduleOperationsData()) ?? [];
    const operation =
        operationsData.find((candidate) => candidate.id === operationId) ??
        null;

    if (!operation) {
        notFound();
    }

    return (
        <div className="max-w-5xl mx-auto w-full p-4 space-y-4">
            <ScheduleGuidanceHeader
                fallbackHref="/operations"
                fallbackTitle="Povratak na priručnik radnji"
                scheduleReturnHref={scheduleReturnHref}
                title={getOperationLabel(operation)}
            />
            <OperationDetails operation={operation} />
        </div>
    );
}

export default async function OperationDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{ operationId: string }>;
    searchParams: Promise<{
        scheduleDate?: string | string[];
        scheduleTask?: string | string[];
    }>;
}) {
    const [{ operationId }, scheduleContext] = await Promise.all([
        params,
        searchParams,
    ]);
    const parsedOperationId = Number(operationId);
    if (!Number.isInteger(parsedOperationId) || parsedOperationId <= 0) {
        notFound();
    }

    const authFarmer = auth.bind(null, ['farmer', 'admin']);
    const scheduleReturnHref = getScheduleTaskReturnHref({
        dateKey: scheduleContext.scheduleDate,
        kind: 'operation',
        taskId: scheduleContext.scheduleTask,
    });

    return (
        <div className="min-h-[100dvh] w-full bg-background">
            <AuthProtectedSection auth={authFarmer}>
                <OperationDetailPageContent
                    operationId={parsedOperationId}
                    scheduleReturnHref={scheduleReturnHref}
                />
            </AuthProtectedSection>
            <SignedOut auth={authFarmer}>
                <LoginDialog />
            </SignedOut>
        </div>
    );
}
