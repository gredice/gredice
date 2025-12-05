'use server';

import 'server-only';

import { client } from '@gredice/client';

export const newsletterSubscribe = async (
    _previousState: unknown,
    formData: FormData,
) => {
    const email = formData.get('email') as string;

    const response = await client().api.newsletter.subscribe.$post({
        json: { email, source: 'www' },
    });

    if (!response.ok) {
        console.error(
            'Newsletter subscribe failed with status',
            response.status,
        );
        return { error: true };
    }

    return { success: true };
};
