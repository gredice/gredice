import { Typography } from '@signalco/ui-primitives/Typography';
import type { PropsWithChildren } from 'react';

export function DashboardDivider({ children }: PropsWithChildren) {
    return (
        <Typography level="h3" semiBold className="text-lg">
            {children}
        </Typography>
    );
}