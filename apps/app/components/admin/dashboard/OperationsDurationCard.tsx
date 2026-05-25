'use client';

import { Card, CardOverflow } from '@gredice/ui/Card';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { UserAvatar } from '@gredice/ui/UserAvatar';
import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

export type OperationsDurationPoint = {
    date: string;
    operationsMinutes: number;
    plannedMinutes: number;
    sowingMinutes: number;
    totalMinutes: number;
    byUser: {
        userId: string;
        userName: string;
        userAvatarUrl: string | null;
        operationsMinutes: number;
        plannedMinutes: number;
    }[];
};

export type OperationsDurationData = {
    totalMinutes: number;
    operationsMinutes: number;
    plannedMinutes: number;
    sowingMinutes: number;
    byUser: {
        userId: string;
        userName: string;
        userAvatarUrl: string | null;
        operationsMinutes: number;
        plannedMinutes: number;
        operationsCount: number;
        plannedCount: number;
    }[];
    daily: OperationsDurationPoint[];
};

const dateFormatter = new Intl.DateTimeFormat('hr-HR', {
    day: '2-digit',
    month: '2-digit',
});

const USER_BAR_COLORS = [
    'hsl(var(--primary) / 0.8)',
    'hsl(221 83% 53% / 0.8)',
    'hsl(262 83% 58% / 0.8)',
    'hsl(16 84% 55% / 0.8)',
    'hsl(142 71% 45% / 0.8)',
    'hsl(338 80% 56% / 0.8)',
    'hsl(199 89% 48% / 0.8)',
    'hsl(32 95% 44% / 0.8)',
];

function getUserBarColor(index: number) {
    return (
        USER_BAR_COLORS[index % USER_BAR_COLORS.length] ??
        'hsl(var(--primary) / 0.8)'
    );
}

function getCompletedDataKey(userId: string) {
    return `completed-${userId}`;
}

function getPlannedDataKey(userId: string) {
    return `planned-${userId}`;
}

function formatTotalDuration(totalMinutes: number) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);

    if (hours <= 0) {
        return `${minutes} min`;
    }

    return `${hours} h ${minutes.toString().padStart(2, '0')} min`;
}

function formatTooltipDuration(minutes: number) {
    if (!minutes) {
        return '0 min';
    }

    if (minutes < 60) {
        return `${Math.round(minutes)} min`;
    }

    const hours = Math.floor(minutes / 60);
    const rest = Math.round(minutes % 60);
    return rest > 0 ? `${hours} h ${rest} min` : `${hours} h`;
}

function formatDateLabel(date: string) {
    const parsed = new Date(date);
    return dateFormatter.format(parsed);
}

