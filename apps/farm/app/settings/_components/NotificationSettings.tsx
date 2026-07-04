'use client';

import { clientAuthenticated } from '@gredice/client';
import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import {
    Check,
    Close,
    Delete,
    Desktop,
    Device,
    Laptop,
    Megaphone,
    Tablet,
    Warning,
} from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Switch } from '@gredice/ui/Switch';
import { Typography } from '@gredice/ui/Typography';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    type PushSetupStatus,
    pushDeviceIdKey,
    usePushSubscription,
} from './usePushSubscription';

type PushOnboarding = ReturnType<typeof usePushSubscription>;

type NotificationDeviceListItem = {
    createdAt?: string | Date | null;
    deviceId?: string | null;
    deviceLabel?: string | null;
    enabled: boolean;
    id: string;
    lastFailureAt?: string | Date | null;
    lastFailureReason?: string | null;
    lastSeenAt?: string | Date | null;
    lastSuccessAt?: string | Date | null;
    permissionState?: string | null;
    platform?: string | null;
    revokedAt?: string | Date | null;
    revokedReason?: string | null;
    userAgent?: string | null;
};

type NotificationSettingsProps = {
    pushOnboarding?: PushOnboarding;
    readCurrentPushDeviceId?: () => string | undefined;
};

const notificationDevicesKey = ['notifications', 'devices'];
const notificationPushStatusKey = ['notifications', 'push-status'];

function readCurrentPushDeviceIdFromStorage() {
    if (typeof window === 'undefined') return undefined;
    return window.localStorage.getItem(pushDeviceIdKey) ?? undefined;
}

function permissionStatusLabel(status: PushSetupStatus) {
    switch (status) {
        case 'granted':
            return 'dozvoljeno';
        case 'denied':
            return 'blokirano';
        case 'unsupported':
            return 'nije podržano';
        case 'unconfigured':
            return 'nije konfigurirano';
        case 'prompt-dismissed':
            return 'odgođeno';
        case 'subscribed':
            return 'uključeno';
        case 'setup-failed':
            return 'nije dovršeno';
        default:
            return 'nije odlučeno';
    }
}

function permissionStatusColor(
    status: PushSetupStatus,
): 'success' | 'warning' | 'error' | 'neutral' | 'info' {
    switch (status) {
        case 'subscribed':
        case 'granted':
            return 'success';
        case 'denied':
        case 'setup-failed':
            return 'error';
        case 'unsupported':
        case 'unconfigured':
        case 'prompt-dismissed':
            return 'warning';
        default:
            return 'neutral';
    }
}

