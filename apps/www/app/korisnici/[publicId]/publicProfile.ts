import { getAchievementFamilies } from '@gredice/js/achievements';
import type { PublicProfileData } from './publicProfileData';

export function getTopPublicAchievements(
    achievements: Pick<
        PublicProfileData['achievements'][number],
        'key' | 'status'
    >[],
) {
    return getAchievementFamilies(achievements).flatMap((family) =>
        family.highestApproved ? [family.highestApproved.definition] : [],
    );
}
