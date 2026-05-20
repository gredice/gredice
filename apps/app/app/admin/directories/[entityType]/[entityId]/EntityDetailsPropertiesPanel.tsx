import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { ReactNode } from 'react';

export function EntityDetailsPropertiesPanel({
    children,
}: {
    children: ReactNode;
}) {
    return (
        <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border bg-background shadow-2xl lg:max-h-[calc(100vh-6rem)] lg:shadow-sm">
            <div className="shrink-0 border-b px-4 py-3">
                <Typography level="h5" semiBold>
                    Detalji
                </Typography>
            </div>
            <div className="min-h-0 grow overflow-y-auto p-3">
                <Stack spacing={2}>{children}</Stack>
            </div>
        </section>
    );
}
