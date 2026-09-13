import { clientPublic } from '@gredice/client';
import { getAchievementFamilies } from '@gredice/js/achievements';

export async function getPublicProfile(publicId: string) {
    const response = await clientPublic().api.users.public[
        ':publicId'
    ].profile.$get({ param: { publicId } });
    if (!response.ok) {
        throw new Error('Profil nije pronađen.');
    }
    return response.json();
}

export function getTopPublicAchievements(
    achievements: Pick<
        Awaited<ReturnType<typeof getPublicProfile>>['achievements'][number],
        'key' | 'status'
    >[],
) {
    return getAchievementFamilies(achievements).flatMap((family) =>
        family.highestApproved ? [family.highestApproved.definition] : [],
    );
}
