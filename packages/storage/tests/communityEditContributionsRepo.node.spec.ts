import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    communityEditRequestChanges,
    communityEditRequests,
    countAcceptedCommunityEditRequests,
    createAttributeDefinition,
    createEntity,
    getCommunityContributionSummaryForUser,
    getCommunityEditorLeaderboard,
    getCommunityEditRequest,
    getCommunityEntityContributors,
    listCommunityEditRequestsForSubmitter,
    markCommunityEditRequestConflicted,
    rejectCommunityEditRequest,
    storage,
    upsertEntityType,
    users,
} from '@gredice/storage';
import { createTestDb } from './testDb';

type ContributionFixture = {
    attributeDefinitionId: number;
    plantId: number;
    otherPlantId: number;
    firstEditorId: string;
    secondEditorId: string;
    temporaryEditorId: string;
    reviewerId: string;
};

let fixturePromise: Promise<ContributionFixture> | null = null;

function fixture() {
    createTestDb();
    if (!fixturePromise) {
        fixturePromise = createFixture();
    }
    return fixturePromise;
}

function at(day: number) {
    return new Date(Date.UTC(2026, 9, day, 12));
}

async function createRequest(input: {
    entityId: number;
    submitterUserId: string;
    status: string;
    publicPath?: string;
    sectionKey?: string | null;
    appliedAt?: Date | null;
    reviewedAt?: Date | null;
    createdAt?: Date;
    changeSectionKeys?: (string | null)[];
}) {
    const data = await fixture();
    const [request] = await storage()
        .insert(communityEditRequests)
        .values({
            status: input.status,
            entityTypeName: 'plant',
            entityId: input.entityId,
            publicPath: input.publicPath ?? '/biljke/doprinosi',
            sectionKey: input.sectionKey ?? null,
            submitterUserId: input.submitterUserId,
            submitterEmail: 'private@example.test',
            reviewerNote: 'Interna napomena.',
            appliedAt: input.appliedAt ?? null,
            reviewedAt: input.reviewedAt ?? null,
            createdAt: input.createdAt ?? at(1),
        })
        .returning({ id: communityEditRequests.id });
    assert.ok(request);

    const changeSectionKeys = input.changeSectionKeys ?? [];
    if (changeSectionKeys.length > 0) {
        await storage()
            .insert(communityEditRequestChanges)
            .values(
                changeSectionKeys.map((sectionKey, index) => ({
                    requestId: request.id,
                    fieldKey: `plant.contribution-${index}`,
                    sectionKey,
                    attributeDefinitionId: data.attributeDefinitionId,
                    attributePath: 'information.description',
                    dataType: 'markdown',
                    previousValue: 'Staro',
                    proposedValue: 'Novo',
                    baseValueHash: 'hash',
                })),
            );
    }

    return request.id;
}

async function createFixture(): Promise<ContributionFixture> {
    const suffix = randomUUID();
    const firstEditorId = `contribution-first-${suffix}`;
    const secondEditorId = `contribution-second-${suffix}`;
    const temporaryEditorId = `contribution-temporary-${suffix}`;
    const reviewerId = `contribution-review-${suffix}`;

    await storage()
        .insert(users)
        .values([
            {
                id: firstEditorId,
                userName: `first-${suffix}`,
                displayName: 'Prva Urednica',
                avatarUrl: 'https://cdn.example.test/first.png',
                role: 'user',
                createdAt: at(1),
            },
            {
                id: secondEditorId,
                userName: `second-${suffix}`,
                displayName: 'Drugi Urednik',
                role: 'user',
                createdAt: at(2),
            },
            {
                id: temporaryEditorId,
                userName: `temporary-${suffix}`,
                displayName: 'Privremeni Gost',
                role: 'user',
                isTemporary: true,
            },
            {
                id: reviewerId,
                userName: `reviewer-${suffix}`,
                displayName: 'Moderator',
                role: 'admin',
            },
        ]);

    await upsertEntityType({ name: 'plant', label: 'Biljka' });
    const attributeDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: `contributionDescription-${suffix}`,
        label: 'Opis',
        entityTypeName: 'plant',
        dataType: 'markdown',
    });
    const [plantId, otherPlantId] = await Promise.all([
        createEntity('plant'),
        createEntity('plant'),
    ]);

    return {
        attributeDefinitionId,
        plantId,
        otherPlantId,
        firstEditorId,
        secondEditorId,
        temporaryEditorId,
        reviewerId,
    };
}

