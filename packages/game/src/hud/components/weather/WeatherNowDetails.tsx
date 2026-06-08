import { Accordion } from '@gredice/ui/Accordion';
import { Button } from '@gredice/ui/Button';
import { Divider } from '@gredice/ui/Divider';
import {
    ArrowDown,
    ArrowDownLeft,
    ArrowDownRight,
    ArrowLeft,
    ArrowRight,
    ArrowUp,
    ArrowUpLeft,
    ArrowUpRight,
    Empty,
    Navigate,
    Snowflake,
    Warning,
    Wind,
} from '@gredice/ui/icons';
import { Link } from '@gredice/ui/Link';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import { type FC, useEffect, useMemo, useState } from 'react';
import {
    pushNotificationPreferenceUpdate,
    useNotificationPreferences,
    useSaveNotificationPreferences,
} from '../../../hooks/useNotificationPreferences';
import { usePushPermissionOnboarding } from '../../../hooks/usePushPermissionOnboarding';
import { useWeatherNow } from '../../../hooks/useWeatherNow';
import { notificationsViewSearchParam } from '../../../notificationFilters';
import { RainIcon } from './icons/RainIcon';
import { WeatherForecastDays } from './WeatherForecastDetails';
import { WeatherHistoryPanel } from './WeatherHistoryModal';
import { weatherIcons } from './WeatherIcons';
import {
    type WeatherPopoverView,
    WeatherViewToggle,
} from './WeatherViewToggle';

const weatherAlertPromptChoiceKey = 'game:weather-alerts:prompt-choice';

function readWeatherAlertPromptChoice(): boolean | null {
    if (typeof window === 'undefined') return null;
    const value = window.localStorage.getItem(weatherAlertPromptChoiceKey);
    if (value === 'enabled') return true;
    if (value === 'disabled') return false;
    return null;
}

function writeWeatherAlertPromptChoice(enabled: boolean) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
        weatherAlertPromptChoiceKey,
        enabled ? 'enabled' : 'disabled',
    );
}

export const windDirectionIcons: Record<string, FC> = {
    N: ArrowUp,
    NE: ArrowUpRight,
    E: ArrowRight,
    SE: ArrowDownRight,
    S: ArrowDown,
    SW: ArrowDownLeft,
    W: ArrowLeft,
    NW: ArrowUpLeft,
};

function formatAlertDateTime(value: string) {
    return new Date(value).toLocaleString('hr-HR', {
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        month: '2-digit',
    });
}

function alertLevelLabel(alert: {
    awarenessLevel?: { color?: string | null; label?: string | null } | null;
    severity?: string | null;
}) {
    const color = alert.awarenessLevel?.color;
    if (color === 'yellow') return 'Žuto upozorenje';
    if (color === 'orange') return 'Narančasto upozorenje';
    if (color === 'red') return 'Crveno upozorenje';
    return alert.awarenessLevel?.label ?? alert.severity ?? 'Upozorenje';
}

type WeatherAlert = {
    id: string;
    event: string;
    description: string;
    instruction?: string | null;
    onset: string;
    expires: string;
    severity?: string | null;
    awarenessLevel?: {
        id?: string | null;
        color?: string | null;
        label?: string | null;
    } | null;
    awarenessType?: {
        id?: string | null;
        label?: string | null;
    } | null;
    area?: {
        regionCode?: string | null;
    } | null;
};

type WeatherAlertGroup = {
    key: string;
    alerts: WeatherAlert[];
    event: string;
    firstOnset: string;
    lastExpires: string;
    proximityMs: number;
};

function parseAlertTime(value: string) {
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
}

function weatherAlertGroupKey(alert: WeatherAlert) {
    return [
        alert.area?.regionCode ?? 'unknown-region',
        alert.awarenessType?.id ?? alert.event,
        alert.awarenessLevel?.id ?? alert.severity ?? 'unknown-level',
        alert.event,
    ].join(':');
}

