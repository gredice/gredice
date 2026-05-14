import { directoriesClient } from '@gredice/client';
import { cache } from 'react';

export const getOccasionsData = cache(async () => {
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
});
