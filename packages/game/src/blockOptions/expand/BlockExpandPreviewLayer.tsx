'use client';

import { useCallback, useMemo, useState } from 'react';
import { ExpandCellPlates } from './ExpandCellPlates';
import {
    ExpandGhostInstances,
    type ExpandGhostStatus,
    isSameExpandGhostStatus,
} from './ExpandGhostInstances';
import { ExpandHandle, isBlockExpandStartedFromKeyboard } from './ExpandHandle';
import type { ExpandCell } from './expandPointer';
import { useBlockExpansionPlan } from './useBlockExpansionPlan';

const loadingGhostStatus: ExpandGhostStatus = { kind: 'loading' };
/**
 * A knob on a block lower than this would sit on the surface; it is raised
 * to stay clear of it.
 */
const minHandleLift = 0.2;

/**
 * The in-scene part of Expand (spec §7.4, §7.5), mounted by
 * `BlockOptionsScene` while editing is in `expand` mode: see-through copies
 * of the block on every cell that gets one, green plates under them, an
 * outline around the rectangle and the corner handle. It reads the shared
 * plan (`useBlockExpansionPlan`), so it shows exactly what the Expand bar
 * counts. While the batch is pending the handle is gone and the corner is
 * locked.
 */
export function BlockExpandPreviewLayer() {
    const expansion = useBlockExpansionPlan();
    // Read in the first render, while the pop-up that started Expand is
    // still in the document (see `isBlockExpandStartedFromKeyboard`).
    const [focusHandle] = useState(isBlockExpandStartedFromKeyboard);
    const [ghostStatus, setGhostStatus] =
        useState<ExpandGhostStatus>(loadingGhostStatus);
    const handleGhostStatus = useCallback((status: ExpandGhostStatus) => {
        setGhostStatus((current) =>
            isSameExpandGhostStatus(current, status) ? current : status,
        );
    }, []);

    const placements = expansion?.plan.placements;
    const cells = useMemo<ExpandCell[]>(
        () =>
            placements?.map((placement) => ({
                x: placement.position.x,
                z: placement.position.y,
            })) ?? [],
        [placements],
    );
    const bounds = expansion?.plan.bounds;
    const cellBounds = useMemo(
        () =>
            bounds
                ? {
                      minX: bounds.minX,
                      maxX: bounds.maxX,
                      minZ: bounds.minY,
                      maxZ: bounds.maxY,
                  }
                : null,
        [bounds],
    );

    if (!expansion || !cellBounds) {
        return null;
    }

    const { editing, plan } = expansion;
    const baseHeight = editing.sourceBaseHeight;
    const handleHeight = Math.max(
        plan.source?.topHeight ?? baseHeight,
        baseHeight + minHandleLift,
    );
    const capacity = editing.maxSide * editing.maxSide;

    return (
        <group name="BlockExpand:Preview">
            <ExpandGhostInstances
                // A template is collected and frozen once per block and turn.
                key={`${editing.blockName}:${editing.rotation}`}
                baseHeight={baseHeight}
                blockName={editing.blockName}
                capacity={capacity}
                cells={cells}
                corner={editing.corner}
                onStatusChange={handleGhostStatus}
                rotation={editing.rotation}
            />
            <ExpandCellPlates
                baseHeight={baseHeight}
                bounds={cellBounds}
                capacity={capacity}
                cells={cells}
            />
            {editing.pending ? null : (
                <ExpandHandle
                    autoFocus={focusHandle}
                    corner={editing.corner}
                    depth={plan.bounds.depth}
                    ghostStatus={ghostStatus}
                    handleHeight={handleHeight}
                    placeCount={plan.placements.length}
                    skippedCount={plan.skippedCount}
                    surfaceHeight={baseHeight}
                    width={plan.bounds.width}
                />
            )}
        </group>
    );
}