export function OperationsDurationCard({
    data,
}: {
    data: OperationsDurationData;
}) {
    const userSegments = data.byUser.map((user, index) => ({
        userId: user.userId,
        userName: user.userName,
        userAvatarUrl: user.userAvatarUrl,
        completedDataKey: getCompletedDataKey(user.userId),
        plannedDataKey: getPlannedDataKey(user.userId),
        color: getUserBarColor(index),
    }));
    const chartData = data.daily.map((day) => {
        const valuesByUser: Record<string, string | number> = {
            date: day.date,
            label: formatDateLabel(day.date),
            sowingMinutes: day.sowingMinutes,
        };

        for (const user of day.byUser) {
            valuesByUser[getCompletedDataKey(user.userId)] =
                user.operationsMinutes;
            valuesByUser[getPlannedDataKey(user.userId)] = user.plannedMinutes;
        }

        return valuesByUser;
    });
    const maxVisibleLabels = 10;
    const labelStep = Math.max(
        1,
        Math.ceil(Math.max(chartData.length, 1) / maxVisibleLabels),
    );

    return (
        <Card>
            <CardOverflow>
                <Stack spacing={4} className="p-4">
                    <Stack spacing={1}>
                        <Typography level="body3">
                            Ukupno trajanje radnji
                        </Typography>
                        <Typography level="h4" semiBold>
                            {formatTotalDuration(data.totalMinutes)}
                        </Typography>
                        <Row className="gap-4 text-xs text-muted-foreground">
                            <Row spacing={1} className="items-center">
                                <span className="h-2 w-2 rounded-xs bg-primary/60" />
                                <Typography level="body3">
                                    Radnje{' '}
                                    {formatTooltipDuration(
                                        data.operationsMinutes,
                                    )}
                                </Typography>
                            </Row>
                            <Row spacing={1} className="items-center">
                                <span className="h-2 w-2 rounded-xs border border-primary/70" />
                                <Typography level="body3">
                                    Planirano{' '}
                                    {formatTooltipDuration(
                                        data.plannedMinutes ?? 0,
                                    )}
                                </Typography>
                            </Row>
                            <Row spacing={1} className="items-center">
                                <span className="h-2 w-2 rounded-xs bg-emerald-500/60" />
                                <Typography level="body3">
                                    Sijanje{' '}
                                    {formatTooltipDuration(data.sowingMinutes)}
                                </Typography>
                            </Row>
                        </Row>
                    </Stack>
                    {chartData.length === 0 ? (
                        <Typography
                            level="body2"
                            className="text-muted-foreground"
                        >
                            Nema podataka za odabrani period.
                        </Typography>
                    ) : (
                        <div className="h-56 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={chartData}
                                    margin={{
                                        top: 8,
                                        right: 8,
                                        left: -16,
                                        bottom: 0,
                                    }}
                                >
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        className="stroke-border"
                                    />
                                    <XAxis
                                        dataKey="label"
                                        tickLine={false}
                                        axisLine={false}
                                        interval={0}
                                        tick={({ x, y, payload, index }) => {
                                            if (
                                                index % labelStep !== 0 &&
                                                index !== chartData.length - 1
                                            ) {
                                                return null;
                                            }

                                            return (
                                                <text
                                                    x={x}
                                                    y={y + 12}
                                                    textAnchor="middle"
                                                    className="fill-muted-foreground text-xs"
                                                >
                                                    {payload.value}
                                                </text>
                                            );
                                        }}
                                    />
                                    <YAxis
                                        tickLine={false}
                                        axisLine={false}
                                        width={36}
                                        tick={{ fontSize: 12 }}
                                        tickFormatter={(value: number) =>
                                            `${Math.round(value)}m`
                                        }
                                    />
                                    <Tooltip
                                        cursor={{
                                            fill: 'hsl(var(--primary) / 0.08)',
                                        }}
                                        content={({
                                            active,
                                            payload,
                                            label,
                                        }) => {
                                            if (
                                                !active ||
                                                !payload ||
                                                payload.length === 0
                                            ) {
                                                return null;
                                            }

                                            const values = payload
                                                .map((item) =>
                                                    typeof item.value ===
                                                    'number'
                                                        ? item.value
                                                        : 0,
                                                )
                                                .filter((value) => value > 0);
                                            const totalMinutes = values.reduce(
                                                (sum, value) => sum + value,
                                                0,
                                            );
                                            const sowingEntry = payload.find(
                                                (item) =>
                                                    String(item.dataKey) ===
                                                    'sowingMinutes',
                                            );
                                            const sowingMinutes =
                                                typeof sowingEntry?.value ===
                                                'number'
                                                    ? sowingEntry.value
                                                    : 0;
                                            const byUserEntries = payload
                                                .filter(
                                                    (item) =>
                                                        String(item.dataKey) !==
                                                            'sowingMinutes' &&
                                                        typeof item.value ===
                                                            'number' &&
                                                        item.value > 0,
                                                )
                                                .sort(
                                                    (a, b) =>
                                                        Number(b.value) -
                                                        Number(a.value),
                                                );

                                            return (
                                                <Stack
                                                    spacing={1}
                                                    className="rounded-md border border-border bg-card p-2 text-xs text-card-foreground shadow-md"
                                                >
                                                    <Typography level="body2">
                                                        {label}
                                                    </Typography>
                                                    <Typography
                                                        level="body3"
                                                        semiBold
                                                    >
                                                        Ukupno:{' '}
                                                        {formatTooltipDuration(
                                                            totalMinutes,
                                                        )}
                                                    </Typography>
                                                    {byUserEntries.length >
                                                    0 ? (
                                                        byUserEntries.map(
                                                            (user) => (
                                                                <Typography
                                                                    key={String(
                                                                        user.dataKey,
                                                                    )}
                                                                    level="body3"
                                                                    className="text-muted-foreground"
                                                                >
                                                                    {user.name}:{' '}
                                                                    {formatTooltipDuration(
                                                                        Number(
                                                                            user.value,
                                                                        ),
                                                                    )}
                                                                </Typography>
                                                            ),
                                                        )
                                                    ) : (
                                                        <Typography
                                                            level="body3"
                                                            className="text-muted-foreground"
                                                        >
                                                            Nema dodijeljenih
                                                            korisnika
                                                        </Typography>
                                                    )}
                                                    {sowingMinutes > 0 ? (
                                                        <Typography
                                                            level="body3"
                                                            className="text-muted-foreground"
                                                        >
                                                            Sijanje:{' '}
                                                            {formatTooltipDuration(
                                                                sowingMinutes,
                                                            )}
                                                        </Typography>
                                                    ) : null}
                                                </Stack>
                                            );
                                        }}
                                    />
                                    {userSegments.map((user) => (
                                        <Bar
                                            key={user.userId}
                                            dataKey={user.completedDataKey}
                                            stackId="completedDuration"
                                            fill={user.color}
                                            radius={[4, 4, 0, 0]}
                                            name={`${user.userName} završeno`}
                                        />
                                    ))}
                                    {userSegments.map((user) => (
                                        <Bar
                                            key={`${user.userId}-planned`}
                                            dataKey={user.plannedDataKey}
                                            stackId="plannedDuration"
                                            fill="transparent"
                                            stroke={user.color}
                                            strokeWidth={2}
                                            radius={[4, 4, 0, 0]}
                                            name={`${user.userName} planirano`}
                                        />
                                    ))}
                                    <Bar
                                        dataKey="sowingMinutes"
                                        stackId="completedDuration"
                                        fill="hsl(142 71% 45% / 0.65)"
                                        name="Sijanje"
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                    {data.byUser.length > 0 ? (
                        <Stack spacing={3} className="pt-2">
                            <Typography level="body3" className="font-medium">
                                Po korisniku
                            </Typography>
                            <div className="flex flex-wrap gap-2">
                                {data.byUser.map((user, index) => {
                                    const segmentColor =
                                        userSegments[index]?.color ??
                                        getUserBarColor(index);

                                    return (
                                        <Row
                                            key={user.userId}
                                            className="min-w-[14rem] items-center gap-2 rounded-md border border-border/40 px-2 py-1.5"
                                        >
                                            <span
                                                className="size-2.5 shrink-0 rounded-full"
                                                style={{
                                                    backgroundColor:
                                                        segmentColor,
                                                }}
                                            />
                                            <UserAvatar
                                                size="sm"
                                                avatarUrl={user.userAvatarUrl}
                                                displayName={user.userName}
                                            />
                                            <Stack
                                                spacing={0}
                                                className="min-w-0"
                                            >
                                                <Typography
                                                    level="body3"
                                                    semiBold
                                                    className="truncate"
                                                >
                                                    {user.userName}
                                                </Typography>
                                                <Typography
                                                    level="body3"
                                                    className="text-muted-foreground"
                                                >
                                                    Završeno:{' '}
                                                    {user.operationsCount} ·
                                                    Nezavršeno:{' '}
                                                    {user.plannedCount ?? 0}
                                                </Typography>
                                            </Stack>
                                            <Typography
                                                level="body3"
                                                semiBold
                                                className="ml-auto whitespace-nowrap"
                                            >
                                                {formatTooltipDuration(
                                                    user.operationsMinutes +
                                                        (user.plannedMinutes ??
                                                            0),
                                                )}
                                            </Typography>
                                        </Row>
                                    );
                                })}
                            </div>
                        </Stack>
                    ) : null}
                </Stack>
            </CardOverflow>
        </Card>
    );
}
