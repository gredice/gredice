import { directoriesClient } from '@gredice/client';

export async function getOccasionsData() {
    'use cache';

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
}
