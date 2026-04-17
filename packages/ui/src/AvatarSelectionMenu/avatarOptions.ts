export type AvatarOption = {
    label: string;
    avatarUrl: string | null;
};

export const AVATAR_OPTIONS: readonly AvatarOption[] = [
    {
        label: 'Farmer',
        avatarUrl: 'https://cdn.gredice.com/avatars/farmer-male.png',
    },
    {
        label: 'Farmerka',
        avatarUrl: 'https://cdn.gredice.com/avatars/farmer-female.png',
    },
];
