import { getFarms, grediceCached, grediceCacheKeys } from '@gredice/storage';
import { Hono } from 'hono';
import { describeRoute } from 'hono-openapi';
import {
    cacheControlPresets,
    setCacheControl,
} from '../../../../lib/http/cacheControl';
import { getBjelovarForecast } from '../../../../lib/weather/forecast';
import { populateWeatherFromSymbol } from '../../../../lib/weather/populateWeatherFromSymbol';
import {
    fallbackWeatherNow,
    findClosestForecastEntry,
    pickFarmSnowAccumulation,
} from '../../../../lib/weather/weatherNowContract';

// import { signalcoClient } from '@gredice/signalco';

const app = new Hono()
    .get(
        '/',
        describeRoute({
            description: 'Get weather forecast',
        }),
        async (context) => {
            const forecast = await grediceCached(
                grediceCacheKeys.forecastBjelovar,
                getBjelovarForecast,
                60 * 60,
            );
            setCacheControl(context, cacheControlPresets.weatherShortTerm);
            return context.json(forecast ?? []);
        },
    )
    .get(
        '/now',
        describeRoute({
            description: 'Get current weather',
        }),
        async (context) => {
            const forecast = await grediceCached(
                grediceCacheKeys.forecastBjelovar,
                getBjelovarForecast,
                60 * 60,
            );

            // const measurements = await grediceCached(grediceCacheKeys.airSensorOpgIb, async () => {
            //     const airSensorData = await signalcoClient().GET('/entity/{id}', { params: { path: { id: '565c2653-b3eb-4a7e-9399-bf5734128e03' } } });
            //     const temperatureContact = airSensorData.data?.contacts?.find((contact) => contact.contactName === 'temperature');
            //     const actualTemperature =
            //         temperatureContact &&
            //             temperatureContact.timeStamp &&
            //             typeof temperatureContact.valueSerialized === 'string' &&
            //             TZDate.now() - new Date(temperatureContact.timeStamp).getTime() < 1000 * 60 * 60 * 6 // within the last 6 hours
            //             ? parseFloat(temperatureContact.valueSerialized)
            //             : null;
            //     return {
            //         actualTemperature
            //     };
            // }, 60 * 60);

            const farmId = context.req.query('farmId');
            const farms = await getFarms();
            const snowAccumulation = pickFarmSnowAccumulation(farms, farmId);

            if (!forecast || forecast.length === 0) {
                setCacheControl(context, cacheControlPresets.weatherShortTerm);
                return context.json({
                    ...fallbackWeatherNow,
                    snowAccumulation,
                });
            }

            const closestEntry = findClosestForecastEntry(forecast, Date.now());
            if (!closestEntry) {
                setCacheControl(context, cacheControlPresets.weatherShortTerm);
                return context.json({
                    ...fallbackWeatherNow,
                    snowAccumulation,
                });
            }
            setCacheControl(context, cacheControlPresets.weatherShortTerm);

            const weather = {
                symbol: closestEntry.symbol,
                temperature: closestEntry?.temperature,
                measuredTemperature: null as number | null, //measurements?.actualTemperature,
                rain: closestEntry.rain,
                windDirection: closestEntry.windDirection,
                windSpeed: closestEntry.windStrength,
                snowAccumulation,
                ...populateWeatherFromSymbol(closestEntry.symbol),
                source: 'forecast' as const,
                isStale: false,
            };

            return context.json(weather);
        },
    );

export default app;