let contributionsPromise: Promise<void> | null = null;

/** Seeds one plant's review history once for the read-model tests. */
function seedContributions() {
    if (!contributionsPromise) {
        contributionsPromise = (async () => {
            const data = await fixture();
            // First editor, oldest accepted edit: two changes, one section.
            await createRequest({
                entityId: data.plantId,
                submitterUserId: data.firstEditorId,
                status: 'applied',
                appliedAt: at(10),
                createdAt: at(9),
                changeSectionKeys: ['sowing', 'sowing'],
            });
            // Second editor touches two sections in one request.
            await createRequest({
                entityId: data.plantId,
                submitterUserId: data.secondEditorId,
                status: 'applied',
                appliedAt: at(12),
                createdAt: at(11),
                changeSectionKeys: ['sowing', 'growth'],
            });
            // A change without a section falls back to the request's section.
            await createRequest({
                entityId: data.plantId,
                submitterUserId: data.firstEditorId,
                status: 'applied',
                sectionKey: 'overview',
                appliedAt: at(20),
                createdAt: at(19),
                changeSectionKeys: [null],
            });
            // An accepted entity suggestion has no change rows.
            await createRequest({
                entityId: data.plantId,
                submitterUserId: data.secondEditorId,
                status: 'applied',
                sectionKey: 'new-plant-tip',
                appliedAt: at(15),
                createdAt: at(14),
            });
            // Older rows may lack `applied_at`; the review date stands in.
            await createRequest({
                entityId: data.plantId,
                submitterUserId: data.secondEditorId,
                status: 'applied',
                reviewedAt: at(5),
                createdAt: at(4),
                changeSectionKeys: ['harvest'],
            });
            // Not contributions: pending, rejected and conflicted requests.
            await createRequest({
                entityId: data.plantId,
                submitterUserId: data.secondEditorId,
                status: 'pending',
                createdAt: at(25),
                changeSectionKeys: ['watering'],
            });
            await createRequest({
                entityId: data.plantId,
                submitterUserId: data.firstEditorId,
                status: 'rejected',
                reviewedAt: at(26),
                createdAt: at(24),
                changeSectionKeys: ['watering'],
            });
            await createRequest({
                entityId: data.plantId,
                submitterUserId: data.firstEditorId,
                status: 'conflicted',
                reviewedAt: at(27),
                createdAt: at(23),
                changeSectionKeys: ['watering'],
            });
            // Temporary users have no public profile to credit.
            await createRequest({
                entityId: data.plantId,
                submitterUserId: data.temporaryEditorId,
                status: 'applied',
                appliedAt: at(28),
                changeSectionKeys: ['sowing'],
            });
            // Another entity's edits stay on that entity.
            await createRequest({
                entityId: data.otherPlantId,
                submitterUserId: data.firstEditorId,
                status: 'applied',
                publicPath: '/biljke/druga',
                sectionKey: 'growth',
                appliedAt: at(18),
                createdAt: at(17),
                changeSectionKeys: ['growth'],
            });
        })();
    }
    return contributionsPromise;
}

function summarize(
    contributors: Awaited<
        ReturnType<typeof getCommunityEntityContributors>
    >['contributors'],
) {
    return contributors.map((contributor) => ({
        userId: contributor.userId,
        lastAppliedAt: contributor.lastAppliedAt.toISOString(),
        editCount: contributor.editCount,
    }));
}

