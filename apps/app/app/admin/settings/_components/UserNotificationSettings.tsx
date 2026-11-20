'use client';

import { clientAuthenticated } from '@gredice/client';
import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Chip } from '@gredice/ui/Chip';
import { Close, Device, Megaphone, Warning } from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { SettingsCard } from './SettingsCard';
import { SettingsCardBody } from './SettingsCardBody';
import { SettingsCardFooter } from './SettingsCardFooter';
import { usePushSubscription } from './usePushSubscription';

const notificationDevicesKey = ['notifications', 'devices'];
const notificationPushStatusKey = ['notifications', 'push-status'];

function permissionStatusLabel(status: string) {
    switch (status) {
        case 'granted':
            return 'dopušteno';
        case 'denied':
            return 'odbijeno';
        case 'unsupported':
            return 'nije podržano';
        case 'unconfigured':
            return 'nije konfigurirano';
        case 'prompt-dismissed':
            return 'odgođeno';
        case 'subscribed':
            return 'uključeno';
        default:
            return 'nije odlučeno';
    }
}

function pushStatusLabel(status: string | undefined) {
    switch (status) {
        case 'subscribed':
            return 'uključeno';
        case 'unsubscribed':
            return 'nije uključeno';
        case 'denied':
            return 'blokirano';
        case 'disabled':
            return 'isključeno';
        case undefined:
            return 'učitavanje';
        default:
            return status;
    }
}

