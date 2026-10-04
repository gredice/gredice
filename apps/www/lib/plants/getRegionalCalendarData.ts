import 'server-only';

import { getCmsPages } from '@gredice/storage';
import { cache } from 'react';
import { getPlantSortsData } from './getPlantSortsData';
import { getPlantsData } from './getPlantsData';
import { buildRegionalCalendar } from './regionalCalendar';
import { regionalCalendarReviews } from './regionalCalendarReviews';

export const regionalCalendarRelatedGuides = [
    {
        slug: 'novosti/sto-sijati-i-saditi-u-rujnu',
        title: 'Što sijati i saditi u rujnu',
    },
    {
        slug: 'novosti/sto-sijati-i-saditi-u-listopadu',
        title: 'Što sijati i saditi u listopadu',
    },
    { slug: 'novosti/vrt-u-studenome', title: 'Vrt u studenome' },
    { slug: 'planovi-sadnje', title: 'Planovi sadnje' },
];

export const getRegionalCalendarData = cache(async () => {
    const [plants, sorts] = await Promise.all([
        getPlantsData(),
        getPlantSortsData(),
    ]);
    const today = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Europe/Zagreb',
    }).format(new Date());
    return buildRegionalCalendar(plants, sorts, regionalCalendarReviews, today);
});

export const getRegionalCalendarRelatedGuides = cache(async () => {
    const pages = await getCmsPages({ state: 'published' });
    return regionalCalendarRelatedGuides.filter((guide) =>
        pages.some(
            (page) =>
                page.slug === guide.slug &&
                page.publishedAt &&
                new Date(page.publishedAt).getTime() <= Date.now() &&
                !page.noIndex &&
                (!page.canonicalPath || page.canonicalPath === `/${page.slug}`),
        ),
    );
});
