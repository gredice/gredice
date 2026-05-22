'use client';

import { IconButton } from '@gredice/ui/IconButton';
import { ArrowLeft } from '@gredice/ui/icons';
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
