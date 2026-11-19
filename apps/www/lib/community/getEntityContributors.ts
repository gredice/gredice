import 'server-only';

import { userIdToPublicId } from '@gredice/js/publicId';
import { safeUserDisplayName } from '@gredice/js/userDisplayName';
import {
    type CommunityContributor,
    getCommunityEntityContributors,
} from '@gredice/storage';
import { cache } from 'react';
import {
    type CommunityContributorView,
    type CommunityEntityContributorsView,
    emptyCommunityEntityContributors,
} from '../../components/community-edits/communityContributors';

function toContributorView(
    contributor: CommunityContributor,
): CommunityContributorView[] {
    let publicId: string;
    try {
        publicId = userIdToPublicId(contributor.userId);
    } catch {
        // Legacy accounts without a UUID have no public profile to link to.
        return [];
    }

    return [
        {
            publicId,
            displayName: safeUserDisplayName(contributor.displayName),
            avatarUrl: contributor.avatarUrl,
            lastEditedAt: contributor.lastAppliedAt.toISOString(),
            editCount: contributor.editCount,
        },
    ];
}

/**
 * Gardeners whose accepted suggestions shaped a directory page, read straight
 * from storage so static generation does not depend on the public API.
 *
 * Credit is never worth a failed page: a storage problem logs and renders the
 * page without contributors.
 */
export const getEntityContributors = cache(
    async (entityId: number): Promise<CommunityEntityContributorsView> => {
        try {
            const result = await getCommunityEntityContributors(entityId);
            return {
                contributors: result.contributors.flatMap(toContributorView),
                sections: Object.fromEntries(
                    Object.entries(result.sections).map(
                        ([sectionKey, contributors]) => [
                            sectionKey,
                            contributors.flatMap(toContributorView),
                        ],
                    ),
                ),
                lastEditedAt: result.lastAppliedAt?.toISOString() ?? null,
            };
        } catch (error) {
            console.error('Failed to load community contributors', {
                entityId,
                error,
            });
            return emptyCommunityEntityContributors;
        }
    },
);
