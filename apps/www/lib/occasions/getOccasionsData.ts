import { directoriesClient } from '@gredice/client';
import { unstable_cache } from 'next/cache';

export const getOccasionsData = unstable_cache(
    async () => {
        try {
            const { data, error } = await directoriesClient().GET(
                '/entities/occasions',
            );

            if (error) {
                console.error('Failed to fetch occasions data', error);
                return [];
            }

            return data ?? [];
        } catch (error) {
            console.error('Failed to fetch occasions data', error);
            return [];
        }
    },
    ['occasionsData'],
    {
        revalidate: 60 * 60, // 1 hour
        tags: ['occasionsData'],
    },
);
