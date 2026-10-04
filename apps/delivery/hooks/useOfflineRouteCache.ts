'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { DriverDeliveryDashboard } from '../lib/deliveryDashboardTypes';
import {
    deliveryLogoutEvent,
    deliveryRunCompletedEvent,
} from '../lib/deliveryOfflineEvents';
import {
    createBrowserOfflineRouteCachePersistence,
    createOfflineRouteSnapshot,
    type OfflineRouteSnapshot,
} from '../lib/offlineRouteCache';

export function useOfflineRouteCache(
    authenticatedUserId: string | null,
    dashboard: DriverDeliveryDashboard | null,
) {
    const persistence = useMemo(createBrowserOfflineRouteCachePersistence, []);
    const [snapshot, setSnapshot] = useState<OfflineRouteSnapshot | null>(null);
    const previousScopeRef = useRef<{
        userId: string;
        runId: string;
    } | null>(null);

    useEffect(() => {
        const handleLogout = () => {
            previousScopeRef.current = null;
            setSnapshot(null);
        };
        const handleRunCompleted = (event: Event) => {
            const detail = (event as CustomEvent<unknown>).detail;
            if (
                typeof detail !== 'object' ||
                detail === null ||
                !('userId' in detail) ||
                typeof detail.userId !== 'string' ||
                detail.userId !== authenticatedUserId ||
                !('runId' in detail) ||
                typeof detail.runId !== 'string'
            ) {
                return;
            }
            void persistence
                .clear({
                    userId: detail.userId,
                    runId: detail.runId,
                })
                .catch(() => undefined);
            previousScopeRef.current = null;
            setSnapshot(null);
        };
        window.addEventListener(deliveryLogoutEvent, handleLogout);
        window.addEventListener(deliveryRunCompletedEvent, handleRunCompleted);
        return () => {
            window.removeEventListener(deliveryLogoutEvent, handleLogout);
            window.removeEventListener(
                deliveryRunCompletedEvent,
                handleRunCompleted,
            );
        };
    }, [authenticatedUserId, persistence]);

    useEffect(() => {
        if (!authenticatedUserId) {
            setSnapshot(null);
            return;
        }
        if (!dashboard) {
            let active = true;
            void persistence
                .load({ userId: authenticatedUserId })
                .then((stored) => {
                    if (active) {
                        previousScopeRef.current = stored?.scope ?? null;
                        setSnapshot(stored);
                    }
                })
                .catch(() => {
                    if (active) setSnapshot(null);
                });
            return () => {
                active = false;
            };
        }
        const run = dashboard.activeRun;
        if (!run) {
            void persistence
                .clear({ userId: dashboard.user.id })
                .catch(() => undefined);
            previousScopeRef.current = null;
            setSnapshot(null);
            return;
        }
        const scope = { userId: dashboard.user.id, runId: run.id };
        const previousScope = previousScopeRef.current;
        if (
            previousScope &&
            (previousScope.userId !== scope.userId ||
                previousScope.runId !== scope.runId)
        ) {
            void persistence.clear(previousScope).catch(() => undefined);
        }
        previousScopeRef.current = scope;
        let active = true;
        const projected = createOfflineRouteSnapshot({
            authenticatedUserId: dashboard.user.id,
            dashboard,
        });
        if (projected) {
            setSnapshot(projected);
            void persistence.save(projected).catch(() => undefined);
            return;
        }
        void persistence
            .load(scope)
            .then((stored) => {
                if (active) setSnapshot(stored);
            })
            .catch(() => {
                if (active) setSnapshot(null);
            });
        return () => {
            active = false;
        };
    }, [authenticatedUserId, dashboard, persistence]);

    return snapshot;
}
