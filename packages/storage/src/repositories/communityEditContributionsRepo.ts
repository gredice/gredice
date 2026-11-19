import 'server-only';
import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm';
import {
    communityEditRequestChanges,
    communityEditRequests,
    users,
} from '../schema';
import { storage } from '../storage';
import { userAchievementCount } from './userAchievementProgress';

/*
 * Public read models over accepted community edits.
 *
 * Only requests in status `applied` count as contributions. The contributor
 * and summary reads name their columns and stay away from `submitter_message`:
 * WWW renders them while it builds, which can happen before the API build has
 * run the migration that adds that column.
 */

export type CommunityContributor = {
    userId: string;
    displayName: string | null;
    avatarUrl: string | null;
    lastAppliedAt: Date;
    editCount: number;
};

export type CommunityEntityContributors = {
    /** Whole entity, latest edit first, one row per user. */
    contributors: CommunityContributor[];
    /** Keyed by section key, latest edit first, one row per user. */
    sections: Record<string, CommunityContributor[]>;
    lastAppliedAt: Date | null;
};

export type CommunityContributionPage = {
    requestId: number;
    entityTypeName: string;
    entityId: number;
    publicPath: string;
    sectionKey: string | null;
    appliedAt: Date;
};

const defaultContributionPageLimit = 6;
const maxContributionPageLimit = 24;
const defaultSubmitterRequestLimit = 50;
const maxSubmitterRequestLimit = 100;
const defaultEditorLeaderboardLimit = 5;
const maxEditorLeaderboardLimit = 25;

/** When an accepted edit went live; older rows may lack `applied_at`. */
const contributionAppliedAt = sql<Date>`coalesce(${communityEditRequests.appliedAt}, ${communityEditRequests.reviewedAt}, ${communityEditRequests.createdAt})`;

function resolveAppliedAt(request: {
    appliedAt: Date | null;
    reviewedAt: Date | null;
    createdAt: Date;
}) {
    return request.appliedAt ?? request.reviewedAt ?? request.createdAt;
}

function clampLimit(value: number | undefined, fallback: number, max: number) {
    if (value === undefined || !Number.isFinite(value)) {
        return fallback;
    }
    return Math.min(Math.max(Math.trunc(value), 0), max);
}

function addContribution(
    contributorsByUserId: Map<string, CommunityContributor>,
    request: {
        submitterUserId: string;
        displayName: string | null;
        avatarUrl: string | null;
    },
    appliedAt: Date,
) {
    const existing = contributorsByUserId.get(request.submitterUserId);
    if (existing) {
        // Requests arrive latest first, so the first one seen sets the date.
        existing.editCount += 1;
        return;
    }

    contributorsByUserId.set(request.submitterUserId, {
        userId: request.submitterUserId,
        displayName: request.displayName,
        avatarUrl: request.avatarUrl,
        lastAppliedAt: appliedAt,
        editCount: 1,
    });
}

/**
 * Who improved a directory entity, for the whole page and per section.
 *
 * A request counts for each distinct section its changes touch. A change
 * without a section falls back to the request's section, and a request with
 * no changes (an accepted entity suggestion such as a new plant tip) counts
 * for the request's section, for example `new-plant-tip`.
 */
export async function getCommunityEntityContributors(
    entityId: number,
): Promise<CommunityEntityContributors> {
    const requests = await storage()
        .select({
            id: communityEditRequests.id,
            sectionKey: communityEditRequests.sectionKey,
            submitterUserId: communityEditRequests.submitterUserId,
            appliedAt: communityEditRequests.appliedAt,
            reviewedAt: communityEditRequests.reviewedAt,
            createdAt: communityEditRequests.createdAt,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl,
        })
        .from(communityEditRequests)
        .innerJoin(users, eq(users.id, communityEditRequests.submitterUserId))
        .where(
            and(
                eq(communityEditRequests.entityId, entityId),
                eq(communityEditRequests.status, 'applied'),
                eq(users.isTemporary, false),
            ),
        )
        .orderBy(desc(contributionAppliedAt), desc(communityEditRequests.id));

    if (requests.length === 0) {
        return { contributors: [], sections: {}, lastAppliedAt: null };
    }

    const changes = await storage()
        .selectDistinct({
            requestId: communityEditRequestChanges.requestId,
            sectionKey: communityEditRequestChanges.sectionKey,
        })
        .from(communityEditRequestChanges)
        .where(
            inArray(
                communityEditRequestChanges.requestId,
                requests.map((request) => request.id),
            ),
        );

    const changeSectionKeysByRequestId = new Map<number, (string | null)[]>();
    for (const change of changes) {
        const sectionKeys =
            changeSectionKeysByRequestId.get(change.requestId) ?? [];
        sectionKeys.push(change.sectionKey);
        changeSectionKeysByRequestId.set(change.requestId, sectionKeys);
    }

    const entityContributors = new Map<string, CommunityContributor>();
    const sectionContributors = new Map<
        string,
        Map<string, CommunityContributor>
    >();
    for (const request of requests) {
        const appliedAt = resolveAppliedAt(request);
        addContribution(entityContributors, request, appliedAt);

        const changeSectionKeys = changeSectionKeysByRequestId.get(
            request.id,
        ) ?? [null];
        const sectionKeys = new Set<string>();
        for (const changeSectionKey of changeSectionKeys) {
            const sectionKey = changeSectionKey ?? request.sectionKey;
            if (sectionKey) {
                sectionKeys.add(sectionKey);
            }
        }

        for (const sectionKey of sectionKeys) {
            const contributorsByUserId =
                sectionContributors.get(sectionKey) ??
                new Map<string, CommunityContributor>();
            addContribution(contributorsByUserId, request, appliedAt);
            sectionContributors.set(sectionKey, contributorsByUserId);
        }
    }

    return {
        contributors: [...entityContributors.values()],
        sections: Object.fromEntries(
            [...sectionContributors].map(([sectionKey, contributors]) => [
                sectionKey,
                [...contributors.values()],
            ]),
        ),
        lastAppliedAt: resolveAppliedAt(requests[0]),
    };
}

