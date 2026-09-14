import type { WeatherDefinition } from './weatherComposition';

/** Stable provider condition IDs; day/night variants share these semantics. */
export const weatherDefinitions = {
    '1': {
        name: 'Sunny',
        label: 'Vedro',
        sky: 'clear',
    },
    '2': {
        name: 'SunnyLightClouds',
        label: 'Malo oblačno',
        sky: 'few',
    },
    '3': {
        name: 'SunnyMediumClouds',
        label: 'Djelomično oblačno',
        sky: 'partly',
    },
    '4': {
        name: 'SunnyHeavyClouds',
        label: 'Pretežno oblačno',
        sky: 'mostly',
    },
    '5': {
        name: 'CloudyLight',
        label: 'Oblačno',
        sky: 'cloudy',
    },
    '6': {
        name: 'CloudyMedium',
        label: 'Potpuno oblačno',
        sky: 'overcast',
    },
    '7': {
        name: 'SunnyMediumCloudsAndFoggy',
        label: 'Djelomično oblačno, magla',
        sky: 'partly',
        fog: true,
    },
    '8': {
        name: 'SunnyAndFoggy',
        label: 'Vedro, magla',
        sky: 'clear',
        fog: true,
    },
    '9': {
        name: 'SunnyLightCloudsAndFoggy',
        label: 'Malo oblačno, magla',
        sky: 'few',
        fog: true,
    },
    '10': {
        name: 'Foggy',
        label: 'Maglovito',
        sky: 'fog',
        fog: true,
    },
    '11': {
        name: 'CloudyMediumAndFoggy',
        label: 'Potpuno oblačno, magla',
        sky: 'overcast',
        fog: true,
    },
    '12': {
        name: 'SunnyMediumCloudsAndLightRain',
        label: 'Djelomično oblačno, slaba kiša',
        sky: 'partly',
        precipitation: {
            kind: 'rain',
            intensity: 1,
        },
    },
    '13': {
        name: 'SunnyMediumCloudsAndMediumRain',
        label: 'Djelomično oblačno, umjerena kiša',
        sky: 'partly',
        precipitation: {
            kind: 'rain',
            intensity: 2,
        },
    },
    '14': {
        name: 'SunnyMediumCloudsAndHeavyRain',
        label: 'Djelomično oblačno, jaka kiša',
        sky: 'partly',
        precipitation: {
            kind: 'rain',
            intensity: 3,
        },
    },
    '15': {
        name: 'SunnyMediumCloudsAndThunder',
        label: 'Djelomično oblačno, grmljavina',
        sky: 'partly',
        thunder: true,
    },
    '16': {
        name: 'SunnyMediumCloudsThunderAndLightRain',
        label: 'Djelomično oblačno, slaba kiša, grmljavina',
        sky: 'partly',
        precipitation: {
            kind: 'rain',
            intensity: 1,
        },
        thunder: true,
    },
    '17': {
        name: 'SunnyMediumCloudsThunderAndMediumRain',
        label: 'Djelomično oblačno, umjerena kiša, grmljavina',
        sky: 'partly',
        precipitation: {
            kind: 'rain',
            intensity: 2,
        },
        thunder: true,
    },
    '18': {
        name: 'SunnyMediumCloudsThunderAndHeavyRain',
        label: 'Djelomično oblačno, jaka kiša, grmljavina',
        sky: 'partly',
        precipitation: {
            kind: 'rain',
            intensity: 3,
        },
        thunder: true,
    },
    '19': {
        name: 'SunnyMediumCloudsLightSnowyRain',
        label: 'Djelomično oblačno, slaba susnježica',
        sky: 'partly',
        precipitation: {
            kind: 'sleet',
            intensity: 1,
        },
    },
    '20': {
        name: 'SunnyMediumCloudsMediumSnowyRain',
        label: 'Djelomično oblačno, umjerena susnježica',
        sky: 'partly',
        precipitation: {
            kind: 'sleet',
            intensity: 2,
        },
    },
    '21': {
        name: 'SunnyMediumCloudsHeavySnowyRain',
        label: 'Djelomično oblačno, jaka susnježica',
        sky: 'partly',
        precipitation: {
            kind: 'sleet',
            intensity: 3,
        },
    },
    '22': {
        name: 'SunnyMediumCloudsLightSnow',
        label: 'Djelomično oblačno, slab snijeg',
        sky: 'partly',
        precipitation: {
            kind: 'snow',
            intensity: 1,
        },
    },
    '23': {
        name: 'SunnyMediumCloudsMediumSnow',
        label: 'Djelomično oblačno, umjeren snijeg',
        sky: 'partly',
        precipitation: {
            kind: 'snow',
            intensity: 2,
        },
    },
    '24': {
        name: 'SunnyMediumCloudsHeavySnow',
        label: 'Djelomično oblačno, jak snijeg',
        sky: 'partly',
        precipitation: {
            kind: 'snow',
            intensity: 3,
        },
    },
    '25': {
        name: 'SunnyMediumCloudsLightSnowAndThunder',
        label: 'Djelomično oblačno, slab snijeg, grmljavina',
        sky: 'partly',
        precipitation: {
            kind: 'snow',
            intensity: 1,
        },
        thunder: true,
    },
    '26': {
        name: 'CloudyLightRain',
        label: 'Potpuno oblačno, slaba kiša',
        sky: 'overcast',
        precipitation: {
            kind: 'rain',
            intensity: 1,
        },
    },
    '27': {
        name: 'CloudyMediumRain',
        label: 'Potpuno oblačno, umjerena kiša',
        sky: 'overcast',
        precipitation: {
            kind: 'rain',
            intensity: 2,
        },
    },
    '28': {
        name: 'CloudyHeavyRain',
        label: 'Potpuno oblačno, jaka kiša',
        sky: 'overcast',
        precipitation: {
            kind: 'rain',
            intensity: 3,
        },
    },
    '29': {
        name: 'CloudyWithThunder',
        label: 'Potpuno oblačno, grmljavina',
        sky: 'overcast',
        thunder: true,
    },
    '30': {
        name: 'CloudyLightRainWithThunder',
        label: 'Potpuno oblačno, slaba kiša, grmljavina',
        sky: 'overcast',
        precipitation: {
            kind: 'rain',
            intensity: 1,
        },
        thunder: true,
    },
    '31': {
        name: 'CloudyMediumRainWithThunder',
        label: 'Potpuno oblačno, umjerena kiša, grmljavina',
        sky: 'overcast',
        precipitation: {
            kind: 'rain',
            intensity: 2,
        },
        thunder: true,
    },
    '32': {
        name: 'CloudyHeavyRainWithThunder',
        label: 'Potpuno oblačno, jaka kiša, grmljavina',
        sky: 'overcast',
        precipitation: {
            kind: 'rain',
            intensity: 3,
        },
        thunder: true,
    },
    '33': {
        name: 'CloudyLightSnowyRain',
        label: 'Potpuno oblačno, slaba susnježica',
        sky: 'overcast',
        precipitation: {
            kind: 'sleet',
            intensity: 1,
        },
    },
    '34': {
        name: 'CloudyMediumSnowyRain',
        label: 'Potpuno oblačno, umjerena susnježica',
        sky: 'overcast',
        precipitation: {
            kind: 'sleet',
            intensity: 2,
        },
    },
    '35': {
        name: 'CloudyHeavySnowyRain',
        label: 'Potpuno oblačno, jaka susnježica',
        sky: 'overcast',
        precipitation: {
            kind: 'sleet',
            intensity: 3,
        },
    },
    '36': {
        name: 'CloudyLightSnow',
        label: 'Potpuno oblačno, slab snijeg',
        sky: 'overcast',
        precipitation: {
            kind: 'snow',
            intensity: 1,
        },
    },
    '37': {
        name: 'CloudyMediumSnow',
        label: 'Potpuno oblačno, umjeren snijeg',
        sky: 'overcast',
        precipitation: {
            kind: 'snow',
            intensity: 2,
        },
    },
    '38': {
        name: 'CloudyHeavySnow',
        label: 'Potpuno oblačno, jak snijeg',
        sky: 'overcast',
        precipitation: {
            kind: 'snow',
            intensity: 3,
        },
    },
    '39': {
        name: 'SunnyMediumCloudsLightRainAndFoggy',
        label: 'Djelomično oblačno, slaba kiša, magla',
        sky: 'partly',
        precipitation: {
            kind: 'rain',
            intensity: 1,
        },
        fog: true,
    },
    '40': {
        name: 'SunnyMediumCloudsLightSnowAndFoggy',
        label: 'Djelomično oblačno, slab snijeg, magla',
        sky: 'partly',
        precipitation: {
            kind: 'snow',
            intensity: 1,
        },
        fog: true,
    },
    '41': {
        name: 'CloudyLightSnowAndFoggy',
        label: 'Potpuno oblačno, slab snijeg, magla',
        sky: 'overcast',
        precipitation: {
            kind: 'snow',
            intensity: 1,
        },
        fog: true,
    },
    '42': {
        name: 'CloudyLightRainAndFoggy',
        label: 'Potpuno oblačno, slaba kiša, magla',
        sky: 'overcast',
        precipitation: {
            kind: 'rain',
            intensity: 1,
        },
        fog: true,
    },
} satisfies Record<number, WeatherDefinition>;