function alertProximityMs(alert: WeatherAlert, nowMs: number) {
    const onsetMs = parseAlertTime(alert.onset);
    const expiresMs = parseAlertTime(alert.expires);
    if (onsetMs === null || expiresMs === null) {
        return Number.POSITIVE_INFINITY;
    }
    if (onsetMs <= nowMs && expiresMs >= nowMs) return 0;
    if (onsetMs > nowMs) return onsetMs - nowMs;
    return nowMs - expiresMs;
}

function periodCountLabel(count: number) {
    if (count === 1) return '1 razdoblje';
    if (count > 1 && count < 5) return `${count} razdoblja`;
    return `${count} razdoblja`;
}

function groupWeatherAlerts(alerts: WeatherAlert[], nowMs: number) {
    const groupsByKey = new Map<string, WeatherAlertGroup>();

    for (const alert of alerts) {
        const key = weatherAlertGroupKey(alert);
        const proximityMs = alertProximityMs(alert, nowMs);
        const existingGroup = groupsByKey.get(key);

        if (!existingGroup) {
            groupsByKey.set(key, {
                key,
                alerts: [alert],
                event: alert.event,
                firstOnset: alert.onset,
                lastExpires: alert.expires,
                proximityMs,
            });
            continue;
        }

        existingGroup.alerts.push(alert);
        if (
            (parseAlertTime(alert.onset) ?? Number.POSITIVE_INFINITY) <
            (parseAlertTime(existingGroup.firstOnset) ??
                Number.POSITIVE_INFINITY)
        ) {
            existingGroup.firstOnset = alert.onset;
        }
        if (
            (parseAlertTime(alert.expires) ?? Number.NEGATIVE_INFINITY) >
            (parseAlertTime(existingGroup.lastExpires) ??
                Number.NEGATIVE_INFINITY)
        ) {
            existingGroup.lastExpires = alert.expires;
        }
        existingGroup.proximityMs = Math.min(
            existingGroup.proximityMs,
            proximityMs,
        );
    }

    return Array.from(groupsByKey.values())
        .map((group) => ({
            ...group,
            alerts: group.alerts.toSorted((left, right) => {
                const leftOnset = parseAlertTime(left.onset) ?? 0;
                const rightOnset = parseAlertTime(right.onset) ?? 0;
                if (leftOnset !== rightOnset) return leftOnset - rightOnset;
                return left.id.localeCompare(right.id);
            }),
        }))
        .toSorted((left, right) => {
            if (left.proximityMs !== right.proximityMs) {
                return left.proximityMs - right.proximityMs;
            }
            const leftOnset = parseAlertTime(left.firstOnset) ?? 0;
            const rightOnset = parseAlertTime(right.firstOnset) ?? 0;
            if (leftOnset !== rightOnset) return leftOnset - rightOnset;
            return left.key.localeCompare(right.key);
        });
}

