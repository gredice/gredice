import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

type ParsedArgs = Map<string, string | boolean>;

type Bounds = {
    bottom: number;
    left: number;
    pixelCount: number;
    right: number;
    top: number;
};

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '../../..');

function parseArgs(argv: string[]): ParsedArgs {
    const parsed = new Map<string, string | boolean>();

    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (!argument?.startsWith('--')) {
            continue;
        }

        const [rawKey, inlineValue] = argument.slice(2).split('=', 2);
        if (inlineValue !== undefined) {
            parsed.set(rawKey, inlineValue);
            continue;
        }

        const next = argv[index + 1];
        if (!next || next.startsWith('--')) {
            parsed.set(rawKey, true);
            continue;
        }

        parsed.set(rawKey, next);
        index += 1;
    }

    return parsed;
}

function getStringArg(
    parsed: ParsedArgs,
    key: string,
    fallback?: string,
): string {
    const value = parsed.get(key);
    if (typeof value === 'string' && value.length > 0) {
        return value;
    }

    if (fallback !== undefined) {
        return fallback;
    }

    throw new Error(`Missing required argument --${key}`);
}

function getNumberArg(
    parsed: ParsedArgs,
    key: string,
    fallback: number,
): number {
    const value = parsed.get(key);
    if (typeof value !== 'string') {
        return fallback;
    }

    const parsedNumber = Number(value);
    if (!Number.isFinite(parsedNumber)) {
        throw new Error(`Argument --${key} must be a number.`);
    }

    return parsedNumber;
}

function getBooleanArg(parsed: ParsedArgs, key: string, fallback: boolean) {
    const value = parsed.get(key);
    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'string') {
        return value !== 'false';
    }

    return fallback;
}

function resolveFromRepositoryRoot(targetPath: string): string {
    return path.isAbsolute(targetPath)
        ? targetPath
        : path.resolve(repositoryRoot, targetPath);
}

function padSpriteNumber(index: number) {
    return String(index + 1).padStart(2, '0');
}

function boundsOverlap(left: Bounds, right: Bounds, mergeGap: number) {
    return (
        left.left <= right.right + mergeGap &&
        left.right + mergeGap >= right.left &&
        left.top <= right.bottom + mergeGap &&
        left.bottom + mergeGap >= right.top
    );
}

function mergeBounds(left: Bounds, right: Bounds): Bounds {
    return {
        bottom: Math.max(left.bottom, right.bottom),
        left: Math.min(left.left, right.left),
        pixelCount: left.pixelCount + right.pixelCount,
        right: Math.max(left.right, right.right),
        top: Math.min(left.top, right.top),
    };
}

function sortBounds(bounds: Bounds[]) {
    return bounds.sort((left, right) => {
        const rowDelta = left.top - right.top;
        if (Math.abs(rowDelta) > 24) {
            return rowDelta;
        }

        return left.left - right.left;
    });
}

function mergeNearbyBounds(bounds: Bounds[], mergeGap: number) {
    const merged = [...bounds];

    if (mergeGap <= 0) {
        return sortBounds(merged);
    }

    let didMerge = true;
    while (didMerge) {
        didMerge = false;

        outer: for (
            let leftIndex = 0;
            leftIndex < merged.length;
            leftIndex += 1
        ) {
            for (
                let rightIndex = leftIndex + 1;
                rightIndex < merged.length;
                rightIndex += 1
            ) {
                if (
                    !boundsOverlap(
                        merged[leftIndex],
                        merged[rightIndex],
                        mergeGap,
                    )
                ) {
                    continue;
                }

                merged[leftIndex] = mergeBounds(
                    merged[leftIndex],
                    merged[rightIndex],
                );
                merged.splice(rightIndex, 1);
                didMerge = true;
                break outer;
            }
        }
    }

    return sortBounds(merged);
}

