const ZAGREB_TIME_ZONE = 'Europe/Zagreb';

export type FarmGreetingWeather = {
    temperature?: number | null;
    measuredTemperature?: number | null;
    rain?: number | null;
    windSpeed?: number | null;
    rainy?: number | null;
    snowy?: number | null;
    cloudy?: number | null;
    foggy?: number | null;
    thundery?: number | null;
    snowAccumulation?: number | null;
    isStale?: boolean | null;
};

function zagrebHour(date: Date) {
    const formatted = new Intl.DateTimeFormat('hr-HR', {
        hour: '2-digit',
        hourCycle: 'h23',
        timeZone: ZAGREB_TIME_ZONE,
    }).format(date);
    const parsed = Number.parseInt(formatted, 10);

    return Number.isFinite(parsed) ? parsed : date.getHours();
}

function zagrebDateKey(date: Date) {
    return new Intl.DateTimeFormat('hr-HR', {
        day: '2-digit',
        month: '2-digit',
        timeZone: ZAGREB_TIME_ZONE,
        year: 'numeric',
    }).format(date);
}

function dailyIndex(
    values: readonly string[],
    displayName: string,
    date: Date,
) {
    if (values.length <= 1) {
        return 0;
    }

    const seed = `${zagrebDateKey(date)}:${displayName}`;
    let hash = 0;

    for (const character of seed) {
        hash = (hash * 31 + character.charCodeAt(0)) % values.length;
    }

    return hash;
}

function timeGreetingOptions(date: Date) {
    const hour = zagrebHour(date);

    if (hour >= 5 && hour < 10) {
        return ['Dobro jutro', 'Jutarnji pozdrav'];
    }

    if (hour >= 10 && hour < 17) {
        return ['Dobar dan', 'Pozdrav iz farme'];
    }

    if (hour >= 17 && hour < 22) {
        return ['Dobra večer', 'Večernji pozdrav'];
    }

    return ['Mirna noć', 'Kasni pozdrav'];
}

function weatherGreetingOptions(
    date: Date,
    weather?: FarmGreetingWeather | null,
) {
    if (!weather || weather.isStale) {
        return [];
    }

    const activeWeatherOptions: string[] = [];
    const hour = zagrebHour(date);
    const isDaytime = hour >= 7 && hour < 19;
    const temperature = weather.measuredTemperature ?? weather.temperature;
    const rain = weather.rain ?? 0;
    const rainy = weather.rainy ?? 0;
    const snowy = weather.snowy ?? 0;
    const cloudy = weather.cloudy ?? 0;
    const foggy = weather.foggy ?? 0;
    const thundery = weather.thundery ?? 0;
    const windSpeed = weather.windSpeed ?? 0;
    const snowAccumulation = weather.snowAccumulation ?? 0;

    if (thundery >= 0.2) {
        activeWeatherOptions.push('Grmljavinski pozdrav');
    }

    if (snowy >= 0.2 || snowAccumulation > 0) {
        activeWeatherOptions.push('Snježan pozdrav');
    }

    if (rainy >= 0.35 || rain > 0) {
        activeWeatherOptions.push('Kišni pozdrav');
    }

    if (foggy >= 0.35) {
        activeWeatherOptions.push('Maglovit pozdrav');
    }

    if (windSpeed >= 2) {
        activeWeatherOptions.push('Vjetrovit pozdrav');
    }

    if (activeWeatherOptions.length > 0) {
        return activeWeatherOptions;
    }

    const ambientWeatherOptions: string[] = [];

    if (typeof temperature === 'number') {
        if (temperature >= 28) {
            ambientWeatherOptions.push('Topao pozdrav');
        } else if (temperature <= 3) {
            ambientWeatherOptions.push('Hladan pozdrav');
        }
    }

    if (cloudy >= 0.7) {
        ambientWeatherOptions.push('Oblačan pozdrav');
    } else if (isDaytime && cloudy <= 0.25 && rainy < 0.2 && foggy < 0.2) {
        ambientWeatherOptions.push('Sunčan pozdrav');
    }

    return ambientWeatherOptions;
}

export function farmDashboardGreeting(
    displayName: string,
    date: Date,
    weather?: FarmGreetingWeather | null,
) {
    const weatherOptions = weatherGreetingOptions(date, weather);
    const options =
        weatherOptions.length > 0 ? weatherOptions : timeGreetingOptions(date);
    const greeting =
        options[dailyIndex(options, displayName, date)] ?? 'Dobrodošli';

    return `${greeting}, ${displayName}!`;
}
