import { Card } from '@gredice/ui/Card';
import { Navigate } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

export function SeedRelatedCard({
    header,
    name,
    href,
    linkLabel,
    visual,
}: {
    header: string;
    name: string;
    href: Route;
    linkLabel: string;
    visual: ReactNode;
}) {
    return (
        <Link
            href={href}
            aria-label={`${linkLabel} ${name}`}
            className="group rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2"
        >
            <Card className="border-tertiary border-b-4 p-0 transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                <Row alignItems="center" spacing={3} className="min-w-0 pr-3">
                    <div className="size-20 shrink-0 overflow-hidden rounded-l-md bg-muted">
                        {visual}
                    </div>
                    <Stack spacing={1} className="min-w-0 grow">
                        <Typography level="body3" secondary component="h3">
                            {header}
                        </Typography>
                        <Typography semiBold className="truncate">
                            {name}
                        </Typography>
                    </Stack>
                    <Navigate
                        aria-hidden
                        className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                    />
                </Row>
            </Card>
        </Link>
    );
}
