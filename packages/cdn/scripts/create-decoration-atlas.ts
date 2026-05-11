import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

type ParsedArgs = Map<string, string | boolean>;

type AtlasGrid = {
    cellSize: number;
    columns: number;
    height: number;
    innerSize: number;
    offsetX: number;
    offsetY: number;
    padding: number;
    rows: number;
    width: number;
};

type SpriteFrame = {
    aspect: number;
    cell: {
        column: number;
        height: number;
        row: number;
        width: number;
        x: number;
        y: number;
    };
    frame: {
        height: number;
        width: number;
        x: number;
        y: number;
    };
    page: number;
    source: string;
};

type AtlasPage = {
    atlas: AtlasGrid;
    index: number;
    spriteCount: number;
};

type AtlasManifest = {
    atlas?: AtlasGrid;
    layout: {
        atlasSize: number;
        columns: number;
        pageCapacity: number;
        padding: number;
        rows: number;
        version: 2;
    };
    pages: AtlasPage[];
    sprites: Record<string, SpriteFrame>;
};

type GridLayout = {
    cellSize: number;
    columns: number;
    innerSize: number;
    offsetX: number;
    offsetY: number;
    pageCapacity: number;
    rows: number;
};

type SpriteAssignment = {
    page: number;
    slot: number;
};

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '../../..');
const imagePattern = /\.(png|jpe?g|webp)$/i;

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

function getOptionalNumberArg(parsed: ParsedArgs, key: string) {
    const value = parsed.get(key);
    if (typeof value !== 'string') {
        return null;
    }

    const parsedNumber = Number(value);
    if (!Number.isFinite(parsedNumber)) {
        throw new Error(`Argument --${key} must be a number.`);
    }

    return parsedNumber;
}

function resolveFromRepositoryRoot(targetPath: string): string {
    return path.isAbsolute(targetPath)
        ? targetPath
        : path.resolve(repositoryRoot, targetPath);
}

function withJsonExtension(outputPngPath: string): string {
    return outputPngPath.replace(/\.[^.]+$/u, '.json');
}

function stripKnownExtension(filePath: string) {
    return filePath.replace(/\.(png|webp|json)$/u, '');
}

function getPageBasePath(outputPngPath: string, pageIndex: number) {
    const outputBasePath = stripKnownExtension(outputPngPath);
    return pageIndex === 0 ? outputBasePath : `${outputBasePath}.${pageIndex}`;
}

function getPagePngPath(outputPngPath: string, pageIndex: number) {
    return `${getPageBasePath(outputPngPath, pageIndex)}.png`;
}

function withWebpExtension(outputPngPath: string): string {
    return outputPngPath.replace(/\.[^.]+$/u, '.webp');
}

function getPageWebpPath(outputWebpPath: string, pageIndex: number) {
    return `${getPageBasePath(outputWebpPath, pageIndex)}.webp`;
}

function buildSpriteName(inputDirectory: string, inputFile: string): string {
    return path
        .relative(inputDirectory, inputFile)
        .replace(/\.[^.]+$/u, '')
        .split(path.sep)
        .join('__');
}

async function collectInputFiles(directory: string): Promise<string[]> {
    const directoryEntries = await readdir(directory, { withFileTypes: true });

    const nestedEntries = await Promise.all(
        directoryEntries.map(async (entry) => {
            const entryPath = path.join(directory, entry.name);

            if (entry.isDirectory()) {
                return collectInputFiles(entryPath);
            }

            if (entry.isFile() && imagePattern.test(entry.name)) {
                return [entryPath];
            }

            return [] as string[];
        }),
    );

    return nestedEntries
        .flat()
        .sort((left, right) => left.localeCompare(right));
}

