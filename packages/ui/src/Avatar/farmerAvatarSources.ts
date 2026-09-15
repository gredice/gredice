import { builtInAvatars } from './avatarCatalog';

export { farmerAvatarUrls } from './avatarCatalog';

const artworkByUrl = new Map(
    builtInAvatars.map(({ avatarUrl, artwork }) => [avatarUrl, artwork]),
);

/** Resolve built-in avatars locally while preserving custom image URLs. */
export function resolveAvatarSource(source: string) {
    const artwork = artworkByUrl.get(source);

    // Next.js imports image metadata; Storybook and component tests import URLs.
    return artwork
        ? typeof artwork === 'string'
            ? artwork
            : artwork.src
        : source;
}
