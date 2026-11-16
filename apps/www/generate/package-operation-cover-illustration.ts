import { link, mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import sharp from 'sharp';

const outputDirectory = fileURLToPath(
    new URL('../public/assets/operation-icons/illustrated/', import.meta.url),
);
const canvasSize = 640;
const paddingRatio = 0.14;
const visibleAlphaThreshold = 8;
const usage =
    'Usage: pnpm --filter www exec tsx generate/package-operation-cover-illustration.ts <operation-name> <source.png> [--replace]';

async function packageIllustration(sourcePath: string) {
    const source = sharp(sourcePath);
    const metadata = await source.metadata();
    if (metadata.format !== 'png' || !metadata.hasAlpha) {
        throw new Error(
            'The source must be a PNG with a transparent background.',
        );
    }

    const { data, info } = await source
        .clone()
        .toColourspace('srgb')
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    let minX = info.width;
    let minY = info.height;
    let maxX = -1;
    let maxY = -1;
    let hasTransparentPixels = false;
    let visiblePixels = 0;

    for (let y = 0; y < info.height; y += 1) {
        for (let x = 0; x < info.width; x += 1) {
            const alpha = data[(y * info.width + x) * info.channels + 3];
            if (alpha === 0) {
                hasTransparentPixels = true;
            }
            if (alpha > visibleAlphaThreshold) {
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
                visiblePixels += 1;
            }
        }
    }

    if (!hasTransparentPixels) {
        throw new Error('The source contains no fully transparent pixels.');
    }
    if (visiblePixels < Math.max(32, info.width * info.height * 0.002)) {
        throw new Error('The source illustration appears blank.');
    }

    const contentSize = Math.round(canvasSize * (1 - 2 * paddingRatio));
    const illustration = await source
        .extract({
            left: minX,
            top: minY,
            width: maxX - minX + 1,
            height: maxY - minY + 1,
        })
        .resize(contentSize, contentSize, {
            fit: 'contain',
            background: 'transparent',
        })
        .png()
        .toBuffer();

    return sharp({
        create: {
            width: canvasSize,
            height: canvasSize,
            channels: 4,
            background: 'transparent',
        },
    })
        .composite([{ input: illustration, gravity: 'centre' }])
        .webp({ quality: 90 })
        .toBuffer();
}

async function main() {
    const { positionals, values } = parseArgs({
        allowPositionals: true,
        options: { replace: { type: 'boolean' } },
    });
    const [operationName, sourcePath] = positionals;
    if (
        positionals.length !== 2 ||
        !/^[A-Za-z][A-Za-z0-9_-]*$/u.test(operationName) ||
        !sourcePath
    ) {
        throw new Error(usage);
    }

    const webp = await packageIllustration(sourcePath);
    const destination = join(outputDirectory, `${operationName}.webp`);
    await mkdir(outputDirectory, { recursive: true });
    const temporaryDirectory = await mkdtemp(
        join(outputDirectory, '.package-'),
    );
    try {
        const temporaryFile = join(temporaryDirectory, 'cover.webp');
        await writeFile(temporaryFile, webp);
        if (values.replace) {
            await rename(temporaryFile, destination);
        } else {
            await link(temporaryFile, destination);
        }
    } finally {
        await rm(temporaryDirectory, { recursive: true, force: true });
    }
    console.log(destination);
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
