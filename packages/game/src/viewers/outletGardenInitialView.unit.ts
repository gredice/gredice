import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector3 } from 'three';
import { getOutletGardenInitialView } from './outletGardenInitialView';
import {
    getOutletGardenDisplayUnits,
    type OutletGardenLayoutOffer,
    reconcileOutletGardenSlots,
} from './outletGardenLayout';

const offers = [
    { id: 301, plantId: 1, plantSortId: 101, remainingQuantity: 2 },
    { id: 302, plantId: 2, plantSortId: 201, remainingQuantity: 3 },
] satisfies OutletGardenLayoutOffer[];

function fittedView(cameraZoom = 42) {
    return {
        cameraPosition: new Vector3(-98, 100, -95),
        cameraTarget: new Vector3(2, 0, 5),
        cameraZoom,
    };
}

describe('getOutletGardenInitialView', () => {
    it('centers the earliest occupied tabletop and starts closer', () => {
        const displayUnits = getOutletGardenDisplayUnits(offers);
        const slotAssignments = reconcileOutletGardenSlots(new Map(), offers);

        const view = getOutletGardenInitialView({
            displayUnits,
            fittedView: fittedView(),
            slotAssignments,
        });

        assert.deepEqual(view.cameraTarget.toArray(), [-2, 1.5, 1.5]);
        assert.deepEqual(view.cameraPosition.toArray(), [-102, 101.5, -98.5]);
        assert.equal(view.cameraZoom, 120);
    });

    it('does not zoom out an already closer fitted view', () => {
        const displayUnits = getOutletGardenDisplayUnits(offers);
        const slotAssignments = reconcileOutletGardenSlots(new Map(), offers);

        const view = getOutletGardenInitialView({
            displayUnits,
            fittedView: fittedView(160),
            slotAssignments,
        });

        assert.equal(view.cameraZoom, 160);
    });

    it('keeps the fitted view when no tabletop offer is available', () => {
        const originalView = fittedView();

        const view = getOutletGardenInitialView({
            displayUnits: [],
            fittedView: originalView,
            slotAssignments: new Map(),
        });

        assert.equal(view, originalView);
    });
});
