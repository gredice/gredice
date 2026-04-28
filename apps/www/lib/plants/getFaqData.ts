import { directoriesClient } from '@gredice/client';

export async function getFaqData() {
    'use cache';

    try {
        const { data, error } = await directoriesClient().GET('/entities/faq');

        if (error) {
            console.error('Failed to fetch faq data', error);
            return [];
        }

        return data ?? [];
    } catch (error) {
        console.error('Failed to fetch faq data', error);
        return [];
    }
}