/** How many of a user's suggestions were accepted and applied. */
export async function countAcceptedCommunityEditRequests(userId: string) {
    const [result] = await storage()
        .select({ count: count() })
        .from(communityEditRequests)
        .where(
            and(
                eq(communityEditRequests.submitterUserId, userId),
                eq(communityEditRequests.status, 'applied'),
            ),
        );

    return result?.count ?? 0;
}

/**
 * A user's accepted contributions: the total, and the pages they most
 * recently helped improve (one row per public path, latest first).
 */
export async function getCommunityContributionSummaryForUser(
    userId: string,
    options?: { pageLimit?: number },
): Promise<{ acceptedCount: number; pages: CommunityContributionPage[] }> {
    const pageLimit = clampLimit(
        options?.pageLimit,
        defaultContributionPageLimit,
        maxContributionPageLimit,
    );
    const acceptedCount = await countAcceptedCommunityEditRequests(userId);
    if (acceptedCount === 0 || pageLimit === 0) {
        return { acceptedCount, pages: [] };
    }

    // Several edits often land on one page, so read past the limit before
    // collapsing to distinct paths.
    const requests = await storage()
        .select({
            id: communityEditRequests.id,
            entityTypeName: communityEditRequests.entityTypeName,
            entityId: communityEditRequests.entityId,
            publicPath: communityEditRequests.publicPath,
            sectionKey: communityEditRequests.sectionKey,
            appliedAt: communityEditRequests.appliedAt,
            reviewedAt: communityEditRequests.reviewedAt,
            createdAt: communityEditRequests.createdAt,
        })
        .from(communityEditRequests)
        .where(
            and(
                eq(communityEditRequests.submitterUserId, userId),
                eq(communityEditRequests.status, 'applied'),
            ),
        )
        .orderBy(desc(contributionAppliedAt), desc(communityEditRequests.id))
        .limit(pageLimit * 8);

    const pages: CommunityContributionPage[] = [];
    const seenPublicPaths = new Set<string>();
    for (const request of requests) {
        if (seenPublicPaths.has(request.publicPath)) {
            continue;
        }
        seenPublicPaths.add(request.publicPath);
        pages.push({
            requestId: request.id,
            entityTypeName: request.entityTypeName,
            entityId: request.entityId,
            publicPath: request.publicPath,
            sectionKey: request.sectionKey,
            appliedAt: resolveAppliedAt(request),
        });
        if (pages.length === pageLimit) {
            break;
        }
    }

    return { acceptedCount, pages };
}

/**
 * Registered users ranked by accepted suggestions. Equal counts are ordered
 * by registration date, then ID, matching the achievement leaderboard.
 */
export function getCommunityEditorLeaderboard(
    limit = defaultEditorLeaderboardLimit,
) {
    const acceptedEditCount = count(communityEditRequests.id);
    return storage()
        .select({
            id: users.id,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl,
            createdAt: users.createdAt,
            achievementCount: userAchievementCount(users.id).as(
                'achievement_count',
            ),
            acceptedEditCount: acceptedEditCount.as('accepted_edit_count'),
            lastAppliedAt: sql<Date>`max(${contributionAppliedAt})`
                .mapWith(communityEditRequests.createdAt)
                .as('last_applied_at'),
        })
        .from(communityEditRequests)
        .innerJoin(users, eq(users.id, communityEditRequests.submitterUserId))
        .where(
            and(
                eq(communityEditRequests.status, 'applied'),
                eq(users.isTemporary, false),
            ),
        )
        .groupBy(users.id)
        .orderBy(desc(acceptedEditCount), asc(users.createdAt), asc(users.id))
        .limit(
            clampLimit(
                limit,
                defaultEditorLeaderboardLimit,
                maxEditorLeaderboardLimit,
            ),
        );
}

/**
 * A submitter's own requests, newest first, in every status.
 *
 * Carries the moderator's reply (`submitterMessage`) and never the internal
 * reviewer note, the reviewer's identity, or the submitter's e-mail.
 */
export function listCommunityEditRequestsForSubmitter(
    userId: string,
    options?: { limit?: number },
) {
    return storage().query.communityEditRequests.findMany({
        columns: {
            id: true,
            status: true,
            entityTypeName: true,
            entityId: true,
            publicPath: true,
            sectionKey: true,
            // Entity suggestions keep their payload in the submitter note.
            submitterNote: true,
            submitterMessage: true,
            createdAt: true,
            reviewedAt: true,
            appliedAt: true,
        },
        where: eq(communityEditRequests.submitterUserId, userId),
        with: {
            changes: {
                columns: {
                    fieldKey: true,
                    sectionKey: true,
                },
                orderBy: [asc(communityEditRequestChanges.id)],
            },
        },
        orderBy: [
            desc(communityEditRequests.createdAt),
            desc(communityEditRequests.id),
        ],
        limit: clampLimit(
            options?.limit,
            defaultSubmitterRequestLimit,
            maxSubmitterRequestLimit,
        ),
    });
}
