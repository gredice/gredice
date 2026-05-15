import { clientAuthenticated } from '@gredice/client';
import { Approved, Close, Empty, Megaphone } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Card } from '@signalco/ui-primitives/Card';
import { Checkbox } from '@signalco/ui-primitives/Checkbox';
import { Input } from '@signalco/ui-primitives/Input';
import { Row } from '@signalco/ui-primitives/Row';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useGameAnalytics } from '../../analytics/GameAnalyticsContext';
import { useMarkAllNotificationsRead } from '../../hooks/useMarkAllNotificationsRead';
import { usePushPermissionOnboarding } from '../../hooks/usePushPermissionOnboarding';
import { NotificationList } from '../../hud/NotificationList';

type ApiClient = ReturnType<typeof clientAuthenticated>;

type NotificationPreferenceUpdate = NonNullable<
    Parameters<ApiClient['api']['notifications']['preferences']['$put']>[0]
>['json']['preferences'][number];

type PushDeviceUpdate = NonNullable<
    Parameters<ApiClient['api']['notifications']['devices'][':id']['$patch']>[0]
>['json'];

const notificationPreferencesKey = ['notifications', 'preferences'];
const notificationDevicesKey = ['notifications', 'devices'];
const notificationPushStatusKey = ['notifications', 'push-status'];

