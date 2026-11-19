import type { CommunityContributorView } from '@apps/www/components/community-edits/communityContributors';

const names = [
    'Ana Kovač',
    'Marko Marić',
    'Petra Horvat',
    'Luka Babić',
    'Iva Novak',
    'Ivan Jurić',
    'Maja Perić',
];

/** Newest editor first, the order storage returns. */
export const storyContributors: CommunityContributorView[] = names.map(
    (displayName, index) => ({
        publicId: `u_story-${index}`,
        displayName,
        avatarUrl: null,
        lastEditedAt: `2026-11-${String(12 - index).padStart(2, '0')}T10:00:00.000Z`,
        editCount: index === 0 ? 4 : 1,
    }),
);
