import { Suspense } from 'react';
import { RegistrationSuccessfulContent } from './RegistrationSuccessfulContent';

type RegistrationSuccessfulPageProps = {
    searchParams?: Promise<{
        upgrade?: string | string[];
    }>;
};

export default function RegistrationSuccessfulPage({
    searchParams,
}: RegistrationSuccessfulPageProps) {
    return (
        <Suspense fallback={null}>
            <RegistrationSuccessfulContent searchParams={searchParams} />
        </Suspense>
    );
}
