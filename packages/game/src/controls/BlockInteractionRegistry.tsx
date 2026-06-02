'use client';

import type { ThreeEvent } from '@react-three/fiber';
import {
    createContext,
    type PropsWithChildren,
    useContext,
    useLayoutEffect,
    useMemo,
    useRef,
} from 'react';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';

export type BlockInteractionTarget = {
    block: Block;
    blockIndex: number;
    stack: Stack;
};

export type BlockInteractionHandlers = {
    onClick?: (event: ThreeEvent<MouseEvent>) => void;
    onPointerDown?: (event: ThreeEvent<PointerEvent>) => void;
    onRotatePointerDown?: (event: ThreeEvent<PointerEvent>) => void;
    onRotatePointerLeave?: (event: ThreeEvent<PointerEvent>) => void;
    onRotatePointerUp?: (event: ThreeEvent<PointerEvent>) => void;
    onSelectClick?: (event: ThreeEvent<MouseEvent>) => void;
};

type RegisteredBlockInteractionTarget = BlockInteractionTarget & {
    handlers: BlockInteractionHandlers;
};

type BlockInteractionRegistry = {
    getTarget: (key: string) => RegisteredBlockInteractionTarget | undefined;
    register: (
        key: string,
        target: BlockInteractionTarget,
        handlers: BlockInteractionHandlers,
    ) => () => void;
};

const BlockInteractionRegistryContext =
    createContext<BlockInteractionRegistry | null>(null);

export function createBlockInteractionTargetKey({
    blockId,
    blockIndex,
    stackPosition,
}: {
    blockId: string;
    blockIndex: number;
    stackPosition: { x: number; z: number };
}) {
    return `${stackPosition.x}|${stackPosition.z}|${blockId}|${blockIndex}`;
}

export function BlockInteractionRegistryProvider({
    children,
}: PropsWithChildren) {
    const targetsRef = useRef(
        new Map<string, RegisteredBlockInteractionTarget>(),
    );
    const registry = useMemo<BlockInteractionRegistry>(
        () => ({
            getTarget: (key) => targetsRef.current.get(key),
            register: (key, target, handlers) => {
                const currentTarget = targetsRef.current.get(key);
                const handlerKeys = Object.keys(
                    handlers,
                ) as (keyof BlockInteractionHandlers)[];

                targetsRef.current.set(key, {
                    ...target,
                    handlers: {
                        ...currentTarget?.handlers,
                        ...handlers,
                    },
                });

                return () => {
                    const registeredTarget = targetsRef.current.get(key);
                    if (!registeredTarget) {
                        return;
                    }

                    const nextHandlers = { ...registeredTarget.handlers };
                    for (const handlerKey of handlerKeys) {
                        if (nextHandlers[handlerKey] === handlers[handlerKey]) {
                            delete nextHandlers[handlerKey];
                        }
                    }

                    if (Object.keys(nextHandlers).length === 0) {
                        targetsRef.current.delete(key);
                        return;
                    }

                    targetsRef.current.set(key, {
                        ...registeredTarget,
                        handlers: nextHandlers,
                    });
                };
            },
        }),
        [],
    );

    return (
        <BlockInteractionRegistryContext.Provider value={registry}>
            {children}
        </BlockInteractionRegistryContext.Provider>
    );
}

export function useBlockInteractionRegistry() {
    return useContext(BlockInteractionRegistryContext);
}

export function useBlockInteractionTargetRegistration(
    key: string | undefined,
    target: BlockInteractionTarget | undefined,
    handlers: BlockInteractionHandlers,
) {
    const registry = useBlockInteractionRegistry();

    useLayoutEffect(() => {
        if (!key || !target || !registry) {
            return;
        }

        return registry.register(key, target, handlers);
    });
}
