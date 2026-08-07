import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    hoverOutlineAllocationBucketPixels,
    resolveHoverOutlineRegion,
} from './hoverOutlineRegion';

type BinaryMask = {
    height: number;
    pixels: Uint8Array;
    width: number;
};

function createMask(width: number, height: number) {
    return {
        height,
        pixels: new Uint8Array(width * height),
        width,
    };
}

function setMaskPixel(mask: BinaryMask, x: number, y: number) {
    mask.pixels[y * mask.width + x] = 1;
}

function legacyDiskOutline(mask: BinaryMask, thickness: number) {
    const radius = Math.ceil(thickness);
    const thicknessSquared = thickness * thickness;
    const outline = new Uint8Array(mask.pixels.length);

    for (let y = 0; y < mask.height; y += 1) {
        for (let x = 0; x < mask.width; x += 1) {
            const index = y * mask.width + x;
            if (mask.pixels[index] === 1) {
                continue;
            }

            let expanded = false;
            for (
                let offsetY = -radius;
                offsetY <= radius && !expanded;
                offsetY += 1
            ) {
                const sampleY = y + offsetY;
                if (sampleY < 0 || sampleY >= mask.height) {
                    continue;
                }

                for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
                    if (
                        offsetX * offsetX + offsetY * offsetY >
                        thicknessSquared
                    ) {
                        continue;
                    }
                    const sampleX = x + offsetX;
                    if (
                        sampleX >= 0 &&
                        sampleX < mask.width &&
                        mask.pixels[sampleY * mask.width + sampleX] === 1
                    ) {
                        expanded = true;
                        break;
                    }
                }
            }

            outline[index] = expanded ? 1 : 0;
        }
    }

    return outline;
}

function boundedSeparableSquaredDistanceOutline(
    mask: BinaryMask,
    thickness: number,
) {
    const radius = Math.ceil(thickness);
    const thicknessSquared = thickness * thickness;
    const unreachableDistance = 255;
    const horizontalDistances = new Uint8Array(mask.pixels.length);
    horizontalDistances.fill(unreachableDistance);

    for (let y = 0; y < mask.height; y += 1) {
        for (let x = 0; x < mask.width; x += 1) {
            const index = y * mask.width + x;
            for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
                const sampleX = x + offsetX;
                if (
                    sampleX < 0 ||
                    sampleX >= mask.width ||
                    mask.pixels[y * mask.width + sampleX] === 0
                ) {
                    continue;
                }

                horizontalDistances[index] = Math.min(
                    horizontalDistances[index] ?? unreachableDistance,
                    offsetX * offsetX,
                );
            }
        }
    }

    const outline = new Uint8Array(mask.pixels.length);
    for (let y = 0; y < mask.height; y += 1) {
        for (let x = 0; x < mask.width; x += 1) {
            const index = y * mask.width + x;
            if (mask.pixels[index] === 1) {
                continue;
            }

            let distanceSquared = unreachableDistance;
            for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
                const sampleY = y + offsetY;
                if (sampleY < 0 || sampleY >= mask.height) {
                    continue;
                }

                distanceSquared = Math.min(
                    distanceSquared,
                    (horizontalDistances[sampleY * mask.width + x] ??
                        unreachableDistance) +
                        offsetY * offsetY,
                );
            }
            outline[index] = distanceSquared <= thicknessSquared ? 1 : 0;
        }
    }

    return outline;
}

function createDeterministicRandomMask(
    width: number,
    height: number,
    initialSeed: number,
) {
    let seed = initialSeed;
    const mask = createMask(width, height);

    for (let index = 0; index < mask.pixels.length; index += 1) {
        seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
        mask.pixels[index] = seed / 2 ** 32 < 0.16 ? 1 : 0;
    }

    return mask;
}

function assertExactDistanceTransform(
    mask: BinaryMask,
    thicknesses: readonly number[],
) {
    for (const thickness of thicknesses) {
        assert.deepEqual(
            boundedSeparableSquaredDistanceOutline(mask, thickness),
            legacyDiskOutline(mask, thickness),
            `outline differs at thickness ${thickness.toString()}`,
        );
    }
}

