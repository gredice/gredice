import { Card, CardHeader, CardOverflow } from '@signalco/ui-primitives/Card';
import type { Route } from 'next';
import type { PropsWithChildren, ReactElement } from 'react';

export function ItemCard({
    children,
    label,
    href,
}: PropsWithChildren<{ label: string | ReactElement; href: Route | URL }>) {
    return (
        <Card
            className="overflow-hidden hover:shadow-xl transition-all group border-tertiary border-b-4"
            href={href as string}
        >
            <CardOverflow className="p-0 aspect-square overflow-hidden mb-2">
                <div className="relative size-full">{children}</div>
            </CardOverflow>
            <CardHeader className="bg-muted/60 border-t -m-2 py-2 px-3 text-center group-hover:bg-muted transition-all">
                {label}
            </CardHeader>
        </Card>
    );
}
