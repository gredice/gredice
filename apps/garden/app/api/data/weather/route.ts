import { getBjelovarForecast } from '../../../../lib/weather/forecast';

export const dynamic = 'force-static';
export const revalidate = 3600; // 1 hour (in seconds)

export async function GET() {
    const forecast = await getBjelovarForecast();
    return Response.json(forecast);
}