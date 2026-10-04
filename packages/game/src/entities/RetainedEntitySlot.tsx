import { Suspense } from 'react';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import {
    formatBlockPlacementDropAnimationRenderIdentity,
    getBlockPlacementDropAnimationRenderIdForBlockId,
    useGameState,
} from '../useGameState';
import { EntityFactory } from './EntityFactory';
import { instancedBlockNames } from './EntityInstances';

export function RetainedEntitySlot({
    noControl,
    ...props
}: EntityInstanceProps & { noControl?: boolean }) {
    const renderId = useGameState((state) =>
        getBlockPlacementDropAnimationRenderIdForBlockId(
            state.blockPlacementDropAnimations,
            props.block.id,
        ),
    );
    return (
        <Suspense
            key={formatBlockPlacementDropAnimationRenderIdentity(
                props.block.id,
                renderId,
            )}
            fallback={null}
        >
            <EntityFactory
                {...props}
                name={props.block.name}
                noControl={noControl}
                noRenderInView={instancedBlockNames}
            />
        </Suspense>
    );
}
