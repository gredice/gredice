import { farmerAvatarUrls } from '../Avatar/farmerAvatarSources';

export type AvatarOption = {
    label: string;
    avatarUrl: string | null;
};

export const AVATAR_OPTIONS: readonly AvatarOption[] = [
    {
        label: 'Farmer',
        avatarUrl: farmerAvatarUrls.male,
    },
    {
        label: 'Farmerka',
        avatarUrl: farmerAvatarUrls.female,
    },
];
