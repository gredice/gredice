'use client';

import {
    getWeatherDataBounds,
    type WeatherForecastDay,
    type WeatherHistoryPoint,
    windDirectionToDegrees,
} from '@gredice/js/weather';
import { Card, CardOverflow } from '@gredice/ui/Card';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import {
    WeatherCharts,
    type WeatherChartsRange,
} from '@gredice/ui/WeatherCharts';
import { ArrowUp } from '@gredice/ui/icons';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

interface CurrentWeather {
    symbol?: number | null;
    temperature?: number | null;
    measuredTemperature?: number | null;
    rain?: number | null;
    windDirection?: string | null;
    windSpeed?: number | null;
    snowAccumulation?: number | null;
}

interface WeatherAdminClientProps {
    history: WeatherHistoryPoint[];
    forecast: WeatherForecastDay[];
    current: CurrentWeather | null;
    historyBounds: { from: string | null; to: string | null };
    range: { from: string; to: string };
}

function StatCard({
    label,
    value,
    unit,
    children,
}: {
    label: string;
    value: string;
    unit?: string;
    children?: React.ReactNode;
}) {
    return (
        <Card className="grow">
            <CardOverflow>
                <Stack spacing={1} className="p-4">
                    <Typography level="body3" tertiary uppercase>
                        {label}
                    </Typography>
                    <Row spacing={1}>
                        <Typography level="h4" semiBold>
                            {value}
                            {unit ? (
                                <Typography level="body2" component="span" tertiary>
                                    {` ${unit}`}
                                </Typography>
                            ) : null}
                        </Typography>
                        {children}
                    </Row>
                </Stack>
            </CardOverflow>
        </Card>
    );
}

export function WeatherAdminClient({
    history,
    forecast,
    current,
    historyBounds,
    range: initialRange,
}: WeatherAdminClientProps) {
    const router = useRouter();
    const pathname = usePathname();

    const [range, setRange] = useState<WeatherChartsRange>(() => ({
        from: new Date(initialRange.from),
        to: new Date(initialRange.to),
    }));

    const bounds = getWeatherDataBounds(historyBounds.from, forecast);

    const handleRangeChange = (next: WeatherChartsRange) => {
        setRange(next);
        const params = new URLSearchParams();
        params.set('from', next.from.toISOString());
        params.set('to', next.to.toISOString());
        router.replace(`${pathname}?${params.toString()}`);
    };

    const temperature =
        current?.measuredTemperature ?? current?.temperature ?? null;
    const windDegrees = windDirectionToDegrees(current?.windDirection);

    return (
        <Stack spacing={4}>
            <Stack spacing={2}>
                <Typography level="h5" semiBold>
                    Trenutno stanje
                </Typography>
                <div className="flex flex-col gap-3 md:flex-row">
                    <StatCard
                        label="Temperatura"
                        value={temperature != null ? temperature.toFixed(1) : '—'}
                        unit="°C"
                    />
                    <StatCard
                        label="Padaline"
                        value={current?.rain != null ? current.rain.toFixed(1) : '—'}
                        unit="mm"
                    />
                    <StatCard
                        label="Vjetar"
                        value={
                            current?.windSpeed != null
                                ? String(current.windSpeed)
                                : '—'
                        }
                    >
                        {windDegrees != null && (
                            <ArrowUp
                                className="size-4 text-muted-foreground"
                                style={{
                                    transform: `rotate(${windDegrees}deg)`,
                                }}
                            />
                        )}
                        {current?.windDirection && (
                            <Typography level="body3" tertiary>
                                {current.windDirection}
                            </Typography>
                        )}
                    </StatCard>
                    <StatCard
                        label="Snijeg"
                        value={
                            current?.snowAccumulation != null
                                ? current.snowAccumulation.toFixed(1)
                                : '—'
                        }
                        unit="cm"
                    />
                </div>
            </Stack>

            <Stack spacing={2}>
                <Typography level="h5" semiBold>
                    Povijest i prognoza
                </Typography>
                <Card>
                    <CardOverflow>
                        <div className="p-4">
                            <WeatherCharts
                                history={history}
                                forecast={forecast}
                                range={range}
                                bounds={bounds}
                                onRangeChange={handleRangeChange}
                            />
                        </div>
                    </CardOverflow>
                </Card>
            </Stack>
        </Stack>
    );
}
