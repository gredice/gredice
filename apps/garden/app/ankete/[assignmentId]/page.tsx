import { SignedIn, SignedOut } from '@gredice/ui/auth';
import type { Metadata } from 'next';
import LoginModal from '../../../components/auth/LoginModal';
import { SurveyResponseClient } from './SurveyResponseClient';

export const metadata: Metadata = {
    title: 'Anketa | Gredice',
};

export default async function SurveyAssignmentPage({
    params,
}: {
    params: Promise<{ assignmentId: string }>;
}) {
    const { assignmentId } = await params;

    return (
        <main className="min-h-[100dvh] bg-muted px-4 py-6 sm:px-6">
            <SignedIn>
                <SurveyResponseClient assignmentId={assignmentId} />
            </SignedIn>
            <SignedOut>
                <div className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-lg items-center justify-center">
                    <LoginModal />
                </div>
            </SignedOut>
        </main>
    );
}
