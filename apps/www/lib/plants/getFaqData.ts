import { directoriesClient } from '@gredice/client';
import { cache } from 'react';
import { mergeQualityHarvestSafetyFaqEntries } from './qualityHarvestSafetyFaq';

export const getFaqData = cache(async () => {
    try {
        const { data, error } = await directoriesClient().GET('/entities/faq');

        if (error) {
            console.error('Failed to fetch faq data', error);
            return [];
        }

        return mergeQualityHarvestSafetyFaqEntries(data ?? []);
    } catch (error) {
        console.error('Failed to fetch faq data', error);
        return mergeQualityHarvestSafetyFaqEntries([]);
    }
});
