import { Hono } from 'hono';
import { getBjelovarForecast } from '../../../../lib/weather/forecast';
import { populateWeatherFromSymbol } from '../../../../lib/weather/populateWeatherFromSymbol';
import { describeRoute } from 'hono-openapi';

const app = new Hono()
    .get(
        '/',
        describeRoute({
            description: 'Get weather forecast',
        }),
        async (context) => {
            return context.json(await getBjelovarForecast());
        })
    .get(
        '/now',
        describeRoute({
            description: 'Get current weather',
        }),
        async (context) => {
            const forecast = await getBjelovarForecast();
            if (!forecast || forecast.length === 0) {
                return context.json({ error: 'Forecast not available' }, { status: 500 });
            }

            // Find the forecast entry closest to now
            const now = new Date();
            let closestEntry = null;
            let minDiff = Infinity;

            for (const day of forecast) {
                const date = new Date(day.date); // day.date is assumed to be YYYY-MM-DD
                console.debug(`Checking date: ${date.toISOString()}`);
                for (const entry of day.entries) {
                    // entry.time is hour in 24h format
                    const entryDate = new Date(date);
                    entryDate.setHours(entry.time, 0, 0, 0);
                    const diff = Math.abs(entryDate.getTime() - now.getTime());
                    console.debug(`Checking entry: ${entryDate.toISOString()} with diff ${diff}`);
                    if (diff < minDiff) {
                        minDiff = diff;
                        closestEntry = entry;
                        console.debug(`Found closer entry: ${entryDate.toISOString()} with diff ${diff}`);
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