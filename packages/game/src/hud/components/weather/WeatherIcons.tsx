import type { FC, SVGProps } from 'react';
import {
    CloudyLight,
    CloudyMedium,
    SunnyMediumCloudsAndFoggy,
} from './icons/CloudyIcons';
import {
    CloudyHeavyRain,
    CloudyHeavyRainWithThunder,
    CloudyHeavySnow,
    CloudyHeavySnowyRain,
    CloudyLightRain,
    CloudyLightRainAndFoggy,
    CloudyLightRainWithThunder,
    CloudyLightSnow,
    CloudyLightSnowAndFoggy,
    CloudyLightSnowyRain,
    CloudyMediumRain,
    CloudyMediumRainWithThunder,
    CloudyMediumSnow,
    CloudyMediumSnowyRain,
    CloudyWithThunder,
    SunnyMediumCloudsLightRainAndFoggy,
    SunnyMediumCloudsLightSnowAndFoggy,
} from './icons/CloudyWeatherIcons';
import {
    CloudyMediumAndFoggy,
    Foggy,
    SunnyAndFoggy,
    SunnyLightCloudsAndFoggy,
} from './icons/FoggyIcons';
import {
    SunnyMediumCloudsAndThunder,
    SunnyMediumCloudsHeavySnow,
    SunnyMediumCloudsHeavySnowyRain,
    SunnyMediumCloudsLightSnow,
    SunnyMediumCloudsLightSnowAndThunder,
    SunnyMediumCloudsLightSnowyRain,
    SunnyMediumCloudsMediumSnow,
    SunnyMediumCloudsMediumSnowyRain,
    SunnyMediumCloudsThunderAndHeavyRain,
    SunnyMediumCloudsThunderAndLightRain,
    SunnyMediumCloudsThunderAndMediumRain,
} from './icons/MixedWeatherIcons';
import {
    SunnyMediumCloudsAndHeavyRain,
    SunnyMediumCloudsAndLightRain,
    SunnyMediumCloudsAndMediumRain,
} from './icons/RainyIcons';
import {
    Sunny,
    SunnyHeavyClouds,
    SunnyLightClouds,
    SunnyMediumClouds,
} from './icons/SunnyIcons';

export const weatherIcons: Record<
    number,
    {
        day: FC<SVGProps<SVGSVGElement>>;
        night: FC<SVGProps<SVGSVGElement>>;
    }
> = {
    1: Sunny,
    2: SunnyLightClouds,
    3: SunnyMediumClouds,
    4: SunnyHeavyClouds,
    5: CloudyLight,
    6: CloudyMedium,
    7: SunnyMediumCloudsAndFoggy,
    8: SunnyAndFoggy,
    9: SunnyLightCloudsAndFoggy,
    10: Foggy,
    11: CloudyMediumAndFoggy,
    12: SunnyMediumCloudsAndLightRain,
    13: SunnyMediumCloudsAndMediumRain,
    14: SunnyMediumCloudsAndHeavyRain,
    15: SunnyMediumCloudsAndThunder,
    16: SunnyMediumCloudsThunderAndLightRain,
    17: SunnyMediumCloudsThunderAndMediumRain,
    18: SunnyMediumCloudsThunderAndHeavyRain,
    19: SunnyMediumCloudsLightSnowyRain,
    20: SunnyMediumCloudsMediumSnowyRain,
    21: SunnyMediumCloudsHeavySnowyRain,
    22: SunnyMediumCloudsLightSnow,
    23: SunnyMediumCloudsMediumSnow,
    24: SunnyMediumCloudsHeavySnow,
    25: SunnyMediumCloudsLightSnowAndThunder,
    26: CloudyLightRain,
    27: CloudyMediumRain,
    28: CloudyHeavyRain,
    29: CloudyWithThunder,
    30: CloudyLightRainWithThunder,
    31: CloudyMediumRainWithThunder,
    32: CloudyHeavyRainWithThunder,
    33: CloudyLightSnowyRain,
    34: CloudyMediumSnowyRain,
    35: CloudyHeavySnowyRain,
    36: CloudyLightSnow,
    37: CloudyMediumSnow,
    38: CloudyHeavySnow,
    39: SunnyMediumCloudsLightRainAndFoggy,
    40: SunnyMediumCloudsLightSnowAndFoggy,
    41: CloudyLightSnowAndFoggy,
    42: CloudyLightRainAndFoggy,
};

export type WeatherIconType = keyof typeof weatherIcons;