test('entity contributors list accepted editors latest first, one row per user', async () => {
    const data = await fixture();
    await seedContributions();

    const result = await getCommunityEntityContributors(data.plantId);

    assert.deepEqual(summarize(result.contributors), [
        {
            userId: data.firstEditorId,
            lastAppliedAt: at(20).toISOString(),
            editCount: 2,
        },
        {
            userId: data.secondEditorId,
            lastAppliedAt: at(15).toISOString(),
            editCount: 3,
        },
    ]);
    assert.equal(result.lastAppliedAt?.toISOString(), at(20).toISOString());
    assert.deepEqual(result.contributors[0], {
        userId: data.firstEditorId,
        displayName: 'Prva Urednica',
        avatarUrl: 'https://cdn.example.test/first.png',
        lastAppliedAt: at(20),
        editCount: 2,
    });
});

test('entity contributors group by change section, request section and suggestion section', async () => {
    const data = await fixture();
    await seedContributions();

    const { sections } = await getCommunityEntityContributors(data.plantId);

    assert.deepEqual(Object.keys(sections).sort(), [
        'growth',
        'harvest',
        'new-plant-tip',
        'overview',
        'sowing',
    ]);
    // Two changes in one section of one request count once.
    assert.deepEqual(summarize(sections.sowing), [
        {
            userId: data.secondEditorId,
            lastAppliedAt: at(12).toISOString(),
            editCount: 1,
        },
        {
            userId: data.firstEditorId,
            lastAppliedAt: at(10).toISOString(),
            editCount: 1,
        },
    ]);
    assert.deepEqual(summarize(sections.growth), [
        {
            userId: data.secondEditorId,
            lastAppliedAt: at(12).toISOString(),
            editCount: 1,
        },
    ]);
    assert.deepEqual(summarize(sections.overview), [
        {
            userId: data.firstEditorId,
            lastAppliedAt: at(20).toISOString(),
            editCount: 1,
        },
    ]);
    assert.deepEqual(summarize(sections['new-plant-tip']), [
        {
            userId: data.secondEditorId,
            lastAppliedAt: at(15).toISOString(),
            editCount: 1,
        },
    ]);
    assert.deepEqual(summarize(sections.harvest), [
        {
            userId: data.secondEditorId,
            lastAppliedAt: at(5).toISOString(),
            editCount: 1,
        },
    ]);
    // Pending, rejected and conflicted requests never create a section.
    assert.equal(sections.watering, undefined);
});

test('entity contributors are empty for an entity without accepted edits', async () => {
    createTestDb();
    await upsertEntityType({ name: 'plant', label: 'Biljka' });
    const untouchedPlantId = await createEntity('plant');

    assert.deepEqual(await getCommunityEntityContributors(untouchedPlantId), {
        contributors: [],
        sections: {},
        lastAppliedAt: null,
    });
});

test('contribution summary counts accepted edits and lists distinct pages latest first', async () => {
    const data = await fixture();
    await seedContributions();

    const summary = await getCommunityContributionSummaryForUser(
        data.firstEditorId,
    );

    assert.equal(summary.acceptedCount, 3);
    assert.deepEqual(
        summary.pages.map((page) => ({
            entityId: page.entityId,
            entityTypeName: page.entityTypeName,
            publicPath: page.publicPath,
            sectionKey: page.sectionKey,
            appliedAt: page.appliedAt.toISOString(),
        })),
        [
            {
                entityId: data.plantId,
                entityTypeName: 'plant',
                publicPath: '/biljke/doprinosi',
                sectionKey: 'overview',
                appliedAt: at(20).toISOString(),
            },
            {
                entityId: data.otherPlantId,
                entityTypeName: 'plant',
                publicPath: '/biljke/druga',
                sectionKey: 'growth',
                appliedAt: at(18).toISOString(),
            },
        ],
    );

    const limited = await getCommunityContributionSummaryForUser(
        data.firstEditorId,
        { pageLimit: 1 },
    );
    assert.equal(limited.acceptedCount, 3);
    assert.deepEqual(
        limited.pages.map((page) => page.publicPath),
        ['/biljke/doprinosi'],
    );

    assert.equal(
        await countAcceptedCommunityEditRequests(data.secondEditorId),
        3,
    );
    assert.deepEqual(
        await getCommunityContributionSummaryForUser(data.reviewerId),
        { acceptedCount: 0, pages: [] },
    );
});

