type Weather = {
    snowy: number;
    rainy: number;
    foggy: number;
    cloudy: number;
    thundery: number;
};

export function populateWeatherFromSymbol(symbol: number): Weather {
    const weather: Weather = {
        snowy: 0,
        rainy: 0,
        foggy: 0,
        cloudy: 0,
        thundery: 0,
    };

    switch (symbol) {
        case 1: // Sunny
            break;
        case 2: // SunnyLightClouds
            weather.cloudy = 0.2;
            break;
        case 3: // SunnyMediumClouds
            weather.cloudy = 0.4;
            break;
        case 4: // SunnyHeavyClouds
            weather.cloudy = 0.6;
            break;
        case 5: // CloudyLight
            weather.cloudy = 0.33;
            break;
        case 6: // CloudyMedium
            weather.cloudy = 0.66;
            break;
        case 7: // SunnyMediumCloudsAndFoggy
            weather.cloudy = 0.66;
            weather.foggy = 0.66;
            break;
        case 8: // SunnyAndFoggy
            weather.foggy = 1;
            break;
        case 9: // SunnyLightCloudsAndFoggy
            weather.cloudy = 0.33;
            weather.foggy = 0.66;
            break;
        case 10: // Foggy
            weather.foggy = 1;
            break;
        case 11: // CloudyMediumAndFoggy
            weather.cloudy = 0.66;
            weather.foggy = 0.66;
            break;
        case 12: // SunnyMediumCloudsAndLightRain
            weather.cloudy = 0.66;
            weather.rainy = 0.33;
            break;
        case 13: // SunnyMediumCloudsAndMediumRain
            weather.cloudy = 0.66;
            weather.rainy = 0.66;
            break;
        case 14: // SunnyMediumCloudsAndHeavyRain
            weather.cloudy = 0.66;
            weather.rainy = 1;
            break;
        case 15: // SunnyMediumCloudsAndThunder
            weather.cloudy = 0.66;
            weather.thundery = 1;
            break;
        case 16: // SunnyMediumCloudsThunderAndLightRain
            weather.cloudy = 0.66;
            weather.thundery = 1;
            weather.rainy = 0.33;
            break;
        case 17: // SunnyMediumCloudsThunderAndMediumRain
            weather.cloudy = 0.66;
            weather.thundery = 1;
            weather.rainy = 0.66;
            break;
        case 18: // SunnyMediumCloudsThunderAndHeavyRain
            weather.cloudy = 0.66;
            weather.thundery = 1;
            weather.rainy = 1;
            break;
        case 19: // SunnyMediumCloudsLightSnowyRain
            weather.cloudy = 0.66;
            weather.snowy = 0.33;
            weather.rainy = 0.33;
            break;
        case 20: // SunnyMediumCloudsMediumSnowyRain
            weather.cloudy = 0.66;
            weather.snowy = 0.66;
            weather.rainy = 0.66;
            break;
        case 21: // SunnyMediumCloudsHeavySnowyRain
            weather.cloudy = 0.66;
            weather.snowy = 1;
            weather.rainy = 1;
            break;
        case 22: // SunnyMediumCloudsLightSnow
            weather.cloudy = 0.66;
            weather.snowy = 0.33;
            break;
        case 23: // SunnyMediumCloudsMediumSnow
            weather.cloudy = 0.66;
            weather.snowy = 0.66;
            break;
        case 24: // SunnyMediumCloudsHeavySnow
            weather.cloudy = 0.66;
            weather.snowy = 1;
            break;
        case 25: // SunnyMediumCloudsLightSnowAndThunder
            weather.cloudy = 0.66;
            weather.snowy = 0.33;
            weather.thundery = 1;
            break;
        case 26: // CloudyLightRain
            weather.cloudy = 1;
            weather.rainy = 0.33;
            break;
        case 27: // CloudyMediumRain
            weather.cloudy = 1;
            weather.rainy = 0.66;
            break;
        case 28: // CloudyHeavyRain
            weather.cloudy = 1;
            weather.rainy = 1;
            break;
        case 29: // CloudyWithThunder
            weather.cloudy = 1;
            weather.thundery = 1;
            break;
        case 30: // CloudyLightRainWithThunder
            weather.cloudy = 1;
            weather.rainy = 0.33;
            weather.thundery = 1;
            break;
        case 31: // CloudyMediumRainWithThunder
            weather.cloudy = 1;
            weather.rainy = 0.66;
            weather.thundery = 1;
            break;
        case 32: // CloudyHeavyRainWithThunder
            weather.cloudy = 1;
            weather.rainy = 1;
            weather.thundery = 1;
            break;
        case 33: // CloudyLightSnowyRain
            weather.cloudy = 1;
            weather.snowy = 0.33;
            weather.rainy = 0.33;
            break;
        case 34: // CloudyMediumSnowyRain
            weather.cloudy = 1;
            weather.snowy = 0.66;
            weather.rainy = 0.66;
            break;
        case 35: // CloudyHeavySnowyRain
            weather.cloudy = 1;
            weather.snowy = 1;
            weather.rainy = 1;
            break;
        case 36: // CloudyLightSnow
            weather.cloudy = 1;
            weather.snowy = 0.33;
            break;
        case 37: // CloudyMediumSnow
            weather.cloudy = 1;
            weather.snowy = 0.66;
            break;
        case 38: // CloudyHeavySnow
            weather.cloudy = 1;
            weather.snowy = 1;
            break;
        case 39: // SunnyMediumCloudsLightRainAndFoggy
            weather.cloudy = 0.66;
            weather.rainy = 0.33;
            weather.foggy = 0.66;
            break;
        case 40: // SunnyMediumCloudsLightSnowAndFoggy
            weather.cloudy = 0.66;
            weather.snowy = 0.33;
            weather.foggy = 0.66;
            break;
        case 41: // CloudyLightSnowAndFoggy
            weather.cloudy = 1;
            weather.snowy = 0.33;
            weather.foggy = 0.66;
            break;
        case 42: // CloudyLightRainAndFoggy
            weather.cloudy = 1;
            weather.rainy = 0.33;
            weather.foggy = 0.66;
            break;
    }

    return weather;
}
