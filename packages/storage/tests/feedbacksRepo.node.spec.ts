import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    createFeedback,
    feedbacks,
    storage,
    updateFeedback,
} from '@gredice/storage';
import { eq } from 'drizzle-orm';
import { createTestDb } from './testDb';

test('updateFeedback changes rating and comment without creating another row', async () => {
    createTestDb();
    const topic = `www/test-feedback/${randomUUID()}`;
    const id = await createFeedback({
        topic,
        data: { page: 'plant', userId: 'user-1' },
        score: '1',
        comment: null,
    });

    const updatedId = await updateFeedback(id, {
        score: '-1',
        comment: 'Nedostaje detalja.',
    });

    assert.equal(updatedId, id);

    const rows = await storage()
        .select({
            id: feedbacks.id,
            topic: feedbacks.topic,
            score: feedbacks.score,
            comment: feedbacks.comment,
        })
        .from(feedbacks)
        .where(eq(feedbacks.topic, topic));

    assert.deepEqual(rows, [
        {
            id,
            topic,
            score: '-1',
            comment: 'Nedostaje detalja.',
        },
    ]);
});

test('updateFeedback returns null for an unknown feedback id', async () => {
    createTestDb();

    const updatedId = await updateFeedback(randomUUID(), {
        score: '0',
    });

    assert.equal(updatedId, null);
});
