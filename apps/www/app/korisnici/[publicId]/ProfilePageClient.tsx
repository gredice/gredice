'use client';

import { Link } from '@gredice/ui/Link';
import { Stack } from '@gredice/ui/Stack';
import { UserAchievementProgress, UserAvatar } from '@gredice/ui/UserAvatar';
import { useQuery } from '@tanstack/react-query';
import { KnownPages } from '../../../src/KnownPages';
import { formatGardenDate } from '../../vrtovi/publicGardenFormatting';
import { PublicProfileAchievements } from './PublicProfileAchievements';
import { PublicProfileGardens } from './PublicProfileGardens';
import { formatProfileMembership } from './profileMembership';
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
    const membership = formatProfileMembership(user.createdAt);

    return (
        <Stack spacing={12} className="pt-8 pb-12 sm:pt-12">
            <Link
                href="/korisnici"
                className="text-sm text-muted-foreground hover:underline"
            >
                Svi vrtlari
            </Link>
            <header className="flex items-center gap-4">
                <UserAvatar
                    avatarUrl={user.avatarUrl}
                    achievementCount={user.achievementCount}
                    displayName={user.displayName}
                    size="lg"
                    className="size-16 border-2 border-tertiary text-2xl sm:size-20"
                />
                <div className="min-w-0">
                    <h1 className="text-3xl font-semibold break-words">
                        {user.displayName}
                    </h1>
                    <UserAchievementProgress
                        achievementCount={user.achievementCount}
                    />
                    <Link
                        href={KnownPages.Experience}
                        className="mt-2 inline-block text-xs underline underline-offset-4"
                    >
                        Kako funkcioniraju XP i razine?
                    </Link>
                    {membership && (
                        <p className="mt-2 text-sm text-muted-foreground">
                            <time
                                dateTime={user.createdAt}
                                title={`Pridružio se ${formatGardenDate(user.createdAt)}`}
                            >
                                {membership}
                            </time>
                        </p>
                    )}
                </div>
            </header>
            <PublicProfileAchievements achievements={achievements} />
            <PublicProfileGardens key={publicId} gardens={gardens} />
        </Stack>
    );
}
