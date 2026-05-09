'use client';

import { ArrowLeft } from '@signalco/ui-icons';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { useRouter } from 'next/navigation';

export function HomeButton() {
    const router = useRouter();

    return (
        <IconButton
            title="Povratak na početnu"
            variant="plain"
            onClick={() => router.push('/')}
        >
            <ArrowLeft className="size-4 shrink-0" />
        </IconButton>
    );
}
