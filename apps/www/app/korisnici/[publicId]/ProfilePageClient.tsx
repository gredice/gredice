'use client';

import { Stack } from '@gredice/ui/Stack';
import { useQuery } from '@tanstack/react-query';
import { PublicProfileAchievements } from './PublicProfileAchievements';
import { PublicProfileGardens } from './PublicProfileGardens';
import { getPublicProfile } from './publicProfile';

type ProfilePageClientProps = {
    publicId: string;
};

export function ProfilePageClient({ publicId }: ProfilePageClientProps) {
    const profileQuery = useQuery({
        queryKey: ['public-profile', publicId],
        queryFn: () => getPublicProfile(publicId),
    });

    if (profileQuery.isLoading) {
        return <p role="status">Učitavanje profila...</p>;
    }

    if (profileQuery.error || !profileQuery.data) {
        return <p>Traženi profil ne postoji ili nije javno dostupan.</p>;
    }

    const { user, gardens, achievements } = profileQuery.data;

    return (
        <Stack spacing={12} className="pb-12">
            <header>
                <h1 className="text-3xl font-semibold break-words">
                    {user.displayName}
                </h1>
            </header>
            <PublicProfileAchievements achievements={achievements} />
            <PublicProfileGardens key={publicId} gardens={gardens} />
        </Stack>
    );
}
