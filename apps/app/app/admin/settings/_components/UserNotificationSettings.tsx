'use client';

import { clientAuthenticated } from '@gredice/client';
import { Button } from '@gredice/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Close, Megaphone } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

    return (
        <Stack spacing={4}>
            <Card>
                <CardHeader>
                    <CardTitle>Push obavijesti na ovom uređaju</CardTitle>
                </CardHeader>
                <CardContent>
                    <Stack spacing={2}>
                        <Typography level="body2" secondary>
                            Primaj push obavijesti u pregledniku kad ti je
                            dodijeljena nova radnja ili kad se dogodi važna
                            promjena.
                        </Typography>
                        <Typography level="body3" secondary>
                            Preglednik:{' '}
                            {notificationsSupported
                                ? 'podržava obavijesti'
                                : 'ne podržava obavijesti'}{' '}
                            · Dozvola:{' '}
                            {permissionStatusLabel(pushOnboarding.status)} ·
                            Status:{' '}
                            {pushStatusLabel(pushStatusQuery.data?.status)}
                        </Typography>
                        {pushStatusQuery.isError && (
                            <Typography level="body3" secondary>
                                Status obavijesti nije učitan.
                            </Typography>
                        )}
                        {pushOnboarding.status === 'denied' && (
                            <Typography level="body3" secondary>
                                Obavijesti su blokirane u pregledniku. Otvori
                                postavke preglednika i omogući obavijesti za ovu
                                stranicu.
                            </Typography>
                        )}
                        {pushOnboarding.status === 'unconfigured' && (
                            <Typography level="body3" secondary>
                                Web push obavijesti nisu konfigurirane na ovom
                                okruženju.
                            </Typography>
                        )}
                        {pushOnboarding.canPrompt &&
                            pushStatusQuery.data?.status !== 'subscribed' && (
                                <Row justifyContent="end">
                                    <Button
                                        size="sm"
                                        onClick={handleEnablePush}
                                        startDecorator={
                                            <Megaphone className="size-4" />
                                        }
                                    >
                                        Uključi obavijesti
                                    </Button>
                                </Row>
                            )}
                    </Stack>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <Row
                        justifyContent="space-between"
                        alignItems="center"
                        spacing={2}
                        className="flex-wrap"
                    >
                        <CardTitle>Uređaji za obavijesti</CardTitle>
                        <Button
                            size="sm"
                            disabled={sendTestMutation.isPending}
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
                            <Typography level="body3" secondary>
                                Probna obavijest nije poslana.
                            </Typography>
                        )}
                        {sendTestMutation.isSuccess && (
                            <Typography level="body3" secondary>
                                Probna obavijest je poslana. Ciljano:{' '}
                                {testNotificationResult?.targeted ?? 0} ·
                                Prihvaćeno:{' '}
                                {testNotificationResult?.accepted ?? 0} ·
                                Neuspjelo: {testNotificationResult?.failed ?? 0}
                            </Typography>
                        )}
                        {devicesQuery.isPending ? (
                            <Typography level="body2" secondary>
                                Uređaji se učitavaju.
                            </Typography>
                        ) : devicesQuery.isError ? (
                            <Typography level="body2" secondary>
                                Uređaji za obavijesti nisu učitani.
                            </Typography>
                        ) : devicesQuery.data?.length ? (
                            devicesQuery.data.map((device) => (
                                <Card key={device.id} className="bg-muted/30">
                                    <CardContent>
                                        <Stack spacing={1}>
                                            <Typography semiBold>
                                                {device.deviceLabel ||
                                                    'Nepoznati uređaj'}
                                            </Typography>
                                            <Typography level="body3" secondary>
                                                {device.userAgent ||
                                                    'Nepoznat preglednik'}
                                            </Typography>
                                            <Typography level="body3" secondary>
                                                Status:{' '}
                                                {device.enabled
                                                    ? 'aktivan'
                                                    : 'isključen'}{' '}
                                                · Zadnji put viđen:{' '}
                                                {device.lastSeenAt
                                                    ? new Date(
                                                          device.lastSeenAt,
                                                      ).toLocaleString('hr-HR')
                                                    : 'nema podataka'}
                                            </Typography>
                                            <Row spacing={2}>
                                                <Button
                                                    size="sm"
                                                    variant="plain"
                                                    disabled={
                                                        deviceMutationBusy
                                                    }
                                                    onClick={() =>
                                                        updateDeviceMutation.mutate(
                                                            {
                                                                id: device.id,
                                                                enabled:
                                                                    !device.enabled,
                                                            },
                                                        )
                                                    }
                                                >
                                                    {device.enabled
                                                        ? 'Isključi'
                                                        : 'Uključi'}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="plain"
                                                    disabled={
                                                        deviceMutationBusy
                                                    }
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
                                            </Row>
                                        </Stack>
                                    </CardContent>
                                </Card>
                            ))
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
