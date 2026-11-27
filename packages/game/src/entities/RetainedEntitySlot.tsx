import { Suspense } from 'react';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import {
    resolveBlockPlacementDropAnimationRenderIdentity,
    useGameState,
} from '../useGameState';
import { EntityFactory } from './EntityFactory';
import { instancedBlockNames } from './EntityInstances';

export function RetainedEntitySlot({
    noControl,
    ...props
}: EntityInstanceProps & { noControl?: boolean }) {
    const renderIdentity = useGameState((state) =>
        resolveBlockPlacementDropAnimationRenderIdentity(
            props.block.id,
            state.blockPlacementDropAnimations,
        ),
    );
    return (
        <Suspense key={renderIdentity} fallback={null}>
            <EntityFactory
                {...props}
                name={props.block.name}
                noControl={noControl}
                noRenderInView={instancedBlockNames}
            />
        </Suspense>
    );
}
