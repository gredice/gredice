import { clientAuthenticated } from '@gredice/client';
import { Button } from '@gredice/ui/Button';
import { Card } from '@gredice/ui/Card';
import { Input } from '@gredice/ui/Input';
import {
    Approved,
    Desktop,
    Device,
    Empty,
    Laptop,
    Megaphone,
    Tablet,
} from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Stack } from '@gredice/ui/Stack';
import { Switch } from '@gredice/ui/Switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@gredice/ui/Tabs';
import { Typography } from '@gredice/ui/Typography';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useGameAnalytics } from '../../analytics/GameAnalyticsContext';
import { useMarkAllNotificationsRead } from '../../hooks/useMarkAllNotificationsRead';
import {
    type NotificationPreferenceUpdate,
    useNotificationPreferences,
    useSaveNotificationPreferences,
} from '../../hooks/useNotificationPreferences';
import { usePushPermissionOnboarding } from '../../hooks/usePushPermissionOnboarding';
import { NotificationList } from '../../hud/NotificationList';
import {
    isNotificationsView,
    type NotificationsFilter,
    type NotificationsView,
} from '../../notificationFilters';
import { WhatsNewNotificationToggle } from './WhatsNewNotificationToggle';

type ApiClient = ReturnType<typeof clientAuthenticated>;

type PushDeviceUpdate = NonNullable<
    Parameters<ApiClient['api']['notifications']['devices'][':id']['$patch']>[0]
>['json'];

type DigestFrequency = NonNullable<
    NotificationPreferenceUpdate['digestFrequency']
>;
type DigestPeriod = Exclude<DigestFrequency, 'off'>;

type NotificationDeviceListItem = {
    deviceId?: string | null;
    deviceLabel?: string | null;
    enabled: boolean;
    id: string;
    permissionState?: string | null;
    platform?: string | null;
    userAgent?: string | null;
};

type NotificationPreferenceItem = {
    category: string;
    channel: NotificationPreferenceUpdate['channel'];
    defaultEnabled: boolean;
    description: string;
    digestEligible: boolean;
    label: string;
    quietHoursEligible: boolean;
};

type NotificationPreferencePolicy = Pick<
    NotificationPreferenceItem,
    | 'category'
    | 'channel'
    | 'defaultEnabled'
    | 'digestEligible'
    | 'quietHoursEligible'
>;

const notificationDevicesKey = ['notifications', 'devices'];
const notificationPushStatusKey = ['notifications', 'push-status'];
const pushDeviceIdKey = 'game:push:device-id';
const defaultQuietHoursStartMinute = 22 * 60;
const defaultQuietHoursEndMinute = 7 * 60;
const quietHoursTimeZoneUnavailableMessage =
    'Vremenska zona preglednika nije dostupna. Provjeri postavke uređaja i pokušaj ponovno.';

function readBooleanFlag(value: string | undefined, defaultValue: boolean) {
    const normalizedValue = value?.trim().toLowerCase();
    if (!normalizedValue) {
        return defaultValue;
    }
    return ['1', 'true', 'yes', 'on', 'enabled'].includes(normalizedValue);
}

function readCurrentPushDeviceId() {
    if (typeof window === 'undefined') {
        return undefined;
    }

    return window.localStorage.getItem(pushDeviceIdKey) ?? undefined;
}

function readCurrentTimeZone() {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    } catch {
        return null;
    }
}

const premiumNotificationControlsEnabled = readBooleanFlag(
    process.env.NEXT_PUBLIC_GREDICE_NOTIFICATIONS_PREMIUM_CONTROLS_ENABLED,
    true,
);

const requiredNotificationGroups: Array<{
    category: string;
    description: string;
    label: string;
}> = [
    {
        category: 'account_security',
        description:
            'Prijave, promjene lozinke, oporavak računa i važne pravne obavijesti.',
        label: 'Sigurnost računa i pravne obavijesti',
    },
    {
        category: 'billing_order_delivery',
        description:
            'Plaćanja, računi, povrati i potvrde narudžbi ostaju dostupni odmah.',
        label: 'Plaćanja, računi i potvrde narudžbi',
    },
];

