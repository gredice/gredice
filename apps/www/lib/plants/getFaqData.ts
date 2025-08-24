import { directoriesClient } from '@gredice/client';
import { unstable_cache } from 'next/cache';

export const getFaqData = unstable_cache(
    async () => {
        return (await directoriesClient().GET('/entities/faq')).data;
    },
    ['faqData'],
    {
        revalidate: 60 * 60, // 1 hour
        tags: ['faqData'],
    },
);

export type FaqData = NonNullable<
    Awaited<ReturnType<typeof getFaqData>>
>[number];
