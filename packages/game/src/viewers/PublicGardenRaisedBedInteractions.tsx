'use client';

import { useLayoutEffect, useMemo } from 'react';
import {
    createBlockInteractionTargetKey,
    useBlockInteractionRegistry,
} from '../controls/BlockInteractionRegistry';
import { useHoveredBlockStore } from '../controls/useHoveredBlockStore';
import type { Stack } from '../types/Stack';

export function getPublicGardenRaisedBedInteractionTargets(stacks: Stack[]) {
    return stacks.flatMap((stack) =>
        stack.blocks.flatMap((block, blockIndex) =>
            block.name === 'Raised_Bed'
                ? [
                      {
                          block,
                          blockIndex,
                          key: createBlockInteractionTargetKey({
                              blockId: block.id,
                              blockIndex,
                              stackPosition: stack.position,
                          }),
                          stack,
                      },
                  ]
                : [],
        ),
    );
}

export function PublicGardenRaisedBedInteractions({
    onSelect,
    stacks,
}: {
    onSelect: (blockId: string) => void;
    stacks: Stack[];
}) {
    const registry = useBlockInteractionRegistry();
    const setHoveredBlock = useHoveredBlockStore(
        (state) => state.setHoveredBlock,
    );
    const targets = useMemo(
        () => getPublicGardenRaisedBedInteractionTargets(stacks),
        [stacks],
    );

    useLayoutEffect(() => {
        if (!registry) {
            return;
        }

        let cursorTarget: HTMLElement | null = null;
        const clearPointerCursor = () => {
            if (cursorTarget) {
                cursorTarget.style.cursor = '';
                cursorTarget = null;
            }
        };
        const unregister = targets.map((target) =>
            registry.register(target.key, target, {
                onPointerEnter: (event) => {
                    event.stopPropagation();
                    setHoveredBlock(target.block);
                    if (event.nativeEvent.target instanceof HTMLElement) {
                        clearPointerCursor();
                        cursorTarget = event.nativeEvent.target;
                        cursorTarget.style.cursor = 'pointer';
                    }
                },
                onPointerLeave: (event) => {
                    event.stopPropagation();
                    if (
                        useHoveredBlockStore.getState().hoveredBlock ===
                        target.block
                    ) {
                        setHoveredBlock(null);
                    }
                    clearPointerCursor();
                },
                onSelectClick: (event) => {
                    event.stopPropagation();
                    setHoveredBlock(null);
                    clearPointerCursor();
                    onSelect(target.block.id);
                },
            }),
        );

        return () => {
            for (const unregisterTarget of unregister) {
                unregisterTarget();
            }
            clearPointerCursor();
            setHoveredBlock(null);
        };
    }, [onSelect, registry, setHoveredBlock, targets]);

    return null;
}
