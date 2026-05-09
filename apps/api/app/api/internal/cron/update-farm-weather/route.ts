import { getFarms, updateFarm } from '@gredice/storage';
import type { NextRequest } from 'next/server';
import { getBjelovarForecast } from '../../../../../lib/weather/forecast';
import { populateWeatherFromSymbol } from '../../../../../lib/weather/populateWeatherFromSymbol';

export const dynamic = 'force-dynamic';

/**
 * Calculate snow accumulation change based on weather conditions and temperature
 * @param currentSnow Current snow accumulation in cm
 * @param temperature Current temperature in °C
 * @param snowy Snow intensity (0-1)
 * @returns New snow accumulation in cm
 */
function calculateSnowChange(
    currentSnow: number,
    temperature: number,
    snowy: number,
): number {
    let snowChange = 0;

    // Add snow if it's snowing and temperature is below freezing
    if (snowy > 0 && temperature <= 0) {
        // Light snow (0.33): ~0.5 cm/hour
        // Medium snow (0.66): ~1 cm/hour
        // Heavy snow (1.0): ~2 cm/hour
        snowChange += snowy * 2;
    }

    // Melt snow based on temperature
    if (currentSnow > 0 && temperature > 0) {
        // Realistic snow melting rates:
        // 0-5°C: slow melting (~0.2 cm/hour)
        // 5-10°C: moderate melting (~0.5 cm/hour)
        // 10-15°C: faster melting (~1 cm/hour)
        // 15+°C: rapid melting (~2 cm/hour)
        if (temperature <= 5) {
            snowChange -= 0.2;
        } else if (temperature <= 10) {
            snowChange -= 0.5;
        } else if (temperature <= 15) {
            snowChange -= 1.0;
        } else {
            snowChange -= 2.0;
        }
    }

    const newSnow = Math.max(0, currentSnow + snowChange);
    return Math.round(newSnow * 10) / 10; // Round to 1 decimal place
}

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', {
            status: 401,
        });
    }

    try {
        const farms = await getFarms();
        const forecast = await getBjelovarForecast();

        if (!forecast || forecast.length === 0) {
            console.error('No forecast data available');
            return Response.json(
                {
                    success: false,
                    error: 'No forecast data available',
                    timestamp: new Date().toISOString(),
                },
                { status: 500 },
            );
        }

        // Get current weather from forecast
        const nowLocal = new Date();
        let closestEntry = null;
        let minDiff = Infinity;

        for (const day of forecast) {
            for (const entry of day.entries) {
                const entryDateTime = new Date(
                    `${day.date}T${entry.time.toString().padStart(2, '0')}:00:00`,
                );
                const diff = Math.abs(
                    entryDateTime.getTime() - nowLocal.getTime(),
                );
                if (diff < minDiff) {
                    minDiff = diff;
                    closestEntry = entry;
                }
            }
        }

        if (!closestEntry) {
            console.error('Could not find closest forecast entry');
            return Response.json(
                {
                    success: false,
                    error: 'Could not find forecast entry',
                    timestamp: new Date().toISOString(),
                },
                { status: 500 },
            );
        }

        const weather = populateWeatherFromSymbol(closestEntry.symbol);
        const temperature = closestEntry.temperature;

        const updates: Array<{ farmId: number; newSnow: number }> = [];

        // Update each farm
        for (const farm of farms) {
            const newSnowAccumulation = calculateSnowChange(
                farm.snowAccumulation,
                temperature,
                weather.snowy,
            );

            if (newSnowAccumulation !== farm.snowAccumulation) {
                await updateFarm({
                    id: farm.id,
                    snowAccumulation: newSnowAccumulation,
                });

                updates.push({
                    farmId: farm.id,
                    newSnow: newSnowAccumulation,
                });

                console.info(
                    `Updated farm ${farm.id} snow accumulation: ${farm.snowAccumulation} cm → ${newSnowAccumulation} cm (temp: ${temperature}°C, snowy: ${weather.snowy})`,
                );
            }
        }

        return Response.json({
            success: true,
            updatedFarms: updates.length,
            updates,
            weather: {
                temperature,
                snowy: weather.snowy,
            },
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Failed to update farm weather:', error);
        return Response.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString(),
            },
            { status: 500 },
        );
    }
}
