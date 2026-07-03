import type { Block } from '../types/Block';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import type { Stack } from '../types/Stack';
import type { EntityFactoryProps } from './EntityFactory';

type EntityFactoryMemoProps = EntityFactoryProps & EntityInstanceProps;

function isInstancedEntityFactoryProps(props: EntityFactoryMemoProps) {
    return props.noRenderInView?.includes(props.name) ?? false;
}

function areBlocksEqual(left: Block, right: Block) {
    return (
        left === right ||
        (left.id === right.id &&
            left.name === right.name &&
            left.rotation === right.rotation &&
            left.variant === right.variant)
    );
}

function areStackPositionsEqual(left: Stack, right: Stack) {
    return (
        left.position === right.position ||
        (left.position.x === right.position.x &&
            left.position.y === right.position.y &&
            left.position.z === right.position.z)
    );
}

function areStackBlocksEqual(left: Block[], right: Block[]) {
    if (left === right) {
        return true;
    }

    if (left.length !== right.length) {
        return false;
    }

    return left.every((leftBlock, index) => {
        const rightBlock = right[index];
        return Boolean(rightBlock) && areBlocksEqual(leftBlock, rightBlock);
    });
}

function areInstancedStacksEqual(left: Stack, right: Stack) {
    return (
        left === right ||
        (areStackPositionsEqual(left, right) &&
            areStackBlocksEqual(left.blocks, right.blocks))
    );
}

export function areEntityFactoryPropsEqual(
    previous: EntityFactoryMemoProps,
    next: EntityFactoryMemoProps,
) {
    const previousInstanced = isInstancedEntityFactoryProps(previous);
    const nextInstanced = isInstancedEntityFactoryProps(next);

    if (
        previous.name !== next.name ||
        previous.rotation !== next.rotation ||
        previous.variant !== next.variant ||
        previous.noControl !== next.noControl ||
        previous.noRenderInView !== next.noRenderInView ||
        previousInstanced !== nextInstanced
    ) {
        return false;
    }

    if (previousInstanced && nextInstanced) {
        return (
            areBlocksEqual(previous.block, next.block) &&
            areInstancedStacksEqual(previous.stack, next.stack)
        );
    }

    return (
        previous.block === next.block &&
        previous.stack === next.stack &&
        previous.stacks === next.stacks
    );
}
