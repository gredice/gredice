import 'server-only';
import { and, asc, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import {
    gardenPreviewBlobDeletions,
    gardenPreviewBlobScanStates,
    gardenPreviewCaptureLeases,
    gardenPreviews,
    gardens,
    type InsertGardenPreview,
    type SelectGardenPreview,
    type SelectGardenPreviewBlobDeletion,
    type SelectGardenPreviewCaptureLease,
} from '../schema';
import { storage } from '../storage';

type StorageClient = ReturnType<typeof storage>;
type TransactionClient = Parameters<
    Parameters<StorageClient['transaction']>[0]
>[0];
type DatabaseClient = StorageClient | TransactionClient;

const GARDEN_PREVIEW_BLOB_SCAN_STATE_NAME = 'garden-previews';
const DEFAULT_BLOB_DELETION_BATCH_SIZE = 100;
const MAX_BLOB_DELETION_BATCH_SIZE = 1_000;
const MAX_BLOB_DELETION_ERROR_LENGTH = 2_000;

export type GardenPreviewBlobDeletionReason =
    | 'garden_deleted'
    | 'garden_unpublished'
    | 'orphaned'
    | 'preview_removed'
    | 'preview_replaced';

export type GardenPreviewImage = {
    url: string;
    width: number;
    height: number;
    sourceRevision: string;
    rendererVersion: string;
    capturedAt: Date;
};

export function toGardenPreviewImage(
    preview: SelectGardenPreview | null | undefined,
): GardenPreviewImage | null {
    if (!preview) {
        return null;
    }

    return {
        url: preview.imageUrl,
        width: preview.width,
        height: preview.height,
        sourceRevision: preview.sourceRevision,
        rendererVersion: preview.rendererVersion,
        capturedAt: preview.capturedAt,
    };
}

export async function getGardenPreview(gardenId: number) {
    return (
        (await storage().query.gardenPreviews.findFirst({
            where: eq(gardenPreviews.gardenId, gardenId),
        })) ?? null
    );
}

export async function listGardenPreviewPathnames() {
    const previews = await storage()
        .select({ pathname: gardenPreviews.pathname })
        .from(gardenPreviews)
        .innerJoin(gardens, eq(gardenPreviews.gardenId, gardens.id))
        .where(and(eq(gardens.isDeleted, false), eq(gardens.isPublic, true)));
    return previews.map((preview) => preview.pathname);
}

export type AcquireGardenPreviewCaptureLeaseInput = {
    gardenId: number;
    leaseId: string;
    expiresAt: Date;
    now?: Date;
};

export async function acquireGardenPreviewCaptureLease({
    gardenId,
    leaseId,
    expiresAt,
    now = new Date(),
}: AcquireGardenPreviewCaptureLeaseInput): Promise<SelectGardenPreviewCaptureLease | null> {
    if (expiresAt.getTime() <= now.getTime()) {
        throw new RangeError(
            'Garden preview capture lease must expire in the future',
        );
    }

    return storage().transaction(async (tx) => {
        const [garden] = await tx
            .select({ id: gardens.id })
            .from(gardens)
            .where(
                and(
                    eq(gardens.id, gardenId),
                    eq(gardens.isDeleted, false),
                    eq(gardens.isPublic, true),
                ),
            )
            .for('update')
            .limit(1);

        if (!garden) {
            return null;
        }

        const [lease] = await tx
            .insert(gardenPreviewCaptureLeases)
            .values({
                acquiredAt: now,
                expiresAt,
                gardenId,
                leaseId,
                updatedAt: now,
            })
            .onConflictDoUpdate({
                target: gardenPreviewCaptureLeases.gardenId,
                set: {
                    acquiredAt: now,
                    expiresAt,
                    leaseId,
                    updatedAt: now,
                },
                setWhere: or(
                    lte(gardenPreviewCaptureLeases.expiresAt, now),
                    eq(gardenPreviewCaptureLeases.leaseId, leaseId),
                ),
            })
            .returning();

        return lease ?? null;
    });
}

export async function releaseGardenPreviewCaptureLease({
    gardenId,
    leaseId,
}: {
    gardenId: number;
    leaseId: string;
}) {
    const [released] = await storage()
        .delete(gardenPreviewCaptureLeases)
        .where(
            and(
                eq(gardenPreviewCaptureLeases.gardenId, gardenId),
                eq(gardenPreviewCaptureLeases.leaseId, leaseId),
            ),
        )
        .returning({ gardenId: gardenPreviewCaptureLeases.gardenId });

    return Boolean(released);
}

export type QueueGardenPreviewBlobDeletionInput = {
    pathname: string;
    imageUrl: string;
    reason?: GardenPreviewBlobDeletionReason;
};

async function queueGardenPreviewBlobDeletionUsing(
    db: DatabaseClient,
    {
        pathname,
        imageUrl,
        reason = 'preview_removed',
    }: QueueGardenPreviewBlobDeletionInput,
): Promise<SelectGardenPreviewBlobDeletion> {
    const [created] = await db
        .insert(gardenPreviewBlobDeletions)
        .values({ imageUrl, pathname, reason })
        .onConflictDoNothing({
            target: gardenPreviewBlobDeletions.pathname,
        })
        .returning();

    if (created) {
        return created;
    }

    const [existing] = await db
        .select()
        .from(gardenPreviewBlobDeletions)
        .where(eq(gardenPreviewBlobDeletions.pathname, pathname))
        .limit(1);

    if (!existing) {
        throw new Error('Failed to queue garden preview Blob deletion');
    }

    return existing;
}

export function queueGardenPreviewBlobDeletion(
    input: QueueGardenPreviewBlobDeletionInput,
) {
    return queueGardenPreviewBlobDeletionUsing(storage(), input);
}

export async function removeGardenPreviewAndQueueBlobDeletionUsing(
    db: DatabaseClient,
    gardenId: number,
    reason: GardenPreviewBlobDeletionReason,
) {
    const [preview] = await db
        .delete(gardenPreviews)
        .where(eq(gardenPreviews.gardenId, gardenId))
        .returning();

    if (!preview) {
        return null;
    }

    await queueGardenPreviewBlobDeletionUsing(db, {
        imageUrl: preview.imageUrl,
        pathname: preview.pathname,
        reason,
    });

    return preview;
}

export async function removeGardenPreviewAndQueueBlobDeletion(
    gardenId: number,
    reason: GardenPreviewBlobDeletionReason = 'preview_removed',
) {
    return storage().transaction((tx) =>
        removeGardenPreviewAndQueueBlobDeletionUsing(tx, gardenId, reason),
    );
}

export type ClaimGardenPreviewBlobDeletionsInput = {
    claimId: string;
    expiresAt: Date;
    limit?: number;
    now?: Date;
};

export async function claimGardenPreviewBlobDeletion({
    pathname,
    claimId,
    expiresAt,
    now = new Date(),
}: {
    pathname: string;
    claimId: string;
    expiresAt: Date;
    now?: Date;
}) {
    if (expiresAt.getTime() <= now.getTime()) {
        throw new RangeError(
            'Garden preview Blob deletion claim must expire in the future',
        );
    }

    const [claimed] = await storage()
        .update(gardenPreviewBlobDeletions)
        .set({
            claimExpiresAt: expiresAt,
            claimId,
            lastAttemptAt: now,
            updatedAt: now,
        })
        .where(
            and(
                eq(gardenPreviewBlobDeletions.pathname, pathname),
                lte(gardenPreviewBlobDeletions.nextAttemptAt, now),
                or(
                    isNull(gardenPreviewBlobDeletions.claimExpiresAt),
                    lte(gardenPreviewBlobDeletions.claimExpiresAt, now),
                    eq(gardenPreviewBlobDeletions.claimId, claimId),
                ),
            ),
        )
        .returning();

    return claimed ?? null;
}

function normalizeBlobDeletionBatchSize(limit?: number) {
    return Math.min(
        MAX_BLOB_DELETION_BATCH_SIZE,
        Math.max(1, Math.floor(limit ?? DEFAULT_BLOB_DELETION_BATCH_SIZE)),
    );
}

function dueGardenPreviewBlobDeletionWhere(now: Date) {
    return and(
        lte(gardenPreviewBlobDeletions.nextAttemptAt, now),
        or(
            isNull(gardenPreviewBlobDeletions.claimExpiresAt),
            lte(gardenPreviewBlobDeletions.claimExpiresAt, now),
        ),
    );
}

export function listGardenPreviewBlobDeletions({
    limit,
    now = new Date(),
}: {
    limit?: number;
    now?: Date;
} = {}) {
    return storage()
        .select()
        .from(gardenPreviewBlobDeletions)
        .where(dueGardenPreviewBlobDeletionWhere(now))
        .orderBy(
            asc(gardenPreviewBlobDeletions.nextAttemptAt),
            asc(gardenPreviewBlobDeletions.id),
        )
        .limit(normalizeBlobDeletionBatchSize(limit));
}

export async function claimGardenPreviewBlobDeletions({
    claimId,
    expiresAt,
    limit,
    now = new Date(),
}: ClaimGardenPreviewBlobDeletionsInput) {
    if (expiresAt.getTime() <= now.getTime()) {
        throw new RangeError(
            'Garden preview Blob deletion claim must expire in the future',
        );
    }

    return storage().transaction(async (tx) => {
        const rows = await tx
            .select({ id: gardenPreviewBlobDeletions.id })
            .from(gardenPreviewBlobDeletions)
            .where(dueGardenPreviewBlobDeletionWhere(now))
            .orderBy(
                asc(gardenPreviewBlobDeletions.nextAttemptAt),
                asc(gardenPreviewBlobDeletions.id),
            )
            .for('update', { skipLocked: true })
            .limit(normalizeBlobDeletionBatchSize(limit));

        const ids = rows.map((row) => row.id);
        if (ids.length === 0) {
            return [];
        }

        const claimed = await tx
            .update(gardenPreviewBlobDeletions)
            .set({
                claimExpiresAt: expiresAt,
                claimId,
                lastAttemptAt: now,
                updatedAt: now,
            })
            .where(inArray(gardenPreviewBlobDeletions.id, ids))
            .returning();
        const claimedById = new Map(claimed.map((row) => [row.id, row]));

        return ids.flatMap((id) => {
            const row = claimedById.get(id);
            return row ? [row] : [];
        });
    });
}

export async function completeGardenPreviewBlobDeletions({
    claimId,
    ids,
}: {
    claimId: string;
    ids: number[];
}) {
    if (ids.length === 0) {
        return 0;
    }

    const completed = await storage()
        .delete(gardenPreviewBlobDeletions)
        .where(
            and(
                eq(gardenPreviewBlobDeletions.claimId, claimId),
                inArray(gardenPreviewBlobDeletions.id, ids),
            ),
        )
        .returning({ id: gardenPreviewBlobDeletions.id });

    return completed.length;
}

export type GardenPreviewBlobDeletionFailure = {
    id: number;
    error: string;
    retryAt: Date;
};

export async function recordGardenPreviewBlobDeletionFailures({
    claimId,
    failures,
    attemptedAt = new Date(),
}: {
    claimId: string;
    failures: GardenPreviewBlobDeletionFailure[];
    attemptedAt?: Date;
}) {
    if (failures.length === 0) {
        return 0;
    }

    return storage().transaction(async (tx) => {
        let recorded = 0;
        for (const failure of failures) {
            const [updated] = await tx
                .update(gardenPreviewBlobDeletions)
                .set({
                    attempts: sql`${gardenPreviewBlobDeletions.attempts} + 1`,
                    claimExpiresAt: null,
                    claimId: null,
                    lastAttemptAt: attemptedAt,
                    lastError: failure.error.slice(
                        0,
                        MAX_BLOB_DELETION_ERROR_LENGTH,
                    ),
                    nextAttemptAt: failure.retryAt,
                    updatedAt: attemptedAt,
                })
                .where(
                    and(
                        eq(gardenPreviewBlobDeletions.id, failure.id),
                        eq(gardenPreviewBlobDeletions.claimId, claimId),
                    ),
                )
                .returning({ id: gardenPreviewBlobDeletions.id });
            if (updated) {
                recorded += 1;
            }
        }
        return recorded;
    });
}

export async function getGardenPreviewBlobScanCursor() {
    const [state] = await storage()
        .select({ cursor: gardenPreviewBlobScanStates.cursor })
        .from(gardenPreviewBlobScanStates)
        .where(
            eq(
                gardenPreviewBlobScanStates.name,
                GARDEN_PREVIEW_BLOB_SCAN_STATE_NAME,
            ),
        )
        .limit(1);

    return state?.cursor ?? null;
}

export async function setGardenPreviewBlobScanCursor(cursor: string | null) {
    const now = new Date();
    await storage()
        .insert(gardenPreviewBlobScanStates)
        .values({
            cursor,
            name: GARDEN_PREVIEW_BLOB_SCAN_STATE_NAME,
            updatedAt: now,
        })
        .onConflictDoUpdate({
            target: gardenPreviewBlobScanStates.name,
            set: { cursor, updatedAt: now },
        });
}

export type ReplaceGardenPreviewInput = Omit<
    InsertGardenPreview,
    'createdAt' | 'updatedAt'
>;

export type ReplaceGardenPreviewResult =
    | {
          status: 'accepted';
          preview: SelectGardenPreview;
          previousPreview: SelectGardenPreview | null;
      }
    | {
          status: 'unchanged';
          preview: SelectGardenPreview;
          previousPreview: null;
      }
    | {
          status: 'rejected';
          reason: 'garden_unavailable' | 'newer_capture_exists';
          previousPreview: SelectGardenPreview | null;
      };

export async function replaceGardenPreview(
    input: ReplaceGardenPreviewInput,
): Promise<ReplaceGardenPreviewResult> {
    return storage().transaction(async (tx) => {
        const [garden] = await tx
            .select({ id: gardens.id })
            .from(gardens)
            .where(
                and(
                    eq(gardens.id, input.gardenId),
                    eq(gardens.isDeleted, false),
                    eq(gardens.isPublic, true),
                ),
            )
            .for('update')
            .limit(1);

        if (!garden) {
            return {
                status: 'rejected',
                reason: 'garden_unavailable',
                previousPreview: null,
            };
        }

        const existing =
            (await tx.query.gardenPreviews.findFirst({
                where: eq(gardenPreviews.gardenId, input.gardenId),
            })) ?? null;

        if (
            existing?.captureRequestId === input.captureRequestId &&
            existing.imageUrl === input.imageUrl
        ) {
            return {
                status: 'unchanged',
                preview: existing,
                previousPreview: null,
            };
        }

        if (
            existing &&
            existing.captureRequestedAt.getTime() >
                input.captureRequestedAt.getTime()
        ) {
            return {
                status: 'rejected',
                reason: 'newer_capture_exists',
                previousPreview: existing,
            };
        }

        const [preview] = await tx
            .insert(gardenPreviews)
            .values(input)
            .onConflictDoUpdate({
                target: gardenPreviews.gardenId,
                set: {
                    captureRequestId: input.captureRequestId,
                    imageUrl: input.imageUrl,
                    pathname: input.pathname,
                    contentType: input.contentType,
                    byteSize: input.byteSize,
                    width: input.width,
                    height: input.height,
                    sourceRevision: input.sourceRevision,
                    rendererVersion: input.rendererVersion,
                    captureRequestedAt: input.captureRequestedAt,
                    capturedAt: input.capturedAt,
                    updatedAt: new Date(),
                },
            })
            .returning();

        if (!preview) {
            throw new Error('Failed to persist garden preview');
        }

        if (existing && existing.pathname !== preview.pathname) {
            await queueGardenPreviewBlobDeletionUsing(tx, {
                imageUrl: existing.imageUrl,
                pathname: existing.pathname,
                reason: 'preview_replaced',
            });
        }

        return {
            status: 'accepted',
            preview,
            previousPreview: existing,
        };
    });
}

export async function removeGardenPreview(gardenId: number) {
    return removeGardenPreviewAndQueueBlobDeletion(gardenId);
}
