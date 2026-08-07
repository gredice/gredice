'use client';

import { authCurrentUserQueryKeys } from '@gredice/ui/auth';
import { IconButton } from '@gredice/ui/IconButton';
import { LogOut } from '@gredice/ui/icons';
import { usePostHog } from '@posthog/next';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { FarmLoggedOutSession } from '../../lib/auth/logoutSessions';
import { purgeOperationCompletionDraftsForUser } from '../../lib/offline/operationCompletionDraftStore';
import { queryClient } from '../providers/ClientAppProvider';

function parseLoggedOutSessions(value: unknown) {
    if (
        typeof value !== 'object' ||
        value === null ||
        !('loggedOutSessions' in value) ||
        !Array.isArray(value.loggedOutSessions)
    ) {
        return [];
    }

    const sessions: FarmLoggedOutSession[] = [];
    for (const candidate of value.loggedOutSessions.slice(0, 3)) {
        if (
            typeof candidate !== 'object' ||
            candidate === null ||
            !('sessionIncarnation' in candidate) ||
            !('userId' in candidate)
        ) {
            continue;
        }
        const { sessionIncarnation, userId } = candidate;
        if (
            typeof sessionIncarnation !== 'string' ||
            sessionIncarnation.length === 0 ||
            typeof userId !== 'string' ||
            userId.length === 0 ||
            sessions.some(
                (session) =>
                    session.sessionIncarnation === sessionIncarnation &&
                    session.userId === userId,
            )
        ) {
            continue;
        }
        sessions.push({ sessionIncarnation, userId });
    }
    return sessions;
}

export function LogoutButton({
    sessionIncarnation,
    size = 'md',
    userId,
}: {
    sessionIncarnation: string;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    userId: string;
}) {
    const posthog = usePostHog();
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleLogout = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/logout', { method: 'POST' });
            if (!response.ok) {
                console.error('Logout failed with status', response.status);
                return;
            }

            const responseBody: unknown = await response
                .json()
                .catch(() => null);
            const loggedOutSessions = parseLoggedOutSessions(responseBody);
            const sessionsToPurge = [...loggedOutSessions];
            if (
                !sessionsToPurge.some(
                    (session) =>
                        session.sessionIncarnation === sessionIncarnation &&
                        session.userId === userId,
                )
            ) {
                sessionsToPurge.push({ sessionIncarnation, userId });
            }
            for (const loggedOutSession of sessionsToPurge) {
                const purgeResult = await purgeOperationCompletionDraftsForUser(
                    loggedOutSession.userId,
                    loggedOutSession.sessionIncarnation,
                );
                if (purgeResult.status === 'unavailable') {
                    console.error(
                        'Local completion drafts could not be cleared after logout.',
                    );
                }
            }
            await queryClient.invalidateQueries({
                queryKey: authCurrentUserQueryKeys,
            });
            queryClient.removeQueries({
                queryKey: ['farm', 'notifications'],
            });
            posthog?.reset();
            router.refresh();
        } catch (cause) {
            console.error('Logout request failed', cause);
        } finally {
            setLoading(false);
        }
    };

    return (
        <IconButton
            title="Odjavi se"
            variant="plain"
            size={size}
            loading={loading}
            onClick={handleLogout}
            className="whitespace-nowrap"
        >
            <LogOut className="size-4 shrink-0" />
        </IconButton>
    );
}
