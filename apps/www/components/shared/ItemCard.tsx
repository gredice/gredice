import type { Route } from 'next';
import type { PropsWithChildren, ReactElement, ReactNode } from 'react';
import { Card, CardHeader, CardOverflow } from './Card';

export function ItemCard({
    children,
    label,
    badge,
    footer,
    href,
    mediaViewTransitionName,
}: PropsWithChildren<{
    label: string | ReactElement;
    /** Top-right corner of the media, outside the link, so it can be interactive. */
    badge?: ReactNode;
    /** Below the label, outside the link, so it can hold its own buttons or links. */
    footer?: ReactNode;
    href: Route;
    mediaViewTransitionName?: string;
}>) {
    return (
        // The link's overlay covers the whole card. Positioned footer content
        // comes later in the DOM and the badge is raised, so both stay above it.
        <div className="group relative isolate h-full rounded-lg">
            {badge && (
                <div className="absolute top-1.5 right-1.5 z-10">{badge}</div>
            )}
            <Card className="flex h-full flex-col overflow-hidden border-tertiary border-b-4 transition-all group-hover:bg-accent group-hover:text-accent-foreground group-hover:shadow-xl">
                <CardOverflow
                    className="public-content-card-view-transition mb-2 aspect-square shrink-0 overflow-hidden p-0"
                    style={
                        mediaViewTransitionName
                            ? { viewTransitionName: mediaViewTransitionName }
                            : undefined
                    }
                >
                    <div className="relative size-full">{children}</div>
                </CardOverflow>
                <CardHeader className="-m-2 grow border-t bg-muted/60 px-3 py-2 transition-all group-hover:bg-muted">
                    <a
                        className="after:absolute after:inset-0 after:rounded-lg focus-visible:outline-hidden focus-visible:after:ring-2 focus-visible:after:ring-ring"
                        href={href}
                    >
                        {label}
                    </a>
                    {footer && <div className="mt-auto">{footer}</div>}
                </CardHeader>
            </Card>
        </div>
    );
}