test('editor leaderboard ranks registered users by accepted edits', async () => {
    const data = await fixture();
    await seedContributions();

    const ownUserIds = new Set([
        data.firstEditorId,
        data.secondEditorId,
        data.temporaryEditorId,
        data.reviewerId,
    ]);
    // Other specs share this database, so read the widest board and keep
    // only this spec's users.
    const editors = (await getCommunityEditorLeaderboard(25)).filter((editor) =>
        ownUserIds.has(editor.id),
    );

    // Equal counts: the earlier registration ranks first.
    assert.deepEqual(
        editors.map((editor) => ({
            id: editor.id,
            displayName: editor.displayName,
            acceptedEditCount: editor.acceptedEditCount,
            lastAppliedAt: editor.lastAppliedAt.toISOString(),
        })),
        [
            {
                id: data.firstEditorId,
                displayName: 'Prva Urednica',
                acceptedEditCount: 3,
                lastAppliedAt: at(20).toISOString(),
            },
            {
                id: data.secondEditorId,
                displayName: 'Drugi Urednik',
                acceptedEditCount: 3,
                lastAppliedAt: at(15).toISOString(),
            },
        ],
    );
    assert.equal(editors[0]?.achievementCount, 0);
    assert.ok((await getCommunityEditorLeaderboard(1)).length <= 1);
});

test("submitter list returns only the user's own requests without review internals", async () => {
    const data = await fixture();
    await seedContributions();

    const requests = await listCommunityEditRequestsForSubmitter(
        data.firstEditorId,
    );

    // Newest first by request ID, which follows creation order in production
    // and gives the pagination cursor a stable order.
    assert.deepEqual(
        requests.map((request) => request.id),
        requests.map((request) => request.id).sort((a, b) => b - a),
    );
    assert.deepEqual(requests.map((request) => request.status).sort(), [
        'applied',
        'applied',
        'applied',
        'conflicted',
        'rejected',
    ]);
    assert.ok(
        requests.every(
            (request) =>
                !('submitterUserId' in request) &&
                !('submitterEmail' in request) &&
                !('reviewerNote' in request) &&
                !('reviewerUserId' in request) &&
                !('reviewerName' in request),
        ),
    );
    const overviewRequest = requests.find(
        (request) => request.sectionKey === 'overview',
    );
    assert.deepEqual(overviewRequest?.changes, [
        { fieldKey: 'plant.contribution-0', sectionKey: null },
    ]);
    assert.equal(
        requests.find((request) => request.status === 'rejected')
            ?.submitterMessage,
        null,
    );

    const limited = await listCommunityEditRequestsForSubmitter(
        data.firstEditorId,
        { limit: 2 },
    );
    assert.equal(limited.length, 2);

    // The cursor continues after the last request of the previous page.
    const lastListedId = limited[1]?.id;
    assert.ok(lastListedId);
    const older = await listCommunityEditRequestsForSubmitter(
        data.firstEditorId,
        { beforeId: lastListedId },
    );
    assert.deepEqual(
        [...limited, ...older].map((request) => request.id),
        requests.map((request) => request.id),
    );
    assert.ok(older.every((request) => request.id < lastListedId));
});