describe('resolveHoverOutlineRegion', () => {
    it('snaps projected bounds to bottom-left physical pixels and pads them', () => {
        const region = resolveHoverOutlineRegion({
            bounds: {
                maxX: 0.5,
                maxY: 0.5,
                minX: 0.25,
                minY: 0.25,
            },
            drawingBufferHeight: 500,
            drawingBufferWidth: 1_000,
            thickness: 5,
        });

        assert.deepEqual(region?.crop, {
            height: 139,
            maxX: 507,
            maxY: 257,
            width: 264,
            x: 243,
            y: 118,
        });
        assert.equal(region?.paddingPixels, 7);
        assert.deepEqual(region?.allocationCapacity, {
            height: 160,
            pixels: 46_080,
            width: 288,
        });
        assert.deepEqual(region?.clipping, {
            any: false,
            bottom: false,
            left: false,
            right: false,
            top: false,
        });
    });

    it('uses ceil thickness plus the guard for fractional outlines', () => {
        const region = resolveHoverOutlineRegion({
            bounds: {
                maxX: 0.26,
                maxY: 0.38,
                minX: 0.101,
                minY: 0.203,
            },
            drawingBufferHeight: 200,
            drawingBufferWidth: 300,
            thickness: 3.25,
        });

        assert.equal(region?.paddingPixels, 6);
        assert.deepEqual(region?.crop, {
            height: 48,
            maxX: 84,
            maxY: 82,
            width: 60,
            x: 24,
            y: 34,
        });
        assert.deepEqual(region?.allocationCapacity, {
            height: 64,
            pixels: 4_096,
            width: 64,
        });
    });

    it('clips padded crops at every drawing-buffer edge', () => {
        const bottomLeft = resolveHoverOutlineRegion({
            bounds: {
                maxX: 0.08,
                maxY: 0.06,
                minX: -0.2,
                minY: -0.1,
            },
            drawingBufferHeight: 100,
            drawingBufferWidth: 100,
            thickness: 5,
        });
        const topRight = resolveHoverOutlineRegion({
            bounds: {
                maxX: 1.2,
                maxY: 1.1,
                minX: 0.94,
                minY: 0.92,
            },
            drawingBufferHeight: 100,
            drawingBufferWidth: 100,
            thickness: 5,
        });

        assert.deepEqual(bottomLeft?.crop, {
            height: 13,
            maxX: 15,
            maxY: 13,
            width: 15,
            x: 0,
            y: 0,
        });
        assert.deepEqual(bottomLeft?.clipping, {
            any: true,
            bottom: true,
            left: true,
            right: false,
            top: false,
        });
        assert.deepEqual(topRight?.crop, {
            height: 15,
            maxX: 100,
            maxY: 100,
            width: 13,
            x: 87,
            y: 85,
        });
        assert.deepEqual(topRight?.clipping, {
            any: true,
            bottom: false,
            left: false,
            right: true,
            top: true,
        });
    });

    it('rounds allocation capacity to buckets without exceeding the buffer', () => {
        const bucketed = resolveHoverOutlineRegion({
            allocationBucketPixels: hoverOutlineAllocationBucketPixels,
            bounds: {
                maxX: 0.4,
                maxY: 0.4,
                minX: 0.2,
                minY: 0.2,
            },
            drawingBufferHeight: 200,
            drawingBufferWidth: 200,
            thickness: 1,
        });
        const fullBuffer = resolveHoverOutlineRegion({
            allocationBucketPixels: hoverOutlineAllocationBucketPixels,
            bounds: {
                maxX: 1,
                maxY: 1,
                minX: 0,
                minY: 0,
            },
            drawingBufferHeight: 70,
            drawingBufferWidth: 100,
            thickness: 12,
        });

        assert.deepEqual(bucketed?.allocationCapacity, {
            height: 64,
            pixels: 4_096,
            width: 64,
        });
        assert.deepEqual(fullBuffer?.allocationCapacity, {
            height: 70,
            pixels: 7_000,
            width: 100,
        });
        assert.equal(fullBuffer?.areaRatios.allocationToDrawingBuffer, 1);
        assert.equal(fullBuffer?.areaRatios.cropToAllocation, 1);
        assert.equal(fullBuffer?.areaRatios.cropToDrawingBuffer, 1);
    });

    it('reports crop, allocation, and drawing-buffer area ratios', () => {
        const region = resolveHoverOutlineRegion({
            bounds: {
                maxX: 0.75,
                maxY: 0.75,
                minX: 0.25,
                minY: 0.25,
            },
            drawingBufferHeight: 128,
            drawingBufferWidth: 128,
            thickness: 0,
        });

        assert.equal(region?.crop.width, 68);
        assert.equal(region?.crop.height, 68);
        assert.equal(region?.drawingBuffer.pixels, 16_384);
        assert.equal(region?.allocationCapacity.pixels, 9_216);
        assert.equal(region?.areaRatios.cropToDrawingBuffer, 4_624 / 16_384);
        assert.equal(
            region?.areaRatios.allocationToDrawingBuffer,
            9_216 / 16_384,
        );
        assert.equal(region?.areaRatios.cropToAllocation, 4_624 / 9_216);
    });

    it('rejects fully offscreen, empty, and invalid regions', () => {
        const common = {
            drawingBufferHeight: 100,
            drawingBufferWidth: 100,
            thickness: 5,
        };

        assert.equal(
            resolveHoverOutlineRegion({
                ...common,
                bounds: { maxX: -0.1, maxY: 0.6, minX: -0.5, minY: 0.2 },
            }),
            null,
        );
        assert.equal(
            resolveHoverOutlineRegion({
                ...common,
                bounds: { maxX: 0.8, maxY: 0.2, minX: 0.2, minY: 0.2 },
            }),
            null,
        );
        assert.equal(
            resolveHoverOutlineRegion({
                ...common,
                bounds: {
                    maxX: Number.NaN,
                    maxY: 0.8,
                    minX: 0.2,
                    minY: 0.2,
                },
            }),
            null,
        );
        assert.equal(
            resolveHoverOutlineRegion({
                ...common,
                bounds: { maxX: 0.8, maxY: 0.8, minX: 0.2, minY: 0.2 },
                drawingBufferWidth: 0,
            }),
            null,
        );
        assert.equal(
            resolveHoverOutlineRegion({
                ...common,
                bounds: { maxX: 0.8, maxY: 0.8, minX: 0.2, minY: 0.2 },
                thickness: -1,
            }),
            null,
        );
    });
});

