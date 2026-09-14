import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveEntityAnchorPrice } from '../src/helpers/entityAnchorPrice';

const date = '2026-09-10';
const before = new Date('2026-09-01T10:00:00Z');
const after = new Date('2026-09-15T10:00:00Z');
const input = {
    date,
    now: new Date('2026-12-01T10:00:00Z'),
    entity: { createdAt: before, publishedAt: before, state: 'published' },
    value: { value: '5', createdAt: before, updatedAt: before },
    revisions: [],
};
const revision = {
    action: 'attribute.updated',
    previousValue: '5',
    nextValue: '7',
    previousState: null,
    nextState: null,
    createdAt: after,
};

test('unchanged persisted prices and changes older than 30 days retain the anchor', () => {
    assert.deepEqual(resolveEntityAnchorPrice(input), { price: 5, date });
    assert.deepEqual(
        resolveEntityAnchorPrice({
            ...input,
            value: { ...input.value, value: '7', updatedAt: after },
            revisions: [revision],
        }),
        { price: 5, date },
    );
});

test('the first change after the reference day determines the anchor, including reversals', () => {
    assert.deepEqual(
        resolveEntityAnchorPrice({
            ...input,
            revisions: [
                {
                    ...revision,
                    previousValue: '7',
                    nextValue: '5',
                    createdAt: new Date('2026-10-01'),
                },
                revision,
            ],
        }),
        { price: 5, date },
    );
});

test('reference day uses Zagreb midnight rather than the UTC calendar boundary', () => {
    assert.deepEqual(
        resolveEntityAnchorPrice({
            ...input,
            revisions: [
                {
                    ...revision,
                    previousValue: '7',
                    nextValue: '9',
                    createdAt: new Date('2026-09-10T22:00:00Z'),
                },
                { ...revision, createdAt: new Date('2026-09-10T21:59:59Z') },
            ],
        }),
        { price: 7, date },
    );
});

test('missing history, new attributes and deleted prices remain unknown', () => {
    assert.equal(
        resolveEntityAnchorPrice({ ...input, value: undefined }),
        null,
    );
    assert.equal(
        resolveEntityAnchorPrice({
            ...input,
            value: { ...input.value, updatedAt: after },
        }),
        null,
    );
    assert.equal(
        resolveEntityAnchorPrice({
            ...input,
            revisions: [
                {
                    ...revision,
                    action: 'attribute.created',
                    previousValue: null,
                },
            ],
        }),
        null,
    );
    assert.equal(
        resolveEntityAnchorPrice({
            ...input,
            revisions: [
                {
                    ...revision,
                    action: 'attribute.deleted',
                    nextValue: null,
                    createdAt: before,
                },
            ],
        }),
        null,
    );
});

test('new or unpublished offerings have no reference price', () => {
    assert.equal(
        resolveEntityAnchorPrice({
            ...input,
            entity: { ...input.entity, createdAt: after },
        }),
        null,
    );
    assert.equal(
        resolveEntityAnchorPrice({
            ...input,
            entity: { ...input.entity, publishedAt: after },
        }),
        null,
    );
    assert.equal(
        resolveEntityAnchorPrice({
            ...input,
            revisions: [
                {
                    ...revision,
                    action: 'entity.state_changed',
                    previousState: 'draft',
                    nextState: 'published',
                },
            ],
        }),
        null,
    );
    assert.equal(resolveEntityAnchorPrice({ ...input, now: before }), null);
});

test('a later republication does not erase an earlier published price', () => {
    assert.deepEqual(
        resolveEntityAnchorPrice({
            ...input,
            entity: { ...input.entity, publishedAt: after },
            revisions: [
                {
                    ...revision,
                    action: 'entity.state_changed',
                    previousState: 'draft',
                    nextState: 'published',
                },
                {
                    ...revision,
                    action: 'entity.state_changed',
                    previousState: 'published',
                    nextState: 'draft',
                    createdAt: new Date('2026-09-12'),
                },
            ],
        }),
        { price: 5, date },
    );
});

test('dated legacy published states do not require a publishedAt backfill', () => {
    assert.deepEqual(
        resolveEntityAnchorPrice({
            ...input,
            entity: { ...input.entity, publishedAt: null, updatedAt: before },
        }),
        { price: 5, date },
    );
    assert.equal(
        resolveEntityAnchorPrice({
            ...input,
            entity: { ...input.entity, publishedAt: null, updatedAt: after },
        }),
        null,
    );
    assert.deepEqual(
        resolveEntityAnchorPrice({
            ...input,
            entity: { ...input.entity, publishedAt: null, updatedAt: after },
            revisions: [
                {
                    ...revision,
                    action: 'entity.updated',
                    previousState: 'published',
                    nextState: 'published',
                },
            ],
        }),
        { price: 5, date },
    );
});
