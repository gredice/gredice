import 'server-only';

import { getCmsPages, getPublicGardens } from '@gredice/storage';
import { getRegionalCalendarData } from '../plants/getRegionalCalendarData';
import { getDirectoryEntitiesData } from '../server/getDirectoryEntitiesData';
import { collectSitemapSourcePaths } from './sitemapSourcePaths';

export async function getSitemapSourcePaths() {
    const [cmsPages, publicGardens, seeds, brands, regionalCalendar] =
        await Promise.all([
            getCmsPages({ state: 'published' }),
            getPublicGardens(),
            getDirectoryEntitiesData('seed'),
            getDirectoryEntitiesData('brand'),
            getRegionalCalendarData(),
        ]);

    return collectSitemapSourcePaths({
        cmsPages,
        publicGardens,
        seeds,
        brands,
        regionalCalendarReady: regionalCalendar.ready,
    });
}
