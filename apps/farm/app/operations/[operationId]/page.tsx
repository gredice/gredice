import { AuthProtectedSection, SignedOut } from '@gredice/ui/auth/server';
import { Typography } from '@gredice/ui/Typography';
import { notFound } from 'next/navigation';
import LoginDialog from '../../../components/auth/LoginDialog';
import { HomeButton } from '../../../components/HomeButton';
import { auth } from '../../../lib/auth/auth';
import { getFarmScheduleOperationsData } from '../../schedule/scheduleData';
import { OperationDetails } from '../OperationDetails';
import { getOperationLabel } from '../operationUtils';

export const dynamic = 'force-dynamic';

async function OperationDetailPageContent({
    operationId,
}: {
    operationId: number;
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
            <div className="flex min-w-0 items-center gap-2">
                <HomeButton
                    href="/operations"
                    title="Povratak na priručnik radnji"
                />
                <Typography
                    level="h4"
                    component="h1"
                    semiBold
                    className="min-w-0 truncate"
                >
                    {getOperationLabel(operation)}
                </Typography>
            </div>
            <OperationDetails operation={operation} />
        </div>
    );
}

export default async function OperationDetailPage({
    params,
}: {
    params: Promise<{ operationId: string }>;
}) {
    const { operationId } = await params;
    const parsedOperationId = Number(operationId);
    if (!Number.isInteger(parsedOperationId) || parsedOperationId <= 0) {
        notFound();
    }

    const authFarmer = auth.bind(null, ['farmer', 'admin']);

    return (
        <div className="min-h-[100dvh] w-full bg-muted">
            <AuthProtectedSection auth={authFarmer}>
                <OperationDetailPageContent operationId={parsedOperationId} />
            </AuthProtectedSection>
            <SignedOut auth={authFarmer}>
                <LoginDialog />
            </SignedOut>
        </div>
    );
}
