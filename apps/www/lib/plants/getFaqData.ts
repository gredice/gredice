import { directoriesClient } from '@gredice/client';
import { unstable_cache } from 'next/cache';

export const getFaqData = unstable_cache(
    async () => {
        try {
            const { data, error } =
                await directoriesClient().GET('/entities/faq');

            if (error) {
                console.error('Failed to fetch faq data', error);
                return [];
            }

            return data ?? [];
        } catch (error) {
            console.error('Failed to fetch faq data', error);
            return [];
        }
    },
    ['faqData'],
    {
        revalidate: 60 * 60, // 1 hour
        tags: ['faqData'],
    },
);
