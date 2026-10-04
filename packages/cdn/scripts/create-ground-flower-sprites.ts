import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const repositoryRoot = path.resolve(import.meta.dirname, '../../..');
const canvasSize = 256;
const flowerVariants = [
    { name: 'cream', petalColor: '#f7f1d0' },
    { name: 'yellow', petalColor: '#ffd35a' },
    { name: 'pink', petalColor: '#f58ab7' },
    { name: 'violet', petalColor: '#9f8cff' },
    { name: 'blue', petalColor: '#73c7ff' },
    { name: 'orange', petalColor: '#ff9f6e' },
];

function getStringArg(key: string, fallback: string) {
    const prefixedKey = `--${key}`;
    const index = process.argv.indexOf(prefixedKey);

    if (index < 0) {
        return fallback;
    }

    const value = process.argv[index + 1];
    if (!value || value.startsWith('--')) {
        throw new Error(`Missing value for ${prefixedKey}.`);
    }

    return value;
}

function resolveFromRepositoryRoot(targetPath: string) {
    return path.isAbsolute(targetPath)
        ? targetPath
        : path.resolve(repositoryRoot, targetPath);
}

function formatNumber(value: number) {
    return Number(value.toFixed(3));
}

function petalElements({
    color,
    cx,
    cy,
    radius,
}: {
    color: string;
    cx: number;
    cy: number;
    radius: number;
}) {
    return Array.from({ length: 6 }, (_, index) => {
        const angle = (index / 6) * Math.PI * 2;
        const petalX = formatNumber(cx + Math.cos(angle) * radius * 0.62);
        const petalY = formatNumber(cy + Math.sin(angle) * radius * 0.62);
        const rotation = formatNumber((angle * 180) / Math.PI);

        return `<ellipse cx="${petalX}" cy="${petalY}" rx="${formatNumber(radius * 0.52)}" ry="${formatNumber(radius * 0.31)}" fill="${color}" transform="rotate(${rotation} ${petalX} ${petalY})"/>`;
    }).join('');
}

function flowerElement({
    color,
    cx,
    cy,
    radius,
    sway,
}: {
    color: string;
    cx: number;
    cy: number;
    radius: number;
    sway: number;
}) {
    const baseY = 230;
    const stemTop = cy + radius * 0.72;
    const controlX = cx - sway;
    const controlY = cy + (baseY - cy) * 0.48;
    const leafY = cy + (baseY - cy) * 0.58;

    return `
        <path d="M ${cx} ${baseY} C ${formatNumber(controlX)} ${formatNumber(controlY)} ${formatNumber(controlX)} ${formatNumber(stemTop)} ${cx} ${formatNumber(stemTop)}" fill="none" stroke="#3f7f2b" stroke-linecap="round" stroke-width="${formatNumber(radius * 0.22)}"/>
        <ellipse cx="${formatNumber(cx - radius * 0.32)}" cy="${formatNumber(leafY)}" rx="${formatNumber(radius * 0.48)}" ry="${formatNumber(radius * 0.18)}" fill="#5d9640" opacity="0.82" transform="rotate(-32 ${formatNumber(cx - radius * 0.32)} ${formatNumber(leafY)})"/>
        <ellipse cx="${formatNumber(cx + radius * 0.34)}" cy="${formatNumber(leafY + radius * 0.18)}" rx="${formatNumber(radius * 0.4)}" ry="${formatNumber(radius * 0.16)}" fill="#4f8734" opacity="0.72" transform="rotate(28 ${formatNumber(cx + radius * 0.34)} ${formatNumber(leafY + radius * 0.18)})"/>
        <g filter="url(#soft-shadow)">
            ${petalElements({ color, cx, cy, radius })}
            <circle cx="${cx}" cy="${cy}" r="${formatNumber(radius * 0.32)}" fill="#efad2f"/>
            <circle cx="${formatNumber(cx - radius * 0.07)}" cy="${formatNumber(cy - radius * 0.08)}" r="${formatNumber(radius * 0.08)}" fill="#ffe18a" opacity="0.72"/>
        </g>
    `;
}

function createFlowerSvg(color: string) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasSize}" height="${canvasSize}" viewBox="0 0 ${canvasSize} ${canvasSize}">
        <defs>
            <filter id="soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="1.2" flood-color="#1f2f1d" flood-opacity="0.18"/>
            </filter>
        </defs>
        ${flowerElement({ color, cx: 82, cy: 158, radius: 16, sway: 10 })}
        ${flowerElement({ color, cx: 130, cy: 134, radius: 22, sway: -8 })}
        ${flowerElement({ color, cx: 174, cy: 170, radius: 14, sway: 7 })}
    </svg>`;
}

async function main() {
    const outputDirectory = resolveFromRepositoryRoot(
        getStringArg(
            'output-dir',
            'apps/garden/data/sriptes/extracted/ground-cover/flower',
        ),
    );

    await mkdir(outputDirectory, { recursive: true });

    await Promise.all(
        flowerVariants.map(async (variant) => {
            const svg = createFlowerSvg(variant.petalColor);
            await sharp(Buffer.from(svg))
                .png()
                .toFile(path.join(outputDirectory, `${variant.name}.png`));
        }),
    );

    console.info(
        `Created ${flowerVariants.length} ground flower sprite source images in ${path.relative(repositoryRoot, outputDirectory)}.`,
    );
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
