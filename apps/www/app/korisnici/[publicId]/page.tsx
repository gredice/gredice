import { getAchievementProgress } from '@gredice/js/achievements';
import { publicUserProfileHref } from '@gredice/ui/PublicChrome';
import type { Metadata } from 'next';
import { CtaBand } from '../../../components/shared/CtaBand';
import { createPublicMetadata } from '../../../lib/seo/publicMetadata';
import { KnownPages } from '../../../src/KnownPages';
import { PublicProfileView } from './PublicProfileView';
import { getPublicProfileForWww } from './publicProfileData';

// Rendered on the server for every visit. Without a loading boundary on this
// route the response waits for the profile, so visitors get the finished page
// and a missing profile answers with a real 404.
export const dynamic = 'force-dynamic';

type ProfilePageProps = {
    params: Promise<{
        publicId: string;
    }>;
};

export async function generateMetadata({
    params,
}: ProfilePageProps): Promise<Metadata> {
    const { publicId } = await params;
    const { user } = await getPublicProfileForWww(publicId);
    const { level } = getAchievementProgress(user.achievementCount);

    return createPublicMetadata({
        title: `${user.displayName}: vrtlarski profil`,
        description: `${user.displayName} vrtlari u Gredicama. Pogledaj razinu ${level}, osvojena postignuća i javne vrtove koje možeš razgledati.`,
        path: publicUserProfileHref(user.publicId),
        eyebrow: 'Vrtlari',
    });
}

export default async function ProfilePage({ params }: ProfilePageProps) {
    const { publicId } = await params;

    return (
        <>
            <PublicProfileView
                profile={await getPublicProfileForWww(publicId)}
            />
            <CtaBand
                id="profile-cta-title"
                title="Zasadi i ti svoj vrt."
                description="Složi svoju gredicu u aplikaciji, skupljaj postignuća i pokaži svoj vrt drugim vrtlarima."
                secondaryAction={{
                    href: KnownPages.Users,
                    label: 'Upoznaj druge vrtlare',
                }}
                className="mb-12"
            />
        </>
    );
}
