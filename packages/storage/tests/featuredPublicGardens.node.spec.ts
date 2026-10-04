import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    createAccount,
    createEvent,
    getFeaturedPublicGardens,
    getGardenActivePlantCounts,
    getGardenLikeCounts,
    getPublicGardens,
    getRaisedBedsForGardens,
    knownEvents,
    storage,
    upsertRaisedBedField,
} from '@gredice/storage';
import { eq } from 'drizzle-orm';
import {
    gardenLikes,
    gardens,
    raisedBedFields,
    raisedBeds,
    users,
} from '../src/schema';
import {
    createTestBlock,
    createTestGarden,
    createTestRaisedBed,
    ensureFarmId,
} from './helpers/testHelpers';
import { createTestDb } from './testDb';

test('featured ranking matches the full list, keeps cutoff ties, and rechecks visibility', async (t) => {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const userIds = Array.from({ length: 3 }, () => randomUUID());
    await storage()
        .insert(users)
        .values(
            userIds.map((id) => ({
                id,
                userName: `${id}@example.com`,
                role: 'user',
            })),
        );
    const ids: number[] = [];
    for (let index = 0; index < 13; index++) {
        const id = await createTestGarden({ accountId, farmId });
        ids.push(id);
        await storage()
            .update(gardens)
            .set({
                updatedAt: new Date(2026, 0, index + 1),
                isPublic: index !== 11,
                isDeleted: index === 12,
            })
            .where(eq(gardens.id, id));
        // All eleven eligible gardens tie on likes: the oldest has more plants
        // and must not be discarded by an early LIMIT 10.
        await storage()
            .insert(gardenLikes)
            .values(
                userIds
                    .slice(0, index === 1 ? 2 : 1)
                    .map((userId) => ({ gardenId: id, userId })),
            );
    }
    const firstId = ids[0];
    assert.ok(firstId);
    const blockId = await createTestBlock(firstId, 'Raised_Bed');
    const bedId = await createTestRaisedBed(firstId, accountId, blockId);
    await upsertRaisedBedField({ raisedBedId: bedId, positionIndex: 0 });
    await createEvent(
        knownEvents.raisedBedFields.plantPlaceV1(`${bedId}|0`, {
            plantSortId: '101',
            scheduledDate: '2026-04-01T00:00:00.000Z',
        }),
    );

    const publicGardens = await getPublicGardens();
    const publicIds = publicGardens.map(({ id }) => id);
    const beds = await getRaisedBedsForGardens(publicIds);
    const likes = await getGardenLikeCounts(publicIds);
    const expected = publicGardens
        .toSorted(
            (a, b) =>
                (likes.get(b.id) ?? 0) - (likes.get(a.id) ?? 0) ||
                activePlants(b.id) - activePlants(a.id),
        )
        .slice(0, 10)
        .map(({ id }) => ({ id }));
    function activePlants(id: number) {
        return (beds.get(id) ?? [])
            .flatMap(({ fields }) => fields)
            .filter(
                (field) =>
                    field.active && typeof field.plantSortId === 'number',
            ).length;
    }
    // None of these detail-only reads belongs on the featured path.
    for (const table of [
        storage().query.gardenPreviews,
        storage().query.raisedBedPlantings,
    ]) {
        t.mock.method(table, 'findMany', () => {
            throw new Error('Unexpected detail hydration');
        });
    }
    const featured = await getFeaturedPublicGardens();
    assert.deepEqual(featured, expected);
    assert.equal(featured.length, 10);
    assert.equal(featured[0]?.id, ids[1]);
    assert.equal(featured[1]?.id, firstId);
    assert.ok(
        featured.every(
            (garden) => garden.id !== ids[11] && garden.id !== ids[12],
        ),
    );
    await storage()
        .update(gardens)
        .set({ isPublic: false })
        .where(eq(gardens.id, firstId));
    assert.ok(
        (await getFeaturedPublicGardens()).every(
            (garden) => garden.id !== firstId,
        ),
    );
});

test('light plant counts preserve lifecycle semantics and ignore deleted beds and fields', async () => {
    createTestDb();
    const accountId = await createAccount();
    const gardenId = await createTestGarden({
        accountId,
        farmId: await ensureFarmId(),
    });
    const bedId = await createTestRaisedBed(
        gardenId,
        accountId,
        await createTestBlock(gardenId, 'Raised_Bed'),
    );
    const aggregateId = `${bedId}|0`;
    await upsertRaisedBedField({
        raisedBedId: bedId,
        positionIndex: 0,
    });
    await createEvent(
        knownEvents.raisedBedFields.plantPlaceV1(aggregateId, {
            plantSortId: '101',
            scheduledDate: '2026-04-01T00:00:00.000Z',
        }),
    );
    async function assertCount(expected: number) {
        const counts = await getGardenActivePlantCounts([gardenId, gardenId]);
        assert.equal(counts.get(gardenId) ?? 0, expected);
        const beds =
            (await getRaisedBedsForGardens([gardenId])).get(gardenId) ?? [];
        assert.equal(
            beds
                .flatMap(({ fields }) => fields)
                .filter(
                    (field) =>
                        field.active && typeof field.plantSortId === 'number',
                ).length,
            expected,
        );
    }
    await assertCount(1);
    await createEvent(
        knownEvents.raisedBedFields.plantUpdateV1(aggregateId, {
            status: 'harvested',
        }),
    );
    await assertCount(1); // Occupied until removed, as in the existing public list.
    await createEvent(
        knownEvents.raisedBedFields.plantUpdateV1(aggregateId, {
            status: 'removed',
        }),
    );
    await assertCount(0);
    await createEvent(
        knownEvents.raisedBedFields.plantUpdateV1(aggregateId, {
            status: 'planned',
        }),
    );
    await assertCount(1);
    const field = await storage().query.raisedBedFields.findFirst({
        where: eq(raisedBedFields.raisedBedId, bedId),
    });
    assert.ok(field);
    await storage()
        .update(raisedBedFields)
        .set({ isDeleted: true })
        .where(eq(raisedBedFields.id, field.id));
    await assertCount(0);
    await storage()
        .update(raisedBedFields)
        .set({ isDeleted: false })
        .where(eq(raisedBedFields.id, field.id));
    await storage()
        .update(raisedBeds)
        .set({ isDeleted: true })
        .where(eq(raisedBeds.id, bedId));
    await assertCount(0);
    assert.deepEqual(await getGardenActivePlantCounts([]), new Map());
});
