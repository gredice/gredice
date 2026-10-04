'use client';

import { Button } from '@gredice/ui/Button';
import { Reset } from '@gredice/ui/icons';

export function SandboxDebugActions({ storageKey }: { storageKey: string }) {
    const handleReset = () => {
        window.localStorage.removeItem(storageKey);
        window.location.reload();
    };

    return (
        <div className="pointer-events-none absolute left-2 top-2 z-10">
            <Button
                className="pointer-events-auto rounded-full shadow-lg"
                color="neutral"
                onClick={handleReset}
                size="sm"
                startDecorator={<Reset className="size-4" />}
                variant="soft"
            >
                Reset
            </Button>
        </div>
    );
}
