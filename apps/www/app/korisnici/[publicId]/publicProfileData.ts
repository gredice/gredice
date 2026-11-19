import { clientPublic } from '@gredice/client';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import {
    type PublicProfileContributions,
    readPublicProfileContributions,
} from '../communityContributions';
import { isCanonicalPublicUserId } from './publicProfile';

async function fetchPublicProfile(publicId: string) {
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
}

export type PublicProfileData = Omit<
    Awaited<ReturnType<typeof fetchPublicProfile>>,
    'contributions'
> & {
    /**
     * Accepted content suggestions. Missing or `null` when the API did not
     * report them, for example while WWW is ahead of an API deployment.
     */
    contributions?: PublicProfileContributions | null;
};

/**
 * Loads a public profile for the page and its metadata with one API request.
 * Profiles are never cached: a renamed gardener or a garden that is no longer
 * public must disappear with the next visit.
 */
export const getPublicProfileForWww = cache(
    async (publicId: string): Promise<PublicProfileData> => {
        // Only canonical IDs reach the API, so a crafted segment cannot be resolved
        // against another API path or serve one profile at several URLs.
        if (!isCanonicalPublicUserId(publicId)) {
            notFound();
        }

        const profile = await fetchPublicProfile(publicId);
        return {
            ...profile,
            contributions: readPublicProfileContributions(profile),
        };
    },
);
