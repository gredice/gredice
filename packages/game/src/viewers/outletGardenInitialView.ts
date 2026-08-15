import { Vector3 } from 'three';
import {
    getOutletGardenOfferPlacement,
    type OutletGardenDisplayUnit,
    type OutletGardenSlotAssignments,
} from './outletGardenLayout';
import type { PublicGardenInitialView } from './PublicGardenViewer';

const outletGardenInitialCameraZoom = 120;
const outletGardenTabletopFocusHeight = 1.5;

export function getOutletGardenInitialView({
    displayUnits,
    fittedView,
    slotAssignments,
}: {
    displayUnits: readonly OutletGardenDisplayUnit[];
    fittedView: PublicGardenInitialView;
    slotAssignments: OutletGardenSlotAssignments;
}): PublicGardenInitialView {
    const tabletopPlacements = displayUnits
        .flatMap((display) => {
            const assignment = slotAssignments.get(display.blockId);
            if (!assignment) {
                return [];
            }

            const placement = getOutletGardenOfferPlacement(
                assignment.slotIndex,
            );
            return placement.surface === 'table' ? [placement] : [];
        })
        .sort(
            (left, right) =>
                left.plantBay - right.plantBay ||
                left.x - right.x ||
                left.y - right.y,
        );
    const firstTablePlantBay = tabletopPlacements[0]?.plantBay;
    if (firstTablePlantBay === undefined) {
        return fittedView;
    }

    const firstTablePlacements = tabletopPlacements.filter(
        (placement) => placement.plantBay === firstTablePlantBay,
    );
    const cameraTarget = new Vector3(
        firstTablePlacements.reduce((sum, placement) => sum + placement.x, 0) /
            firstTablePlacements.length,
        outletGardenTabletopFocusHeight,
        firstTablePlacements.reduce((sum, placement) => sum + placement.y, 0) /
            firstTablePlacements.length,
    );
    const cameraOffset = cameraTarget.clone().sub(fittedView.cameraTarget);

    return {
        cameraPosition: fittedView.cameraPosition.clone().add(cameraOffset),
        cameraTarget,
        cameraZoom: Math.max(
            fittedView.cameraZoom,
            outletGardenInitialCameraZoom,
        ),
    };
}
