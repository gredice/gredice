import type { BlockData } from '@gredice/client';
import { orderBy } from '@signalco/js';
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
} & HTMLAttributes<HTMLDivElement>;

export function GardenDisplay2D({
    garden,
    blockData,
    viewportSize = 600,
    viewportOffset,
    blockSize = 128,
    ...rest
}: GardenDisplay2DProps) {
    // Block snapshots have margins so we need to adjust the size
    const ySize = blockSize - blockSize * 0.538;
    const xSize = blockSize - blockSize * 0.154;
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
            const projectedTop =
                viewportSize / 2 + (-positionY - positionX) * (ySize / 2);
            const projectedLeft =
                viewportSize / 2 - (-positionY + positionX) * (xSize / 2);
            stacks.push({
                key: `${positionX}_${positionY}`,
                position: { x: positionX, y: positionY },
                projectedTop,
                projectedLeft,
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
        // Basic check for stacks overlapping the viewport
        return (
            stack.projectedTop + blockSize > 0 &&
            stack.projectedLeft + blockSize > 0 &&
            stack.projectedTop - blockSize < viewportSize &&
            stack.projectedLeft - blockSize < viewportSize
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

            const rotationIndex = (((block.rotation ?? 0) % 4) + 4) % 4;
            const rotationSuffix = rotationIndex + 1;

            return {
                id: block.id,
                name: block.name,
                src: `https://www.gredice.com/assets/blocks/${block.name}_${rotationSuffix}.png`,
                realizedBlockSize,
                horizontalOffset,
                underStackHeight: currentUnderStackHeight,
            };
        });

        return {
            key: stack.key,
            position: stack.position,
            renderedBlocks,
        };
    });

    return (
        <div {...rest}>
            {renderedStacks.map((stack) => (
                <div
                    key={stack.key}
                    style={{
                        display: 'flex',
                        position: 'absolute',
                        top:
                            viewportSize / 2 +
                            ((-stack.position.y - stack.position.x) * ySize) /
                                2 -
                            (viewportOffset?.y ?? 0),
                        left:
                            viewportSize / 2 -
                            ((-stack.position.y + stack.position.x) * xSize) /
                                2 -
                            (viewportOffset?.x ?? 0),
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
            ))}
        </div>
    );
}
