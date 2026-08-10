import { cache } from 'react';
import { getDirectoryEntitiesData } from '../server/getDirectoryEntitiesData';
import { mergeQualityHarvestSafetyFaqEntries } from './qualityHarvestSafetyFaq';

export const getFaqData = cache(async () => {
    const data = await getDirectoryEntitiesData('faq');
    return mergeQualityHarvestSafetyFaqEntries(data);
});
