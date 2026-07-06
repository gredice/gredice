import { blockGeometryMergingFlag } from '../../flags';
import { ProfilePageClient } from './ProfilePageClient';

type ProfilePageProps = {
    params: Promise<{
        publicId: string;
    }>;
};

export default async function ProfilePage({ params }: ProfilePageProps) {
    const [{ publicId }, enableBlockGeometryMerging] = await Promise.all([
        params,
        blockGeometryMergingFlag(),
    ]);

    return (
        <ProfilePageClient
            enableBlockGeometryMerging={enableBlockGeometryMerging}
            publicId={publicId}
        />
    );
}
