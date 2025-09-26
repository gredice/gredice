import { Card, CardHeader, CardOverflow } from '@signalco/ui-primitives/Card';
import type { Route } from 'next';
import type { PropsWithChildren, ReactElement } from 'react';

export function ItemCard({
    children,
    label,
    href,
}: PropsWithChildren<{ label: string | ReactElement; href: Route | URL }>) {
    return (
        <Card className="overflow-hidden" href={href as string}>
            <CardOverflow className="p-2 sm:p-4 md:p-6 aspect-square">
                <div className="relative size-full">{children}</div>
            </CardOverflow>
            <CardHeader className="bg-muted/60 border-t -m-2 py-2 px-3 text-center">
                {label}
            </CardHeader>
        </Card>
    );
}
