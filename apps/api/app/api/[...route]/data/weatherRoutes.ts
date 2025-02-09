import { Hono } from 'hono';
import { getBjelovarForecast } from '../../../../lib/weather/forecast';
import { populateWeatherFromSymbol } from '../../../../lib/weather/populateWeatherFromSymbol';

const app = new Hono()
    .get('/now', async (context) => {
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
    })
    .get('/', async (context) => {
        return context.json(await getBjelovarForecast());
    })

export default app;