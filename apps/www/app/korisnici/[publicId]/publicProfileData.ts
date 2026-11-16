import { clientPublic } from '@gredice/client';
import { publicIdToUserId } from '@gredice/js/publicId';
import { notFound } from 'next/navigation';
import { cache } from 'react';

/**
 * Loads a public profile for the page and its metadata with one API request.
 * Profiles are never cached: a renamed gardener or a garden that is no longer
 * public must disappear with the next visit.
 */
export const getPublicProfileForWww = cache(async (publicId: string) => {
    // Only well-formed IDs reach the API, so a crafted segment cannot be
    // resolved against another API path.
    if (!publicIdToUserId(publicId)) {
        notFound();
    }

    const response = await clientPublic().api.users.public[
        ':publicId'
    ].profile.$get(
        { param: { publicId } },
        { init: { cache: 'no-store', signal: AbortSignal.timeout(10_000) } },
    );
    if (response.status === 404) {
        notFound();
    }
    if (!response.ok) {
        throw new Error('Profil trenutačno nije dostupan.');
    }

    return response.json();
});

export type PublicProfileData = Awaited<
    ReturnType<typeof getPublicProfileForWww>
>;