function collectOpaqueBounds(options: {
    alpha: Uint8Array;
    height: number;
    minAlpha: number;
    minPixels: number;
    width: number;
}) {
    const { alpha, height, minAlpha, minPixels, width } = options;
    const size = width * height;
    const visited = new Uint8Array(size);
    const bounds: Bounds[] = [];

    for (let index = 0; index < size; index += 1) {
        if (visited[index] || alpha[index] <= minAlpha) {
            continue;
        }

        const stack = [index];
        visited[index] = 1;

        let pixelCount = 0;
        let left = index % width;
        let right = left;
        let top = Math.floor(index / width);
        let bottom = top;

        while (stack.length > 0) {
            const current = stack.pop();
            if (current === undefined) {
                continue;
            }

            const x = current % width;
            const y = Math.floor(current / width);

            pixelCount += 1;
            left = Math.min(left, x);
            right = Math.max(right, x);
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);

            for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
                for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
                    if (offsetX === 0 && offsetY === 0) {
                        continue;
                    }

                    const nextX = x + offsetX;
                    const nextY = y + offsetY;
                    if (
                        nextX < 0 ||
                        nextX >= width ||
                        nextY < 0 ||
                        nextY >= height
                    ) {
                        continue;
                    }

                    const nextIndex = nextY * width + nextX;
                    if (visited[nextIndex] || alpha[nextIndex] <= minAlpha) {
                        continue;
                    }

                    visited[nextIndex] = 1;
                    stack.push(nextIndex);
                }
            }
        }

        if (pixelCount < minPixels) {
            continue;
        }

        bounds.push({
            bottom,
            left,
            pixelCount,
            right,
            top,
        });
    }

    return bounds;
}

async function main() {
    const parsedArgs = parseArgs(process.argv.slice(2));
    const inputPath = resolveFromRepositoryRoot(
        getStringArg(parsedArgs, 'input'),
    );
    const outputDirectory = resolveFromRepositoryRoot(
        getStringArg(parsedArgs, 'output-dir'),
    );
    const minAlpha = getNumberArg(parsedArgs, 'min-alpha', 16);
    const minPixels = getNumberArg(parsedArgs, 'min-pixels', 1200);
    const mergeGap = getNumberArg(parsedArgs, 'merge-gap', 32);
    const padding = getNumberArg(parsedArgs, 'padding', 20);
    const limit = getNumberArg(parsedArgs, 'limit', 0);
    const clearOutputDirectory = getBooleanArg(
        parsedArgs,
        'clear-output-dir',
        true,
    );

    const source = sharp(inputPath).ensureAlpha();
    const { data, info } = await source
        .raw()
        .toBuffer({ resolveWithObject: true });
    const width = info.width;
    const height = info.height;
    const alpha = new Uint8Array(width * height);

    for (let index = 0; index < width * height; index += 1) {
        alpha[index] = data[index * info.channels + 3] ?? 0;
    }

    const rawBounds = collectOpaqueBounds({
        alpha,
        height,
        minAlpha,
        minPixels,
        width,
    });
    const mergedBounds = mergeNearbyBounds(rawBounds, mergeGap);
    const selectedBounds =
        limit > 0 ? mergedBounds.slice(0, limit) : mergedBounds;

    if (selectedBounds.length < 1) {
        throw new Error(
            `No sprites matched alpha>${minAlpha} and minPixels>${minPixels} in ${inputPath}.`,
        );
    }

    if (clearOutputDirectory) {
        await rm(outputDirectory, { force: true, recursive: true });
    }
    await mkdir(outputDirectory, { recursive: true });

    await Promise.all(
        selectedBounds.map(async (bounds, index) => {
            const left = Math.max(0, bounds.left - padding);
            const top = Math.max(0, bounds.top - padding);
            const extractWidth = Math.min(
                width - left,
                bounds.right - bounds.left + 1 + padding * 2,
            );
            const extractHeight = Math.min(
                height - top,
                bounds.bottom - bounds.top + 1 + padding * 2,
            );

            await sharp(inputPath)
                .extract({
                    height: extractHeight,
                    left,
                    top,
                    width: extractWidth,
                })
                .png()
                .toFile(
                    path.join(outputDirectory, `${padSpriteNumber(index)}.png`),
                );
        }),
    );

    console.info(
        `Extracted ${selectedBounds.length} sprite cutouts from ${path.relative(repositoryRoot, inputPath)}:`,
    );
    console.info(`  Output: ${path.relative(repositoryRoot, outputDirectory)}`);
    console.info(
        `  Filters: alpha>${minAlpha}, minPixels>${minPixels}, mergeGap=${mergeGap}, padding=${padding}`,
    );
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
