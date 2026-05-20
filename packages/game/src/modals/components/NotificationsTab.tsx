import { clientAuthenticated } from '@gredice/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@gredice/ui/Tabs';
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
import { useEffect, useState } from 'react';
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

type DigestFrequency = NonNullable<
    NotificationPreferenceUpdate['digestFrequency']
>;
type DigestPeriod = Exclude<DigestFrequency, 'off'>;

type NotificationsView = 'notifications' | 'settings';
type NotificationsFilter = 'unread' | 'all';

const notificationPreferencesKey = ['notifications', 'preferences'];
const notificationDevicesKey = ['notifications', 'devices'];
const notificationPushStatusKey = ['notifications', 'push-status'];
const defaultQuietHoursStartMinute = 22 * 60;
const defaultQuietHoursEndMinute = 7 * 60;

const categoryPreferences: Array<{
    category: string;
    label: string;
    channel: NotificationPreferenceUpdate['channel'];
}> = [
    {
        category: 'garden_activity',
        label: 'Aktivnosti vrta',
        channel: 'push',
    },
    {
        category: 'orders',
        label: 'Narudžbe i dostava',
        channel: 'push',
    },
    {
        category: 'promotions',
        label: 'Promocije i preporuke',
        channel: 'email',
    },
];

const digestFrequencyItems: Array<{
    label: string;
    value: DigestPeriod;
}> = [
    { label: 'Svaki sat', value: 'hourly' },
    { label: 'Dnevno', value: 'daily' },
    { label: 'Tjedno', value: 'weekly' },
];

function isNotificationsView(value: string): value is NotificationsView {
    return value === 'notifications' || value === 'settings';
}

function isNotificationsFilter(value: string): value is NotificationsFilter {
    return value === 'unread' || value === 'all';
}

function isDigestPeriod(value: string): value is DigestPeriod {
    return digestFrequencyItems.some((item) => item.value === value);
}

