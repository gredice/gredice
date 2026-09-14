/// <reference types="next/image-types/global" />

import femaleArtwork from './assets/farmer-female.webp';
import maleArtwork from './assets/farmer-male.webp';

// These URLs are persisted in user profiles. Keep them stable across artwork updates.
export const farmerAvatarUrls = {
    male: 'https://cdn.gredice.com/avatars/farmer-male.png',
    female: 'https://cdn.gredice.com/avatars/farmer-female.png',
};

/** Resolve built-in avatars locally while preserving custom image URLs. */
export function resolveAvatarSource(source: string) {
    const artwork =
        source === farmerAvatarUrls.male
            ? maleArtwork
            : source === farmerAvatarUrls.female
              ? femaleArtwork
              : undefined;

    // Next.js imports image metadata; Storybook and component tests import URLs.
    return artwork
        ? typeof artwork === 'string'
            ? artwork
            : artwork.src
        : source;
}