const categoryPreferences: NotificationPreferenceItem[] = [
    {
        category: 'garden',
        channel: 'push',
        defaultEnabled: true,
        description:
            'Radovi u vrtu, promjene termina, berba i zdravstvena upozorenja o vrtu.',
        digestEligible: true,
        label: 'Radovi i berba u vrtu',
        quietHoursEligible: true,
    },
    {
        category: 'weather_alerts',
        channel: 'push',
        defaultEnabled: false,
        description:
            'Upozorenja za grmljavinu, vjetar, kišu, snijeg, poledicu i druge vremenske rizike za regiju vrta.',
        digestEligible: false,
        label: 'Vremenska upozorenja',
        quietHoursEligible: false,
    },
    {
        category: 'reminders',
        channel: 'push',
        defaultEnabled: false,
        description:
            'Podsjetnici za zadatke, košaricu i obnovu pretplate kad ih uključiš.',
        digestEligible: true,
        label: 'Podsjetnici i zadaci',
        quietHoursEligible: true,
    },
    {
        category: 'admin_campaigns',
        channel: 'push',
        defaultEnabled: false,
        description:
            'Novosti o usluzi, nove mogućnosti i održavanje koje nije označeno kao obavezno.',
        digestEligible: true,
        label: 'Novosti o usluzi i održavanju',
        quietHoursEligible: true,
    },
    {
        category: 'promotional',
        channel: 'push',
        defaultEnabled: false,
        description:
            'Promotivne ponude, sezonske preporuke i povremene kampanje.',
        digestEligible: true,
        label: 'Promotivne ponude i sezonske preporuke',
        quietHoursEligible: true,
    },
];

const hiddenDeliveryPreferencePolicies: NotificationPreferencePolicy[] = [
    {
        category: 'delivery_updates',
        channel: 'in_app',
        defaultEnabled: true,
        digestEligible: false,
        quietHoursEligible: true,
    },
    {
        category: 'delivery_updates',
        channel: 'email',
        defaultEnabled: true,
        digestEligible: false,
        quietHoursEligible: true,
    },
    {
        category: 'delivery_updates',
        channel: 'push',
        defaultEnabled: true,
        digestEligible: false,
        quietHoursEligible: true,
    },
];

const globalPreferencePolicies: NotificationPreferencePolicy[] = [
    ...categoryPreferences,
    ...hiddenDeliveryPreferencePolicies,
];

const digestFrequencyItems: Array<{
    label: string;
    value: DigestPeriod;
}> = [
    { label: 'Svaki sat', value: 'hourly' },
    { label: 'Dnevno', value: 'daily' },
    { label: 'Tjedno', value: 'weekly' },
];

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

