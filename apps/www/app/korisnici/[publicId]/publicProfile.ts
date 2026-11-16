import { getAchievementFamilies } from '@gredice/js/achievements';
import { publicIdToUserId, userIdToPublicId } from '@gredice/js/publicId';
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

/**
 * Accepts only the canonical form of a public user ID. Base64url decoding is
 * lenient, so a malformed segment can still decode to a user ID; re-encoding
 * keeps every profile at exactly one URL.
 */
export function isCanonicalPublicUserId(publicId: string) {
    const userId = publicIdToUserId(publicId);
    return userId !== null && userIdToPublicId(userId) === publicId;
}
