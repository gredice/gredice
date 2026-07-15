'use client';

import { useCurrentUser } from '@gredice/ui/auth';
import type { PropsWithChildren } from 'react';
import { OperationCompletionSyncProvider } from '../offline/OperationCompletionSyncProvider';
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
    const user = isFarmCurrentUser(currentUser.data?.user)
        ? currentUser.data.user
        : null;
    const authenticated =
        Boolean(currentUser.data?.isLogginedIn) && user !== null;
    const shell = (
        <FarmAuthenticatedShell
            authenticated={authenticated}
            pathname={pathname}
        >
            {children}
        </FarmAuthenticatedShell>
    );

    return user && authenticated ? (
        <OperationCompletionSyncProvider
            accountId={user.accountId}
            mode={user.operationCompletionSyncMode}
            sessionIncarnation={user.sessionIncarnation}
            userId={user.id}
        >
            {shell}
        </OperationCompletionSyncProvider>
    ) : (
        shell
    );
}
