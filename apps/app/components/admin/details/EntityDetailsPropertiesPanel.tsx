import { Stack } from '@gredice/ui/Stack';
import type { ReactNode } from 'react';

export function EntityDetailsPropertiesPanel({
    children,
}: {
    children: ReactNode;
}) {
    return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden lg:max-h-[calc(100vh-6rem)]">
            <div className="min-h-0 grow overflow-y-auto overflow-x-hidden px-1 pb-1">
                <Stack spacing={4}>{children}</Stack>
            </div>
        </div>
    );
}
