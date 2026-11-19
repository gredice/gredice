import { PublicBreadcrumbs } from '../../../components/shared/seo/PublicBreadcrumbs';
import { KnownPages } from '../../../src/KnownPages';
import { PublicProfileAchievements } from './PublicProfileAchievements';
import { PublicProfileContributions } from './PublicProfileContributions';
import { PublicProfileGardens } from './PublicProfileGardens';
import { PublicProfileHeader } from './PublicProfileHeader';
import type { PublicProfileData } from './publicProfileData';

export function PublicProfileView({ profile }: { profile: PublicProfileData }) {
    return (
        <div className="space-y-10 py-8 sm:space-y-12 sm:py-12">
            <div className="space-y-6">
                <PublicBreadcrumbs
                    items={[
                        { label: 'Vrtlari', href: KnownPages.Users },
                        { label: profile.user.displayName },
                    ]}
                />
                <PublicProfileHeader {...profile} />
            </div>
            <PublicProfileAchievements achievements={profile.achievements} />
            <PublicProfileContributions contributions={profile.contributions} />
            <PublicProfileGardens
                key={profile.user.publicId}
                gardens={profile.gardens}
            />
        </div>
    );
}
