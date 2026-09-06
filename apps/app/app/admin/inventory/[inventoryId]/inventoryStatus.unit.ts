import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getInventoryItemState,
    isInventoryItemOrphaned,
    normalizeInventoryLinkFilter,
    normalizeInventoryStateFilter,
} from './inventoryStatus.ts';

test('getInventoryItemState marks zero quantity as critical', () => {
    assert.equal(
        getInventoryItemState({ quantity: 0, lowCountThreshold: null }),
        'critical',
    );
    assert.equal(
        getInventoryItemState({ quantity: 0, lowCountThreshold: 3 }, null),
        'critical',
    );
});

test('getInventoryItemState marks low stock as warning', () => {
    assert.equal(
        getInventoryItemState({ quantity: 3, lowCountThreshold: 3 }),
        'warning',
    );
    assert.equal(
        getInventoryItemState({ quantity: 2, lowCountThreshold: null }, 5),
        'warning',
    );
});

test('getInventoryItemState marks stock above the threshold as ok', () => {
    assert.equal(
        getInventoryItemState({ quantity: 4, lowCountThreshold: 3 }),
        'ok',
    );
    assert.equal(
        getInventoryItemState({ quantity: 1, lowCountThreshold: null }),
        'ok',
    );
});

test('normalizeInventoryStateFilter accepts supported state aliases', () => {
    assert.equal(normalizeInventoryStateFilter('ok'), 'ok');
    assert.equal(normalizeInventoryStateFilter('warning'), 'warning');
    assert.equal(normalizeInventoryStateFilter('critical'), 'critical');
    assert.equal(normalizeInventoryStateFilter('error'), 'critical');
    assert.equal(normalizeInventoryStateFilter('unknown'), '');
});

test('isInventoryItemOrphaned ignores items without an entity reference', () => {
    assert.equal(
        isInventoryItemOrphaned({ entityId: null, entity: null }),
        false,
    );
});

test('isInventoryItemOrphaned marks references to deleted entities', () => {
    assert.equal(
        isInventoryItemOrphaned({ entityId: 317, entity: { isDeleted: true } }),
        true,
    );
});

test('isInventoryItemOrphaned marks references to missing entities', () => {
    assert.equal(
        isInventoryItemOrphaned({ entityId: 317, entity: null }),
        true,
    );
});

test('isInventoryItemOrphaned keeps live references linked', () => {
    assert.equal(
        isInventoryItemOrphaned({ entityId: 520, entity: { isDeleted: false } }),
        false,
    );
});

test('normalizeInventoryLinkFilter accepts only the orphaned filter', () => {
    assert.equal(normalizeInventoryLinkFilter('orphaned'), 'orphaned');
    assert.equal(normalizeInventoryLinkFilter(''), '');
    assert.equal(normalizeInventoryLinkFilter('linked'), '');
});
