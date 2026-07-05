import type { BlockData } from '@gredice/client';
import { orderBy } from '@gredice/js/arrays';
import { getBlockImageUrl } from '@gredice/ui/BlockImage';
import type { HTMLAttributes } from 'react';

export type GardenDisplay2DProps = {
    garden: {
        stacks: {
            [x: string]: {
                [x: string]: {
                    id: string;
                    name: string;
                    rotation?: number | null;
                }[];
            };
        };
    };
    blockData: BlockData[];

    /**
     * Size of the viewport in pixels
     * @default 600
     */
    viewportSize?: number;
    viewportOffset?: { x: number; y: number };

    /**
     * Size of a block in pixels
     * @default 128
     */
    blockSize?: number;
    blockImageSrcByKey?: ReadonlyMap<string, string>;
} & HTMLAttributes<HTMLDivElement>;

export function getGardenDisplayRotationSuffix(rotation?: number | null) {
    return ((((rotation ?? 0) % 4) + 4) % 4) + 1;
}

export function getGardenDisplayBlockImageKey(
    blockName: string,
    rotationSuffix: number | string,
) {
    return `${blockName}:${rotationSuffix.toString()}`;
}

export function getGardenDisplayProjectedPosition({
    blockSize = 128,
    position,
    viewportSize = 600,
}: {
    blockSize?: number;
    position: { x: number; y: number };
    viewportSize?: number;
}) {
    const ySize = blockSize - blockSize * 0.538;
    const xSize = blockSize - blockSize * 0.154;

    return {
        top: viewportSize / 2 + (-position.y - position.x) * (ySize / 2),
        left: viewportSize / 2 - (-position.y + position.x) * (xSize / 2),
    };
}

export function getGardenDisplayViewportOffset({
    blockSize,
    focus,
    viewportCenter,
    viewportSize,
}: {
    blockSize?: number;
    focus: { x: number; y: number };
    viewportCenter: { x: number; y: number };
    viewportSize?: number;
}) {
    const projected = getGardenDisplayProjectedPosition({
        blockSize,
        position: focus,
        viewportSize,
    });

    return {
        x: projected.left - viewportCenter.x,
        y: projected.top - viewportCenter.y,
    };
}

export function getGardenDisplayViewportPosition({
    projectedPosition,
    viewportOffset,
}: {
    projectedPosition: { top: number; left: number };
    viewportOffset?: { x: number; y: number };
}) {
    return {
        top: projectedPosition.top - (viewportOffset?.y ?? 0),
        left: projectedPosition.left - (viewportOffset?.x ?? 0),
    };
}

