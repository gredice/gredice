'use client';

import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Card, CardContent } from '@gredice/ui/Card';
import { LoaderSpinner, Reset, Warning } from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useDriverTracking } from '../hooks/useDriverTracking';
import type { DeliveryDashboard as DeliveryDashboardData } from '../lib/deliveryDashboardTypes';
import { CustomerDashboard } from './CustomerDashboard';
import { DriverDashboard } from './DriverDashboard';

async function readDashboard() {
    const response = await fetch('/api/dashboard', { cache: 'no-store' });
    if (!response.ok) {
        throw new Error('Podatke o dostavama trenutačno nije moguće učitati.');
    }
    const data: unknown = await response.json();
    if (!isDeliveryDashboard(data)) {
        throw new Error(
            'Poslužitelj je vratio neispravne podatke o dostavama.',
        );
    }
    return data;
}

function isDeliveryDashboard(value: unknown): value is DeliveryDashboardData {
    if (
        typeof value !== 'object' ||
        value === null ||
        !('kind' in value) ||
        !('user' in value) ||
        typeof value.user !== 'object' ||
        value.user === null ||
        !('id' in value.user) ||
        typeof value.user.id !== 'string' ||
        !('displayName' in value.user) ||
        typeof value.user.displayName !== 'string' ||
        !('role' in value.user) ||
        typeof value.user.role !== 'string'
    ) {
        return false;
    }

    return value.kind === 'driver'
        ? 'batches' in value &&
              Array.isArray(value.batches) &&
              'maximumRouteDeliveries' in value &&
              typeof value.maximumRouteDeliveries === 'number' &&
              'maximumRouteWindowHours' in value &&
              typeof value.maximumRouteWindowHours === 'number'
        : value.kind === 'customer' &&
              'deliveries' in value &&
              Array.isArray(value.deliveries);
}

async function postAction(path: string, body?: object) {
    const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
    });
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
        const message =
            typeof data === 'object' &&
            data !== null &&
            'error' in data &&
            typeof data.error === 'string'
                ? data.error
                : 'Radnju nije moguće dovršiti.';
        throw new Error(message);
    }
}

export function DeliveryDashboard() {
    const [pendingAction, setPendingAction] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const query = useQuery({
        queryKey: ['delivery-dashboard'],
        queryFn: readDashboard,
        refetchInterval: 10_000,
    });
    const activeRunId =
        query.data?.kind === 'driver'
            ? (query.data.activeRun?.id ?? null)
            : null;
    const trackingState = useDriverTracking(activeRunId);

    const perform = async (key: string, path: string, body?: object) => {
        setPendingAction(key);
        setActionError(null);
        try {
            await postAction(path, body);
            await query.refetch();
        } catch (error) {
            setActionError(
                error instanceof Error
                    ? error.message
                    : 'Radnju nije moguće dovršiti.',
            );
        } finally {
            setPendingAction(null);
        }
    };

    if (query.isPending) {
        return (
            <main className="flex min-h-[100dvh] items-center justify-center bg-background p-4">
                <div className="flex items-center gap-3 text-muted-foreground">
                    <LoaderSpinner className="size-5 animate-spin" />
                    <Typography>Učitavanje dostava…</Typography>
                </div>
            </main>
        );
    }

    if (query.isError || !query.data) {
        return (
            <main className="flex min-h-[100dvh] items-center justify-center bg-background p-4">
                <Card className="w-full max-w-md">
                    <CardContent noHeader className="space-y-4 p-6 text-center">
                        <Warning className="mx-auto size-9 text-warning" />
                        <Typography level="h3" semiBold>
                            Dostave nisu dostupne
                        </Typography>
                        <Typography className="text-muted-foreground">
                            {query.error instanceof Error
                                ? query.error.message
                                : 'Pokušaj ponovno za nekoliko trenutaka.'}
                        </Typography>
                        <Button
                            startDecorator={<Reset className="size-4" />}
                            onClick={() => void query.refetch()}
                        >
                            Pokušaj ponovno
                        </Button>
                    </CardContent>
                </Card>
            </main>
        );
    }

    const dashboard = query.data;
    return (
        <>
            {actionError ? (
                <div className="fixed inset-x-4 top-4 z-50 mx-auto max-w-xl">
                    <Alert
                        color="danger"
                        startDecorator={<Warning className="size-5" />}
                    >
                        {actionError}
                    </Alert>
                </div>
            ) : null}
            {dashboard.kind === 'driver' ? (
                <DriverDashboard
                    dashboard={dashboard}
                    trackingState={trackingState}
                    pendingAction={pendingAction}
                    onStartRun={(deliveryRequestIds) =>
                        void perform('start-route', '/api/driver/runs', {
                            deliveryRequestIds,
                        })
                    }
                    onArrive={(runId, stopId) =>
                        void perform(
                            `${stopId}:arrive`,
                            `/api/driver/runs/${runId}/stops/${stopId}/arrive`,
                        )
                    }
                    onDeliver={(runId, stopId, notes) =>
                        void perform(
                            `${stopId}:deliver`,
                            `/api/driver/runs/${runId}/stops/${stopId}/deliver`,
                            { notes },
                        )
                    }
                />
            ) : (
                <CustomerDashboard dashboard={dashboard} />
            )}
        </>
    );
}
