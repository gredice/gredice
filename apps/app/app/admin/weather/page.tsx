import { clientPublic } from '@gredice/client';
import { getDefaultWeatherRange } from '@gredice/js/weather';
import { getWeatherHistory, getWeatherHistoryBounds } from '@gredice/storage';
import { Stack } from '@gredice/ui/Stack';
import { WeatherAdminClient } from '../../../components/admin/weather/WeatherAdminClient';
import { auth } from '../../../lib/auth/auth';

export const dynamic = 'force-dynamic';

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

    const [historyRows, bounds, forecastResponse, currentResponse] =
        await Promise.all([
            getWeatherHistory(safeFrom, safeTo),
            getWeatherHistoryBounds(),
            clientPublic().api.data.weather.$get(),
            clientPublic().api.data.weather.now.$get(),
        ]);

    const forecast = forecastResponse.ok ? await forecastResponse.json() : [];
    const current = currentResponse.ok ? await currentResponse.json() : null;

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
