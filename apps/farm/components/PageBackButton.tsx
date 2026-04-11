'use client';

import { ArrowLeft } from '@signalco/ui-icons';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { useRouter } from 'next/dist/client/components/navigation';

export function PageBackButton() {
    const router = useRouter();

    return (
        <IconButton
            title="Povratak"
            variant="plain"
            size="sm"
            onClick={() => router.back()}
        >
            <ArrowLeft className="size-4 shrink-0" />
        </IconButton>
    );
}
