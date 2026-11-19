/**
 * Readers for the community-contribution fields of the public user API.
 *
 * WWW and the API deploy separately, so a page can meet a response from before
 * these fields existed. Anything missing or malformed reads as "nothing to
 * show" instead of failing the page.
 */

export type PublicProfileContributionPage = {
    title: string;
    /** Section or kind of the accepted suggestion, e.g. "Sijanje". */
    context: string | null;
    publicPath: string;
    appliedAt: string;
};

export type PublicProfileContributions = {
    acceptedCount: number;
    pages: PublicProfileContributionPage[];
};

export type LeaderboardEditor = {
    publicId: string;
    displayName: string;
    avatarUrl: string | null;
    achievementCount: number;
    acceptedEditCount: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isCount(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/** Only same-site paths become links; anything else is dropped. */
function isPublicPath(value: unknown): value is string {
    return (
        typeof value === 'string' &&
        value.startsWith('/') &&
        !value.startsWith('//') &&
        !value.includes('\\')
    );
}

function readContributionPage(value: unknown): PublicProfileContributionPage[] {
    if (
        !isRecord(value) ||
        typeof value.title !== 'string' ||
        value.title.trim().length === 0 ||
        !isPublicPath(value.publicPath) ||
        typeof value.appliedAt !== 'string'
    ) {
        return [];
    }

    return [
        {
            title: value.title.trim(),
            context:
                typeof value.context === 'string' &&
                value.context.trim().length > 0
                    ? value.context.trim()
                    : null,
            publicPath: value.publicPath,
            appliedAt: value.appliedAt,
        },
    ];
}

/** `null` when the profile response carries no usable `contributions`. */
export function readPublicProfileContributions(
    profile: unknown,
): PublicProfileContributions | null {
    const contributions = isRecord(profile) ? profile.contributions : null;
    if (!isRecord(contributions) || !isCount(contributions.acceptedCount)) {
        return null;
    }

    return {
        acceptedCount: contributions.acceptedCount,
        pages: Array.isArray(contributions.pages)
            ? contributions.pages.flatMap(readContributionPage)
            : [],
    };
}

function readLeaderboardEditor(value: unknown): LeaderboardEditor[] {
    if (
        !isRecord(value) ||
        typeof value.publicId !== 'string' ||
        value.publicId.length === 0 ||
        typeof value.displayName !== 'string' ||
        !isCount(value.acceptedEditCount) ||
        value.acceptedEditCount === 0
    ) {
        return [];
    }

    return [
        {
            publicId: value.publicId,
            displayName: value.displayName,
            avatarUrl:
                typeof value.avatarUrl === 'string' ? value.avatarUrl : null,
            achievementCount: isCount(value.achievementCount)
                ? value.achievementCount
                : 0,
            acceptedEditCount: value.acceptedEditCount,
        },
    ];
}

/** Empty when the leaderboard response carries no usable `editors`. */
export function readLeaderboardEditors(leaderboard: unknown) {
    const editors = isRecord(leaderboard) ? leaderboard.editors : null;
    return Array.isArray(editors) ? editors.flatMap(readLeaderboardEditor) : [];
}
