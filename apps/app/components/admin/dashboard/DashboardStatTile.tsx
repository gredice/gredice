import { Card, CardOverflow } from '@gredice/ui/Card';
import { Typography } from '@gredice/ui/Typography';
import type { ReactNode } from 'react';
import { DashboardChange } from './DashboardChange';
import { formatDashboardNumber } from './dashboardFormat';

export function DashboardStatTile({
    label,
    value,
    previousValue,
    detail,
    href,
}: {
    label: string;
    value: number | string;
    /** Count at the start of the selected period, used for the change line. */
    previousValue?: number;
    detail?: ReactNode;
    href?: string;
}) {
    return (
        <Card href={href} className="h-full">
            <CardOverflow className="h-full">
                <div className="flex h-full flex-col gap-1 p-3">
                    <Typography level="body3" className="text-muted-foreground">
                        {label}
                    </Typography>
                    <Typography level="h4" component="p" semiBold>
                        {typeof value === 'number'
                            ? formatDashboardNumber(value)
                            : value}
                    </Typography>
                    {typeof value === 'number' &&
                    typeof previousValue === 'number' ? (
                        <DashboardChange
                            current={value}
                            previous={previousValue}
                        />
                    ) : null}
                    {detail ? (
                        <Typography
                            level="body3"
                            className="text-muted-foreground"
                        >
                            {detail}
                        </Typography>
                    ) : null}
                </div>
            </CardOverflow>
        </Card>
    );
}
