import { type ComponentProps, useContext } from 'react';
import { RetainedEntitySlot } from './RetainedEntitySlot';
import { RetainedEntitySceneContext } from './retainedEntitySceneContext';

export function SceneDependentEntitySlot(
    props: ComponentProps<typeof RetainedEntitySlot>,
) {
    const stacks = useContext(RetainedEntitySceneContext);
    return <RetainedEntitySlot {...props} stacks={stacks} />;
}
