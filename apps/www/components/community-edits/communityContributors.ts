/** A gardener whose accepted suggestion changed a public page. */
export type CommunityContributorView = {
    publicId: string;
    displayName: string;
    avatarUrl: string | null;
    /** ISO timestamp of their latest accepted edit in this list. */
    lastEditedAt: string;
    editCount: number;
};

export type CommunityEntityContributorsView = {
    /** Whole page, latest editor first, one row per gardener. */
    contributors: CommunityContributorView[];
    /** Keyed by community-edit section key, latest editor first. */
    sections: Record<string, CommunityContributorView[]>;
    lastEditedAt: string | null;
};

export const emptyCommunityEntityContributors: CommunityEntityContributorsView =
    {
        contributors: [],
        sections: {},
        lastEditedAt: null,
    };