function minuteToTimeValue(minute: number) {
    const normalizedMinute = ((minute % 1440) + 1440) % 1440;
    const hours = Math.floor(normalizedMinute / 60)
        .toString()
        .padStart(2, '0');
    const minutes = (normalizedMinute % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

function timeValueToMinute(value: string) {
    const [hoursText, minutesText] = value.split(':');
    const hours = Number(hoursText);
    const minutes = Number(minutesText);
    if (
        !Number.isInteger(hours) ||
        !Number.isInteger(minutes) ||
        hours < 0 ||
        hours > 23 ||
        minutes < 0 ||
        minutes > 59
    ) {
        return null;
    }
    return hours * 60 + minutes;
}

function permissionStatusLabel(status: string) {
    switch (status) {
        case 'granted':
            return 'dopušteno';
        case 'denied':
            return 'odbijeno';
        case 'unsupported':
            return 'nije podržano';
        case 'prompt-dismissed':
            return 'odgođeno';
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

export function NotificationsTab() {
    const [activeView, setActiveView] =
        useState<NotificationsView>('notifications');
    const [notificationsFilter, setNotificationsFilter] =
        useState<NotificationsFilter>('unread');
    const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
    const [quietHoursStartMinute, setQuietHoursStartMinute] = useState(
        defaultQuietHoursStartMinute,
    );
    const [quietHoursEndMinute, setQuietHoursEndMinute] = useState(
        defaultQuietHoursEndMinute,
    );
    const [digestEnabled, setDigestEnabled] = useState(false);
    const [digestFrequency, setDigestFrequency] =
        useState<DigestPeriod>('daily');
    const markAllNotificationsRead = useMarkAllNotificationsRead();
    const { track } = useGameAnalytics();
    const pushOnboarding = usePushPermissionOnboarding();
    const queryClient = useQueryClient();

    const preferencesQuery = useQuery({
        queryKey: notificationPreferencesKey,
        queryFn: async () => {
            const response =
                await clientAuthenticated().api.notifications.preferences.$get();
            if (!response.ok)
                throw new Error('Postavke obavijesti nisu učitane');
            return (await response.json()).preferences;
        },
    });

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

    const savePreferencesMutation = useMutation({
        mutationFn: async (preferences: NotificationPreferenceUpdate[]) => {
            const response =
                await clientAuthenticated().api.notifications.preferences.$put({
                    json: { preferences },
                });
            if (!response.ok)
                throw new Error('Postavke obavijesti nisu spremljene');
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
        },
    });

    useEffect(() => {
        if (!preferencesQuery.data?.length) {
            return;
        }

        const quietHoursPreference = preferencesQuery.data.find(
            (preference) =>
                preference.quietHoursStartMinute !== null &&
                preference.quietHoursEndMinute !== null,
        );
        if (
            typeof quietHoursPreference?.quietHoursStartMinute === 'number' &&
            typeof quietHoursPreference.quietHoursEndMinute === 'number'
        ) {
            setQuietHoursEnabled(true);
            setQuietHoursStartMinute(
                quietHoursPreference.quietHoursStartMinute,
            );
            setQuietHoursEndMinute(quietHoursPreference.quietHoursEndMinute);
        } else {
            setQuietHoursEnabled(false);
        }

        const digestPreference = preferencesQuery.data.find(
            (preference) =>
                preference.digestFrequency &&
                preference.digestFrequency !== 'off',
        );
        if (
            digestPreference?.digestFrequency &&
            isDigestPeriod(digestPreference.digestFrequency)
        ) {
            setDigestEnabled(true);
            setDigestFrequency(digestPreference.digestFrequency);
        } else {
            setDigestEnabled(false);
        }
    }, [preferencesQuery.data]);

    function findPreference(item: (typeof categoryPreferences)[number]) {
        return preferencesQuery.data?.find(
            (preference) =>
                preference.category === item.category &&
                preference.channel === item.channel &&
                preference.scope === 'global',
        );
    }

    function buildPreferenceUpdate(
        item: (typeof categoryPreferences)[number],
        enabled: boolean,
        options: {
            quietEnabled?: boolean;
            quietStart?: number;
            quietEnd?: number;
            summaryEnabled?: boolean;
            summaryFrequency?: DigestPeriod;
        } = {},
    ): NotificationPreferenceUpdate {
        const nextQuietEnabled = options.quietEnabled ?? quietHoursEnabled;
        const nextSummaryEnabled = options.summaryEnabled ?? digestEnabled;

        return {
            scope: 'global',
            category: item.category,
            channel: item.channel,
            enabled,
            quietHoursStartMinute: nextQuietEnabled
                ? (options.quietStart ?? quietHoursStartMinute)
                : null,
            quietHoursEndMinute: nextQuietEnabled
                ? (options.quietEnd ?? quietHoursEndMinute)
                : null,
            digestFrequency: nextSummaryEnabled
                ? (options.summaryFrequency ?? digestFrequency)
                : 'off',
        };
    }

    function saveAllPreferenceSettings(
        options: Parameters<typeof buildPreferenceUpdate>[2] = {},
    ) {
        savePreferencesMutation.mutate(
            categoryPreferences.map((item) =>
                buildPreferenceUpdate(
                    item,
                    findPreference(item)?.enabled ?? false,
                    options,
                ),
            ),
        );
    }

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

    const notificationsSupported =
        typeof window !== 'undefined' && 'Notification' in window;
    const settingsBusy = savePreferencesMutation.isPending;

    return (
        <Stack spacing={2}>
            <Typography level="h4" className="hidden md:block">
                🔔 Obavijesti
            </Typography>
            <Tabs
                value={activeView}
                onValueChange={(value: string) => {
                    if (isNotificationsView(value)) {
                        setActiveView(value);
                    }
                }}
                className="flex flex-col"
            >
                <TabsList className="grid w-full grid-cols-2 border">
                    <TabsTrigger value="notifications">Obavijesti</TabsTrigger>
                    <TabsTrigger value="settings">Postavke</TabsTrigger>
                </TabsList>
                <TabsContent value="notifications" className="mt-3">
                    <Stack spacing={1}>
                        <Typography level="body1" semiBold>
                            Popis obavijesti
                        </Typography>
                        <Card className="bg-card p-1">
                            <Row justifyContent="space-between">
                                <SelectItems
                                    value={notificationsFilter}
                                    onValueChange={(value) => {
                                        if (!isNotificationsFilter(value)) {
                                            return;
                                        }
                                        track(
                                            'game_notifications_filter_changed',
                                            {
                                                filter: value,
                                            },
                                        );
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
                                            icon: (
                                                <Approved className="size-4" />
                                            ),
                                        },
                                    ]}
                                />
                                <Button
                                    variant="plain"
                                    size="sm"
                                    onClick={handleMarkAllNotificationsRead}
                                    startDecorator={
                                        <Approved className="size-4" />
                                    }
                                >
                                    Sve pročitano
                                </Button>
                            </Row>
                        </Card>
                        <div className="overflow-y-auto max-h-[calc(100dvh-18rem)] md:max-h-[calc(100dvh-24rem)] rounded-lg text-card-foreground bg-card shadow-sm p-0">
                            <NotificationList
                                read={notificationsFilter === 'all'}
                            />
                        </div>
                    </Stack>
                </TabsContent>
                <TabsContent value="settings" className="mt-3">
                    <Stack spacing={1}>
                        <Card className="bg-card p-2">
                            <Stack spacing={1}>
                                <Typography level="body1" semiBold>
                                    Obavijesti na ovom uređaju
                                </Typography>
                                <Typography level="body2" secondary>
                                    Preglednik:{' '}
                                    {notificationsSupported
                                        ? 'podržava obavijesti'
                                        : 'ne podržava obavijesti'}{' '}
                                    · Dozvola:{' '}
                                    {permissionStatusLabel(
                                        pushOnboarding.status,
                                    )}{' '}
                                    · Status:{' '}
                                    {pushStatusLabel(
                                        pushStatusQuery.data?.status,
                                    )}
                                </Typography>
                                {pushOnboarding.status === 'denied' && (
                                    <Typography level="body3" secondary>
                                        Obavijesti su blokirane u pregledniku.
                                        Otvori postavke preglednika i omogući
                                        obavijesti za ovu stranicu.
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
                                            Uključi obavijesti
                                        </Button>
                                    </Row>
                                )}
                            </Stack>
                        </Card>

                        <Card className="bg-card p-2">
                            <Stack spacing={1}>
                                <Row justifyContent="space-between">
                                    <Typography level="body1" semiBold>
                                        Vrste obavijesti
                                    </Typography>
                                    <Button
                                        size="sm"
                                        variant="plain"
                                        disabled={settingsBusy}
                                        onClick={() =>
                                            savePreferencesMutation.mutate(
                                                categoryPreferences.map(
                                                    (item) =>
                                                        buildPreferenceUpdate(
                                                            item,
                                                            true,
                                                        ),
                                                ),
                                            )
                                        }
                                    >
                                        Omogući sve
                                    </Button>
                                </Row>
                                {categoryPreferences.map((item) => {
                                    const preference = findPreference(item);
                                    return (
                                        <Row
                                            key={item.category}
                                            justifyContent="space-between"
                                            alignItems="center"
                                        >
                                            <Typography>
                                                {item.label}
                                            </Typography>
                                            <Checkbox
                                                checked={
                                                    preference?.enabled ?? false
                                                }
                                                disabled={settingsBusy}
                                                onCheckedChange={(
                                                    checked: boolean,
                                                ) =>
                                                    savePreferencesMutation.mutate(
                                                        [
                                                            buildPreferenceUpdate(
                                                                item,
                                                                Boolean(
                                                                    checked,
                                                                ),
                                                            ),
                                                        ],
                                                    )
                                                }
                                            />
                                        </Row>
                                    );
                                })}
                            </Stack>
                        </Card>

                        <Card className="bg-card p-2">
                            <Stack spacing={1}>
                                <Checkbox
                                    label="Ne ometaj"
                                    checked={quietHoursEnabled}
                                    disabled={settingsBusy}
                                    onCheckedChange={(checked: boolean) => {
                                        const enabled = Boolean(checked);
                                        setQuietHoursEnabled(enabled);
                                        saveAllPreferenceSettings({
                                            quietEnabled: enabled,
                                        });
                                    }}
                                />
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <Input
                                        label="Od"
                                        type="time"
                                        value={minuteToTimeValue(
                                            quietHoursStartMinute,
                                        )}
                                        disabled={
                                            !quietHoursEnabled || settingsBusy
                                        }
                                        onChange={(event) => {
                                            const minute = timeValueToMinute(
                                                event.target.value,
                                            );
                                            if (minute === null) {
                                                return;
                                            }
                                            setQuietHoursStartMinute(minute);
                                            if (quietHoursEnabled) {
                                                saveAllPreferenceSettings({
                                                    quietStart: minute,
                                                });
                                            }
                                        }}
                                    />
                                    <Input
                                        label="Do"
                                        type="time"
                                        value={minuteToTimeValue(
                                            quietHoursEndMinute,
                                        )}
                                        disabled={
                                            !quietHoursEnabled || settingsBusy
                                        }
                                        onChange={(event) => {
                                            const minute = timeValueToMinute(
                                                event.target.value,
                                            );
                                            if (minute === null) {
                                                return;
                                            }
                                            setQuietHoursEndMinute(minute);
                                            if (quietHoursEnabled) {
                                                saveAllPreferenceSettings({
                                                    quietEnd: minute,
                                                });
                                            }
                                        }}
                                    />
                                </div>
                            </Stack>
                        </Card>

                        <Card className="bg-card p-2">
                            <Stack spacing={1}>
                                <Checkbox
                                    label="Primaj sažetak obavijesti"
                                    checked={digestEnabled}
                                    disabled={settingsBusy}
                                    onCheckedChange={(checked: boolean) => {
                                        const enabled = Boolean(checked);
                                        setDigestEnabled(enabled);
                                        saveAllPreferenceSettings({
                                            summaryEnabled: enabled,
                                        });
                                    }}
                                />
                                <Stack spacing={0.5}>
                                    <Typography level="body2" semiBold>
                                        Razdoblje sažetka
                                    </Typography>
                                    <div
                                        className={
                                            digestEnabled
                                                ? undefined
                                                : 'pointer-events-none opacity-50'
                                        }
                                    >
                                        <SelectItems
                                            value={digestFrequency}
                                            onValueChange={(value) => {
                                                if (!isDigestPeriod(value)) {
                                                    return;
                                                }
                                                setDigestFrequency(value);
                                                if (digestEnabled) {
                                                    saveAllPreferenceSettings({
                                                        summaryFrequency: value,
                                                    });
                                                }
                                            }}
                                            items={digestFrequencyItems}
                                        />
                                    </div>
                                </Stack>
                            </Stack>
                        </Card>

                        <Card className="bg-card p-2">
                            <Row
                                justifyContent="space-between"
                                alignItems="center"
                            >
                                <Typography level="body1" semiBold>
                                    Uređaji za obavijesti
                                </Typography>
                                <Button
                                    size="sm"
                                    onClick={() => sendTestMutation.mutate()}
                                    startDecorator={
                                        <Megaphone className="size-4" />
                                    }
                                >
                                    Pošalji probnu obavijest
                                </Button>
                            </Row>
                            <Stack spacing={1} className="pt-2">
                                {devicesQuery.data?.length ? (
                                    devicesQuery.data.map((device) => (
                                        <Card
                                            key={device.id}
                                            className="p-1 bg-muted/20"
                                        >
                                            <Stack spacing={0.5}>
                                                <Typography semiBold>
                                                    {device.deviceLabel ||
                                                        'Nepoznati uređaj'}
                                                </Typography>
                                                <Typography
                                                    level="body3"
                                                    secondary
                                                >
                                                    {device.userAgent ||
                                                        'Nepoznat preglednik'}
                                                </Typography>
                                                <Typography
                                                    level="body3"
                                                    secondary
                                                >
                                                    Status:{' '}
                                                    {device.enabled
                                                        ? 'aktivan'
                                                        : 'isključen'}{' '}
                                                    · Zadnji put viđen:{' '}
                                                    {device.lastSeenAt
                                                        ? new Date(
                                                              device.lastSeenAt,
                                                          ).toLocaleString(
                                                              'hr-HR',
                                                          )
                                                        : 'nema podataka'}
                                                </Typography>
                                                <Row spacing={1}>
                                                    <Button
                                                        size="sm"
                                                        variant="plain"
                                                        onClick={() =>
                                                            updateDeviceMutation.mutate(
                                                                {
                                                                    id: device.id,
                                                                    payload: {
                                                                        enabled:
                                                                            !device.enabled,
                                                                    },
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
                                        </Card>
                                    ))
                                ) : (
                                    <Typography level="body2" secondary>
                                        Nema uređaja prijavljenih za obavijesti.
                                    </Typography>
                                )}
                            </Stack>
                        </Card>
                    </Stack>
                </TabsContent>
            </Tabs>
        </Stack>
    );
}
