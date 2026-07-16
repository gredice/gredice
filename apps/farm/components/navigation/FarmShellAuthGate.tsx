'use client';

import { useCurrentUser } from '@gredice/ui/auth';
import type { PropsWithChildren } from 'react';
import { isFarmCurrentUser } from '../providers/AuthAppProvider';
import { FarmAuthenticatedShell } from './FarmAuthenticatedShell';

type FarmShellAuthGateProps = PropsWithChildren<{
    pathname: string;
}>;

export function FarmShellAuthGate({
    children,
    pathname,
}: FarmShellAuthGateProps) {
    const currentUser = useCurrentUser();
    const authenticated =
        Boolean(currentUser.data?.isLogginedIn) &&
        isFarmCurrentUser(currentUser.data?.user);

    return (
        <FarmAuthenticatedShell
            authenticated={authenticated}
            pathname={pathname}
        >
            {children}
        </FarmAuthenticatedShell>
    );
}
