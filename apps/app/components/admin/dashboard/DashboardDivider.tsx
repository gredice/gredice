import { Typography } from '@gredice/ui/Typography';
import type { PropsWithChildren } from 'react';

export function DashboardDivider({ children }: PropsWithChildren) {
    return (
        <Typography level="h2" semiBold className="text-lg">
            {children}
        </Typography>
    );
}