test('rejecting stores the trimmed reply for the submitter beside the internal note', async () => {
    const data = await fixture();
    const requestId = await createRequest({
        entityId: data.plantId,
        submitterUserId: data.firstEditorId,
        status: 'pending',
        createdAt: at(30),
    });

    const rejected = await rejectCommunityEditRequest({
        id: requestId,
        reviewer: { id: data.reviewerId, name: 'Moderator' },
        reviewerNote: 'Provjeriti izvor.',
        submitterMessage: '  Ta sorta već postoji pod drugim nazivom.  ',
    });

    assert.equal(rejected?.status, 'rejected');
    assert.equal(rejected?.reviewerNote, 'Provjeriti izvor.');
    assert.equal(
        rejected?.submitterMessage,
        'Ta sorta već postoji pod drugim nazivom.',
    );

    const [listed] = await listCommunityEditRequestsForSubmitter(
        data.firstEditorId,
        { limit: 1 },
    );
    assert.equal(listed?.id, requestId);
    assert.equal(
        listed?.submitterMessage,
        'Ta sorta već postoji pod drugim nazivom.',
    );

    const blankRequestId = await createRequest({
        entityId: data.plantId,
        submitterUserId: data.secondEditorId,
        status: 'pending',
        createdAt: at(30),
    });
    const blank = await rejectCommunityEditRequest({
        id: blankRequestId,
        reviewer: { id: data.reviewerId },
        submitterMessage: '   ',
    });
    assert.equal(blank?.submitterMessage, null);
});

test('marking a conflict stores a reply only when one is given', async () => {
    const data = await fixture();
    const withReplyId = await createRequest({
        entityId: data.plantId,
        submitterUserId: data.secondEditorId,
        status: 'pending',
        createdAt: at(30),
    });
    const withReply = await markCommunityEditRequestConflicted({
        id: withReplyId,
        reviewer: { id: data.reviewerId },
        reason: 'Reviewer marked this request as conflicted.',
        submitterMessage: ' Stranica je u međuvremenu promijenjena. ',
    });
    assert.equal(withReply?.status, 'conflicted');
    assert.equal(
        withReply?.submitterMessage,
        'Stranica je u međuvremenu promijenjena.',
    );

    const automaticId = await createRequest({
        entityId: data.plantId,
        submitterUserId: data.secondEditorId,
        status: 'pending',
        createdAt: at(30),
    });
    await markCommunityEditRequestConflicted({
        id: automaticId,
        reviewer: { id: data.reviewerId },
        reason: 'Field changed after the request was submitted.',
    });
    const automatic = await getCommunityEditRequest(automaticId);
    assert.equal(automatic?.status, 'conflicted');
    assert.equal(automatic?.submitterMessage, null);
});

test('contribution summary fills the page limit with distinct pages past many edits to one page', async () => {
    const data = await fixture();
    // A dedicated guest keeps the seeded totals of the other tests intact:
    // temporary users stay off the leaderboard and off entity credits.
    const busyEditorId = `contribution-busy-${randomUUID()}`;
    await storage().insert(users).values({
        id: busyEditorId,
        userName: busyEditorId,
        displayName: 'Marljiva Urednica',
        role: 'user',
        isTemporary: true,
    });
    // Far more accepted edits on one page than the page limit.
    for (let day = 10; day < 24; day++) {
        await createRequest({
            entityId: data.plantId,
            submitterUserId: busyEditorId,
            status: 'applied',
            publicPath: '/biljke/doprinosi',
            sectionKey: 'overview',
            appliedAt: at(day),
        });
    }
    await createRequest({
        entityId: data.otherPlantId,
        submitterUserId: busyEditorId,
        status: 'applied',
        publicPath: '/biljke/druga',
        sectionKey: 'growth',
        appliedAt: at(3),
    });
    await createRequest({
        entityId: data.otherPlantId,
        submitterUserId: busyEditorId,
        status: 'applied',
        publicPath: '/biljke/treca',
        sectionKey: 'harvest',
        appliedAt: at(2),
    });

    const summary = await getCommunityContributionSummaryForUser(busyEditorId, {
        pageLimit: 2,
    });

    assert.equal(summary.acceptedCount, 16);
    assert.deepEqual(
        summary.pages.map((page) => ({
            publicPath: page.publicPath,
            appliedAt: page.appliedAt.toISOString(),
        })),
        [
            {
                publicPath: '/biljke/doprinosi',
                appliedAt: at(23).toISOString(),
            },
            { publicPath: '/biljke/druga', appliedAt: at(3).toISOString() },
        ],
    );
});