function WeatherAlertGroups({ alerts }: { alerts: WeatherAlert[] }) {
    const alertGroups = useMemo(
        () => groupWeatherAlerts(alerts, Date.now()),
        [alerts],
    );
    const [expandedGroupKey, setExpandedGroupKey] = useState<
        string | null | undefined
    >(undefined);

    useEffect(() => {
        if (expandedGroupKey === undefined || expandedGroupKey === null) {
            return;
        }

        if (!alertGroups.some((group) => group.key === expandedGroupKey)) {
            setExpandedGroupKey(undefined);
        }
    }, [alertGroups, expandedGroupKey]);

    const defaultExpandedGroupKey = alertGroups[0]?.key ?? null;
    const activeGroupKey =
        expandedGroupKey === undefined
            ? defaultExpandedGroupKey
            : expandedGroupKey;

    if (alertGroups.length === 0) return null;

    return (
        <Stack
            className="col-span-full px-4 pb-4"
            data-weather-alert-groups="true"
            spacing={2}
        >
            {alertGroups.map((group) => {
                const firstAlert = group.alerts[0];
                const open = activeGroupKey === group.key;

                return (
                    <Accordion
                        className={cx(
                            'border-amber-300 bg-amber-100 text-amber-950 shadow-none dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100',
                            open && 'bg-amber-100 dark:bg-amber-950',
                        )}
                        key={group.key}
                        onOpenChanged={(_, nextOpen) =>
                            setExpandedGroupKey(nextOpen ? group.key : null)
                        }
                        open={open}
                        unmountOnExit
                    >
                        <Row alignItems="start" className="min-w-0" spacing={3}>
                            <Warning className="mt-0.5 size-4 shrink-0" />
                            <Stack className="min-w-0" spacing={1}>
                                <Typography className="min-w-0" semiBold>
                                    {group.event}
                                </Typography>
                                <Typography
                                    className="text-amber-900/75 dark:text-amber-100/80"
                                    level="body3"
                                >
                                    {firstAlert
                                        ? alertLevelLabel(firstAlert)
                                        : 'Upozorenje'}{' '}
                                    · {periodCountLabel(group.alerts.length)} ·{' '}
                                    {formatAlertDateTime(group.firstOnset)} -{' '}
                                    {formatAlertDateTime(group.lastExpires)}
                                </Typography>
                            </Stack>
                        </Row>
                        <Stack spacing={2}>
                            {group.alerts.map((alert) => (
                                <Stack
                                    className="border-amber-300/70 border-t pt-2 first:border-t-0 first:pt-0 dark:border-amber-800/80"
                                    key={alert.id}
                                    spacing={1}
                                >
                                    <Typography level="body3" semiBold>
                                        {formatAlertDateTime(alert.onset)} -{' '}
                                        {formatAlertDateTime(alert.expires)}
                                    </Typography>
                                    <Typography level="body3">
                                        {alert.description}
                                    </Typography>
                                    {alert.instruction && (
                                        <Typography
                                            className="text-amber-900/80 dark:text-amber-100/80"
                                            level="body3"
                                        >
                                            {alert.instruction}
                                        </Typography>
                                    )}
                                </Stack>
                            ))}
                        </Stack>
                    </Accordion>
                );
            })}
        </Stack>
    );
}

function useNotificationSettingsHref() {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    return useMemo(() => {
        const next = new URLSearchParams(
            Array.from(searchParams?.entries() ?? []),
        );
        next.set('pregled', 'obavijesti');
        next.set(notificationsViewSearchParam, 'settings');

        const query = next.toString();
        return `${pathname}${query ? `?${query}` : ''}`;
    }, [pathname, searchParams]);
}

