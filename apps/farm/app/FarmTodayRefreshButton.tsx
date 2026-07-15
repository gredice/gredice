'use client';

import { Button } from '@gredice/ui/Button';
import { Reset } from '@gredice/ui/icons';
import { useRouter } from 'next/navigation';

export function FarmTodayRefreshButton() {
    const router = useRouter();

    return (
        <Button
            onClick={() => router.refresh()}
            size="lg"
            startDecorator={<Reset aria-hidden className="size-4" />}
            variant="outlined"
        >
            Pokušaj ponovno
        </Button>
    );
}