export function GardenDisplay2D({
    blockImageSrcByKey,
    garden,
    blockData,
    viewportSize = 600,
    viewportOffset,
    blockSize = 128,
    style,
    ...rest
}: GardenDisplay2DProps) {
    // Block snapshots have margins so we need to adjust the size
    const ySize = blockSize - blockSize * 0.538;
    const blockHeightByName = new Map<string, number>();
    for (const block of blockData) {
        const name = block.information?.name;
        if (!name) {
            continue;
        }

        blockHeightByName.set(name, block.attributes?.height ?? 0);
    }

    // Expand the garden data to a flat array of stacks
    const stacks: {
        key: string;
        position: { x: number; y: number };
        projectedTop: number;
        projectedLeft: number;
        blocks: { id: string; name: string; rotation?: number | null }[];
    }[] = [];
    const xPositions = Object.keys(garden.stacks);
    for (const x of xPositions) {
        const yPositions = Object.keys(garden.stacks[x]);
        for (const y of yPositions) {
            const blocks = garden.stacks[x][y];
            const positionX = Number(x);
            const positionY = Number(y);
            const projected = getGardenDisplayProjectedPosition({
                blockSize,
                position: { x: positionX, y: positionY },
                viewportSize,
            });
            stacks.push({
                key: `${positionX}_${positionY}`,
                position: { x: positionX, y: positionY },
                projectedTop: projected.top,
                projectedLeft: projected.left,
                blocks: blocks
                    ? blocks.map((block) => {
                          return {
                              id: block.id,
                              name: block.name,
                              rotation: block.rotation,
                          };
                      })
                    : [],
            });
        }
    }

    // Filter stacks that are in view
    const inViewStacks = stacks.filter((stack) => {
        const viewportPosition = getGardenDisplayViewportPosition({
            projectedPosition: {
                top: stack.projectedTop,
                left: stack.projectedLeft,
            },
            viewportOffset,
        });

        // Basic check for stacks overlapping the viewport
        return (
            viewportPosition.top + blockSize > 0 &&
            viewportPosition.left + blockSize > 0 &&
            viewportPosition.top - blockSize < viewportSize &&
            viewportPosition.left - blockSize < viewportSize
        );
    });

    // Order stacks by y position and then by x position to get the correct z-index
    const orderedStacks = orderBy(inViewStacks, (a, b) => {
        if (a.position.y !== b.position.y) {
            return b.position.y - a.position.y;
        }
        return b.position.x - a.position.x;
    });

    const renderedStacks = orderedStacks.map((stack) => {
        let underStackHeight = 0;
        const renderedBlocks = stack.blocks.map((block) => {
            const blockHeight = blockHeightByName.get(block.name) ?? 0;
            const currentUnderStackHeight = underStackHeight;
            underStackHeight += blockHeight;

            // Large blocks do snapshots with zoomed view so we need to compensate with 1.5x size and -0.25x offset
            const isLargeBlock = blockHeight > 1.5;
            const realizedBlockSize = isLargeBlock
                ? blockSize * 1.5
                : blockSize;
            const horizontalOffset = isLargeBlock
                ? -((realizedBlockSize - blockSize) / 2)
                : 0;

            const rotationSuffix = getGardenDisplayRotationSuffix(
                block.rotation,
            );
            const blockImageKey = getGardenDisplayBlockImageKey(
                block.name,
                rotationSuffix,
            );

            return {
                id: block.id,
                name: block.name,
                src:
                    blockImageSrcByKey?.get(blockImageKey) ??
                    getBlockImageUrl(block.name, { rotationSuffix }),
                realizedBlockSize,
                horizontalOffset,
                underStackHeight: currentUnderStackHeight,
            };
        });

        return {
            key: stack.key,
            position: stack.position,
            projectedTop: stack.projectedTop,
            projectedLeft: stack.projectedLeft,
            renderedBlocks,
        };
    });

    return (
        <div {...rest} style={{ position: 'relative', ...style }}>
            {renderedStacks.map((stack) => {
                const viewportPosition = getGardenDisplayViewportPosition({
                    projectedPosition: {
                        top: stack.projectedTop,
                        left: stack.projectedLeft,
                    },
                    viewportOffset,
                });

                return (
                    <div
                        key={stack.key}
                        style={{
                            display: 'flex',
                            position: 'absolute',
                            top: viewportPosition.top,
                            left: viewportPosition.left,
                            width: blockSize,
                            height: blockSize,
                        }}
                    >
                        {stack.renderedBlocks.map((block) => {
                            return (
                                // biome-ignore lint/performance/noImgElement: Not part of NextJS app - OG image generation doesn't support next image
                                <img
                                    key={block.id}
                                    src={block.src}
                                    alt={`${block.name}`}
                                    width={block.realizedBlockSize}
                                    height={block.realizedBlockSize}
                                    style={{
                                        position: 'absolute',
                                        bottom: block.underStackHeight * ySize,
                                        left: block.horizontalOffset,
                                        width: block.realizedBlockSize,
                                        height: block.realizedBlockSize,
                                    }}
                                />
                            );
                        })}
                    </div>
                );
            })}
        </div>
    );
}
