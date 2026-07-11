import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { afterEach } from 'node:test';
import {
    acquireGardenPreviewCaptureLease,
    claimGardenPreviewBlobDeletion,
    claimGardenPreviewBlobDeletions,
    completeGardenPreviewBlobDeletions,
    createAccount,
    deleteGarden,
    deleteGardenIfNoActiveRaisedBeds,
    getGardenPreview,
    getGardenPreviewBlobScanCursor,
    listGardenPreviewBlobDeletions,
    listGardenPreviewPathnames,
    queueGardenPreviewBlobDeletion,
    recordGardenPreviewBlobDeletionFailures,
    releaseGardenPreviewCaptureLease,
    removeGardenPreviewAndQueueBlobDeletion,
    replaceGardenPreview,
    setGardenPreviewBlobScanCursor,
    storage,
    updateGarden,
} from '@gredice/storage';
import { eq } from 'drizzle-orm';
import { gardens } from '../src/schema';
import { createTestGarden, ensureFarmId } from './helpers/testHelpers';
import { createTestDb } from './testDb';

const publicGardenIds: number[] = [];

afterEach(async () => {
    for (const gardenId of publicGardenIds.splice(0)) {
        await updateGarden({ id: gardenId, isPublic: false });
    }
});

async function createPublicGarden() {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    await updateGarden({ id: gardenId, isPublic: true });
    publicGardenIds.push(gardenId);
    return gardenId;
}

function previewInput({
    gardenId,
    requestedAt,
    pathname,
}: {
    gardenId: number;
    requestedAt: Date;
    pathname: string;
}) {
    return {
        byteSize: 100,
        captureRequestId: randomUUID(),
        captureRequestedAt: requestedAt,
        capturedAt: requestedAt,
        contentType: 'image/webp',
        gardenId,
        height: 630,
        imageUrl: `https://example.test/${pathname}`,
        pathname,
        rendererVersion: 'garden-preview-v1',
        sourceRevision: randomUUID().replaceAll('-', '').repeat(2),
        width: 1200,
    };
}

test('garden preview capture leases have one atomic holder and can be reclaimed after expiry', async () => {
    const gardenId = await createPublicGarden();
    const now = new Date('2026-07-11T12:00:00.000Z');
    const expiresAt = new Date('2026-07-11T12:01:00.000Z');
    const contenders = [randomUUID(), randomUUID()];

    const leases = await Promise.all(
        contenders.map((leaseId) =>
            acquireGardenPreviewCaptureLease({
                expiresAt,
                gardenId,
                leaseId,
                now,
            }),
        ),
    );
    const acquired = leases.filter((lease) => lease !== null);
    assert.equal(acquired.length, 1);
    const holderId = acquired[0]?.leaseId;
    assert.ok(holderId);

    const renewed = await acquireGardenPreviewCaptureLease({
        expiresAt: new Date('2026-07-11T12:02:00.000Z'),
        gardenId,
        leaseId: holderId,
        now: new Date('2026-07-11T12:00:30.000Z'),
    });
    assert.equal(renewed?.leaseId, holderId);
    assert.equal(
        await releaseGardenPreviewCaptureLease({
            gardenId,
            leaseId: 'not-the-holder',
        }),
        false,
    );

    const nextHolderId = randomUUID();
    const reclaimed = await acquireGardenPreviewCaptureLease({
        expiresAt: new Date('2026-07-11T12:04:00.000Z'),
        gardenId,
        leaseId: nextHolderId,
        now: new Date('2026-07-11T12:02:00.000Z'),
    });
    assert.equal(reclaimed?.leaseId, nextHolderId);
    assert.equal(
        await releaseGardenPreviewCaptureLease({
            gardenId,
            leaseId: nextHolderId,
        }),
        true,
    );
});

test('private gardens cannot acquire a preview capture lease', async () => {
    createTestDb();
    const accountId = await createAccount();
    const gardenId = await createTestGarden({
        accountId,
        farmId: await ensureFarmId(),
    });

    const lease = await acquireGardenPreviewCaptureLease({
        expiresAt: new Date('2026-07-11T12:01:00.000Z'),
        gardenId,
        leaseId: randomUUID(),
        now: new Date('2026-07-11T12:00:00.000Z'),
    });
    assert.equal(lease, null);
});