function chooseGridLayout(
    spriteCount: number,
    atlasSize: number,
    padding: number,
): GridLayout {
    if (spriteCount < 1) {
        throw new Error(
            'At least one source image is required to build an atlas.',
        );
    }

    let bestLayout: GridLayout | null = null;
    let bestWaste = Number.POSITIVE_INFINITY;
    let bestSkew = Number.POSITIVE_INFINITY;

    for (let columns = 1; columns <= spriteCount; columns += 1) {
        const rows = Math.ceil(spriteCount / columns);
        const candidate = createGridLayout({
            atlasSize,
            columns,
            padding,
            rows,
        });
        if (candidate.innerSize < 1) {
            continue;
        }

        const waste = candidate.pageCapacity - spriteCount;
        const skew = Math.abs(columns - rows);

        if (
            !bestLayout ||
            candidate.cellSize > bestLayout.cellSize ||
            (candidate.cellSize === bestLayout.cellSize && waste < bestWaste) ||
            (candidate.cellSize === bestLayout.cellSize &&
                waste === bestWaste &&
                skew < bestSkew)
        ) {
            bestLayout = candidate;
            bestWaste = waste;
            bestSkew = skew;
        }
    }

    if (!bestLayout) {
        throw new Error(
            `Unable to fit ${spriteCount} sprites into a ${atlasSize}x${atlasSize} atlas with padding ${padding}.`,
        );
    }

    return bestLayout;
}

function createGridLayout(options: {
    atlasSize: number;
    columns: number;
    padding: number;
    rows: number;
}): GridLayout {
    const { atlasSize, columns, padding, rows } = options;
    const cellSize = Math.min(
        Math.floor(atlasSize / columns),
        Math.floor(atlasSize / rows),
    );

    return {
        cellSize,
        columns,
        innerSize: cellSize - padding * 2,
        offsetX: Math.floor((atlasSize - columns * cellSize) / 2),
        offsetY: Math.floor((atlasSize - rows * cellSize) / 2),
        pageCapacity: columns * rows,
        rows,
    };
}