describe('bounded separable squared-distance outline', () => {
    const thicknesses = [1, 2, 3, 3.5, 5, 7, 8, 11.75, 12] as const;

    it('matches the legacy disk for isolated, diagonal, and edge seeds', () => {
        const mask = createMask(31, 23);
        setMaskPixel(mask, 0, 0);
        setMaskPixel(mask, 30, 22);
        setMaskPixel(mask, 15, 11);
        setMaskPixel(mask, 16, 12);

        assertExactDistanceTransform(mask, thicknesses);
    });

    it('matches the legacy disk for a connected-bed union with a hole', () => {
        const mask = createMask(37, 25);
        for (let y = 7; y <= 16; y += 1) {
            for (let x = 5; x <= 28; x += 1) {
                if (x >= 14 && x <= 18 && y >= 10 && y <= 13) {
                    continue;
                }
                setMaskPixel(mask, x, y);
            }
        }

        assertExactDistanceTransform(mask, thicknesses);
    });

    it('matches the legacy disk for deterministic sparse masks through radius 12', () => {
        for (let seed = 1; seed <= 24; seed += 1) {
            assertExactDistanceTransform(
                createDeterministicRandomMask(31, 23, seed),
                thicknesses,
            );
        }
    });

    it('keeps every source-mask pixel outside the resulting outline', () => {
        const mask = createDeterministicRandomMask(31, 23, 42);

        for (const thickness of thicknesses) {
            const outline = boundedSeparableSquaredDistanceOutline(
                mask,
                thickness,
            );
            for (let index = 0; index < mask.pixels.length; index += 1) {
                if (mask.pixels[index] === 1) {
                    assert.equal(outline[index], 0);
                }
            }
        }
    });
});