function WeatherAlertPreferencePrompt() {
    const settingsHref = useNotificationSettingsHref();
    const pushOnboarding = usePushPermissionOnboarding();
    const preferencesQuery = useNotificationPreferences();
    const savePreferencesMutation = useSaveNotificationPreferences();
    const [localChoice, setLocalChoice] = useState<boolean | null>(null);
    const [storedChoice, setStoredChoice] = useState<
        boolean | null | undefined
    >(undefined);

    useEffect(() => {
        setStoredChoice(readWeatherAlertPromptChoice());
    }, []);

    const weatherAlertPreference = preferencesQuery.data?.find(
        (preference) =>
            preference.scope === 'global' &&
            preference.category === 'weather_alerts' &&
            preference.channel === 'push',
    );
    const weatherAlertsEnabled =
        weatherAlertPreference?.enabled === true || localChoice === true;
    const hasStoredWeatherAlertChoice =
        storedChoice !== undefined && storedChoice !== null;
    const hasWeatherAlertChoice =
        weatherAlertsEnabled ||
        localChoice !== null ||
        hasStoredWeatherAlertChoice;
    const busy =
        preferencesQuery.isPending || savePreferencesMutation.isPending;

    const saveWeatherAlertPreference = async (enabled: boolean) => {
        if (enabled && pushOnboarding.canPrompt) {
            await pushOnboarding.requestPermission().catch(() => undefined);
        }
        await savePreferencesMutation.mutateAsync([
            pushNotificationPreferenceUpdate({
                category: 'weather_alerts',
                enabled,
            }),
        ]);
        writeWeatherAlertPromptChoice(enabled);
        setStoredChoice(enabled);
        setLocalChoice(enabled);
    };

    if (preferencesQuery.isError) {
        return null;
    }

    if (weatherAlertsEnabled) {
        return (
            <Typography
                level="body3"
                secondary
                className="col-span-full px-4 pb-3 text-xs"
            >
                Vremenska upozorenja su uključena.{' '}
                <Link href={settingsHref} className="underline">
                    Postavke
                </Link>
            </Typography>
        );
    }

    if (
        hasWeatherAlertChoice ||
        preferencesQuery.isPending ||
        storedChoice === undefined
    ) {
        return null;
    }

    return (
        <Stack className="col-span-full px-4 pb-4" spacing={1}>
            <div className="rounded border border-border/60 bg-muted/20 p-3">
                <Stack spacing={2}>
                    <Stack spacing={0.5}>
                        <Typography level="body2" semiBold>
                            Primati vremenska upozorenja?
                        </Typography>
                        <Typography level="body3" secondary>
                            Samo žuta, narančasta i crvena upozorenja za regiju
                            vrta.
                        </Typography>
                    </Stack>
                    <Row justifyContent="end" spacing={2} className="flex-wrap">
                        <Button
                            size="sm"
                            variant="plain"
                            disabled={busy}
                            onClick={() =>
                                void saveWeatherAlertPreference(false).catch(
                                    () => undefined,
                                )
                            }
                        >
                            Ne uključuj
                        </Button>
                        <Button
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                                void saveWeatherAlertPreference(true).catch(
                                    () => undefined,
                                )
                            }
                        >
                            Uključi
                        </Button>
                    </Row>
                    {savePreferencesMutation.isError && (
                        <Typography level="body3" secondary>
                            Postavke obavijesti nisu spremljene.
                        </Typography>
                    )}
                </Stack>
            </div>
        </Stack>
    );
}

