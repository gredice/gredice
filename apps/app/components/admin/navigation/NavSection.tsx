'use client';

import type { PropsWithChildren } from 'react';

export function NavSection({
    label,
    compact = false,
    children,
}: PropsWithChildren<{
    label: string;
    compact?: boolean;
}>) {
    if (compact) {
        return <div className="space-y-1">{children}</div>;
    }

    return (
        <section className="space-y-1">
            <div className="px-2 pt-3 pb-1 text-muted-foreground text-xs font-semibold">
                {label}
            </div>
            <div className="space-y-1">{children}</div>
        </section>
    );
}