export function NotificationsTab() {
    const [notificationsFilter, setNotificationsFilter] = useState('unread');
    const [quietHoursStartMinute, setQuietHoursStartMinute] = useState(1320);
    const [quietHoursEndMinute, setQuietHoursEndMinute] = useState(420);
    const [digestFrequency, setDigestFrequency] = useState('daily');
    const markAllNotificationsRead = useMarkAllNotificationsRead();
    const { track } = useGameAnalytics();
    const pushOnboarding = usePushPermissionOnboarding();
    const queryClient = useQueryClient();

    const preferencesQuery = useQuery({
        queryKey: notificationPreferencesKey,
        queryFn: async () => {
            const response =
                await clientAuthenticated().api.notifications.preferences.$get();
            if (!response.ok) throw new Error('Failed to load preferences');
            return (await response.json()).preferences;
        },
    });

    const devicesQuery = useQuery({
        queryKey: notificationDevicesKey,
        queryFn: async () => {
            const response =
                await clientAuthenticated().api.notifications.devices.$get();
            if (!response.ok) throw new Error('Failed to load devices');
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
            if (!response.ok) throw new Error('Failed to load push status');
            return response.json();
        },
    });

    const savePreferencesMutation = useMutation({
        mutationFn: async (preferences: NotificationPreferenceUpdate[]) => {
            const response =
                await clientAuthenticated().api.notifications.preferences.$put({
                    json: { preferences },
                });
            if (!response.ok) throw new Error('Failed to save preferences');
        },
        onSuccess: () =>
            queryClient.invalidateQueries({
                queryKey: notificationPreferencesKey,
            }),
    });

    const updateDeviceMutation = useMutation({
        mutationFn: async ({
            id,
            payload,
        }: {
            id: string;
            payload: PushDeviceUpdate;
        }) => {
            const response =
                await clientAuthenticated().api.notifications.devices[
                    ':id'
                ].$patch({
                    param: { id },
                    json: payload,
                });
            if (!response.ok) throw new Error('Failed to update device');
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
            if (!response.ok) throw new Error('Failed to revoke device');
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
            if (!response.ok)
                throw new Error('Failed to send test notification');
        },
    });

    const categoryPreferences = useMemo(
        () => [
            {
                category: 'garden_activity',
                label: 'Aktivnosti vrta',
                channel: 'push' as const,
            },
            {
                category: 'orders',
                label: 'Narudžbe i dostava',
                channel: 'push' as const,
            },
            {
                category: 'promotions',
                label: 'Promocije i preporuke',
                channel: 'email' as const,
            },
        ],
        [],
    );

    const handleEnablePush = async () => {
        track('game_push_enable_clicked', {
            source: 'overview_notifications_tab',
            status: pushOnboarding.status,
        });
        const result = await pushOnboarding.requestPermission();
        track('game_push_permission_result', {
            source: 'overview_notifications_tab',
            result,
        });
    };

    const handleMarkAllNotificationsRead = () => {
        track('game_notifications_mark_all_read', { source: 'overview_tab' });
        markAllNotificationsRead.mutate({ readWhere: 'game' });
    };

    const permissionLabel =
        pushOnboarding.status === 'granted'
            ? 'Dopušteno'
            : pushOnboarding.status === 'denied'
              ? 'Odbijeno'
              : pushOnboarding.status === 'unsupported'
                ? 'Nije podržano'
                : 'Nije odlučeno';

    return (
        <Stack spacing={1}>
            <Typography level="h4" className="hidden md:block">
                🔔 Obavijesti
            </Typography>
            <Card className="bg-card p-2">
                <Stack spacing={1}>
                    <Typography level="body2" secondary>
                        Podrška preglednika:{' '}
                        {'Notification' in window
                            ? 'Podržano'
                            : 'Nije podržano'}{' '}
                        · Dozvola: {permissionLabel} · Push status:{' '}
                        {pushStatusQuery.data?.status ?? 'učitavanje...'}
                    </Typography>
                    {pushOnboarding.status === 'denied' && (
                        <Typography level="body3" secondary>
                            Push je blokiran u pregledniku. Otvori postavke
                            preglednika i omogući obavijesti za ovu stranicu.
                        </Typography>
                    )}
                    {pushOnboarding.canPrompt && (
                        <Row justifyContent="end">
                            <Button
                                size="sm"
                                onClick={handleEnablePush}
                                startDecorator={
                                    <Megaphone className="size-4" />
                                }
                            >
                                Uključi push
                            </Button>
                        </Row>
                    )}
                </Stack>
            </Card>

            <Card className="bg-card p-2">
                <Stack spacing={1}>
                    <Row justifyContent="space-between">
                        <Typography level="body1" semiBold>
                            Tipovi obavijesti
                        </Typography>
                        <Button
                            size="sm"
                            variant="plain"
                            onClick={() =>
                                savePreferencesMutation.mutate(
                                    categoryPreferences.map((item) => ({
                                        scope: 'global',
                                        category: item.category,
                                        channel: item.channel,
                                        enabled: true,
                                        quietHoursStartMinute,
                                        quietHoursEndMinute,
                                    })),
                                )
                            }
                        >
                            Omogući sve
                        </Button>
                    </Row>
                    {categoryPreferences.map((item) => {
                        const preference = preferencesQuery.data?.find(
                            (pref) =>
                                pref.category === item.category &&
                                pref.channel === item.channel &&
                                pref.scope === 'global',
                        );
                        return (
                            <Row
                                key={item.category}
                                justifyContent="space-between"
                                alignItems="center"
                            >
                                <Typography>{item.label}</Typography>
                                <Checkbox
                                    checked={preference?.enabled ?? false}
                                    onCheckedChange={(checked: boolean) =>
                                        savePreferencesMutation.mutate([
                                            {
                                                scope: 'global',
                                                category: item.category,
                                                channel: item.channel,
                                                enabled: Boolean(checked),
                                                quietHoursStartMinute,
                                                quietHoursEndMinute,
                                            },
                                        ])
                                    }
                                />
                            </Row>
                        );
                    })}
                    <Row spacing={1}>
                        <Input
                            label="Tišina od (minute)"
                            type="number"
                            value={quietHoursStartMinute.toString()}
                            onChange={(event) =>
                                setQuietHoursStartMinute(
                                    Number(event.target.value),
                                )
                            }
                        />
                        <Input
                            label="Tišina do (minute)"
                            type="number"
                            value={quietHoursEndMinute.toString()}
                            onChange={(event) =>
                                setQuietHoursEndMinute(
                                    Number(event.target.value),
                                )
                            }
                        />
                        <SelectItems
                            value={digestFrequency}
                            onValueChange={setDigestFrequency}
                            items={[
                                { label: 'Bez sažetka', value: 'off' },
                                { label: 'Satno', value: 'hourly' },
                                { label: 'Dnevno', value: 'daily' },
                                { label: 'Tjedno', value: 'weekly' },
                            ]}
                        />
                    </Row>
                </Stack>
            </Card>

            <Card className="bg-card p-2">
                <Row justifyContent="space-between" alignItems="center">
                    <Typography level="body1" semiBold>
                        Push uređaji
                    </Typography>
                    <Button
                        size="sm"
                        onClick={() => sendTestMutation.mutate()}
                        startDecorator={<Megaphone className="size-4" />}
                    >
                        Pošalji test
                    </Button>
                </Row>
                <Stack spacing={1} className="pt-2">
                    {devicesQuery.data?.length ? (
                        devicesQuery.data.map((device) => (
                            <Card key={device.id} className="p-1 bg-muted/20">
                                <Stack spacing={0.5}>
                                    <Typography semiBold>
                                        {device.deviceLabel ||
                                            'Nepoznati uređaj'}
                                    </Typography>
                                    <Typography level="body3" secondary>
                                        {device.userAgent ||
                                            'Nepoznat preglednik'}
                                    </Typography>
                                    <Typography level="body3" secondary>
                                        Stanje:{' '}
                                        {device.enabled
                                            ? 'Aktivan'
                                            : 'Isključen'}{' '}
                                        · Zadnji put viđen:{' '}
                                        {device.lastSeenAt
                                            ? new Date(
                                                  device.lastSeenAt,
                                              ).toLocaleString('hr-HR')
                                            : 'Nema podataka'}
                                    </Typography>
                                    <Row spacing={1}>
                                        <Button
                                            size="sm"
                                            variant="plain"
                                            onClick={() =>
                                                updateDeviceMutation.mutate({
                                                    id: device.id,
                                                    payload: {
                                                        enabled:
                                                            !device.enabled,
                                                    },
                                                })
                                            }
                                        >
                                            {device.enabled
                                                ? 'Onemogući'
                                                : 'Omogući'}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="plain"
                                            startDecorator={
                                                <Close className="size-4" />
                                            }
                                            onClick={() =>
                                                revokeDeviceMutation.mutate(
                                                    device.id,
                                                )
                                            }
                                        >
                                            Opozovi
                                        </Button>
                                    </Row>
                                </Stack>
                            </Card>
                        ))
                    ) : (
                        <Typography level="body2" secondary>
                            Nema registriranih push uređaja.
                        </Typography>
                    )}
                </Stack>
            </Card>

            <Card className="bg-card p-1">
                <Row justifyContent="space-between">
                    <SelectItems
                        value={notificationsFilter}
                        onValueChange={(value) => {
                            track('game_notifications_filter_changed', {
                                filter: value,
                            });
                            setNotificationsFilter(value);
                        }}
                        items={[
                            {
                                label: 'Nepročitane',
                                value: 'unread',
                                icon: <Empty className="size-4" />,
                            },
                            {
                                label: 'Sve obavijesti',
                                value: 'all',
                                icon: <Approved className="size-4" />,
                            },
                        ]}
                    />
                    <Button
                        variant="plain"
                        size="sm"
                        onClick={handleMarkAllNotificationsRead}
                        startDecorator={<Approved className="size-4" />}
                    >
                        Sve pročitano
                    </Button>
                </Row>
            </Card>
            <div className="overflow-y-auto max-h-[calc(100dvh-18rem)] md:max-h-[calc(100dvh-24rem)] rounded-lg text-card-foreground bg-card shadow-sm p-0">
                <NotificationList read={notificationsFilter === 'all'} />
            </div>
        </Stack>
    );
}
