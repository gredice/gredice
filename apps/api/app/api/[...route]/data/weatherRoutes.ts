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
            const current = forecast.at(0)?.entries.at(0);
            if (!current) {
                return new Response(null, { status: 500, statusText: 'Forecast not available' });
            }

            const weather = {
                symbol: current.symbol,
                temperature: current?.temperature,
                rain: current.rain,
                windDirection: current.windDirection,
                windSpeed: current.windStrength,
                ...populateWeatherFromSymbol(current.symbol),
            };

            return context.json(weather);
        });

export default app;