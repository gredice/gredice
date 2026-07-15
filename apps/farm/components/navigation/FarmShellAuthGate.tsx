'use client';

import { useCurrentUser } from '@gredice/ui/auth';
import type { PropsWithChildren } from 'react';
import { FarmAuthenticatedShell } from './FarmAuthenticatedShell';

type FarmShellAuthGateProps = PropsWithChildren<{
    pathname: string;
}>;

export function FarmShellAuthGate({
    children,
    pathname,
}: FarmShellAuthGateProps) {
    const currentUser = useCurrentUser();

    return (
        <FarmAuthenticatedShell
            authenticated={Boolean(currentUser.data?.isLogginedIn)}
            pathname={pathname}
        >
            {children}
        </FarmAuthenticatedShell>
    );
}
