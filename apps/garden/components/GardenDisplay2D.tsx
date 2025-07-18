import { HTMLAttributes, ImgHTMLAttributes } from "react";
import { orderBy } from '@signalco/js';
import { BlockData } from "@gredice/client";

export type GardenDisplay2DProps = {
    garden: {
        stacks: {
            [x: string]: {
                [x: string]: {
                    id: string;
                    name: string;
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
    viewportOffset?: { x: number, y: number };

    /**
     * Size of a block in pixels
     * @default 128
     */
    blockSize?: number;
} & HTMLAttributes<HTMLDivElement>;

export function HtmlImageBlock({ blockName, ...rest }: ImgHTMLAttributes<HTMLImageElement> & { blockName: string }) {
    return (
        <img
            src={`https://www.gredice.com/assets/blocks/${blockName}.png`}
            {...rest}
        />
    );
}

export function GardenDisplay2D({ garden, blockData, viewportSize = 600, viewportOffset, blockSize = 128, ...rest }: GardenDisplay2DProps) {
    // Block snapshots have margins so we need to adjust the size
    const ySize = blockSize - blockSize * 0.538;
    const xSize = blockSize - blockSize * 0.154;

    // Expand the garden data to a flat array of stacks
    const stacks: { position: { x: number, y: number }, blocks: { id: string, name: string }[] }[] = [];
    const xPositions = Object.keys(garden.stacks);
    for (const x of xPositions) {
        const yPositions = Object.keys(garden.stacks[x]);
        for (const y of yPositions) {
            const blocks = garden.stacks[x][y];
            stacks.push({
                position: { x: Number(x), y: Number(y) },
                blocks: blocks ? blocks.map((block) => {
                    return {
                        id: block.id,
                        name: block.name
                    }
                }) : []
            });
        }
    }

    // Filter stacks that are in view
    const inViewStacks = stacks.filter((stack) => {
        const top = viewportSize / 2 + (-stack.position.y - stack.position.x) * (ySize / 2);
        const left = viewportSize / 2 - (-stack.position.y + stack.position.x) * (xSize / 2);

        // Basic check for stacks overlapping the viewport
        return (
            (top + blockSize) > 0 &&
            (left + blockSize) > 0 &&
            (top - blockSize) < viewportSize &&
            (left - blockSize) < viewportSize
        );
    });

    // Order stacks by y position and then by x position to get the correct z-index
    const orderedStacks = orderBy(
        orderBy(inViewStacks, (a, b) => b.position.y - a.position.y),
        (a, b) => b.position.x - a.position.x
    );

    return (
        <div {...rest}>
            {orderedStacks.map((stack) => (
                <div
                    key={`${stack.position.x}_${stack.position.y}`}
                    style={{
                        display: 'flex',
                        position: 'absolute',
                        top: viewportSize / 2 + (-stack.position.y - stack.position.x) * ySize / 2 - (viewportOffset?.y ?? 0),
                        left: viewportSize / 2 - (-stack.position.y + stack.position.x) * xSize / 2 - (viewportOffset?.x ?? 0),
                        width: blockSize,
                        height: blockSize
                    }}>
                    {stack.blocks.map((block) => {
                        let underStackHeight = 0;
                        for (const currentBlock of stack.blocks) {
                            if (currentBlock.id === block.id) {
                                break;
                            }
                            underStackHeight += blockData?.find(b => b.information.name === currentBlock.name)?.attributes.height ?? 0;
                        }

                        // Large blocks do snaphots with zoomed view so we need to compensite with 1.5x size and -0.25x offset
                        const isLargeBlock = (blockData?.find(b => b.information.name === block.name)?.attributes.height ?? 0) > 1.5;
                        const realizedBlockSize = isLargeBlock ? blockSize * 1.5 : blockSize;
                        const horizontalOffset = isLargeBlock ? -((realizedBlockSize - blockSize) / 2) : 0;

                        return (
                            <HtmlImageBlock
                                key={block.id}
                                blockName={block.name}
                                width={realizedBlockSize}
                                height={realizedBlockSize}
                                style={{
                                    position: 'absolute',
                                    bottom: underStackHeight * ySize,
                                    left: horizontalOffset,
                                    width: realizedBlockSize,
                                    height: realizedBlockSize
                                }} />
                        );
                    })}
                </div>
            ))}
        </div>
    )
}