function pushStatusLabel(status: string | undefined) {
    switch (status) {
        case 'subscribed':
            return 'uređaj prima obavijesti';
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

function pushStatusColor(
    status: string | undefined,
): 'success' | 'warning' | 'error' | 'neutral' | 'info' {
    switch (status) {
        case 'subscribed':
            return 'success';
        case 'denied':
            return 'error';
        case 'disabled':
            return 'warning';
        case 'unsubscribed':
        case undefined:
            return 'neutral';
        default:
            return 'info';
    }
}

function deviceDisplayName(device: NotificationDeviceListItem) {
    const label = device.deviceLabel?.trim();
    if (!label) return 'Nepoznati uređaj';
    return label.replace(/\s*\([^)]*\)\s*$/u, '');
}

function deviceIcon(device: NotificationDeviceListItem) {
    const deviceText =
        `${device.platform ?? ''} ${device.userAgent ?? ''}`.toLowerCase();

    if (/ipad|tablet/u.test(deviceText)) {
        return <Tablet aria-hidden className="size-5" />;
    }

    if (/iphone|android|mobile/u.test(deviceText)) {
        return <Device aria-hidden className="size-5" />;
    }

    if (/mac|linux|windows/u.test(deviceText)) {
        return <Laptop aria-hidden className="size-5" />;
    }

    return <Desktop aria-hidden className="size-5" />;
}

function formatDeviceDate(value: string | Date | null | undefined) {
    if (!value) return 'nema podataka';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'nema podataka';
    return date.toLocaleString('hr-HR');
}

function isRevokedDevice(device: NotificationDeviceListItem) {
    return Boolean(device.revokedAt);
}

function isDeliverableDevice(device: NotificationDeviceListItem) {
    return (
        device.enabled &&
        device.permissionState === 'granted' &&
        !isRevokedDevice(device)
    );
}

function capabilityAlert(status: PushSetupStatus) {
    switch (status) {
        case 'unsupported':
            return {
                color: 'warning' as const,
                message:
                    'Ovaj preglednik, uređaj ili nesigurna veza ne podržava web push obavijesti.',
            };
        case 'denied':
            return {
                color: 'danger' as const,
                message:
                    'Obavijesti su blokirane u pregledniku. Otvori postavke preglednika i omogući obavijesti za ovu stranicu.',
            };
        case 'unconfigured':
            return {
                color: 'warning' as const,
                message:
                    'Web push obavijesti nisu konfigurirane na ovom okruženju.',
            };
        case 'prompt-dismissed':
            return {
                color: 'info' as const,
                message:
                    'Zahtjev za dozvolu nije dovršen. Možeš ponovno pokušati kada želiš primati obavijesti na ovom uređaju.',
            };
        case 'setup-failed':
            return {
                color: 'danger' as const,
                message: 'Obavijesti nisu uključene. Pokušaj ponovno.',
            };
        default:
            return null;
    }
}

export function NotificationSettings({
    pushOnboarding: pushOnboardingOverride,
    readCurrentPushDeviceId = readCurrentPushDeviceIdFromStorage,
}: NotificationSettingsProps = {}) {
    const internalPushOnboarding = usePushSubscription();
    const pushOnboarding = pushOnboardingOverride ?? internalPushOnboarding;
    const queryClient = useQueryClient();

    function invalidateNotificationQueries() {
        void queryClient.invalidateQueries({
            queryKey: notificationDevicesKey,
        });
        void queryClient.invalidateQueries({
            queryKey: notificationPushStatusKey,
        });
    }

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
            enabled,
            id,
        }: {
            enabled: boolean;
            id: string;
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
        onSuccess: invalidateNotificationQueries,
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
        onSuccess: invalidateNotificationQueries,
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
            invalidateNotificationQueries();
        }
    };

    const currentPushDeviceId = readCurrentPushDeviceId();
    const activeDevices =
        devicesQuery.data?.filter((device) => !isRevokedDevice(device)) ?? [];
    const currentNotificationDevice = currentPushDeviceId
        ? activeDevices.find(
              (device) => device.deviceId === currentPushDeviceId,
          )
        : undefined;
    const currentDeviceNotificationsEnabled = currentNotificationDevice
        ? isDeliverableDevice(currentNotificationDevice)
        : false;
    const canRequestPush =
        pushOnboarding.status !== 'denied' &&
        pushOnboarding.status !== 'unsupported' &&
        pushOnboarding.status !== 'unconfigured';
    const deviceMutationBusy =
        updateDeviceMutation.isPending || revokeDeviceMutation.isPending;
    const currentDeviceToggleDisabled =
        pushStatusQuery.isPending ||
        devicesQuery.isPending ||
        devicesQuery.isError ||
        pushStatusQuery.isError ||
        deviceMutationBusy ||
        pushOnboarding.isRequesting ||
        currentNotificationDevice?.permissionState === 'denied' ||
        (!currentNotificationDevice && !canRequestPush);
    const testNotificationResult = sendTestMutation.data;
    const hasDeliverableDevice =
        pushStatusQuery.data?.status === 'subscribed' ||
        activeDevices.some(isDeliverableDevice);
    const statusAlert = capabilityAlert(pushOnboarding.status);
    const visiblePushError =
        pushOnboarding.error && pushOnboarding.error !== statusAlert?.message
            ? pushOnboarding.error
            : null;

    function handleCurrentDeviceToggle(checked: boolean) {
        if (currentNotificationDevice) {
            updateDeviceMutation.mutate({
                enabled: checked,
                id: currentNotificationDevice.id,
            });
            return;
        }

        void handleEnablePush();
    }

    async function handleRevokeDevice(device: NotificationDeviceListItem) {
        try {
            await revokeDeviceMutation.mutateAsync(device.id);
            if (device.deviceId && device.deviceId === currentPushDeviceId) {
                await pushOnboarding.revokeBrowserSubscription();
            }
        } catch {
            // Mutation state renders the recoverable error below.
        }
    }

    return (
        <Stack spacing={4}>
            <Card>
                <CardHeader>
                    <Row
                        justifyContent="space-between"
                        alignItems="start"
                        spacing={4}
                        className="gap-y-3"
                    >
                        <Stack spacing={1} className="min-w-0 flex-1">
                            <CardTitle>Web push obavijesti</CardTitle>
                            <Typography level="body2" secondary>
                                Upravljaj obavijestima za ovaj preglednik i
                                uređaje koji primaju operativne novosti.
                            </Typography>
                        </Stack>
                        <Row spacing={1} className="flex-wrap justify-end">
                            <Chip
                                color={permissionStatusColor(
                                    pushOnboarding.status,
                                )}
                                size="sm"
                                variant="soft"
                                startDecorator={
                                    pushOnboarding.status === 'subscribed' ? (
                                        <Check aria-hidden />
                                    ) : (
                                        <Warning aria-hidden />
                                    )
                                }
                            >
                                Dozvola:{' '}
                                {permissionStatusLabel(pushOnboarding.status)}
                            </Chip>
                            <Chip
                                color={pushStatusColor(
                                    pushStatusQuery.data?.status,
                                )}
                                size="sm"
                                variant="soft"
                            >
                                Status:{' '}
                                {pushStatusLabel(pushStatusQuery.data?.status)}
                            </Chip>
                        </Row>
                    </Row>
                </CardHeader>
                <CardContent>
                    <Stack spacing={3}>
                        <div className="flex items-center gap-3 rounded-md border border-border/70 bg-muted/20 p-3">
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-background text-muted-foreground">
                                {currentNotificationDevice ? (
                                    deviceIcon(currentNotificationDevice)
                                ) : (
                                    <Device aria-hidden className="size-5" />
                                )}
                            </div>
                            <Stack spacing={0.5} className="min-w-0 flex-1">
                                <Typography semiBold>Ovaj uređaj</Typography>
                                <Typography level="body3" secondary>
                                    {currentDeviceNotificationsEnabled
                                        ? 'Obavijesti su uključene za ovaj uređaj.'
                                        : currentNotificationDevice
                                          ? 'Uređaj je spremljen, ali obavijesti su isključene.'
                                          : 'Uređaj još nije prijavljen za web push obavijesti.'}
                                </Typography>
                            </Stack>
                            <Switch
                                aria-label={
                                    currentDeviceNotificationsEnabled
                                        ? 'Isključi obavijesti na ovom uređaju'
                                        : 'Uključi obavijesti na ovom uređaju'
                                }
                                checked={currentDeviceNotificationsEnabled}
                                disabled={currentDeviceToggleDisabled}
                                onCheckedChange={handleCurrentDeviceToggle}
                            />
                        </div>

                        {statusAlert && (
                            <Alert color={statusAlert.color}>
                                {statusAlert.message}
                            </Alert>
                        )}
                        {pushStatusQuery.isError && (
                            <Alert color="warning">
                                Status obavijesti nije učitan.
                            </Alert>
                        )}
                        {visiblePushError && (
                            <Alert color="danger">{visiblePushError}</Alert>
                        )}
                        {updateDeviceMutation.isError && (
                            <Alert color="danger">
                                Uređaj nije ažuriran. Pokušaj ponovno.
                            </Alert>
                        )}
                        {revokeDeviceMutation.isError && (
                            <Alert color="danger">
                                Uređaj nije uklonjen. Pokušaj ponovno.
                            </Alert>
                        )}

                        <Row spacing={2} className="flex-wrap">
                            {pushOnboarding.canPrompt &&
                                !currentDeviceNotificationsEnabled && (
                                    <Button
                                        size="sm"
                                        loading={pushOnboarding.isRequesting}
                                        onClick={handleEnablePush}
                                        startDecorator={
                                            <Megaphone className="size-4" />
                                        }
                                    >
                                        Uključi obavijesti
                                    </Button>
                                )}
                            {pushOnboarding.status === 'default' && (
                                <Button
                                    size="sm"
                                    variant="plain"
                                    onClick={pushOnboarding.dismissPrompt}
                                    startDecorator={
                                        <Close className="size-4" />
                                    }
                                >
                                    Ne sada
                                </Button>
                            )}
                        </Row>
                    </Stack>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <Row
                        justifyContent="space-between"
                        alignItems="center"
                        spacing={2}
                        className="flex-wrap gap-y-2"
                    >
                        <Stack spacing={0.5} className="min-w-0">
                            <CardTitle>Uređaji za obavijesti</CardTitle>
                            <Typography level="body3" secondary>
                                Aktivni uređaji povezani s ovim farm računom.
                            </Typography>
                        </Stack>
                        <Button
                            size="sm"
                            disabled={
                                sendTestMutation.isPending ||
                                !hasDeliverableDevice
                            }
                            loading={sendTestMutation.isPending}
                            onClick={() => sendTestMutation.mutate()}
                            startDecorator={<Megaphone className="size-4" />}
                        >
                            Pošalji probnu obavijest
                        </Button>
                    </Row>
                </CardHeader>
                <CardContent>
                    <Stack spacing={2}>
                        {sendTestMutation.isError && (
                            <Alert color="danger">
                                Probna obavijest nije poslana.
                            </Alert>
                        )}
                        {sendTestMutation.isSuccess && (
                            <Alert color="success" role="status">
                                Probna obavijest je poslana. Ciljano:{' '}
                                {testNotificationResult?.targeted ?? 0} ·
                                Prihvaćeno:{' '}
                                {testNotificationResult?.accepted ?? 0} ·
                                Neuspjelo: {testNotificationResult?.failed ?? 0}
                            </Alert>
                        )}
                        {devicesQuery.isPending ? (
                            <Typography level="body2" secondary>
                                Uređaji se učitavaju.
                            </Typography>
                        ) : devicesQuery.isError ? (
                            <Alert color="warning">
                                Uređaji za obavijesti nisu učitani.
                            </Alert>
                        ) : activeDevices.length ? (
                            activeDevices.map((device) => {
                                const label = deviceDisplayName(device);
                                const deliverable = isDeliverableDevice(device);
                                const toggleDisabled =
                                    deviceMutationBusy ||
                                    device.permissionState === 'denied';

                                return (
                                    <div
                                        key={device.id}
                                        className="flex flex-col gap-3 rounded-md border border-border/70 p-3 sm:flex-row sm:items-center"
                                    >
                                        <div className="flex min-w-0 flex-1 items-start gap-3">
                                            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                                {deviceIcon(device)}
                                            </div>
                                            <Stack
                                                spacing={0.5}
                                                className="min-w-0 flex-1"
                                            >
                                                <Row
                                                    spacing={1}
                                                    className="min-w-0 flex-wrap"
                                                >
                                                    <Typography semiBold>
                                                        {label}
                                                    </Typography>
                                                    {device.deviceId ===
                                                        currentPushDeviceId && (
                                                        <Chip
                                                            color="info"
                                                            size="sm"
                                                            variant="soft"
                                                        >
                                                            ovaj uređaj
                                                        </Chip>
                                                    )}
                                                    <Chip
                                                        color={
                                                            deliverable
                                                                ? 'success'
                                                                : 'neutral'
                                                        }
                                                        size="sm"
                                                        variant="soft"
                                                    >
                                                        {deliverable
                                                            ? 'uključeno'
                                                            : 'isključeno'}
                                                    </Chip>
                                                </Row>
                                                <Typography
                                                    level="body3"
                                                    secondary
                                                >
                                                    Zadnji put viđen:{' '}
                                                    {formatDeviceDate(
                                                        device.lastSeenAt,
                                                    )}
                                                </Typography>
                                                {device.lastFailureReason && (
                                                    <Typography
                                                        level="body3"
                                                        secondary
                                                    >
                                                        Zadnja greška:{' '}
                                                        {
                                                            device.lastFailureReason
                                                        }
                                                    </Typography>
                                                )}
                                            </Stack>
                                        </div>
                                        <Row
                                            spacing={2}
                                            className="shrink-0 justify-end"
                                        >
                                            <Switch
                                                aria-label={`${
                                                    deliverable
                                                        ? 'Isključi'
                                                        : 'Uključi'
                                                } ${label}`}
                                                checked={deliverable}
                                                disabled={toggleDisabled}
                                                onCheckedChange={(enabled) =>
                                                    updateDeviceMutation.mutate(
                                                        {
                                                            enabled,
                                                            id: device.id,
                                                        },
                                                    )
                                                }
                                            />
                                            <Button
                                                aria-label={`Ukloni ${label}`}
                                                size="sm"
                                                variant="plain"
                                                color="danger"
                                                disabled={deviceMutationBusy}
                                                onClick={() => {
                                                    void handleRevokeDevice(
                                                        device,
                                                    );
                                                }}
                                                startDecorator={
                                                    <Delete className="size-4" />
                                                }
                                            >
                                                Ukloni
                                            </Button>
                                        </Row>
                                    </div>
                                );
                            })
                        ) : (
                            <Typography level="body2" secondary>
                                Nema uređaja prijavljenih za obavijesti.
                            </Typography>
                        )}
                    </Stack>
                </CardContent>
            </Card>
        </Stack>
    );
}
