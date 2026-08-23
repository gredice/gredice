import 'server-only';

import { getCmsPages, getPublicGardens } from '@gredice/storage';
import { getDirectoryEntitiesData } from '../server/getDirectoryEntitiesData';
import { collectSitemapSourcePaths } from './sitemapSourcePaths';

export async function getSitemapSourcePaths() {
    const [cmsPages, publicGardens, seeds, brands] = await Promise.all([
        getCmsPages({ state: 'published' }),
        getPublicGardens(),
        getDirectoryEntitiesData('seed'),
        getDirectoryEntitiesData('brand'),
    ]);

    return collectSitemapSourcePaths({
        cmsPages,
        publicGardens,
        seeds,
        brands,
    });
}
