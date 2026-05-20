import { Stack } from '@signalco/ui-primitives/Stack';
import type { ReactNode } from 'react';

export function EntityDetailsPropertiesPanel({
    children,
}: {
    children: ReactNode;
}) {
    return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden lg:max-h-[calc(100vh-6rem)]">
            <div className="min-h-0 grow overflow-y-auto overflow-x-hidden p-1">
                <Stack spacing={2}>{children}</Stack>
            </div>
        </div>
    );
}