export function WeatherNowDetails({ farmId }: { farmId?: number | null } = {}) {
    const { data } = useWeatherNow(true, farmId);
    // TODO: Add loading indicator
    // TODO: Add error message

    const [showForecast, setShowForecast] = useState(false);
    const [view, setView] = useState<WeatherPopoverView>('weather');
    if (!data) return null;

    const WeatherIcon = data.symbol != null ? weatherIcons[data.symbol] : null;
    const WindIcon = data.windDirection
        ? windDirectionIcons[data.windDirection]
        : Empty;
    const title =
        view === 'graph'
            ? 'Vremenske prilike'
            : showForecast
              ? 'Prognoza'
              : 'Aktualno vrijeme';

    // Chance of rain is a number between 0 and 1,
    // chance is 100 when there is 10 or more mm of rain
    const rainChance = data.rain > 10 ? 1 : 10 / data.rain;
    const alerts = data.alerts ?? [];

    return (
        <Stack
            className={cx(
                'max-h-[min(calc(100vh-6rem),44rem)] min-h-0 overflow-hidden',
                view === 'graph'
                    ? 'w-[min(calc(100vw-1rem),44rem)]'
                    : 'w-[min(calc(100vw-1rem),26rem)]',
            )}
            data-weather-now-details="true"
        >
            <Row
                className="shrink-0 bg-background px-4 py-2"
                justifyContent="space-between"
            >
                <Typography level="body2" bold>
                    {title}
                </Typography>
                <WeatherViewToggle value={view} onValueChange={setView} />
            </Row>
            <Divider />
            <div
                className="min-h-0 overflow-y-auto overscroll-contain"
                data-weather-now-scroll="true"
            >
                {view === 'graph' && <WeatherHistoryPanel className="p-3" />}
                {view === 'weather' && showForecast && (
                    <WeatherForecastDays limit={3} />
                )}
                {view === 'weather' && !showForecast && (
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                        <Row spacing={2} className="p-4">
                            <div className="my-1 mr-2">
                                {WeatherIcon && (
                                    <WeatherIcon.day className="size-12" />
                                )}
                            </div>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <Stack>
                                    <Typography level="body3">
                                        Temperatura (prognoza)
                                    </Typography>
                                    <Typography semiBold>
                                        {data.temperature ?? '—'}°C
                                    </Typography>
                                </Stack>
                                {data.measuredTemperature && (
                                    <Stack>
                                        <Typography level="body3">
                                            Izmjerena temperatura
                                        </Typography>
                                        <Typography semiBold>
                                            {data.measuredTemperature.toFixed(
                                                1,
                                            )}
                                            °C
                                        </Typography>
                                    </Stack>
                                )}
                                {data.rain > 0 && (
                                    <Stack spacing={1}>
                                        <Typography level="body3">
                                            Padaline
                                        </Typography>
                                        <div className="flex items-center space-x-1">
                                            <RainIcon chance={rainChance} />
                                            <Typography level="body2">
                                                {data.rain} mm
                                            </Typography>
                                        </div>
                                    </Stack>
                                )}
                                {data.snowAccumulation > 0 && (
                                    <Stack spacing={1}>
                                        <Typography level="body3">
                                            Snijeg
                                        </Typography>
                                        <div className="flex items-center space-x-1">
                                            <Snowflake className="h-4 w-4 opacity-60" />
                                            <Typography level="body2">
                                                {data.snowAccumulation.toFixed(
                                                    1,
                                                )}{' '}
                                                cm
                                            </Typography>
                                        </div>
                                    </Stack>
                                )}
                                {data.windSpeed > 0 && (
                                    <Stack spacing={1}>
                                        <Typography level="body3">
                                            Vjetar
                                        </Typography>
                                        <div className="relative flex items-center space-x-1">
                                            <Wind className="h-4 w-4 opacity-40" />
                                            <Row>
                                                {Array(data.windSpeed)
                                                    .fill(0)
                                                    .map((_, i) => (
                                                        <WindIcon
                                                            // biome-ignore lint/suspicious/noArrayIndexKey: Allowed
                                                            key={i}
                                                            className="-ml-1.5 h-4 w-4 first:ml-0"
                                                        />
                                                    ))}
                                            </Row>
                                        </div>
                                    </Stack>
                                )}
                            </div>
                        </Row>
                        {alerts.length > 0 && (
                            <WeatherAlertGroups alerts={alerts} />
                        )}
                        <WeatherAlertPreferencePrompt />
                        <div className="block border-l md:hidden">
                            <Button
                                variant="plain"
                                className="h-full rounded-none"
                                endDecorator={<Navigate />}
                                onClick={() => setShowForecast(true)}
                            >
                                Prognoza
                            </Button>
                        </div>
                    </div>
                )}
            </div>
            <Divider />
            <Row className="shrink-0 px-4 py-2" justifyContent="space-between">
                <Typography level="body3" className="flex gap-1">
                    <span>Izvor podataka</span>
                    <Link
                        href={
                            'https://meteo.hr/proizvodi.php?section=podaci&param=xml_korisnici'
                        }
                        target="_blank"
                        className="flex gap-1 items-center"
                    >
                        <Image
                            className="inline"
                            width={18}
                            height={18}
                            alt="DHMZ logo"
                            src="data:image/svg+xml;base64,PHN2ZyBpZD0ibWV0ZW8tbG9nbyIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB2aWV3Qm94PSIwIDAgMzM3LjcgMjk3LjE2Ij48ZGVmcz48c3R5bGU+LmNscy0xe2ZpbGw6I2Y2YjUzYTt9LmNscy0xLC5jbHMtMntmaWxsLXJ1bGU6ZXZlbm9kZDt9LmNscy0ye2ZpbGw6IzAwNTc4YTt9PC9zdHlsZT48L2RlZnM+PHRpdGxlPmxvZ288L3RpdGxlPjxwYXRoIGNsYXNzPSJjbHMtMSIgZD0iTTQ1LDM5Ljg3czM1LjIyLTI3LjU1LDYzLjctMzUuOTJhMTAyLjU5LDEwMi41OSwwLDAsMSw1My40LS44M1pNMTgzLjM0LDE1LDE2MC40OSwyLjI3bC0xNTUsODFMNC40LDg3LjU1LDE4Ny44NCwzMy4zNiwyLjc1LDEzMy40NiwwLDE0MmwxODMuMzMtNTYuNEwyLjUxLDE3NS4xOS44MSwxODEuMDhsMTYxLjM1LTQyLjYxTDYuNDMsMjE2Ljc4bDQuOTMsNi41NEwxNjQsMTgyLjA2LDIzLjIzLDI1Ni42OGw5LjkxLDYuODlMMTU2LjgsMjMzLjMyLDY4LjUxLDI3OS4yczM1LjQzLDExLjg4LDY5LjA2LDQuNjdhMTY0LjQyLDE2NC40MiwwLDAsMCw1OC4xOS0yNS42NmwtODYsMTQuNzNMMjY0LDE4Ny4zM2wtMTkxLDUyLjgsMTgwLjItOTYuMjctNjguODIsMTcuODgtODcuODQsMjIsMTM5LjItNjQuMjUsMzIuNTQtMjQuOTJMODMuNTgsMTQ1Ljg0LDIzNy41MSw2NS41N2wtNi43MS0xMS43NUw5My44LDkzLjIzLDIxMCwzMi41OGwtMTYuODktMTMuM0wxMjIsNDMuNTdaIi8+PHBhdGggY2xhc3M9ImNscy0yIiBkPSJNMTE4LjQxLDQ3LjUzczIzLTIxLjI4LDU4LTMxLDY1Ljc3LS42LDY1Ljc3LS42Wk0yNDEuNjIsMTUuNjQsOTMuOCw5My4yM2wxNzguNi00Ny4zMUw4My41OCwxNDUuODQsMjYyLjQsMTAwbC0xNjUuOCw4My44LDg3Ljg0LTIyLDEzOC4zLTc0LjExLTYtMTEuMzdMMTkzLjY2LDEwOS40MywyOTcuODQsNTMuMjNsLTE5LjA1LTE3TDE5NC43NSw1OGw2OC41LTMyWm05My4zMiwxMDYuNTEtODEuNjksMjEuNzFMNzMuMDUsMjQwLjEzLDI0OCwxOTUsMTAxLjkzLDI3Ny4zNCwyMzYuNDQsMjQ5LjhsLTg3Ljg3LDQzLjUxczQzLjc2LDEzLjgxLDkxLTEwLjkyYzI0Ljg5LTEzLDc5LjMzLTU4Ljc1LDc5LjMzLTU4Ljc1bDQuNjQtNy44Mi0xNTMuNCw0MEwzMzcuNywxNjcuNjZsLS40LTUuN0wxOTcuMDcsMTk5LjE1LDMzNS44LDEyNy45M1oiLz48L3N2Zz4="
                        />
                        <span>DHMZ</span>
                    </Link>
                    {alerts.length > 0 && (
                        <>
                            <span>•</span>
                            <Link
                                href="https://meteoalarm.org"
                                target="_blank"
                                className="flex gap-1 items-center"
                            >
                                <span>MeteoAlarm</span>
                            </Link>
                        </>
                    )}
                    <span>•</span>
                    <Link
                        href="https://signalco.io"
                        target="_blank"
                        className="flex gap-1 items-center"
                    >
                        <Image
                            className="inline rounded-xs"
                            width={18}
                            height={18}
                            alt="Signalco logo"
                            src="data:image/png;base64,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"
                        />
                        <span>Signalco</span>
                    </Link>
                </Typography>
            </Row>
        </Stack>
    );
}
