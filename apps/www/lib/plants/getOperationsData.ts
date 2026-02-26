import { directoriesClient } from '@gredice/client';
import { unstable_cache } from 'next/cache';

export const getOperationsData = unstable_cache(
    async () => {
        try {
            const { data, error } = await directoriesClient().GET(
                '/entities/operation',
            );

            if (error) {
                console.error('Failed to fetch operations data', error);
                return [];
            }

            return data ?? [];
        } catch (error) {
            console.error('Failed to fetch operations data', error);
            return [];
        }
    },
    ['operationsData'],
    {
        revalidate: 60 * 60, // 1 hour
        tags: ['operationsData'],
    },
);
