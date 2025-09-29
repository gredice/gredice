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
                    rotation?: number;
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

    // Expand the garden data to a flat array of stacks
    const stacks: {
        position: { x: number; y: number };
        blocks: { id: string; name: string; rotation?: number }[];
    }[] = [];
    const xPositions = Object.keys(garden.stacks);
    for (const x of xPositions) {
        const yPositions = Object.keys(garden.stacks[x]);
        for (const y of yPositions) {
            const blocks = garden.stacks[x][y];
            stacks.push({
                position: { x: Number(x), y: Number(y) },
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
        const top =
            viewportSize / 2 +
            (-stack.position.y - stack.position.x) * (ySize / 2);
        const left =
            viewportSize / 2 -
            (-stack.position.y + stack.position.x) * (xSize / 2);

        // Basic check for stacks overlapping the viewport
        return (
            top + blockSize > 0 &&
            left + blockSize > 0 &&
            top - blockSize < viewportSize &&
            left - blockSize < viewportSize
        );
    });

    // Order stacks by y position and then by x position to get the correct z-index
    const orderedStacks = orderBy(
        orderBy(inViewStacks, (a, b) => b.position.y - a.position.y),
        (a, b) => b.position.x - a.position.x,
    );

    return (
        <div {...rest}>
            {orderedStacks.map((stack) => (
                <div
                    key={`${stack.position.x}_${stack.position.y}`}
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
                    {stack.blocks.map((block) => {
                        let underStackHeight = 0;
                        for (const currentBlock of stack.blocks) {
                            if (currentBlock.id === block.id) {
                                break;
                            }
                            underStackHeight +=
                                blockData?.find(
                                    (b) =>
                                        b.information.name ===
                                        currentBlock.name,
                                )?.attributes.height ?? 0;
                        }

                        // Large blocks do snaphots with zoomed view so we need to compensite with 1.5x size and -0.25x offset
                        const isLargeBlock =
                            (blockData?.find(
                                (b) => b.information.name === block.name,
                            )?.attributes.height ?? 0) > 1.5;
                        const realizedBlockSize = isLargeBlock
                            ? blockSize * 1.5
                            : blockSize;
                        const horizontalOffset = isLargeBlock
                            ? -((realizedBlockSize - blockSize) / 2)
                            : 0;

                        const rotationIndex =
                            (((block.rotation ?? 0) % 4) + 4) % 4;
                        const rotationSuffix = rotationIndex + 1;
                        return (
                            // biome-ignore lint/performance/noImgElement: Not part of NextJS app - OG image generation doesn't support next image
                            <img
                                key={block.id}
                                src={`https://www.gredice.com/assets/blocks/${block.name}_${rotationSuffix}.png`}
                                alt={`${block.name}`}
                                width={realizedBlockSize}
                                height={realizedBlockSize}
                                style={{
                                    position: 'absolute',
                                    bottom: underStackHeight * ySize,
                                    left: horizontalOffset,
                                    width: realizedBlockSize,
                                    height: realizedBlockSize,
                                }}
                            />
                        );
                    })}
                </div>
            ))}
        </div>
    );
}
