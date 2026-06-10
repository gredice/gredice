import { clientAuthenticated } from '@gredice/client';
import { Button } from '@gredice/ui/Button';
import { Card } from '@gredice/ui/Card';
import { Checkbox } from '@gredice/ui/Checkbox';
import { Input } from '@gredice/ui/Input';
import { Approved, Close, Empty, Megaphone } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Stack } from '@gredice/ui/Stack';
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

type NotificationPreferenceItem = {
    category: string;
    channel: NotificationPreferenceUpdate['channel'];
    defaultEnabled: boolean;
    description: string;
    digestEligible: boolean;
    label: string;
    quietHoursEligible: boolean;
};

const notificationDevicesKey = ['notifications', 'devices'];
const notificationPushStatusKey = ['notifications', 'push-status'];
const defaultQuietHoursStartMinute = 22 * 60;
const defaultQuietHoursEndMinute = 7 * 60;

function readBooleanFlag(value: string | undefined, defaultValue: boolean) {
    const normalizedValue = value?.trim().toLowerCase();
    if (!normalizedValue) {
        return defaultValue;
    }
    return ['1', 'true', 'yes', 'on', 'enabled'].includes(normalizedValue);
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

    useEffect(() => {
        if (!preferencesQuery.data?.length) {
            return;
        }

        const quietHoursPreference = preferencesQuery.data.find(
            (preference) =>
                categoryPreferences.some(
                    (item) =>
                        item.quietHoursEligible &&
                        item.category === preference.category &&
                        item.channel === preference.channel,
                ) &&
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
            quietHoursStartMinute:
                item.quietHoursEligible && nextQuietEnabled
                    ? (options.quietStart ?? quietHoursStartMinute)
                    : null,
            quietHoursEndMinute:
                item.quietHoursEligible && nextQuietEnabled
                    ? (options.quietEnd ?? quietHoursEndMinute)
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
        savePreferencesMutation.mutate(
            categoryPreferences.map((item) =>
                buildPreferenceUpdate(
                    item,
                    findPreference(item)?.enabled ?? item.defaultEnabled,
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

    const notificationsSupported =
        typeof window !== 'undefined' && 'Notification' in window;
    const settingsBusy =
        savePreferencesMutation.isPending ||
        preferencesQuery.isPending ||
        preferencesQuery.isError;
    const deviceMutationBusy =
        updateDeviceMutation.isPending || revokeDeviceMutation.isPending;
    const testNotificationResult = sendTestMutation.data;

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
                <TabsContent value="settings" className="mt-3">
                    <Stack spacing={2}>
                        <WhatsNewNotificationToggle />
                        <Card className="bg-card p-2">
                            <Stack spacing={2}>
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
                                {pushOnboarding.canPrompt &&
                                    pushStatusQuery.data?.status !==
                                        'subscribed' && (
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

                        {premiumNotificationControlsEnabled ? (
                            <>
                                <Card className="bg-card p-2">
                                    <Stack spacing={2}>
                                        <Typography level="body1" semiBold>
                                            Uvijek uključeno
                                        </Typography>
                                        <Typography level="body2" secondary>
                                            Sigurnosne, pravne i naplatne
                                            obavijesti ne koriste sažetak ni
                                            tihi period.
                                        </Typography>
                                        {requiredNotificationGroups.map(
                                            (item) => (
                                                <div
                                                    key={item.category}
                                                    className="rounded border border-border/60 p-2"
                                                >
                                                    <Row
                                                        justifyContent="space-between"
                                                        alignItems="start"
                                                        spacing={4}
                                                    >
                                                        <Stack spacing={0.5}>
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
                                                        <Typography
                                                            level="body3"
                                                            semiBold
                                                            className="shrink-0"
                                                        >
                                                            Uvijek uključeno
                                                        </Typography>
                                                    </Row>
                                                </div>
                                            ),
                                        )}
                                    </Stack>
                                </Card>

                                <Card className="bg-card p-2">
                                    <Stack spacing={2}>
                                        <Row justifyContent="space-between">
                                            <Typography level="body1" semiBold>
                                                Vrste koje možeš prilagoditi
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
                                        {preferencesQuery.isPending ? (
                                            <Typography level="body2" secondary>
                                                Postavke se učitavaju.
                                            </Typography>
                                        ) : preferencesQuery.isError ? (
                                            <Typography level="body2" secondary>
                                                Postavke obavijesti nisu
                                                učitane.
                                            </Typography>
                                        ) : (
                                            categoryPreferences.map((item) => {
                                                const preference =
                                                    findPreference(item);
                                                const checked =
                                                    preference?.enabled ??
                                                    item.defaultEnabled;
                                                return (
                                                    <div
                                                        key={item.category}
                                                        className="rounded border border-border/60 p-2"
                                                    >
                                                        <Row
                                                            justifyContent="space-between"
                                                            alignItems="start"
                                                            spacing={4}
                                                        >
                                                            <Stack
                                                                spacing={0.5}
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
                                                            <Checkbox
                                                                aria-label={`Uključi ${item.label.toLowerCase()}`}
                                                                checked={
                                                                    checked
                                                                }
                                                                disabled={
                                                                    settingsBusy
                                                                }
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
                                                    </div>
                                                );
                                            })
                                        )}
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
                                        <Checkbox
                                            label="Ne ometaj"
                                            checked={quietHoursEnabled}
                                            disabled={settingsBusy}
                                            onCheckedChange={(
                                                checked: boolean,
                                            ) => {
                                                const enabled =
                                                    Boolean(checked);
                                                setQuietHoursEnabled(enabled);
                                                saveAllPreferenceSettings({
                                                    quietEnabled: enabled,
                                                });
                                            }}
                                        />
                                        <Typography level="body3" secondary>
                                            Vrijedi samo za prilagodljive
                                            obavijesti koje podržavaju tihi
                                            period.
                                        </Typography>
                                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                            <Input
                                                label="Od"
                                                type="time"
                                                value={minuteToTimeValue(
                                                    quietHoursStartMinute,
                                                )}
                                                disabled={
                                                    !quietHoursEnabled ||
                                                    settingsBusy
                                                }
                                                onChange={(event) => {
                                                    const minute =
                                                        timeValueToMinute(
                                                            event.target.value,
                                                        );
                                                    if (minute === null) {
                                                        return;
                                                    }
                                                    setQuietHoursStartMinute(
                                                        minute,
                                                    );
                                                    if (quietHoursEnabled) {
                                                        saveAllPreferenceSettings(
                                                            {
                                                                quietStart:
                                                                    minute,
                                                            },
                                                        );
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
                                                    !quietHoursEnabled ||
                                                    settingsBusy
                                                }
                                                onChange={(event) => {
                                                    const minute =
                                                        timeValueToMinute(
                                                            event.target.value,
                                                        );
                                                    if (minute === null) {
                                                        return;
                                                    }
                                                    setQuietHoursEndMinute(
                                                        minute,
                                                    );
                                                    if (quietHoursEnabled) {
                                                        saveAllPreferenceSettings(
                                                            {
                                                                quietEnd:
                                                                    minute,
                                                            },
                                                        );
                                                    }
                                                }}
                                            />
                                        </div>
                                    </Stack>
                                </Card>

                                <Card className="bg-card p-2">
                                    <Stack spacing={2}>
                                        <Checkbox
                                            label="Primaj sažetak obavijesti"
                                            checked={digestEnabled}
                                            disabled={settingsBusy}
                                            onCheckedChange={(
                                                checked: boolean,
                                            ) => {
                                                const enabled =
                                                    Boolean(checked);
                                                setDigestEnabled(enabled);
                                                saveAllPreferenceSettings({
                                                    summaryEnabled: enabled,
                                                });
                                            }}
                                        />
                                        <Typography level="body3" secondary>
                                            Sažetak vrijedi za prilagodljive
                                            kategorije; obavezne poruke ne
                                            čekaju sažetak.
                                        </Typography>
                                        <Stack spacing={1}>
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
                                                        if (digestEnabled) {
                                                            saveAllPreferenceSettings(
                                                                {
                                                                    summaryFrequency:
                                                                        value,
                                                                },
                                                            );
                                                        }
                                                    }}
                                                    items={digestFrequencyItems}
                                                />
                                            </div>
                                        </Stack>
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
                                    devicesQuery.data.map((device) => (
                                        <Card
                                            key={device.id}
                                            className="p-1 bg-muted/20"
                                        >
                                            <Stack spacing={1}>
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
