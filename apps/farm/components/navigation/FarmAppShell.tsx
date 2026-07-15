'use client';

import { usePathname } from 'next/navigation';
import type { PropsWithChildren } from 'react';
import { FarmShellAuthGate } from './FarmShellAuthGate';
import { isFarmWorkspacePath } from './farmNavigation';

export function FarmAppShell({ children }: PropsWithChildren) {
    const pathname = usePathname();

    if (!isFarmWorkspacePath(pathname)) {
        return children;
    }

    return (
        <FarmShellAuthGate pathname={pathname}>{children}</FarmShellAuthGate>
    );
}
