import type { DefaultService } from './types';

export const defaultServices: DefaultService[] = [
    {
        id: 'www',
        name: 'Web stranica',
        url: 'https://www.gredice.com/',
    },
    {
        id: 'garden',
        name: 'Vrt',
        url: 'https://vrt.gredice.com/',
    },
    {
        id: 'farm',
        name: 'Farma',
        url: 'https://farma.gredice.com/',
    },
    {
        id: 'app',
        name: 'Administracija',
        url: 'https://app.gredice.com/',
    },
    {
        id: 'storybook',
        name: 'Storybook',
        url: 'https://storybook.gredice.com/',
    },
    {
        id: 'api',
        name: 'API',
        url: 'https://api.gredice.com/',
    },
];