test('preview replacement and removal enqueue Blob deletion transactionally', async () => {
    const gardenId = await createPublicGarden();
    const firstPathname = `garden-previews/${gardenId.toString()}/first.webp`;
    const secondPathname = `garden-previews/${gardenId.toString()}/second.webp`;
    const first = await replaceGardenPreview(
        previewInput({
            gardenId,
            pathname: firstPathname,
            requestedAt: new Date('2026-07-11T12:00:00.000Z'),
        }),
    );
    assert.equal(first.status, 'accepted');

    const second = await replaceGardenPreview(
        previewInput({
            gardenId,
            pathname: secondPathname,
            requestedAt: new Date('2026-07-11T12:01:00.000Z'),
        }),
    );
    assert.equal(second.status, 'accepted');
    const afterReplacement = await listGardenPreviewBlobDeletions({
        now: new Date('2100-07-11T12:02:00.000Z'),
    });
    assert.equal(
        afterReplacement.find((row) => row.pathname === firstPathname)?.reason,
        'preview_replaced',
    );

    await updateGarden({ id: gardenId, isPublic: false });
    assert.equal(await getGardenPreview(gardenId), null);
    assert.equal(
        (await listGardenPreviewPathnames()).includes(secondPathname),
        false,
    );
    const afterUnpublish = await listGardenPreviewBlobDeletions({
        now: new Date('2100-07-11T12:02:00.000Z'),
    });
    assert.equal(
        afterUnpublish.find((row) => row.pathname === secondPathname)?.reason,
        'garden_unpublished',
    );

    const duplicate = await queueGardenPreviewBlobDeletion({
        imageUrl: `https://example.test/${firstPathname}`,
        pathname: firstPathname,
        reason: 'orphaned',
    });
    assert.equal(
        duplicate.id,
        afterReplacement.find((row) => row.pathname === firstPathname)?.id,
    );
    assert.equal(duplicate.reason, 'preview_replaced');
});

test('explicit preview removal is idempotent and durably queues its Blob', async () => {
    const gardenId = await createPublicGarden();
    const pathname = `garden-previews/${gardenId.toString()}/remove.webp`;
    await replaceGardenPreview(
        previewInput({ gardenId, pathname, requestedAt: new Date() }),
    );

    const removed = await removeGardenPreviewAndQueueBlobDeletion(gardenId);
    assert.equal(removed?.pathname, pathname);
    assert.equal(await removeGardenPreviewAndQueueBlobDeletion(gardenId), null);
    assert.equal(
        (await listGardenPreviewBlobDeletions()).filter(
            (row) => row.pathname === pathname,
        ).length,
        1,
    );
});

test('referenced Blob scan ignores previews left on private gardens after a crash', async () => {
    const gardenId = await createPublicGarden();
    const pathname = `garden-previews/${gardenId.toString()}/crash-leftover.webp`;
    await replaceGardenPreview(
        previewInput({ gardenId, pathname, requestedAt: new Date() }),
    );

    // Simulate a legacy/crashed unpublish that bypassed the repository cleanup.
    await storage()
        .update(gardens)
        .set({ isPublic: false })
        .where(eq(gardens.id, gardenId));

    assert.equal(
        (await listGardenPreviewPathnames()).includes(pathname),
        false,
    );
});

