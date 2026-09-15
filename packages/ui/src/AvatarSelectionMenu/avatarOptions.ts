import { builtInAvatars } from '../Avatar/avatarCatalog';

export { avatarCategories as AVATAR_CATEGORIES } from '../Avatar/avatarCatalog';

export const AVATAR_OPTIONS = builtInAvatars.map(
    ({ id, label, category, avatarUrl }) => ({
        id,
        label,
        category,
        avatarUrl,
    }),
);

export type AvatarOption = (typeof AVATAR_OPTIONS)[number];
