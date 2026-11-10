import { Card, CardOverflow } from '@gredice/ui/Card';
import { Navigate } from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

export function DashboardChartCard({
    title,
    href,
    value,
    detail,
    legend,
    children,
}: {
    title: string;
    href: Route;
    value: ReactNode;
    detail?: ReactNode;
    legend?: ReactNode;
    children: ReactNode;
}) {
    return (
        <Card className="h-full">
            <CardOverflow className="h-full">
                <div className="flex h-full flex-col gap-3 p-3">
                    <div className="flex flex-col gap-1">
                        <Typography level="h3" semiBold className="text-sm">
                            <Link
                                href={href}
                                className="inline-flex items-center gap-0.5 rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                            >
                                {title}
                                <Navigate
                                    aria-hidden
                                    className="size-4 text-muted-foreground"
                                />
                            </Link>
                        </Typography>
                        <Typography level="h4" component="p" semiBold>
                            {value}
                        </Typography>
                        {detail ? (
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                {detail}
                            </Typography>
                        ) : null}
                    </div>
                    {legend}
                    <div className="mt-auto">{children}</div>
                </div>
            </CardOverflow>
        </Card>
    );
}
