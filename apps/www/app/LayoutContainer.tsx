'use client';

import { Container } from '@signalco/ui-primitives/Container';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export function LayoutContainer({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    const pathname = usePathname();

    if (pathname === '/' || pathname.startsWith('/blokovi/biljke/generator')) {
        return <>{children}</>;
    }

    return <Container>{children}</Container>;
}
