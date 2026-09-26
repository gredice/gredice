import { Vector3 } from 'three';
import { EntityFactory } from '../src/entities/EntityFactory';
import { useCurrentGarden } from '../src/hooks/useCurrentGarden';
import type { EntityInstanceProps } from '../src/types/runtime/EntityInstanceProps';

/** Read the real optimistic gate variant so the fixture exercises the production toggle. */
export function AutumnEntranceGateInstance(props: EntityInstanceProps) {
    const { data: garden } = useCurrentGarden();
    const stack =
        garden?.stacks.find((stack) =>
            stack.blocks.some((block) => block.id === props.block.id),
        ) ?? props.stack;
    const block =
        stack.blocks.find((block) => block.id === props.block.id) ??
        props.block;
    return (
        <EntityFactory
            {...props}
            name={block.name}
            stack={{
                ...stack,
                position: new Vector3(
                    stack.position.x,
                    stack.position.y,
                    stack.position.z,
                ),
            }}
            block={block}
            noControl
        />
    );
}