export function UserNotificationSettings() {
    const pushOnboarding = usePushSubscription();
    const queryClient = useQueryClient();
    // Error of the last device switch or removal. Starting another device
    // action clears it, so it never describes an older, different action.
    const [deviceActionError, setDeviceActionError] = useState<string | null>(
        null,
    );

    const devicesQuery = useQuery({
        queryKey: notificationDevicesKey,
        queryFn: async () => {
            const response =
                await clientAuthenticated().api.notifications.devices.$get();
            if (!response.ok)
                throw new Error('Uređaji za obavijesti nisu učitani');
            return (await response.json()).devices;
        },
    });

    const pushStatusQuery = useQuery({
        queryKey: notificationPushStatusKey,
        queryFn: async () => {
            const response =
                await clientAuthenticated().api.notifications[
                    'push-status'
                ].$get();
            if (!response.ok) throw new Error('Status obavijesti nije učitan');
            return response.json();
        },
    });

    const updateDeviceMutation = useMutation({
        mutationFn: async ({
            id,
            enabled,
        }: {
            id: string;
            enabled: boolean;
        }) => {
            const response =
                await clientAuthenticated().api.notifications.devices[
                    ':id'
                ].$patch({
                    param: { id },
                    json: { enabled },
                });
            if (!response.ok) throw new Error('Uređaj nije ažuriran');
        },
        onMutate: () => setDeviceActionError(null),
        onError: () => setDeviceActionError('Uređaj nije ažuriran.'),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: notificationDevicesKey });
            queryClient.invalidateQueries({
                queryKey: notificationPushStatusKey,
            });
        },
    });

    const revokeDeviceMutation = useMutation({
        mutationFn: async (id: string) => {
            const response =
                await clientAuthenticated().api.notifications.devices[
                    ':id'
                ].$delete({
                    param: { id },
                });
            if (!response.ok) throw new Error('Uređaj nije uklonjen');
        },
        onMutate: () => setDeviceActionError(null),
        onError: () => setDeviceActionError('Uređaj nije uklonjen.'),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: notificationDevicesKey });
            queryClient.invalidateQueries({
                queryKey: notificationPushStatusKey,
            });
        },
    });

    const sendTestMutation = useMutation({
        mutationFn: async () => {
            const response =
                await clientAuthenticated().api.notifications.test.$post();
            if (!response.ok) throw new Error('Probna obavijest nije poslana');
            return response.json();
        },
    });

    const handleEnablePush = async () => {
        const result = await pushOnboarding.requestPermission();
        if (result === 'subscribed') {
            queryClient.invalidateQueries({ queryKey: notificationDevicesKey });
            queryClient.invalidateQueries({
                queryKey: notificationPushStatusKey,
            });
        }
    };

    const notificationsSupported =
        typeof window !== 'undefined' && 'Notification' in window;
    const deviceMutationBusy =
        updateDeviceMutation.isPending || revokeDeviceMutation.isPending;
    const testNotificationResult = sendTestMutation.data;

    const canEnablePush =
        pushOnboarding.canPrompt &&
        pushStatusQuery.data?.status !== 'subscribed';
    const pushStatusItems = [
        {
            label: 'Preglednik',
            value: notificationsSupported
                ? 'podržava obavijesti'
                : 'ne podržava obavijesti',
        },
        {
            label: 'Dozvola',
            value: permissionStatusLabel(pushOnboarding.status),
        },
        {
            label: 'Status',
            value: pushStatusLabel(pushStatusQuery.data?.status),
        },
    ];

    return (
        <>
            <SettingsCard
                title="Push obavijesti na ovom uređaju"
                description="Primaj push obavijesti u pregledniku kad ti je dodijeljena nova radnja ili kad se dogodi važna promjena."
            >
                <SettingsCardBody>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 @md/settings:grid-cols-3">
                        {pushStatusItems.map((item) => (
                            <div key={item.label} className="min-w-0">
                                <dt className="text-xs text-muted-foreground">
                                    {item.label}
                                </dt>
                                <dd className="text-sm font-medium">
                                    {item.value}
                                </dd>
                            </div>
                        ))}
                    </dl>
                    {pushStatusQuery.isError && (
                        <Alert
                            color="danger"
                            startDecorator={<Warning className="size-4" />}
                        >
                            Status obavijesti nije učitan.
                        </Alert>
                    )}
                    {pushOnboarding.status === 'denied' && (
                        <Alert
                            color="warning"
                            role="note"
                            startDecorator={<Warning className="size-4" />}
                        >
                            Obavijesti su blokirane u pregledniku. Otvori
                            postavke preglednika i omogući obavijesti za ovu
                            stranicu.
                        </Alert>
                    )}
                    {pushOnboarding.status === 'unconfigured' && (
                        <Alert
                            color="warning"
                            role="note"
                            startDecorator={<Warning className="size-4" />}
                        >
                            Web push obavijesti nisu konfigurirane na ovom
                            okruženju.
                        </Alert>
                    )}
                </SettingsCardBody>
                {canEnablePush && (
                    <SettingsCardFooter>
                        <p className="text-sm text-muted-foreground">
                            Preglednik će zatražiti dozvolu za obavijesti.
                        </p>
                        <Button
                            onClick={handleEnablePush}
                            startDecorator={<Megaphone className="size-4" />}
                        >
                            Uključi obavijesti
                        </Button>
                    </SettingsCardFooter>
                )}
            </SettingsCard>

            <SettingsCard
                title="Uređaji za obavijesti"
                description="Uređaji i preglednici prijavljeni za push obavijesti tvog računa."
                aside={
                    <Button
                        size="sm"
                        variant="outlined"
                        disabled={sendTestMutation.isPending}
                        onClick={() => sendTestMutation.mutate()}
                        startDecorator={<Megaphone className="size-4" />}
                    >
                        Pošalji probnu obavijest
                    </Button>
                }
            >
                <SettingsCardBody>
                    {sendTestMutation.isError && (
                        <Alert
                            color="danger"
                            startDecorator={<Warning className="size-4" />}
                        >
                            Probna obavijest nije poslana.
                        </Alert>
                    )}
                    {sendTestMutation.isSuccess && (
                        <Alert color="success" role="status">
                            Probna obavijest je poslana. Ciljano:{' '}
                            {testNotificationResult?.targeted ?? 0} ·
                            Prihvaćeno: {testNotificationResult?.accepted ?? 0}{' '}
                            · Neuspjelo: {testNotificationResult?.failed ?? 0}
                        </Alert>
                    )}
                    {deviceActionError && (
                        <Alert
                            color="danger"
                            startDecorator={<Warning className="size-4" />}
                        >
                            {deviceActionError} Pokušaj ponovno.
                        </Alert>
                    )}
                    {devicesQuery.isPending ? (
                        <Typography level="body2" secondary>
                            Uređaji se učitavaju.
                        </Typography>
                    ) : devicesQuery.isError ? (
                        <Alert
                            color="danger"
                            startDecorator={<Warning className="size-4" />}
                        >
                            Uređaji za obavijesti nisu učitani.
                        </Alert>
                    ) : devicesQuery.data?.length ? (
                        <ul className="divide-y rounded-md border">
                            {devicesQuery.data.map((device) => (
                                <li
                                    key={device.id}
                                    className="flex flex-col gap-3 p-3 @lg/settings:flex-row @lg/settings:items-center"
                                >
                                    <Device
                                        className="hidden size-5 shrink-0 text-muted-foreground @lg/settings:block"
                                        aria-hidden
                                    />
                                    <div className="min-w-0 flex-1 space-y-0.5">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm font-medium">
                                                {device.deviceLabel ||
                                                    'Nepoznati uređaj'}
                                            </span>
                                            <Chip
                                                color={
                                                    device.enabled
                                                        ? 'success'
                                                        : 'neutral'
                                                }
                                                variant="soft"
                                                size="sm"
                                            >
                                                {device.enabled
                                                    ? 'Aktivan'
                                                    : 'Isključen'}
                                            </Chip>
                                        </div>
                                        <p className="break-words text-xs text-muted-foreground">
                                            {device.userAgent ||
                                                'Nepoznat preglednik'}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Zadnji put viđen:{' '}
                                            {device.lastSeenAt
                                                ? new Date(
                                                      device.lastSeenAt,
                                                  ).toLocaleString('hr-HR')
                                                : 'nema podataka'}
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1">
                                        <Button
                                            size="sm"
                                            variant="outlined"
                                            disabled={deviceMutationBusy}
                                            onClick={() =>
                                                updateDeviceMutation.mutate({
                                                    id: device.id,
                                                    enabled: !device.enabled,
                                                })
                                            }
                                        >
                                            {device.enabled
                                                ? 'Isključi'
                                                : 'Uključi'}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="plain"
                                            disabled={deviceMutationBusy}
                                            startDecorator={
                                                <Close className="size-4" />
                                            }
                                            onClick={() =>
                                                revokeDeviceMutation.mutate(
                                                    device.id,
                                                )
                                            }
                                        >
                                            Ukloni
                                        </Button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <Typography level="body2" secondary>
                            Nema uređaja prijavljenih za obavijesti.
                        </Typography>
                    )}
                </SettingsCardBody>
            </SettingsCard>
        </>
    );
}
