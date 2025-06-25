import { Hono } from 'hono';
import { getBjelovarForecast } from '../../../../lib/weather/forecast';
import { populateWeatherFromSymbol } from '../../../../lib/weather/populateWeatherFromSymbol';
import { describeRoute } from 'hono-openapi';
import { TZDate } from "@date-fns/tz";
import { grediceCached, grediceCacheKeys } from '@gredice/storage';

const app = new Hono()
    .get(
        '/',
        describeRoute({
            description: 'Get weather forecast',
        }),
        async (context) => {
            const forecast = await grediceCached(grediceCacheKeys.forecast, getBjelovarForecast);
            return context.json(forecast ?? []);
        })
    .get(
        '/now',
        describeRoute({
            description: 'Get current weather',
        }),
        async (context) => {
            const forecast = await grediceCached(grediceCacheKeys.forecast, getBjelovarForecast);
            if (!forecast || forecast.length === 0) {
                return context.json({ error: 'Forecast not available' }, { status: 500 });
            }


            // Find the forecast entry closest to now
            const nowLocal = new TZDate(TZDate.now(), 'Europe/Zagreb');
            let closestEntry = null;
            let minDiff = Infinity;

            for (const day of forecast) {
                for (const entry of day.entries) {
                    const entryDateTime = new TZDate(`${day.date}T${entry.time.toString().padStart(2, "0")}:00:00`, 'Europe/Zagreb');
                    const diff = Math.abs(entryDateTime.getTime() - nowLocal.getTime());
                    if (diff < minDiff) {
                        minDiff = diff;
                        closestEntry = entry;
                    }
                }
            }

            if (!closestEntry) {
                return context.json({ error: 'Forecast not available' }, { status: 500 });
            }

            const weather = {
                symbol: closestEntry.symbol,
                temperature: closestEntry?.temperature,
                rain: closestEntry.rain,
                windDirection: closestEntry.windDirection,
                windSpeed: closestEntry.windStrength,
                ...populateWeatherFromSymbol(closestEntry.symbol),
            };

            return context.json(weather);
        });

export default app;