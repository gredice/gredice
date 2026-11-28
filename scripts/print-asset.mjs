#!/usr/bin/env node

// Print assets live in assets/print/<name>/index.html. See assets/print/README.md.
//
//   node scripts/print-asset.mjs render [name]
//   node scripts/print-asset.mjs prepare-image <generated.png> <target.png>

import { existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
);
const printRoot = path.join(repoRoot, 'assets', 'print');
// Playwright and sharp are already dependencies of the www app.
const wwwRequire = createRequire(
    path.join(repoRoot, 'apps', 'www', 'package.json'),
);

function printAssetNames() {
    return readdirSync(printRoot, { withFileTypes: true })
        .filter(
            (entry) =>
                entry.isDirectory() &&
                existsSync(path.join(printRoot, entry.name, 'index.html')),
        )
        .map((entry) => entry.name)
        .sort();
}

// Runs in the page. Returns the page size and anything that would make the
// render wrong without failing loudly: missing page, images, fonts, overflow.
async function inspectPrintPage() {
    await document.fonts.ready;
    const pages = document.querySelectorAll('[data-print-page]');
    if (pages.length !== 1) {
        return {
            problems: [
                `expected one [data-print-page] element, found ${pages.length}`,
            ],
        };
    }
    const page = pages[0];
    const problems = [];
    for (const image of document.images) {
        if (!image.complete || image.naturalWidth === 0) {
            problems.push(`image did not load: ${image.getAttribute('src')}`);
        }
    }
    const unquote = (family) => family.trim().replace(/^["']|["']$/g, '');
    const loadedFamilies = new Set(
        [...document.fonts]
            .filter((face) => face.status === 'loaded')
            .map((face) => unquote(face.family)),
    );
    const missingFamilies = new Set();
    const textNodes = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
    while (textNodes.nextNode()) {
        const node = textNodes.currentNode;
        if (!node.textContent?.trim() || !node.parentElement) continue;
        const family = unquote(
            getComputedStyle(node.parentElement).fontFamily.split(',')[0],
        );
        if (!loadedFamilies.has(family)) missingFamilies.add(family);
    }
    for (const family of missingFamilies) {
        problems.push(`font did not load: ${family}`);
    }
    if (
        page.scrollWidth > page.clientWidth ||
        page.scrollHeight > page.clientHeight
    ) {
        problems.push(
            `content overflows the page: ${page.scrollWidth}×${page.scrollHeight} px in a ${page.clientWidth}×${page.clientHeight} px page`,
        );
    }
    return {
        width: page.offsetWidth,
        height: page.offsetHeight,
        problems,
    };
}

async function render(requestedName) {
    const available = printAssetNames();
    if (requestedName && !available.includes(requestedName)) {
        throw new Error(
            `No print asset "${requestedName}". Available: ${available.join(', ') || 'none'}.`,
        );
    }
    const names = requestedName ? [requestedName] : available;
    const { chromium } = wwwRequire('@playwright/test');
    const browser = await chromium.launch();
    let failed = false;
    try {
        for (const name of names) {
            const directory = path.join(printRoot, name);
            const context = await browser.newContext({ deviceScaleFactor: 1 });
            const page = await context.newPage();
            await page.goto(
                pathToFileURL(path.join(directory, 'index.html')).href,
                { waitUntil: 'load' },
            );
            let inspection = await page.evaluate(inspectPrintPage);
            if (inspection.problems.length === 0) {
                // Layout can depend on the viewport, so check again at page size.
                await page.setViewportSize({
                    width: inspection.width,
                    height: inspection.height,
                });
                inspection = await page.evaluate(inspectPrintPage);
            }
            if (inspection.problems.length > 0) {
                failed = true;
                console.error(`${name}: not rendered`);
                for (const problem of inspection.problems) {
                    console.error(`  - ${problem}`);
                }
            } else {
                const output = path.join(directory, `${name}.png`);
                await page
                    .locator('[data-print-page]')
                    .screenshot({ path: output, type: 'png' });
                console.info(
                    `${path.relative(repoRoot, output)}: ${inspection.width}×${inspection.height} px`,
                );
            }
            await context.close();
        }
    } finally {
        await browser.close();
    }
    if (failed) process.exitCode = 1;
}

// Image generators leave colour in fully transparent pixels and wide empty
// margins. Clear the first so trimming works, then trim to the artwork.
async function prepareImage(input, output) {
    if (!input || !output) {
        throw new Error(
            'Usage: print-asset.mjs prepare-image <generated.png> <target.png>',
        );
    }
    const sharp = wwwRequire('sharp');
    const { data, info } = await sharp(input)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    for (let offset = 0; offset < data.length; offset += 4) {
        if (data[offset + 3] < 24) {
            data[offset] = 255;
            data[offset + 1] = 255;
            data[offset + 2] = 255;
            data[offset + 3] = 0;
        }
    }
    const cleaned = await sharp(data, { raw: info }).png().toBuffer();
    const result = await sharp(cleaned)
        .trim({ threshold: 1 })
        .png({ compressionLevel: 9 })
        .toFile(output);
    console.info(`${output}: ${result.width}×${result.height} px`);
}

const [command, ...args] = process.argv.slice(2);
try {
    if (command === 'render') {
        await render(args[0]);
    } else if (command === 'prepare-image') {
        await prepareImage(args[0], args[1]);
    } else {
        throw new Error(
            'Usage: print-asset.mjs render [name] | prepare-image <generated.png> <target.png>',
        );
    }
} catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
}
