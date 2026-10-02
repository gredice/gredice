import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import test from 'node:test';
import {
    createAccount,
    createEvent,
    getFeaturedPublicGardenSummaries,
    getFeaturedPublicGardens,
    knownEvents,
    replaceGardenPreview,
    setGardenLike,
    storage,
    updateGarden,
    upsertRaisedBedField,
} from '@gredice/storage';
import { eq, inArray } from 'drizzle-orm';
import { accountUsers, gardenPreviews, gardens, users } from '../src/schema';
import {
    createTestBlock,
    createTestGarden,
    createTestRaisedBed,
    ensureFarmId,
} from './helpers/testHelpers';
import { createTestDb } from './testDb';

test('shared featured counts preserve ranking while current public metadata prevents stale disclosures', async (t) => {
    const values = new Map<string, unknown>();
    const ttls: number[] = [];
    let discardInvalidations = false;
    let serverError: unknown;
    const server = createServer(async (request, response) => {
        try {
            let rawBody = '';
            for await (const chunk of request) rawBody += chunk;
            const pipeline: unknown = JSON.parse(rawBody);
            assert.ok(Array.isArray(pipeline));
            const run = (command: unknown) => {
                assert.ok(Array.isArray(command));
                const [name, key, value, _expiration, ttl] = command;
                assert.equal(typeof name, 'string');
                assert.equal(typeof key, 'string');
                if (name.toLowerCase() === 'get')
                    return { result: values.get(key) ?? null };
                if (name.toLowerCase() === 'set') {
                    values.set(key, value);
                    ttls.push(Number(ttl));
                    return { result: 'OK' };
                }
                if (name.toLowerCase() === 'del') {
                    if (!discardInvalidations) values.delete(key);
                    return { result: 1 };
                }
                throw new Error(`Unexpected Redis command: ${name}`);
            };
            response.setHeader('content-type', 'application/json');
            response.end(
                JSON.stringify(
                    typeof pipeline[0] === 'string'
                        ? run(pipeline)
                        : pipeline.map(run),
                ),
            );
        } catch (error) {
            serverError = error;
            response.statusCode = 500;
            response.end('{}');
        }
    });
    await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve),
    );
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    process.env.GREDICE_SILO_KV_REST_API_URL = `http://127.0.0.1:${address.port}`;
    process.env.GREDICE_SILO_KV_REST_API_TOKEN = 'test-token';
    const gardenIds: number[] = [];
    t.after(async () => {
        if (gardenIds.length)
            await storage()
                .update(gardens)
                .set({ isPublic: false })
                .where(inArray(gardens.id, gardenIds));
        await new Promise<void>((resolve) => server.close(() => resolve()));
        delete process.env.GREDICE_SILO_KV_REST_API_URL;
        delete process.env.GREDICE_SILO_KV_REST_API_TOKEN;
    });

    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const temporaryUserId = randomUUID();
    const ownerId = randomUUID();
    await storage()
        .insert(users)
        .values([
            {
                id: temporaryUserId,
                userName: 'temporary-private@example.com',
                role: 'user',
                isTemporary: true,
            },
            {
                id: ownerId,
                userName: 'private-owner@example.com',
                displayName: 'Javni vrtlar',
                role: 'user',
            },
        ]);
    await storage()
        .insert(accountUsers)
        .values([
            {
                accountId,
                userId: temporaryUserId,
                createdAt: new Date('2026-01-01'),
            },
            { accountId, userId: ownerId, createdAt: new Date('2026-01-02') },
        ]);
    for (let index = 0; index < 11; index++) {
        const id = await createTestGarden({
            accountId,
            farmId,
            name: `Vrt ${index}`,
        });
        gardenIds.push(id);
        await updateGarden({ id, isPublic: true });
    }
    const firstId = gardenIds[0];
    assert.ok(firstId);
    const bedId = await createTestRaisedBed(
        firstId,
        accountId,
        await createTestBlock(firstId, 'Raised_Bed'),
    );
    await upsertRaisedBedField({ raisedBedId: bedId, positionIndex: 0 });
    await createEvent(
        knownEvents.raisedBedFields.plantPlaceV1(`${bedId}|0`, {
            plantSortId: '101',
            scheduledDate: '2026-10-02T06:00:00Z',
        }),
    );
    const previewDate = new Date('2026-10-02T06:00:00Z');
    const preview = {
        gardenId: firstId,
        phase: 'day',
        byteSize: 100,
        captureRequestId: randomUUID(),
        captureRequestedAt: previewDate,
        capturedAt: previewDate,
        contentType: 'image/webp',
        height: 630,
        width: 1200,
        imageUrl: `https://cdn.gredice.com/${firstId}/day.webp`,
        pathname: `garden-${firstId}-day.webp`,
        rendererVersion: 'garden-preview-v1',
        sourceRevision: 'a'.repeat(64),
    };
    await replaceGardenPreview({ ...preview, phase: 'day' });
    const expected = await getFeaturedPublicGardens();
    const cold = await getFeaturedPublicGardenSummaries();
    assert.deepEqual(
        cold.map(({ garden }) => ({ id: garden.id })),
        expected,
    );
    assert.ok(cold.some(({ garden }) => garden.id === firstId));
    assert.equal(
        cold.find(({ garden }) => garden.id === firstId)?.owner?.displayName,
        'Javni vrtlar',
    );
    assert.equal(
        cold.find(({ garden }) => garden.id === firstId)?.dayPreviewImageUrl,
        preview.imageUrl,
    );
    assert.ok(Buffer.byteLength(JSON.stringify({ items: cold })) < 10_000);
    assert.doesNotMatch(
        JSON.stringify(cold),
        /private-owner|temporary-private|accountId|userName|raisedBeds|stacks/,
    );
    assert.ok(ttls.every((ttl) => ttl >= 30 * 60 && ttl <= 60 * 60));

    const fieldReads = t.mock.method(
        storage().query.raisedBedFields,
        'findMany',
        () => {
            throw new Error('Warm summary replayed fields');
        },
    );
    const eventReads = t.mock.method(storage().query.events, 'findMany', () => {
        throw new Error('Warm summary replayed events');
    });
    const metadataReads = t.mock.method(storage(), 'select');
    const ownerReads = t.mock.method(storage(), 'selectDistinctOn');
    assert.deepEqual(await getFeaturedPublicGardenSummaries(), cold);
    assert.equal(metadataReads.mock.callCount(), 2);
    assert.equal(ownerReads.mock.callCount(), 1);
    assert.equal(fieldReads.mock.callCount(), 0);
    assert.equal(eventReads.mock.callCount(), 0);
    t.diagnostic(
        JSON.stringify({
            summaryBytes: Buffer.byteLength(JSON.stringify({ items: cold })),
            warmSqlReads:
                metadataReads.mock.callCount() + ownerReads.mock.callCount(),
            warmFieldReads: fieldReads.mock.callCount(),
            warmEventReads: eventReads.mock.callCount(),
            cachedProjectionKeys: values.size,
        }),
    );
    t.mock.restoreAll();

    // Cache loss/failure cannot restore a removed preview or old owner fields.
    await storage()
        .delete(gardenPreviews)
        .where(eq(gardenPreviews.gardenId, firstId));
    await storage()
        .update(users)
        .set({ isTemporary: true })
        .where(eq(users.id, ownerId));
    const changedMetadata = await getFeaturedPublicGardenSummaries();
    assert.equal(
        changedMetadata.find(({ garden }) => garden.id === firstId)
            ?.dayPreviewImageUrl,
        null,
    );
    assert.equal(
        changedMetadata.find(({ garden }) => garden.id === firstId)?.owner,
        null,
    );
    await storage()
        .update(users)
        .set({ isTemporary: false })
        .where(eq(users.id, ownerId));

    await createEvent(
        knownEvents.raisedBedFields.plantUpdateV1(`${bedId}|0`, {
            status: 'removed',
        }),
    );
    assert.deepEqual(
        (await getFeaturedPublicGardenSummaries()).map(({ garden }) => ({
            id: garden.id,
        })),
        await getFeaturedPublicGardens(),
    );
    await createEvent(
        knownEvents.raisedBedFields.plantUpdateV1(`${bedId}|0`, {
            status: 'planned',
        }),
    );
    await setGardenLike({
        accountIds: [],
        gardenId: firstId,
        liked: true,
        userId: ownerId,
    });
    assert.deepEqual(
        (await getFeaturedPublicGardenSummaries()).map(({ garden }) => ({
            id: garden.id,
        })),
        await getFeaturedPublicGardens(),
    );

    discardInvalidations = true;
    await updateGarden({ id: firstId, isPublic: false });
    assert.ok(
        (await getFeaturedPublicGardenSummaries()).every(
            ({ garden }) => garden.id !== firstId,
        ),
    );
    assert.equal(serverError, undefined);
});
