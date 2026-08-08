import { directoriesClient } from '@gredice/client';
import { cache } from 'react';

export const getSeedsData = cache(async () => {
    try {
        const { data, error } = await directoriesClient().GET('/entities/seed');

        if (error) {
            console.error('Failed to fetch seeds data', error);
            return [];
        }

        return data ?? [];
    } catch (error) {
        console.error('Failed to fetch seeds data', error);
        return [];
    }
});
