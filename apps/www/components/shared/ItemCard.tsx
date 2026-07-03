import { Card, CardHeader, CardOverflow } from '@gredice/ui/Card';
import type { Route } from 'next';
import type { PropsWithChildren, ReactElement } from 'react';

export function ItemCard({
    children,
    label,
    href,
    mediaViewTransitionName,
}: PropsWithChildren<{
    label: string | ReactElement;
    href: Route;
    mediaViewTransitionName?: string;
}>) {
    return (
        <a
            className="group block h-full rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            href={href}
        >
            <Card className="h-full overflow-hidden border-tertiary border-b-4 transition-all group-hover:bg-accent group-hover:text-accent-foreground group-hover:shadow-xl">
                <CardOverflow
                    className="public-content-card-view-transition mb-2 aspect-square overflow-hidden p-0"
                    style={
                        mediaViewTransitionName
                            ? { viewTransitionName: mediaViewTransitionName }
                            : undefined
                    }
                >
                    <div className="relative size-full">{children}</div>
                </CardOverflow>
                <CardHeader className="-m-2 h-full border-t bg-muted/60 px-3 py-2 transition-all group-hover:bg-muted">
                    {label}
                </CardHeader>
            </Card>
        </a>
    );
}
