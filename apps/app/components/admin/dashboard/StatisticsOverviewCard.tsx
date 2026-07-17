import { Card, CardOverflow } from '@gredice/ui/Card';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { ReactNode } from 'react';

export function StatisticsOverviewCard({
    title,
    value,
    detail,
    href,
}: {
    title: string;
    value: ReactNode;
    detail: string;
    href: string;
}) {
    return (
        <Card href={href}>
            <CardOverflow>
                <Stack spacing={1} className="p-3">
                    <Typography level="body3">{title}</Typography>
                    <Typography level="h4" semiBold className="tabular-nums">
                        {value}
                    </Typography>
                    <Typography level="body3" className="text-muted-foreground">
                        {detail}
                    </Typography>
                </Stack>
            </CardOverflow>
        </Card>
    );
}
