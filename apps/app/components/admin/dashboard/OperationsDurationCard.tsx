'use client';

import { Card, CardOverflow } from '@signalco/ui-primitives/Card';
import { Stack } from '@signalco/ui-primitives/Stack';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@signalco/ui-primitives/Tooltip';
import { Typography } from '@signalco/ui-primitives/Typography';

export type OperationsDurationPoint = {
    date: string;
    durationMinutes: number;
};

export type OperationsDurationData = {
    totalMinutes: number;
    daily: OperationsDurationPoint[];
};

const dateFormatter = new Intl.DateTimeFormat('hr-HR', {
    day: '2-digit',
    month: '2-digit',
});

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
    const maxMinutes = Math.max(
        0,
        ...data.daily.map((day) => day.durationMinutes),
    );
    const hasData = maxMinutes > 0;

    return (
        <Card>
            <CardOverflow>
                <Stack spacing={2} className="p-4">
                    <Stack spacing={0.5}>
                        <Typography level="body3">
                            Ukupno trajanje radnji
                        </Typography>
                        <Typography level="h4" semiBold>
                            {formatTotalDuration(data.totalMinutes)}
                        </Typography>
                        <Typography
                            level="body3"
                            className="text-muted-foreground"
                        >
                            Prikazane su samo završene radnje
                        </Typography>
                    </Stack>
                    {data.daily.length === 0 || !hasData ? (
                        <Typography
                            level="body2"
                            className="text-muted-foreground"
                        >
                            Nema podataka za odabrani period.
                        </Typography>
                    ) : (
                        <div className="flex items-end gap-2 h-48">
                            {data.daily.map((day) => {
                                const normalizedHeight = maxMinutes
                                    ? (day.durationMinutes / maxMinutes) * 100
                                    : 0;
                                const heightPercent =
                                    day.durationMinutes > 0
                                        ? Math.max(4, normalizedHeight)
                                        : 0;

                                return (
                                    <div
                                        key={day.date}
                                        className="flex-1 flex flex-col items-center gap-1 h-full"
                                    >
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="flex-1 flex items-end w-full">
                                                    <div
                                                        className="w-full rounded-t bg-primary/30"
                                                        style={{
                                                            height: `${heightPercent}%`,
                                                        }}
                                                    />
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <Stack spacing={0.5}>
                                                    <Typography level="body2">
                                                        {formatDateLabel(
                                                            day.date,
                                                        )}
                                                    </Typography>
                                                    <Typography level="body3">
                                                        {formatTooltipDuration(
                                                            day.durationMinutes,
                                                        )}
                                                    </Typography>
                                                </Stack>
                                            </TooltipContent>
                                        </Tooltip>
                                        <Stack
                                            spacing={0}
                                            className="items-center"
                                        >
                                            <Typography
                                                level="body3"
                                                className="text-xs"
                                            >
                                                {formatDateLabel(day.date)}
                                            </Typography>
                                            <Typography
                                                level="body3"
                                                className="text-xs text-muted-foreground"
                                            >
                                                {formatTooltipDuration(
                                                    day.durationMinutes,
                                                )}
                                            </Typography>
                                        </Stack>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Stack>
            </CardOverflow>
        </Card>
    );
}
