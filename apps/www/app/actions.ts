'use server';

import 'server-only';

export const preSeasonNewsletterSubscribe = async (
    _previousState: unknown,
    formData: FormData,
) => {
    const email = formData.get('email') as string;

    if (!email) {
        return { error: true };
    }

    const isDev =
        process.env.NEXT_PUBLIC_VERCEL_ENV === 'development' ||
        process.env.NODE_ENV !== 'production';
    const baseUrl = isDev
        ? 'https://api.gredice.local'
        : 'https://api.gredice.com';

    try {
        const response = await fetch(`${baseUrl}/api/newsletter/subscribe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, source: 'landing-page' }),
            cache: 'no-store',
        });

        if (!response.ok) {
            console.error(
                'Pre-season newsletter subscribe failed with status',
                response.status,
            );
            return { error: true };
        }
    } catch (error) {
        console.error('Pre-season newsletter subscribe failed', error);
        return { error: true };
    }

    return { success: true };
};