function toAtlasGrid(
    layout: GridLayout,
    atlasSize: number,
    padding: number,
): AtlasGrid {
    return {
        cellSize: layout.cellSize,
        columns: layout.columns,
        height: atlasSize,
        innerSize: layout.innerSize,
        offsetX: layout.offsetX,
        offsetY: layout.offsetY,
        padding,
        rows: layout.rows,
        width: atlasSize,
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function parseAtlasGrid(value: unknown): AtlasGrid | null {
    if (!isRecord(value)) {
        return null;
    }

    const {
        cellSize,
        columns,
        height,
        innerSize,
        offsetX,
        offsetY,
        padding,
        rows,
        width,
    } = value;

    if (
        !isFiniteNumber(cellSize) ||
        !isFiniteNumber(columns) ||
        !isFiniteNumber(height) ||
        !isFiniteNumber(innerSize) ||
        !isFiniteNumber(offsetX) ||
        !isFiniteNumber(offsetY) ||
        !isFiniteNumber(padding) ||
        !isFiniteNumber(rows) ||
        !isFiniteNumber(width)
    ) {
        return null;
    }

    return {
        cellSize,
        columns,
        height,
        innerSize,
        offsetX,
        offsetY,
        padding,
        rows,
        width,
    };
}

function parseSpriteFrame(value: unknown): SpriteFrame | null {
    if (!isRecord(value)) {
        return null;
    }

    const cell = isRecord(value.cell) ? value.cell : null;
    const frame = isRecord(value.frame) ? value.frame : null;
    const aspect = value.aspect;
    const page = value.page;
    const source = value.source;

    if (
        !cell ||
        !frame ||
        !isFiniteNumber(aspect) ||
        typeof source !== 'string'
    ) {
        return null;
    }

    const parsedCell =
        isFiniteNumber(cell.column) &&
        isFiniteNumber(cell.height) &&
        isFiniteNumber(cell.row) &&
        isFiniteNumber(cell.width) &&
        isFiniteNumber(cell.x) &&
        isFiniteNumber(cell.y)
            ? {
                  column: cell.column,
                  height: cell.height,
                  row: cell.row,
                  width: cell.width,
                  x: cell.x,
                  y: cell.y,
              }
            : null;

    const parsedFrame =
        isFiniteNumber(frame.height) &&
        isFiniteNumber(frame.width) &&
        isFiniteNumber(frame.x) &&
        isFiniteNumber(frame.y)
            ? {
                  height: frame.height,
                  width: frame.width,
                  x: frame.x,
                  y: frame.y,
              }
            : null;

    if (!parsedCell || !parsedFrame) {
        return null;
    }

    return {
        aspect,
        cell: parsedCell,
        frame: parsedFrame,
        page: isFiniteNumber(page) ? page : 0,
        source,
    };
}

function parsePreviousManifest(jsonText: string): AtlasManifest | null {
    const parsed = JSON.parse(jsonText) as unknown;
    if (!isRecord(parsed) || !isRecord(parsed.sprites)) {
        return null;
    }

    const legacyAtlas = parseAtlasGrid(parsed.atlas);
    const pagesSource = Array.isArray(parsed.pages) ? parsed.pages : null;
    const pages =
        pagesSource
            ?.map((value, index) => {
                if (!isRecord(value)) {
                    return null;
                }

                const atlas = parseAtlasGrid(value.atlas);
                if (!atlas) {
                    return null;
                }

                return {
                    atlas,
                    index:
                        isFiniteNumber(value.index) && value.index >= 0
                            ? value.index
                            : index,
                    spriteCount:
                        isFiniteNumber(value.spriteCount) &&
                        value.spriteCount >= 0
                            ? value.spriteCount
                            : 0,
                } satisfies AtlasPage;
            })
            .filter((value): value is AtlasPage => value !== null) ?? [];

    const normalizedPages =
        pages.length > 0
            ? pages
            : legacyAtlas
              ? [
                    {
                        atlas: legacyAtlas,
                        index: 0,
                        spriteCount: Object.keys(parsed.sprites).length,
                    },
                ]
              : [];

    if (normalizedPages.length < 1) {
        return null;
    }

    const sprites = Object.entries(parsed.sprites).reduce<
        Record<string, SpriteFrame>
    >((accumulator, [spriteName, value]) => {
        const sprite = parseSpriteFrame(value);
        if (sprite) {
            accumulator[spriteName] = sprite;
        }
        return accumulator;
    }, {});

    const firstPageAtlas = normalizedPages[0].atlas;

    return {
        atlas: legacyAtlas ?? firstPageAtlas,
        layout: {
            atlasSize: firstPageAtlas.width,
            columns: firstPageAtlas.columns,
            pageCapacity: firstPageAtlas.columns * firstPageAtlas.rows,
            padding: firstPageAtlas.padding,
            rows: firstPageAtlas.rows,
            version: 2,
        },
        pages: normalizedPages,
        sprites,
    };
}

async function loadPreviousManifest(outputJsonPath: string) {
    try {
        return parsePreviousManifest(await readFile(outputJsonPath, 'utf8'));
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return null;
        }

        throw error;
    }
}

function resolveGridLayout(options: {
    atlasSize: number;
    columns: number | null;
    padding: number;
    previousManifest: AtlasManifest | null;
    rows: number | null;
    spriteCount: number;
}) {
    const { atlasSize, columns, padding, previousManifest, rows, spriteCount } =
        options;

    if ((columns === null) !== (rows === null)) {
        throw new Error(
            'Arguments --columns and --rows must be provided together.',
        );
    }

    if (columns !== null && rows !== null) {
        return createGridLayout({ atlasSize, columns, padding, rows });
    }

    const previousAtlas = previousManifest?.pages[0]?.atlas;
    if (previousAtlas) {
        return createGridLayout({
            atlasSize: previousAtlas.width,
            columns: previousAtlas.columns,
            padding: previousAtlas.padding,
            rows: previousAtlas.rows,
        });
    }

    return chooseGridLayout(spriteCount, atlasSize, padding);
}

async function createPaddingComposites(
    spriteBuffer: Buffer,
    x: number,
    y: number,
    width: number,
    height: number,
    padding: number,
) {
    if (padding <= 0) {
        return [] as sharp.OverlayOptions[];
    }

    const image = sharp(spriteBuffer);
    const resizeKernel = { kernel: 'nearest' as const };

    const [leftEdge, rightEdge, topEdge, bottomEdge] = await Promise.all([
        image
            .clone()
            .extract({ left: 0, top: 0, width: 1, height })
            .resize({ width: padding, height, ...resizeKernel })
            .png()
            .toBuffer(),
        image
            .clone()
            .extract({ left: width - 1, top: 0, width: 1, height })
            .resize({ width: padding, height, ...resizeKernel })
            .png()
            .toBuffer(),
        image
            .clone()
            .extract({ left: 0, top: 0, width, height: 1 })
            .resize({ width, height: padding, ...resizeKernel })
            .png()
            .toBuffer(),
        image
            .clone()
            .extract({ left: 0, top: height - 1, width, height: 1 })
            .resize({ width, height: padding, ...resizeKernel })
            .png()
            .toBuffer(),
    ]);

    const [topLeftCorner, topRightCorner, bottomLeftCorner, bottomRightCorner] =
        await Promise.all([
            image
                .clone()
                .extract({ left: 0, top: 0, width: 1, height: 1 })
                .resize({ width: padding, height: padding, ...resizeKernel })
                .png()
                .toBuffer(),
            image
                .clone()
                .extract({ left: width - 1, top: 0, width: 1, height: 1 })
                .resize({ width: padding, height: padding, ...resizeKernel })
                .png()
                .toBuffer(),
            image
                .clone()
                .extract({ left: 0, top: height - 1, width: 1, height: 1 })
                .resize({ width: padding, height: padding, ...resizeKernel })
                .png()
                .toBuffer(),
            image
                .clone()
                .extract({
                    left: width - 1,
                    top: height - 1,
                    width: 1,
                    height: 1,
                })
                .resize({ width: padding, height: padding, ...resizeKernel })
                .png()
                .toBuffer(),
        ]);

    return [
        { input: leftEdge, left: x - padding, top: y },
        { input: rightEdge, left: x + width, top: y },
        { input: topEdge, left: x, top: y - padding },
        { input: bottomEdge, left: x, top: y + height },
        { input: topLeftCorner, left: x - padding, top: y - padding },
        { input: topRightCorner, left: x + width, top: y - padding },
        { input: bottomLeftCorner, left: x - padding, top: y + height },
        { input: bottomRightCorner, left: x + width, top: y + height },
    ] satisfies sharp.OverlayOptions[];
}

function getPreviousAssignment(
    spriteName: string,
    previousManifest: AtlasManifest | null,
    pageCapacity: number,
) {
    const sprite = previousManifest?.sprites[spriteName];
    if (!sprite) {
        return null;
    }

    const pageColumns =
        previousManifest?.pages[sprite.page]?.atlas.columns ??
        previousManifest?.atlas?.columns;
    if (!pageColumns) {
        return null;
    }

    const slot = sprite.cell.row * pageColumns + sprite.cell.column;
    if (slot < 0 || slot >= pageCapacity) {
        return null;
    }

    return {
        page: sprite.page ?? 0,
        slot,
    } satisfies SpriteAssignment;
}

function createStableAssignments(options: {
    pageCapacity: number;
    previousManifest: AtlasManifest | null;
    spriteNames: string[];
}) {
    const { pageCapacity, previousManifest, spriteNames } = options;
    const assignments = new Map<string, SpriteAssignment>();
    const occupiedSlots = new Set<string>();

    for (const spriteName of spriteNames) {
        const previousAssignment = getPreviousAssignment(
            spriteName,
            previousManifest,
            pageCapacity,
        );
        if (!previousAssignment) {
            continue;
        }

        const slotKey = `${previousAssignment.page}:${previousAssignment.slot}`;
        if (occupiedSlots.has(slotKey)) {
            continue;
        }

        assignments.set(spriteName, previousAssignment);
        occupiedSlots.add(slotKey);
    }

    const allocateSlot = () => {
        let page = 0;
        let slot = 0;

        while (occupiedSlots.has(`${page}:${slot}`)) {
            slot += 1;
            if (slot >= pageCapacity) {
                page += 1;
                slot = 0;
            }
        }

        const slotKey = `${page}:${slot}`;
        occupiedSlots.add(slotKey);

        return {
            page,
            slot,
        } satisfies SpriteAssignment;
    };

    for (const spriteName of spriteNames) {
        if (assignments.has(spriteName)) {
            continue;
        }

        assignments.set(spriteName, allocateSlot());
    }

    return assignments;
}

async function removeStalePageImages(options: {
    outputPngPath: string;
    outputWebpPath: string;
    pageCount: number;
    previousManifest: AtlasManifest | null;
}) {
    const { outputPngPath, outputWebpPath, pageCount, previousManifest } =
        options;
    const previousPageCount =
        previousManifest?.pages.length ?? (previousManifest?.atlas ? 1 : 0);

    await Promise.all(
        Array.from(
            { length: Math.max(previousPageCount - pageCount, 0) },
            (_, index) =>
                Promise.all([
                    rm(getPagePngPath(outputPngPath, pageCount + index), {
                        force: true,
                    }),
                    rm(getPageWebpPath(outputWebpPath, pageCount + index), {
                        force: true,
                    }),
                ]),
        ),
    );
}

async function main() {
    const parsedArgs = parseArgs(process.argv.slice(2));
    const inputDirectory = resolveFromRepositoryRoot(
        getStringArg(parsedArgs, 'input-dir'),
    );
    const outputPngPath = resolveFromRepositoryRoot(
        getStringArg(parsedArgs, 'output-png'),
    );
    const outputWebpPath = resolveFromRepositoryRoot(
        getStringArg(
            parsedArgs,
            'output-webp',
            withWebpExtension(outputPngPath),
        ),
    );
    const outputJsonPath = resolveFromRepositoryRoot(
        getStringArg(
            parsedArgs,
            'output-json',
            withJsonExtension(outputPngPath),
        ),
    );
    const includePattern = new RegExp(
        getStringArg(parsedArgs, 'include', '.*'),
        'i',
    );
    const atlasSize = getNumberArg(parsedArgs, 'size', 2048);
    const padding = getNumberArg(parsedArgs, 'padding', 8);
    const columns = getOptionalNumberArg(parsedArgs, 'columns');
    const rows = getOptionalNumberArg(parsedArgs, 'rows');
    const webpQuality = getNumberArg(parsedArgs, 'webp-quality', 80);
    const previousManifest = await loadPreviousManifest(outputJsonPath);

    const allInputFiles = await collectInputFiles(inputDirectory);
    const inputFiles = allInputFiles.filter((filePath) =>
        includePattern.test(path.basename(filePath, path.extname(filePath))),
    );

    if (inputFiles.length < 1) {
        throw new Error(
            `No input images matched ${includePattern} in ${inputDirectory}.`,
        );
    }

    const gridLayout = resolveGridLayout({
        atlasSize,
        columns,
        padding,
        previousManifest,
        rows,
        spriteCount: inputFiles.length,
    });
    const isUsingExplicitGrid = columns !== null && rows !== null;
    if (gridLayout.innerSize < 1) {
        throw new Error(
            `Grid layout leaves no room for sprites. Reduce padding or increase atlas size.`,
        );
    }

    const pageAtlasSize = isUsingExplicitGrid
        ? atlasSize
        : (previousManifest?.pages[0]?.atlas.width ?? atlasSize);
    const pagePadding = isUsingExplicitGrid
        ? padding
        : (previousManifest?.pages[0]?.atlas.padding ?? padding);
    const pageAtlas = toAtlasGrid(gridLayout, pageAtlasSize, pagePadding);
    const spriteEntries = inputFiles.map((inputFile) => ({
        inputFile,
        spriteName: buildSpriteName(inputDirectory, inputFile),
    }));
    const spriteNames = spriteEntries
        .map((entry) => entry.spriteName)
        .sort((left, right) => left.localeCompare(right));
    const assignments = createStableAssignments({
        pageCapacity: gridLayout.pageCapacity,
        previousManifest,
        spriteNames,
    });
    const highestPageIndex = Math.max(
        ...Array.from(assignments.values(), (assignment) => assignment.page),
    );
    const pageCount = highestPageIndex + 1;
    const pageComposites = Array.from(
        { length: pageCount },
        () => [] as sharp.OverlayOptions[],
    );
    const pageSpriteCounts = Array.from({ length: pageCount }, () => 0);
    const sprites: Record<string, SpriteFrame> = {};

    for (const { inputFile, spriteName } of spriteEntries) {
        const assignment = assignments.get(spriteName);
        if (!assignment) {
            throw new Error(
                `Unable to allocate a slot for sprite ${spriteName}.`,
            );
        }

        const column = assignment.slot % gridLayout.columns;
        const row = Math.floor(assignment.slot / gridLayout.columns);
        const cellX = gridLayout.offsetX + column * gridLayout.cellSize;
        const cellY = gridLayout.offsetY + row * gridLayout.cellSize;
        const resized = await sharp(inputFile)
            .resize({
                fit: 'inside',
                height: gridLayout.innerSize,
                width: gridLayout.innerSize,
                withoutEnlargement: true,
            })
            .png()
            .toBuffer({ resolveWithObject: true });

        const width = resized.info.width;
        const height = resized.info.height;
        if (!width || !height) {
            throw new Error(
                `Unable to read image dimensions for ${inputFile}.`,
            );
        }

        const x =
            cellX +
            pageAtlas.padding +
            Math.floor((gridLayout.innerSize - width) / 2);
        const y = cellY + pageAtlas.padding + (gridLayout.innerSize - height);

        pageComposites[assignment.page]?.push({
            input: resized.data,
            left: x,
            top: y,
        });
        pageComposites[assignment.page]?.push(
            ...(await createPaddingComposites(
                resized.data,
                x,
                y,
                width,
                height,
                pageAtlas.padding,
            )),
        );
        pageSpriteCounts[assignment.page] += 1;

        sprites[spriteName] = {
            aspect: width / height,
            cell: {
                column,
                height: gridLayout.cellSize,
                row,
                width: gridLayout.cellSize,
                x: cellX,
                y: cellY,
            },
            frame: {
                height,
                width,
                x,
                y,
            },
            page: assignment.page,
            source: path.relative(repositoryRoot, inputFile),
        };
    }

    const manifest: AtlasManifest = {
        atlas: pageAtlas,
        layout: {
            atlasSize: pageAtlas.width,
            columns: gridLayout.columns,
            pageCapacity: gridLayout.pageCapacity,
            padding: pageAtlas.padding,
            rows: gridLayout.rows,
            version: 2,
        },
        pages: Array.from({ length: pageCount }, (_, index) => ({
            atlas: pageAtlas,
            index,
            spriteCount: pageSpriteCounts[index] ?? 0,
        })),
        sprites,
    };

    await mkdir(path.dirname(outputJsonPath), { recursive: true });

    await Promise.all(
        manifest.pages.map(async (page) => {
            const outputPagePath = getPagePngPath(outputPngPath, page.index);
            const outputPageWebpPath = getPageWebpPath(
                outputWebpPath,
                page.index,
            );
            await mkdir(path.dirname(outputPagePath), { recursive: true });
            await mkdir(path.dirname(outputPageWebpPath), { recursive: true });
            const atlasImage = sharp({
                create: {
                    background: { alpha: 0, b: 0, g: 0, r: 0 },
                    channels: 4,
                    height: pageAtlas.height,
                    width: pageAtlas.width,
                },
            }).composite(pageComposites[page.index] ?? []);

            await Promise.all([
                atlasImage.clone().png().toFile(outputPagePath),
                atlasImage
                    .clone()
                    .webp({ quality: webpQuality })
                    .toFile(outputPageWebpPath),
            ]);
        }),
    );

    await removeStalePageImages({
        outputPngPath,
        outputWebpPath,
        pageCount,
        previousManifest,
    });
    await writeFile(outputJsonPath, JSON.stringify(manifest, null, 4));

    console.info(
        `Created ${pageCount} atlas page(s) with ${inputFiles.length} sprites using stable slot assignment:`,
    );
    for (const page of manifest.pages) {
        console.info(
            `  PNG:  ${path.relative(repositoryRoot, getPagePngPath(outputPngPath, page.index))} (${page.spriteCount} sprites)`,
        );
        console.info(
            `  WEBP: ${path.relative(repositoryRoot, getPageWebpPath(outputWebpPath, page.index))} (${page.spriteCount} sprites)`,
        );
    }
    console.info(`  JSON: ${path.relative(repositoryRoot, outputJsonPath)}`);
    console.info(
        `  Grid: ${gridLayout.columns}x${gridLayout.rows} @ ${gridLayout.cellSize}px cells with ${pageAtlas.padding}px padding (${gridLayout.pageCapacity} sprites per page)`,
    );
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