test('soft garden deletion helpers remove previews and queue their Blobs', async () => {
    const directGardenId = await createPublicGarden();
    const directPathname = `garden-previews/${directGardenId.toString()}/deleted.webp`;
    await replaceGardenPreview(
        previewInput({
            gardenId: directGardenId,
            pathname: directPathname,
            requestedAt: new Date(),
        }),
    );
    await deleteGarden(directGardenId);
    assert.equal(await getGardenPreview(directGardenId), null);

    const conditionalGardenId = await createPublicGarden();
    const conditionalPathname = `garden-previews/${conditionalGardenId.toString()}/conditionally-deleted.webp`;
    await replaceGardenPreview(
        previewInput({
            gardenId: conditionalGardenId,
            pathname: conditionalPathname,
            requestedAt: new Date(),
        }),
    );
    assert.deepStrictEqual(
        await deleteGardenIfNoActiveRaisedBeds(conditionalGardenId),
        { activeRaisedBedCount: 0, deleted: true },
    );
    assert.equal(await getGardenPreview(conditionalGardenId), null);

    const queued = await listGardenPreviewBlobDeletions({
        now: new Date('2100-07-11T12:02:00.000Z'),
    });
    assert.equal(
        queued.find((row) => row.pathname === directPathname)?.reason,
        'garden_deleted',
    );
    assert.equal(
        queued.find((row) => row.pathname === conditionalPathname)?.reason,
        'garden_deleted',
    );
});

test('Blob deletion claims complete successes and reschedule failures safely', async () => {
    const cleanupClaimId = randomUUID();
    const existing = await claimGardenPreviewBlobDeletions({
        claimId: cleanupClaimId,
        expiresAt: new Date('2100-07-11T12:59:00.000Z'),
        now: new Date('2100-07-11T12:58:00.000Z'),
    });
    await completeGardenPreviewBlobDeletions({
        claimId: cleanupClaimId,
        ids: existing.map((row) => row.id),
    });

    const firstPathname = `garden-previews/outbox/${randomUUID()}.webp`;
    const secondPathname = `garden-previews/outbox/${randomUUID()}.webp`;
    await queueGardenPreviewBlobDeletion({
        imageUrl: `https://example.test/${firstPathname}`,
        pathname: firstPathname,
        reason: 'orphaned',
    });
    await queueGardenPreviewBlobDeletion({
        imageUrl: `https://example.test/${secondPathname}`,
        pathname: secondPathname,
        reason: 'orphaned',
    });

    const now = new Date('2100-07-11T13:00:00.000Z');
    const targetedClaimId = randomUUID();
    const targeted = await claimGardenPreviewBlobDeletion({
        claimId: targetedClaimId,
        expiresAt: new Date('2100-07-11T13:01:00.000Z'),
        now,
        pathname: firstPathname,
    });
    assert.equal(targeted?.pathname, firstPathname);
    assert.equal(
        await completeGardenPreviewBlobDeletions({
            claimId: 'wrong-claim',
            ids: targeted ? [targeted.id] : [],
        }),
        0,
    );

    const retryAt = new Date('2100-07-11T13:05:00.000Z');
    assert.equal(
        await recordGardenPreviewBlobDeletionFailures({
            attemptedAt: now,
            claimId: targetedClaimId,
            failures: targeted
                ? [{ error: 'temporary failure', id: targeted.id, retryAt }]
                : [],
        }),
        1,
    );
    assert.equal(
        (
            await listGardenPreviewBlobDeletions({
                now: new Date('2100-07-11T13:04:59.000Z'),
            })
        ).some((row) => row.pathname === firstPathname),
        false,
    );

    const batchClaimId = randomUUID();
    const claimed = await claimGardenPreviewBlobDeletions({
        claimId: batchClaimId,
        expiresAt: new Date('2100-07-11T13:06:00.000Z'),
        now: retryAt,
    });
    assert.deepStrictEqual(
        new Set(claimed.map((row) => row.pathname)),
        new Set([firstPathname, secondPathname]),
    );
    assert.deepStrictEqual(
        await claimGardenPreviewBlobDeletions({
            claimId: randomUUID(),
            expiresAt: new Date('2100-07-11T13:06:00.000Z'),
            now: retryAt,
        }),
        [],
    );
    assert.equal(
        await completeGardenPreviewBlobDeletions({
            claimId: batchClaimId,
            ids: claimed.map((row) => row.id),
        }),
        2,
    );
});

test('garden preview Blob scan cursor survives each scan page', async () => {
    await setGardenPreviewBlobScanCursor('next-page-token');
    assert.equal(await getGardenPreviewBlobScanCursor(), 'next-page-token');
    await setGardenPreviewBlobScanCursor(null);
    assert.equal(await getGardenPreviewBlobScanCursor(), null);
});
