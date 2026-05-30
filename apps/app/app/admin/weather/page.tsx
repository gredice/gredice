import { clientPublic } from '@gredice/client';
import { getDefaultWeatherRange } from '@gredice/js/weather';
import { getWeatherHistory, getWeatherHistoryBounds } from '@gredice/storage';
import { Stack } from '@gredice/ui/Stack';
import { WeatherAdminClient } from '../../../components/admin/weather/WeatherAdminClient';
import { auth } from '../../../lib/auth/auth';

export const dynamic = 'force-dynamic';

async function getForecast() {
    try {
        const response = await clientPublic().api.data.weather.$get();
        return response.ok ? await response.json() : [];
    } catch (error) {
        console.error('Failed to load weather forecast for admin page:', error);
        return [];
    }
}

async function getCurrentWeather() {
    try {
        const response = await clientPublic().api.data.weather.now.$get();
        return response.ok ? await response.json() : null;
    } catch (error) {
        console.error('Failed to load current weather for admin page:', error);
        return null;
    }
}

export default async function WeatherPage({
    searchParams,
}: {
    searchParams: Promise<{ from?: string; to?: string }>;
}) {
    await auth(['admin']);

    const params = await searchParams;
    const defaults = getDefaultWeatherRange();
    const from = params.from ? new Date(params.from) : defaults.from;
    const to = params.to ? new Date(params.to) : defaults.to;
    const safeFrom = Number.isNaN(from.getTime()) ? defaults.from : from;
    const safeTo = Number.isNaN(to.getTime()) ? defaults.to : to;

    const [historyRows, bounds, forecast, current] = await Promise.all([
        getWeatherHistory(safeFrom, safeTo),
        getWeatherHistoryBounds(),
        getForecast(),
        getCurrentWeather(),
    ]);

    const history = historyRows.map((row) => ({
        ...row,
        recordedAt:
            row.recordedAt instanceof Date
                ? row.recordedAt.toISOString()
                : row.recordedAt,
    }));

    return (
        <Stack spacing={4}>
            <WeatherAdminClient
                history={history}
                forecast={forecast}
                current={current}
                historyBounds={{
                    from: bounds.from ? bounds.from.toISOString() : null,
                    to: bounds.to ? bounds.to.toISOString() : null,
                }}
                range={{
                    from: safeFrom.toISOString(),
                    to: safeTo.toISOString(),
                }}
            />
        </Stack>
    );
}
