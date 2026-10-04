'use client';

import { NuqsAdapter } from '@gredice/ui/nuqs';
import { PublicChromeProvider } from '@gredice/ui/PublicChrome';
import type { PropsWithChildren } from 'react';

export function ClientAppProvider({ children }: PropsWithChildren) {
    return (
        <PublicChromeProvider>
            <NuqsAdapter>{children}</NuqsAdapter>
        </PublicChromeProvider>
    );
}
