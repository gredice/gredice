import { getBjelovarForecast } from "../../../../../lib/weather/forecast";
import { populateWeatherFromSymbol } from "../../../../../lib/weather/populateWeatherFromSymbol";

export const dynamic = 'force-static';
export const revalidate = 3600; // 1 hour (in seconds)

export async function GET() {
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

    return Response.json(weather);
}