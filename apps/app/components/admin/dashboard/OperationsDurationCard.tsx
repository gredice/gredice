'use client';

import { Card, CardOverflow } from '@signalco/ui-primitives/Card';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@signalco/ui-primitives/Tooltip';
import { Typography } from '@signalco/ui-primitives/Typography';

export type OperationsDurationPoint = {
    date: string;
    operationsMinutes: number;
    sowingMinutes: number;
    totalMinutes: number;
};

export type OperationsDurationData = {
    totalMinutes: number;
    operationsMinutes: number;
    sowingMinutes: number;
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
        ...data.daily.map((day) => day.totalMinutes),
    );
    const hasData = maxMinutes > 0;
    const maxVisibleLabels = 10;
    const labelStep = Math.max(
        1,
        Math.ceil(data.daily.length / maxVisibleLabels),
    );
    const points = data.daily.map((day, index) => {
        const normalizedHeight = maxMinutes
            ? (day.totalMinutes / maxMinutes) * 100
            : 0;
        const heightPercent =
            day.totalMinutes > 0 ? Math.max(4, normalizedHeight) : 0;
        const barHasSegments =
            day.operationsMinutes > 0 || day.sowingMinutes > 0;
        const shouldShowLabel =
            index % labelStep === 0 || index === data.daily.length - 1;

        return {
            barHasSegments,
            day,
            heightPercent,
            shouldShowLabel,
        };
    });

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
                        <Row className="gap-4 text-xs text-muted-foreground">
                            <Row spacing={0.5} className="items-center">
                                <span className="h-2 w-2 rounded-sm bg-primary/60" />
                                <Typography level="body3">
                                    Radnje{' '}
                                    {formatTooltipDuration(
                                        data.operationsMinutes,
                                    )}
                                </Typography>
                            </Row>
                            <Row spacing={0.5} className="items-center">
                                <span className="h-2 w-2 rounded-sm bg-emerald-500/60" />
                                <Typography level="body3">
                                    Sijanje{' '}
                                    {formatTooltipDuration(data.sowingMinutes)}
                                </Typography>
                            </Row>
                        </Row>
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
                        <>
                            <div className="flex h-48 w-full items-end gap-[3px] sm:gap-2">
                                {points.map(
                                    ({
                                        barHasSegments,
                                        day,
                                        heightPercent,
                                    }) => (
                                        <Tooltip key={day.date}>
                                            <TooltipTrigger asChild>
                                                <div className="flex h-full min-w-[6px] flex-1 basis-0 items-end">
                                                    <div
                                                        className="flex w-full min-w-0 flex-col justify-end overflow-hidden rounded-t bg-primary/10"
                                                        style={{
                                                            height: `${heightPercent}%`,
                                                        }}
                                                    >
                                                        {barHasSegments ? (
                                                            <>
                                                                {day.operationsMinutes >
                                                                    0 && (
                                                                    <div
                                                                        className="bg-primary/60"
                                                                        style={{
                                                                            flexGrow:
                                                                                day.operationsMinutes,
                                                                            flexBasis: 0,
                                                                        }}
                                                                    />
                                                                )}
                                                                {day.sowingMinutes >
                                                                    0 && (
                                                                    <div
                                                                        className="bg-emerald-500/60"
                                                                        style={{
                                                                            flexGrow:
                                                                                day.sowingMinutes,
                                                                            flexBasis: 0,
                                                                        }}
                                                                    />
                                                                )}
                                                            </>
                                                        ) : null}
                                                    </div>
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
                                                        Ukupno:{' '}
                                                        {formatTooltipDuration(
                                                            day.totalMinutes,
                                                        )}
                                                    </Typography>
                                                    <Typography
                                                        level="body3"
                                                        className="text-muted-foreground"
                                                    >
                                                        Radnje:{' '}
                                                        {formatTooltipDuration(
                                                            day.operationsMinutes,
                                                        )}
                                                    </Typography>
                                                    <Typography
                                                        level="body3"
                                                        className="text-muted-foreground"
                                                    >
                                                        Sijanje:{' '}
                                                        {formatTooltipDuration(
                                                            day.sowingMinutes,
                                                        )}
                                                    </Typography>
                                                </Stack>
                                            </TooltipContent>
                                        </Tooltip>
                                    ),
                                )}
                            </div>
                            <div className="mt-2 flex w-full gap-[3px] sm:gap-2">
                                {points.map(({ day, shouldShowLabel }) => (
                                    <div
                                        key={`${day.date}-label`}
                                        className="min-w-[6px] flex-1 basis-0 text-center"
                                    >
                                        {shouldShowLabel ? (
                                            <Stack
                                                spacing={0}
                                                className="min-w-0 items-center text-center"
                                            >
                                                <Typography
                                                    level="body3"
                                                    className="text-xs font-medium leading-tight"
                                                >
                                                    {formatDateLabel(day.date)}
                                                </Typography>
                                                <Stack
                                                    spacing={0}
                                                    className="hidden min-w-0 items-center text-[10px] leading-tight text-muted-foreground md:flex"
                                                >
                                                    <Typography level="body3">
                                                        Ukupno{' '}
                                                        {formatTooltipDuration(
                                                            day.totalMinutes,
                                                        )}
                                                    </Typography>
                                                    <Typography level="body3">
                                                        Radnje{' '}
                                                        {formatTooltipDuration(
                                                            day.operationsMinutes,
                                                        )}
                                                    </Typography>
                                                    <Typography level="body3">
                                                        Sijanje{' '}
                                                        {formatTooltipDuration(
                                                            day.sowingMinutes,
                                                        )}
                                                    </Typography>
                                                </Stack>
                                            </Stack>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </Stack>
            </CardOverflow>
        </Card>
    );
}
