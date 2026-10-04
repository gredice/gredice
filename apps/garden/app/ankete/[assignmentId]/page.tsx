import { SignedIn, SignedOut } from '@gredice/ui/auth';
import { Spinner } from '@gredice/ui/Spinner';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import LoginModal from '../../../components/auth/LoginModal';
import { SurveyResponse } from './SurveyResponse';

export const metadata: Metadata = {
    title: 'Anketa | Gredice',
};

export default function SurveyAssignmentPage({
    params,
}: {
    params: Promise<{ assignmentId: string }>;
}) {
    return (
        <main className="min-h-[100dvh] bg-muted px-4 py-6 sm:px-6">
            <SignedIn>
                <Suspense
                    fallback={
                        <div className="grid min-h-[calc(100dvh-3rem)] place-items-center">
                            <Spinner
                                className="size-8 text-primary"
                                loadingLabel="Učitavanje ankete"
                            />
                        </div>
                    }
                >
                    <SurveyResponse params={params} />
                </Suspense>
            </SignedIn>
            <SignedOut>
                <div className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-lg items-center justify-center">
                    <LoginModal />
                </div>
            </SignedOut>
        </main>
    );
}
