'use client';

import { useMemo } from 'react';
import { useGameSceneDetails } from '../../GameSceneDetailContext';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { useOperations } from '../../hooks/useOperations';
import {
    type OperationVisualDefinitionInput,
    resolveOperationVisualRewards,
} from '../../operationVisualRewards';
import {
    createRaisedBedFieldInsectProtectionMeshLayout,
    createRaisedBedWholeInsectProtectionMeshLayout,
    RaisedBedInsectProtectionMesh,
    type RaisedBedInsectProtectionMeshBlock,
    type RaisedBedInsectProtectionMeshLayout,
} from './RaisedBedInsectProtectionMesh';
import {
    hasActiveRaisedBedInsectMesh,
    resolveRaisedBedInsectMeshPositions,
} from './raisedBedAgrotextileRewards';

type CurrentGardenData = NonNullable<
    NonNullable<ReturnType<typeof useCurrentGarden>['data']>
>;

export type RaisedBedInsectProtectionMeshResolvedLayout = {
    key: string;
    layout: RaisedBedInsectProtectionMeshLayout;
};

export function resolveRaisedBedInsectProtectionMeshLayouts({
    blocks,
    currentGarden,
    operations,
}: {
    blocks: readonly RaisedBedInsectProtectionMeshBlock[];
    currentGarden: CurrentGardenData | null | undefined;
    operations: OperationVisualDefinitionInput[] | undefined;
}): RaisedBedInsectProtectionMeshResolvedLayout[] {
    if (!currentGarden || !operations) {
        return [];
    }

    const layouts: RaisedBedInsectProtectionMeshResolvedLayout[] = [];

    for (const raisedBed of currentGarden.raisedBeds) {
        const raisedBedBlocks = blocks
            .filter((block) => block.raisedBedId === raisedBed.id)
            .sort((left, right) => left.blockIndex - right.blockIndex);
        if (raisedBedBlocks.length === 0) {
            continue;
        }

        const visualRewards = resolveOperationVisualRewards({
            appliedOperations: (raisedBed.appliedOperations ?? []).map(
                (operation) => ({
                    ...operation,
                    raisedBedId: raisedBed.id,
                }),
            ),
            operations,
        });
        const orientation = raisedBed.orientation ?? 'vertical';

        if (
            hasActiveRaisedBedInsectMesh({
                raisedBedId: raisedBed.id,
                visualRewards,
            })
        ) {
            const layout = createRaisedBedWholeInsectProtectionMeshLayout({
                blocks: raisedBedBlocks,
                orientation,
            });
            if (layout) {
                layouts.push({
                    key: `raised-bed-${raisedBed.id.toString()}-insect-mesh`,
                    layout,
                });
            }
            continue;
        }

        for (const block of raisedBedBlocks) {
            const fieldPositions = resolveRaisedBedInsectMeshPositions({
                blockOffset: block.blockOffset,
                fields: raisedBed.fields,
                raisedBedId: raisedBed.id,
                visualRewards,
            });

            for (const positionIndex of fieldPositions) {
                layouts.push({
                    key: `raised-bed-${raisedBed.id.toString()}-field-${(
                        block.blockOffset + positionIndex
                    ).toString()}-insect-mesh`,
                    layout: createRaisedBedFieldInsectProtectionMeshLayout({
                        block,
                        orientation,
                        positionIndex,
                    }),
                });
            }
        }
    }

    return layouts;
}

export function RaisedBedInsectProtectionMeshes({
    blocks,
}: {
    blocks: RaisedBedInsectProtectionMeshBlock[];
}) {
    const { renderDetails } = useGameSceneDetails();
    const { data: currentGarden } = useCurrentGarden();
    const { data: operations } = useOperations();
    const layouts = useMemo(
        () =>
            renderDetails
                ? resolveRaisedBedInsectProtectionMeshLayouts({
                      blocks,
                      currentGarden,
                      operations,
                  })
                : [],
        [blocks, currentGarden, operations, renderDetails],
    );

    if (layouts.length === 0) {
        return null;
    }

    return (
        <group name={`VisualRewards:InsectProtectionMeshes:${layouts.length}`}>
            {layouts.map((entry) => (
                <RaisedBedInsectProtectionMesh
                    key={entry.key}
                    layout={entry.layout}
                />
            ))}
        </group>
    );
}
