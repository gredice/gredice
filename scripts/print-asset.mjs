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
    const declaredFamilies = new Set(
        [...document.fonts].map((face) => unquote(face.family)),
    );
    const missingFonts = new Set();
    const clippedText = new Set();
    const pageBox = page.getBoundingClientRect();
    // True when the part of the box that is actually painted crosses a page
    // edge. Content cropped on purpose by a clipping box inside the page
    // stays valid.
    const pastPageEdge = (box, parent) => {
        let { left, top, right, bottom } = box;
        for (
            let ancestor = parent;
            ancestor && ancestor !== page;
            ancestor = ancestor.parentElement
        ) {
            if (getComputedStyle(ancestor).overflow === 'visible') continue;
            const clip = ancestor.getBoundingClientRect();
            left = Math.max(left, clip.left);
            top = Math.max(top, clip.top);
            right = Math.min(right, clip.right);
            bottom = Math.min(bottom, clip.bottom);
        }
        if (right <= left || bottom <= top) return false;
        return (
            left < pageBox.left - 0.5 ||
            top < pageBox.top - 0.5 ||
            right > pageBox.right + 0.5 ||
            bottom > pageBox.bottom + 0.5
        );
    };
    // Images and every other element box, in document order, so only the
    // outermost element that crosses an edge is reported.
    const clippedElements = [];
    for (const element of page.querySelectorAll('*')) {
        const box = element.getBoundingClientRect();
        if (box.width === 0 && box.height === 0) continue;
        if (clippedElements.some((outer) => outer.contains(element))) continue;
        if (pastPageEdge(box, element.parentElement)) {
            clippedElements.push(element);
        }
    }
    for (const element of clippedElements) {
        const source = element.getAttribute('src');
        const label = source
            ? `<${element.localName} src="${source}">`
            : `<${element.localName}>`;
        problems.push(`${label} extends past the page edge`);
    }
    const textRange = document.createRange();
    const textNodes = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
    while (textNodes.nextNode()) {
        const node = textNodes.currentNode;
        if (!node.textContent?.trim() || !node.parentElement) continue;
        const style = getComputedStyle(node.parentElement);
        const family = unquote(style.fontFamily.split(',')[0]);
        // Check the characters as rendered, so the right unicode-range
        // faces are required. Under any text-transform, require the faces
        // for both cases rather than modelling each transform.
        const text =
            style.textTransform === 'none'
                ? node.textContent
                : node.textContent +
                  node.textContent.toUpperCase() +
                  node.textContent.toLowerCase();
        const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} "${family}"`;
        if (!declaredFamilies.has(family)) {
            missingFonts.add(`${family} (no web font with this name)`);
        } else if (!document.fonts.check(font, text)) {
            // A family is not enough: every face this text needs, by
            // weight, style and unicode-range, must have loaded.
            missingFonts.add(
                `${family} ${style.fontWeight} ${style.fontStyle}`,
            );
        }
        // Glyphs can leave their element's box, so check the text itself
        // unless its element is already reported.
        textRange.selectNodeContents(node);
        if (
            pastPageEdge(
                textRange.getBoundingClientRect(),
                node.parentElement,
            ) &&
            !clippedElements.some((outer) => outer.contains(node))
        ) {
            clippedText.add(node.textContent.trim().slice(0, 40));
        }
    }
    for (const font of missingFonts) {
        problems.push(`font did not load: ${font}`);
    }
    for (const text of clippedText) {
        problems.push(`text extends past the page edge: "${text}"`);
    }
    // Scroll size also catches overflow that has no element box, such as
    // pseudo-elements.
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
        if (data[offset + 3] === 0) {
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