function deviceDisplayName(device: NotificationDeviceListItem) {
    const label = device.deviceLabel?.trim();
    if (!label) {
        return 'Nepoznati uređaj';
    }

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

type NotificationsTabProps = {
    initialFilter?: NotificationsFilter;
    initialView?: NotificationsView;
};

export function NotificationsTab({
    initialFilter = 'unread',
    initialView = 'notifications',
}: NotificationsTabProps = {}) {
    const [activeView, setActiveView] =
        useState<NotificationsView>(initialView);
    const [notificationsFilter, setNotificationsFilter] =
        useState<NotificationsFilter>(initialFilter);
    const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
    const [quietHoursStartMinute, setQuietHoursStartMinute] = useState(
        defaultQuietHoursStartMinute,
    );
    const [quietHoursEndMinute, setQuietHoursEndMinute] = useState(
        defaultQuietHoursEndMinute,
    );
    const [quietHoursTimeZone, setQuietHoursTimeZone] = useState<string | null>(
        null,
    );
    const [quietHoursTimeZoneError, setQuietHoursTimeZoneError] = useState<
        string | null
    >(null);
    const [digestEnabled, setDigestEnabled] = useState(false);
    const [digestFrequency, setDigestFrequency] =
        useState<DigestPeriod>('daily');
    const markAllNotificationsRead = useMarkAllNotificationsRead();
    const { track } = useGameAnalytics();
    const pushOnboarding = usePushPermissionOnboarding();
    const queryClient = useQueryClient();

    useEffect(() => {
        setNotificationsFilter(initialFilter);
    }, [initialFilter]);

    useEffect(() => {
        setActiveView(initialView);
    }, [initialView]);

    const preferencesQuery = useNotificationPreferences();

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

    const savePreferencesMutation = useSaveNotificationPreferences();

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

    const sendTestMutation = useMutation({
        mutationFn: async () => {
            const response =
                await clientAuthenticated().api.notifications.test.$post();
            if (!response.ok) throw new Error('Probna obavijest nije poslana');
            return response.json();
        },
    });

    useEffect(() => {
        if (!preferencesQuery.data?.length) {
            return;
        }

        const quietHoursPreference = preferencesQuery.data.find(
            (preference) =>
                globalPreferencePolicies.some(
                    (item) =>
                        item.quietHoursEligible &&
                        item.category === preference.category &&
                        item.channel === preference.channel,
                ) &&
                preference.quietHoursStartMinute !== null &&
                preference.quietHoursEndMinute !== null &&
                typeof preference.timezone === 'string' &&
                preference.timezone.length > 0,
        );
        if (
            typeof quietHoursPreference?.quietHoursStartMinute === 'number' &&
            typeof quietHoursPreference.quietHoursEndMinute === 'number' &&
            typeof quietHoursPreference.timezone === 'string'
        ) {
            setQuietHoursEnabled(true);
            setQuietHoursStartMinute(
                quietHoursPreference.quietHoursStartMinute,
            );
            setQuietHoursEndMinute(quietHoursPreference.quietHoursEndMinute);
            setQuietHoursTimeZone(quietHoursPreference.timezone);
            setQuietHoursTimeZoneError(null);
        } else {
            setQuietHoursEnabled(false);
            setQuietHoursTimeZone(null);
        }

        const digestPreference = preferencesQuery.data.find(
            (preference) =>
                categoryPreferences.some(
                    (item) =>
                        item.digestEligible &&
                        item.category === preference.category &&
                        item.channel === preference.channel,
                ) &&
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

    function findPreference(item: NotificationPreferencePolicy) {
        return preferencesQuery.data?.find(
            (preference) =>
                preference.category === item.category &&
                preference.channel === item.channel &&
                preference.scope === 'global',
        );
    }

    function buildPreferenceUpdate(
        item: NotificationPreferencePolicy,
        enabled: boolean,
        options: {
            quietEnabled?: boolean;
            quietStart?: number;
            quietEnd?: number;
            quietTimeZone?: string;
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
            quietHoursStartMinute:
                item.quietHoursEligible && nextQuietEnabled
                    ? (options.quietStart ?? quietHoursStartMinute)
                    : null,
            quietHoursEndMinute:
                item.quietHoursEligible && nextQuietEnabled
                    ? (options.quietEnd ?? quietHoursEndMinute)
                    : null,
            timezone:
                item.quietHoursEligible && nextQuietEnabled
                    ? (options.quietTimeZone ?? quietHoursTimeZone)
                    : null,
            digestFrequency:
                item.digestEligible && nextSummaryEnabled
                    ? (options.summaryFrequency ?? digestFrequency)
                    : 'off',
        };
    }

    function saveAllPreferenceSettings(
        options: Parameters<typeof buildPreferenceUpdate>[2] = {},
    ) {
        const nextQuietEnabled = options.quietEnabled ?? quietHoursEnabled;
        const nextQuietTimeZone = nextQuietEnabled
            ? (options.quietTimeZone ??
              quietHoursTimeZone ??
              readCurrentTimeZone())
            : null;
        if (nextQuietEnabled && !nextQuietTimeZone) {
            setQuietHoursTimeZoneError(quietHoursTimeZoneUnavailableMessage);
            return false;
        }

        setQuietHoursTimeZoneError(null);
        setQuietHoursTimeZone(nextQuietTimeZone);
        savePreferencesMutation.mutate(
            globalPreferencePolicies.map((item) =>
                buildPreferenceUpdate(
                    item,
                    findPreference(item)?.enabled ?? item.defaultEnabled,
                    {
                        ...options,
                        quietTimeZone: nextQuietTimeZone ?? undefined,
                    },
                ),
            ),
        );
        return true;
    }

    const handleEnablePush = async () => {
        track('game_push_enable_clicked', {
            source: 'overview_notifications_tab',
            status: pushOnboarding.status,
        });
        const result = await pushOnboarding.requestPermission();
        if (result === 'subscribed') {
            queryClient.invalidateQueries({ queryKey: notificationDevicesKey });
            queryClient.invalidateQueries({
                queryKey: notificationPushStatusKey,
            });
        }
        track('game_push_permission_result', {
            source: 'overview_notifications_tab',
            result,
        });
    };

    const handleMarkAllNotificationsRead = () => {
        track('game_notifications_mark_all_read', { source: 'overview_tab' });
        markAllNotificationsRead.mutate({ readWhere: 'game' });
    };

    const settingsBusy =
        savePreferencesMutation.isPending ||
        preferencesQuery.isPending ||
        preferencesQuery.isError;
    const deviceMutationBusy = updateDeviceMutation.isPending;
    const testNotificationResult = sendTestMutation.data;
    const currentPushDeviceId = readCurrentPushDeviceId();
    const currentNotificationDevice = currentPushDeviceId
        ? devicesQuery.data?.find(
              (device) => device.deviceId === currentPushDeviceId,
          )
        : undefined;
    const currentDeviceNotificationsEnabled =
        Boolean(currentNotificationDevice?.enabled) &&
        currentNotificationDevice?.permissionState !== 'denied';
    const currentDeviceStatusLabel = devicesQuery.isPending
        ? 'Učitavanje'
        : currentDeviceNotificationsEnabled
          ? 'Uključeno'
          : 'Isključeno';
    const canRequestPush =
        pushOnboarding.status !== 'denied' &&
        pushOnboarding.status !== 'unsupported' &&
        pushOnboarding.status !== 'unconfigured';
    const currentDeviceToggleDisabled =
        pushStatusQuery.isPending ||
        devicesQuery.isPending ||
        devicesQuery.isError ||
        pushStatusQuery.isError ||
        deviceMutationBusy ||
        (!currentNotificationDevice && !canRequestPush);

    function handleCurrentDeviceToggle() {
        if (currentNotificationDevice) {
            updateDeviceMutation.mutate({
                id: currentNotificationDevice.id,
                payload: { enabled: !currentDeviceNotificationsEnabled },
            });
            return;
        }

        void handleEnablePush();
    }

    return (
        <Stack spacing={4}>
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
                <TabsList className="w-fit self-center border">
                    <TabsTrigger value="notifications">Obavijesti</TabsTrigger>
                    <TabsTrigger value="settings">Postavke</TabsTrigger>
                </TabsList>
                <TabsContent value="notifications" className="mt-3">
                    <Stack spacing={2}>
                        <Typography level="body1" semiBold>
                            Popis obavijesti
                        </Typography>
                        <Card className="bg-card p-1">
                            <Row justifyContent="space-between">
                                <SelectItems
                                    value={notificationsFilter}
                                    onValueChange={(value) => {
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
                        <div className="overflow-y-auto max-h-[calc(100dvh-18rem)] md:max-h-[calc(100dvh-24rem)] rounded-lg text-card-foreground bg-card shadow-xs p-0">
                            <NotificationList
                                read={notificationsFilter === 'all'}
                            />
                        </div>
                    </Stack>
                </TabsContent>
                <TabsContent value="settings" className="mt-3 min-h-0">
                    <Stack spacing={2}>
                        <WhatsNewNotificationToggle />
                        <Card className="bg-card p-2">
                            <Stack spacing={1.5}>
                                <Row
                                    alignItems="center"
                                    className="gap-4"
                                    justifyContent="space-between"
                                >
                                    <Stack
                                        spacing={0.5}
                                        className="min-w-0 flex-1"
                                    >
                                        <Typography level="body1" semiBold>
                                            Obavijesti na ovom uređaju
                                        </Typography>
                                        <Typography level="body3" secondary>
                                            {currentDeviceStatusLabel}
                                        </Typography>
                                    </Stack>
                                    <Switch
                                        aria-label={
                                            currentDeviceNotificationsEnabled
                                                ? 'Isključi obavijesti na ovom uređaju'
                                                : 'Uključi obavijesti na ovom uređaju'
                                        }
                                        checked={
                                            currentDeviceNotificationsEnabled
                                        }
                                        disabled={currentDeviceToggleDisabled}
                                        onCheckedChange={
                                            handleCurrentDeviceToggle
                                        }
                                    />
                                </Row>
                                {pushStatusQuery.isError && (
                                    <Typography level="body3" secondary>
                                        Status obavijesti nije učitan.
                                    </Typography>
                                )}
                                {pushOnboarding.status === 'denied' && (
                                    <Typography level="body3" secondary>
                                        Obavijesti su blokirane u pregledniku.
                                        Otvori postavke preglednika i omogući
                                        obavijesti za ovu stranicu.
                                    </Typography>
                                )}
                            </Stack>
                        </Card>

                        {premiumNotificationControlsEnabled ? (
                            <>
                                <Card className="bg-card p-2">
                                    <Stack spacing={2}>
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
                                        <Stack spacing={0.5}>
                                            {requiredNotificationGroups.map(
                                                (item) => (
                                                    <Row
                                                        key={item.category}
                                                        justifyContent="space-between"
                                                        alignItems="start"
                                                        spacing={4}
                                                        className="py-2"
                                                    >
                                                        <Stack
                                                            spacing={0.5}
                                                            className="min-w-0 flex-1"
                                                        >
                                                            <Typography
                                                                semiBold
                                                            >
                                                                {item.label}
                                                            </Typography>
                                                            <Typography
                                                                level="body3"
                                                                secondary
                                                            >
                                                                {
                                                                    item.description
                                                                }
                                                            </Typography>
                                                        </Stack>
                                                        <Stack
                                                            spacing={0.5}
                                                            alignItems="center"
                                                            className="shrink-0"
                                                        >
                                                            <Switch
                                                                aria-label={`Obavezna obavijest ${item.label.toLowerCase()}`}
                                                                checked
                                                                readOnly
                                                            />
                                                            <Typography
                                                                level="body3"
                                                                secondary
                                                            >
                                                                Obavezno
                                                            </Typography>
                                                        </Stack>
                                                    </Row>
                                                ),
                                            )}
                                            {preferencesQuery.isPending ? (
                                                <Typography
                                                    level="body2"
                                                    secondary
                                                >
                                                    Postavke se učitavaju.
                                                </Typography>
                                            ) : preferencesQuery.isError ? (
                                                <Typography
                                                    level="body2"
                                                    secondary
                                                >
                                                    Postavke obavijesti nisu
                                                    učitane.
                                                </Typography>
                                            ) : (
                                                categoryPreferences.map(
                                                    (item) => {
                                                        const preference =
                                                            findPreference(
                                                                item,
                                                            );
                                                        const checked =
                                                            preference?.enabled ??
                                                            item.defaultEnabled;
                                                        return (
                                                            <Row
                                                                key={
                                                                    item.category
                                                                }
                                                                justifyContent="space-between"
                                                                alignItems="start"
                                                                spacing={4}
                                                                className="py-2"
                                                            >
                                                                <Stack
                                                                    spacing={
                                                                        0.5
                                                                    }
                                                                    className="min-w-0 flex-1"
                                                                >
                                                                    <Typography
                                                                        semiBold
                                                                    >
                                                                        {
                                                                            item.label
                                                                        }
                                                                    </Typography>
                                                                    <Typography
                                                                        level="body3"
                                                                        secondary
                                                                    >
                                                                        {
                                                                            item.description
                                                                        }
                                                                    </Typography>
                                                                </Stack>
                                                                <Switch
                                                                    aria-label={`${
                                                                        checked
                                                                            ? 'Isključi'
                                                                            : 'Uključi'
                                                                    } ${item.label.toLowerCase()}`}
                                                                    checked={
                                                                        checked
                                                                    }
                                                                    disabled={
                                                                        settingsBusy
                                                                    }
                                                                    onCheckedChange={(
                                                                        checked,
                                                                    ) =>
                                                                        savePreferencesMutation.mutate(
                                                                            [
                                                                                buildPreferenceUpdate(
                                                                                    item,
                                                                                    checked,
                                                                                ),
                                                                            ],
                                                                        )
                                                                    }
                                                                />
                                                            </Row>
                                                        );
                                                    },
                                                )
                                            )}
                                        </Stack>
                                        {savePreferencesMutation.isError && (
                                            <Typography level="body3" secondary>
                                                Postavke obavijesti nisu
                                                spremljene.
                                            </Typography>
                                        )}
                                    </Stack>
                                </Card>

                                <Card className="bg-card p-2">
                                    <Stack spacing={2}>
                                        <Row
                                            justifyContent="space-between"
                                            alignItems="start"
                                            spacing={4}
                                        >
                                            <Stack
                                                spacing={0.5}
                                                className="min-w-0 flex-1"
                                            >
                                                <Typography semiBold>
                                                    Ne ometaj
                                                </Typography>
                                                {quietHoursEnabled ? (
                                                    <Typography
                                                        level="body3"
                                                        secondary
                                                    >
                                                        Vrijedi samo za
                                                        prilagodljive obavijesti
                                                        koje podržavaju tihi
                                                        period.
                                                    </Typography>
                                                ) : null}
                                            </Stack>
                                            <Switch
                                                aria-label={
                                                    quietHoursEnabled
                                                        ? 'Isključi ne ometaj'
                                                        : 'Uključi ne ometaj'
                                                }
                                                checked={quietHoursEnabled}
                                                disabled={settingsBusy}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        const timeZone =
                                                            readCurrentTimeZone();
                                                        if (!timeZone) {
                                                            setQuietHoursTimeZoneError(
                                                                quietHoursTimeZoneUnavailableMessage,
                                                            );
                                                            return;
                                                        }
                                                        setQuietHoursEnabled(
                                                            true,
                                                        );
                                                        saveAllPreferenceSettings(
                                                            {
                                                                quietEnabled: true,
                                                                quietTimeZone:
                                                                    timeZone,
                                                            },
                                                        );
                                                        return;
                                                    }

                                                    setQuietHoursEnabled(false);
                                                    setQuietHoursTimeZone(null);
                                                    saveAllPreferenceSettings({
                                                        quietEnabled: false,
                                                    });
                                                }}
                                            />
                                        </Row>
                                        {quietHoursTimeZoneError && (
                                            <div role="alert">
                                                <Typography
                                                    level="body3"
                                                    secondary
                                                >
                                                    {quietHoursTimeZoneError}
                                                </Typography>
                                            </div>
                                        )}
                                        {quietHoursEnabled && (
                                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                                <Input
                                                    label="Od"
                                                    type="time"
                                                    value={minuteToTimeValue(
                                                        quietHoursStartMinute,
                                                    )}
                                                    disabled={settingsBusy}
                                                    onChange={(event) => {
                                                        const minute =
                                                            timeValueToMinute(
                                                                event.target
                                                                    .value,
                                                            );
                                                        if (minute === null) {
                                                            return;
                                                        }
                                                        setQuietHoursStartMinute(
                                                            minute,
                                                        );
                                                        saveAllPreferenceSettings(
                                                            {
                                                                quietStart:
                                                                    minute,
                                                            },
                                                        );
                                                    }}
                                                />
                                                <Input
                                                    label="Do"
                                                    type="time"
                                                    value={minuteToTimeValue(
                                                        quietHoursEndMinute,
                                                    )}
                                                    disabled={settingsBusy}
                                                    onChange={(event) => {
                                                        const minute =
                                                            timeValueToMinute(
                                                                event.target
                                                                    .value,
                                                            );
                                                        if (minute === null) {
                                                            return;
                                                        }
                                                        setQuietHoursEndMinute(
                                                            minute,
                                                        );
                                                        saveAllPreferenceSettings(
                                                            {
                                                                quietEnd:
                                                                    minute,
                                                            },
                                                        );
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </Stack>
                                </Card>

                                <Card className="bg-card p-2">
                                    <Stack spacing={2}>
                                        <Row
                                            justifyContent="space-between"
                                            alignItems="start"
                                            spacing={4}
                                        >
                                            <Stack
                                                spacing={0.5}
                                                className="min-w-0 flex-1"
                                            >
                                                <Typography semiBold>
                                                    Primaj sažetak obavijesti
                                                </Typography>
                                                <Typography
                                                    level="body3"
                                                    secondary
                                                >
                                                    Sažetak vrijedi za
                                                    prilagodljive kategorije;
                                                    obavezne poruke ne čekaju
                                                    sažetak.
                                                </Typography>
                                            </Stack>
                                            <Switch
                                                aria-label={
                                                    digestEnabled
                                                        ? 'Isključi primanje sažetka obavijesti'
                                                        : 'Uključi primanje sažetka obavijesti'
                                                }
                                                checked={digestEnabled}
                                                disabled={settingsBusy}
                                                onCheckedChange={(checked) => {
                                                    setDigestEnabled(checked);
                                                    saveAllPreferenceSettings({
                                                        summaryEnabled: checked,
                                                    });
                                                }}
                                            />
                                        </Row>
                                        {digestEnabled && (
                                            <Stack spacing={1}>
                                                <Typography
                                                    level="body2"
                                                    semiBold
                                                >
                                                    Razdoblje sažetka
                                                </Typography>
                                                <SelectItems
                                                    value={digestFrequency}
                                                    onValueChange={(value) => {
                                                        if (
                                                            !isDigestPeriod(
                                                                value,
                                                            )
                                                        ) {
                                                            return;
                                                        }
                                                        setDigestFrequency(
                                                            value,
                                                        );
                                                        saveAllPreferenceSettings(
                                                            {
                                                                summaryFrequency:
                                                                    value,
                                                            },
                                                        );
                                                    }}
                                                    items={digestFrequencyItems}
                                                />
                                            </Stack>
                                        )}
                                    </Stack>
                                </Card>
                            </>
                        ) : (
                            <Card className="bg-card p-2">
                                <Typography level="body2" secondary>
                                    Napredne postavke obavijesti trenutno nisu
                                    dostupne.
                                </Typography>
                            </Card>
                        )}

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
                                    disabled={sendTestMutation.isPending}
                                    onClick={() => sendTestMutation.mutate()}
                                    startDecorator={
                                        <Megaphone className="size-4" />
                                    }
                                >
                                    Pošalji probnu obavijest
                                </Button>
                            </Row>
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
                                    Neuspjelo:{' '}
                                    {testNotificationResult?.failed ?? 0}
                                </Typography>
                            )}
                            <Stack spacing={2} className="pt-2">
                                {devicesQuery.isPending ? (
                                    <Typography level="body2" secondary>
                                        Uređaji se učitavaju.
                                    </Typography>
                                ) : devicesQuery.isError ? (
                                    <Typography level="body2" secondary>
                                        Uređaji za obavijesti nisu učitani.
                                    </Typography>
                                ) : devicesQuery.data?.length ? (
                                    devicesQuery.data.map((device) => {
                                        const label = deviceDisplayName(device);

                                        return (
                                            <div
                                                key={device.id}
                                                className="flex items-center gap-3 rounded border border-border/60 p-2"
                                            >
                                                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                                    {deviceIcon(device)}
                                                </div>
                                                <Stack
                                                    spacing={0.5}
                                                    className="min-w-0 flex-1"
                                                >
                                                    <Typography semiBold>
                                                        {label}
                                                    </Typography>
                                                    <Typography
                                                        level="body3"
                                                        secondary
                                                    >
                                                        {device.enabled
                                                            ? 'Uključeno'
                                                            : 'Isključeno'}
                                                    </Typography>
                                                </Stack>
                                                <Switch
                                                    aria-label={`${
                                                        device.enabled
                                                            ? 'Isključi'
                                                            : 'Uključi'
                                                    } ${label}`}
                                                    checked={device.enabled}
                                                    disabled={
                                                        deviceMutationBusy
                                                    }
                                                    onCheckedChange={() =>
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
                                                />
                                            </div>
                                        );
                                    })
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
