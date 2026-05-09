import { ProfilePageClient } from './ProfilePageClient';

type ProfilePageProps = {
    params: Promise<{
        publicId: string;
    }>;
};

export default async function ProfilePage({ params }: ProfilePageProps) {
    const { publicId } = await params;

    return <ProfilePageClient publicId={publicId} />;
}
