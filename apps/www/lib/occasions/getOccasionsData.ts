import { directoriesClient } from '@gredice/client';
import { unstable_cache } from 'next/cache';

export const getOccasionsData = unstable_cache(
    async () => {
        return (await directoriesClient().GET('/entities/occasions')).data;
    },
    ['occasionsData'],
    {
        revalidate: 60 * 60, // 1 hour
        tags: ['occasionsData'],
    },
);
